-- Gast wird zum echten Konto (Nutzer 2026-11-09): wer als Gast gespielt hat, kann sich nach seinen Matches registrieren und bekommt dabei
-- ALLE Matches des Gastes (Match-Modus, Turnier, Winner Stays) in sein neues Konto - sie zaehlen fuer Statistik, Rangliste und Erfolge.
-- Ablauf: Der Gast bekommt einen geheimen Uebernahme-Code (guest_claims). Er steckt im Link /?claim=CODE (QR am Handy des Mitglieds bzw.
-- Knopf im Gast-Dashboard). Nach Anmeldung/Registrierung loest die App ihn mit claim_guest() ein: Alle Verweise auf den Gast werden auf den
-- neuen Spieler umgeschrieben, der Gast verschwindet. Die Matches werden mit EINEM UPDATE umgeschrieben - das loest genau einen Rating-Neuaufbau
-- aus (und holt die Gast-Matches in Rangliste und Erfolge, weil kein Beteiligter mehr Gast ist).
--
-- Test, dann Produktion. Idempotent. Als GANZE Datei ausfuehren.

create table if not exists public.guest_claims (
  token      text primary key default replace(gen_random_uuid()::text, '-', ''),
  guest_id   uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists guest_claims_guest_idx on public.guest_claims (guest_id);
alter table public.guest_claims enable row level security;
revoke all on public.guest_claims from anon, authenticated;
grant select, insert, update, delete on public.guest_claims to service_role;

-- Code fuer einen Gast holen/erneuern (intern)
create or replace function public.guest_claim_token_for(p_guest uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_tok text;
begin
  select token into v_tok from guest_claims where guest_id = p_guest and created_at > now() - interval '30 days' order by created_at desc limit 1;
  if v_tok is null then
    insert into guest_claims (guest_id) values (p_guest) returning token into v_tok;
  end if;
  return v_tok;
end;
$function$;
revoke all on function public.guest_claim_token_for(uuid) from public;

-- (a) Mitglied zeigt den Code seines Gast-Gegners/-Partners (QR am eigenen Handy): nur wer mit dem Gast ein Match hatte
create or replace function public.guest_claim_code_member(p_guest uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_me uuid := current_player_id();
begin
  if v_me is null then raise exception 'Nicht angemeldet.'; end if;
  if not exists (select 1 from players where id = p_guest and is_guest) then raise exception 'Das ist kein Gast.'; end if;
  if not exists (select 1 from matches m where p_guest in (m.player1_id, m.player2_id, m.player1b_id, m.player2b_id)
                                          and v_me in (m.player1_id, m.player2_id, m.player1b_id, m.player2b_id, m.reported_by))
     and not exists (select 1 from tournament_players tp join tournaments t on t.id = tp.tournament_id
                      where tp.player_id = p_guest and (t.organizer_id = v_me or is_admin()))
     and not exists (select 1 from winner_stays_entries e join winner_stays_sessions s on s.id = e.session_id
                      where p_guest in (e.player1_id, e.player2_id) and (s.organizer_id = v_me or is_admin())) then
    raise exception 'Keine Berechtigung.';
  end if;
  return guest_claim_token_for(p_guest);
end;
$function$;

-- (b) Gast mit eigenem Zugang (Turnier/Winner Stays, ohne Konto) holt seinen Code mit seinem Zugangs-Token
create or replace function public.guest_claim_code_token(p_token text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_guest uuid;
begin
  select player_id into v_guest from tournament_guest_tokens where token = p_token;
  if v_guest is null then select player_id into v_guest from winner_stays_guest_tokens where token = p_token; end if;
  if v_guest is null then raise exception 'Zugang ungültig.'; end if;
  return guest_claim_token_for(v_guest);
end;
$function$;

-- Einloesen: der angemeldete (echte) Spieler uebernimmt alles vom Gast. Liefert die Zahl der uebernommenen Matches.
create or replace function public.claim_guest(p_claim text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me    uuid := current_player_id();
  v_g     uuid;
  v_name  text;
  v_n     int;
begin
  if v_me is null then raise exception 'Nicht angemeldet.'; end if;
  if exists (select 1 from players where id = v_me and is_guest) then raise exception 'Nur mit einem echten Konto möglich.'; end if;
  select c.guest_id, p.nickname into v_g, v_name
    from guest_claims c join players p on p.id = c.guest_id
   where c.token = p_claim and c.created_at > now() - interval '30 days' and p.is_guest;
  if v_g is null then raise exception 'Dieser Code ist nicht mehr gültig.'; end if;

  -- wer selbst im selben Match / Turnier / in derselben Runde war, kann nicht "der Gast" sein
  if exists (select 1 from matches m where v_g in (m.player1_id, m.player2_id, m.player1b_id, m.player2b_id)
                                       and v_me in (m.player1_id, m.player2_id, m.player1b_id, m.player2b_id))
     or exists (select 1 from tournament_players a join tournament_players b on a.tournament_id = b.tournament_id
                 where a.player_id = v_g and b.player_id = v_me)
     or exists (select 1 from winner_stays_entries a join winner_stays_entries b on a.session_id = b.session_id
                 where v_g in (a.player1_id, a.player2_id) and v_me in (b.player1_id, b.player2_id)) then
    raise exception 'Du warst selbst im selben Match oder Turnier dabei - das ist nicht dein Gast-Zugang.';
  end if;

  -- Matches: ein einziges UPDATE (= ein Rating-Neuaufbau)
  update matches set
    player1_id  = case when player1_id  = v_g then v_me else player1_id  end,
    player2_id  = case when player2_id  = v_g then v_me else player2_id  end,
    player1b_id = case when player1b_id = v_g then v_me else player1b_id end,
    player2b_id = case when player2b_id = v_g then v_me else player2b_id end,
    reported_by = case when reported_by = v_g then v_me else reported_by end,
    confirmed_by = case when confirmed_by = v_g then v_me else confirmed_by end
  where v_g in (player1_id, player2_id, player1b_id, player2b_id, reported_by, confirmed_by);
  get diagnostics v_n = row_count;

  update match_confirmations set player_id = v_me where player_id = v_g and not exists (select 1 from match_confirmations x where x.match_id = match_confirmations.match_id and x.player_id = v_me);
  delete from match_confirmations where player_id = v_g;

  update tournament_matches set
    player1_id = case when player1_id = v_g then v_me else player1_id end,
    player2_id = case when player2_id = v_g then v_me else player2_id end,
    winner_id  = case when winner_id  = v_g then v_me else winner_id  end
  where v_g in (player1_id, player2_id, winner_id);
  update tournament_players set player_id = v_me where player_id = v_g;
  update winner_stays_entries set player1_id = v_me where player1_id = v_g;
  update winner_stays_entries set player2_id = v_me where player2_id = v_g;
  update winner_stays_games set reported_by = v_me where reported_by = v_g;

  delete from players where id = v_g;   -- Zugangs-Tokens und Codes gehen per cascade mit
  return jsonb_build_object('matches', v_n, 'name', v_name);
end;
$function$;

revoke all on function public.guest_claim_code_member(uuid) from public;
revoke all on function public.guest_claim_code_token(text) from public;
revoke all on function public.claim_guest(text) from public;
grant execute on function public.guest_claim_code_member(uuid) to authenticated;
grant execute on function public.guest_claim_code_token(text) to anon, authenticated;
grant execute on function public.claim_guest(text) to authenticated;

select proname from pg_proc where proname in ('guest_claim_code_member', 'guest_claim_code_token', 'claim_guest');
