-- Nachtrag zu 2026-11-04_admin_edit_delete_match.sql: Die DISZIPLIN eines Matches mit
-- Protokoll (run_log, 14/1) darf der Admin jetzt auch aendern; nur das Ergebnis bleibt
-- dort gesperrt (es ergibt sich aus dem Protokoll). Sonst unveraendert. Test, dann Produktion. Idempotent.

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
     and (p_score1 <> v_old.score1 or p_score2 <> v_old.score2) then
    raise exception 'Das Ergebnis eines Matches mit Protokoll kann nicht geändert werden.';
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

revoke all on function public.admin_update_match(uuid, integer, integer, text, timestamptz) from public, anon;
grant execute on function public.admin_update_match(uuid, integer, integer, text, timestamptz) to authenticated;
