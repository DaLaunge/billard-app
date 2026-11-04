-- Admin: Matches nachtraeglich aendern und loeschen.
--
-- Zwei RPCs (SECURITY DEFINER, beide pruefen is_admin() ZUERST):
--   admin_update_match(p_match, p_score1, p_score2, p_discipline, p_played_at)
--   admin_delete_match(p_match)
-- Vorsichtsmassnahmen:
--  * nur Admins; jede Aenderung/Loeschung wird mit dem alten Stand in
--    admin_match_audit festgehalten (nur ueber die RPCs lesbar/schreibbar),
--  * Turnier- und Winner-Stays-Matches sind gesperrt (tournament_matches /
--    winner_stays_entries verweisen darauf, ein Eingriff wuerde Tabelle und
--    Statistik auseinanderlaufen lassen),
--  * Ergebnis und Disziplin eines Matches mit Protokoll (run_log, 14/1) sind
--    gesperrt - das Ergebnis ergibt sich dort aus dem Protokoll; loeschen geht,
--  * Ergebnis: keine Negativwerte, kein Unentschieden.
-- Die Neuberechnung von Rating/Erfolgen laeuft wie immer ueber den Statement-
-- Trigger auf matches (inkl. Advisory-Lock); geloeschte IDs landen ueber den
-- vorhandenen Trigger in deleted_matches, Geraete gleichen sich per
-- matches_sync() ab. rating_snapshots vergangener Tage werden NICHT
-- umgeschrieben (der Verlauf bleibt wie er war, das aktuelle Rating stimmt).
-- Test, dann Produktion. Idempotent.

create table if not exists public.admin_match_audit (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  admin_id   uuid,
  action     text not null check (action in ('update', 'delete')),
  match_id   uuid not null,
  old_row    jsonb not null,
  new_values jsonb
);
alter table public.admin_match_audit enable row level security;
-- bewusst keine Policy und kein Grant fuer Clients: Zugriff nur ueber SECURITY DEFINER bzw. Dashboard
grant select, insert on public.admin_match_audit to service_role;
grant usage, select on sequence public.admin_match_audit_id_seq to service_role;

create or replace function public.admin_update_match(
  p_match uuid, p_score1 integer, p_score2 integer,
  p_discipline text, p_played_at timestamptz
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_old matches;
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  select * into v_old from matches where id = p_match;
  if not found then raise exception 'Match nicht gefunden.'; end if;
  if v_old.tournament_id is not null or v_old.winner_stays_session_id is not null then
    raise exception 'Turnier- und Winner-Stays-Matches können hier nicht geändert werden.';
  end if;
  if p_score1 is null or p_score2 is null or p_score1 < 0 or p_score2 < 0 then
    raise exception 'Ungültiges Ergebnis.';
  end if;
  if p_score1 = p_score2 then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;
  if coalesce(trim(p_discipline), '') = '' then raise exception 'Disziplin fehlt.'; end if;
  if p_played_at is null or p_played_at > now() + interval '1 day' then
    raise exception 'Ungültiges Datum.';
  end if;
  if v_old.run_log is not null
     and (p_score1 <> v_old.score1 or p_score2 <> v_old.score2 or trim(p_discipline) <> v_old.discipline) then
    raise exception 'Ergebnis und Disziplin eines Matches mit Protokoll können nicht geändert werden.';
  end if;
  if p_score1 = v_old.score1 and p_score2 = v_old.score2
     and trim(p_discipline) = v_old.discipline and p_played_at = v_old.played_at then
    return;  -- nichts zu tun, keine Neuberechnung
  end if;

  insert into admin_match_audit (admin_id, action, match_id, old_row, new_values)
  values (current_player_id(), 'update', p_match, to_jsonb(v_old),
          jsonb_build_object('score1', p_score1, 'score2', p_score2,
                             'discipline', trim(p_discipline), 'played_at', p_played_at));

  update matches
     set score1 = p_score1, score2 = p_score2,
         discipline = trim(p_discipline), played_at = p_played_at,
         updated_at = now()
   where id = p_match;
end;
$function$;

create or replace function public.admin_delete_match(p_match uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_old matches;
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  select * into v_old from matches where id = p_match;
  if not found then raise exception 'Match nicht gefunden.'; end if;
  if v_old.tournament_id is not null or v_old.winner_stays_session_id is not null then
    raise exception 'Turnier- und Winner-Stays-Matches können hier nicht gelöscht werden.';
  end if;

  insert into admin_match_audit (admin_id, action, match_id, old_row)
  values (current_player_id(), 'delete', p_match, to_jsonb(v_old));

  delete from matches where id = p_match;
end;
$function$;

revoke all on function public.admin_update_match(uuid, integer, integer, text, timestamptz) from public, anon;
revoke all on function public.admin_delete_match(uuid) from public, anon;
grant execute on function public.admin_update_match(uuid, integer, integer, text, timestamptz) to authenticated;
grant execute on function public.admin_delete_match(uuid) to authenticated;
