-- Gaeste OHNE Konto im Turnier (Nutzer-Wunsch 2026-10-27): wer ueber den Einladungslink als Gast mitspielt, hat keinen Login. Damit er
-- trotzdem seine Anmeldung zuruecknehmen, "Du bist dran" sehen, sein Match mitzaehlen/melden und bestaetigen kann (auch Gast gegen Gast),
-- bekommt er beim Beitritt ein geheimes Zeichen (Token). Es liegt nur im Browser des Gastes; alle Aufrufe laufen ueber Funktionen, die das
-- Token pruefen. Das Token gilt nur fuer DIESES Turnier und nur fuer die beiden eigenen Partien. Die Tabelle ist fuer Clients gesperrt.
-- Ergaenzt 2026-10-29_tournament_invite.sql (tournament_join_guest wird ersetzt und liefert jetzt das Token).
--
-- Test, dann Produktion. Idempotent.

create table if not exists public.tournament_guest_tokens (
  token         text primary key default replace(gen_random_uuid()::text, '-', ''),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id     uuid not null references public.players(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (tournament_id, player_id)
);
alter table public.tournament_guest_tokens enable row level security;
revoke all on public.tournament_guest_tokens from anon, authenticated;
grant select, insert, update, delete on public.tournament_guest_tokens to service_role;

-- 1) Beitritt als Gast (ersetzt die Fassung aus 2026-10-29_tournament_invite.sql): liefert zusaetzlich das Token.
--    Ist der Name im Turnier schon angemeldet, wird abgelehnt (sonst koennte jemand die Identitaet eines anderen Gastes uebernehmen).
create or replace function public.tournament_join_guest(p_tournament_id uuid, p_nickname text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tour  tournaments;
  v_nick  text := trim(coalesce(p_nickname, ''));
  v_guest players;
  v_token text;
begin
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnier nicht gefunden.'; end if;
  if v_tour.status <> 'setup' then raise exception 'Die Anmeldung für dieses Turnier ist nicht mehr offen.'; end if;
  if char_length(v_nick) < 2 or char_length(v_nick) > 30 then raise exception 'Der Name muss 2 bis 30 Zeichen lang sein.'; end if;
  if (select count(*) from tournament_players where tournament_id = p_tournament_id) >= 64 then
    raise exception 'Das Turnier ist voll.';
  end if;

  select * into v_guest from players where nickname = v_nick and is_guest;
  if found then
    if exists (select 1 from tournament_players where tournament_id = p_tournament_id and player_id = v_guest.id) then
      raise exception 'Der Name "%" ist in diesem Turnier schon angemeldet - bitte einen anderen Namen verwenden (z. B. mit Zusatz).', v_nick;
    end if;
  else
    if (select count(*) from players where is_guest and created_at > now() - interval '10 minutes') >= 40 then
      raise exception 'Gerade sehr viele Gast-Anmeldungen - bitte in ein paar Minuten nochmal versuchen.';
    end if;
    begin
      insert into players (nickname, is_guest) values (v_nick, true) returning * into v_guest;
    exception when unique_violation then
      raise exception 'Der Name "%" ist schon vergeben - bitte einen anderen Namen verwenden (z. B. mit Zusatz).', v_nick;
    end;
  end if;

  insert into tournament_players (tournament_id, player_id) values (p_tournament_id, v_guest.id) on conflict do nothing;
  insert into tournament_guest_tokens (tournament_id, player_id) values (p_tournament_id, v_guest.id)
    on conflict (tournament_id, player_id) do update set token = replace(gen_random_uuid()::text, '-', '')
    returning token into v_token;
  return jsonb_build_object('player_id', v_guest.id, 'nickname', v_guest.nickname, 'token', v_token);
end;
$function$;

-- 2) Stand fuer das Gast-Dashboard (wird alle paar Sekunden abgefragt): Turnier, Anmeldung, Teilnehmer, meine bereite Partie
--    (Tisch zugeteilt, beide Spieler stehen fest, noch kein Ergebnis) und ein Ergebnis, das noch bestaetigt werden muss.
create or replace function public.guest_tournament_state(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tok  tournament_guest_tokens;
  v_tour tournaments;
  v_me   players;
  v_ready jsonb;
  v_conf  jsonb;
begin
  select * into v_tok from tournament_guest_tokens where token = p_token;
  if not found then return null; end if;
  select * into v_tour from tournaments where id = v_tok.tournament_id;
  select * into v_me from players where id = v_tok.player_id;

  select jsonb_build_object('id', tm.id, 'table_number', tm.table_number, 'discipline', v_tour.discipline,
           'opponent', o.nickname, 'opponent_is_guest', coalesce(o.is_guest, false), 'me_is_p1', tm.player1_id = v_me.id)
    into v_ready
    from tournament_matches tm
    join players o on o.id = case when tm.player1_id = v_me.id then tm.player2_id else tm.player1_id end
   where tm.tournament_id = v_tour.id and v_tour.status = 'running'
     and v_me.id in (tm.player1_id, tm.player2_id) and tm.player1_id is not null and tm.player2_id is not null
     and not tm.is_bye and not coalesce(tm.void, false) and tm.match_id is null and tm.table_number is not null
   order by tm.round, tm.id limit 1;

  select jsonb_build_object('id', tm.id, 'opponent', o.nickname, 'reported_by_me', m.reported_by = v_me.id,
           'score_me', case when m.player1_id = v_me.id then m.score1 else m.score2 end,
           'score_opp', case when m.player1_id = v_me.id then m.score2 else m.score1 end)
    into v_conf
    from tournament_matches tm
    join matches m on m.id = tm.match_id
    join players o on o.id = case when tm.player1_id = v_me.id then tm.player2_id else tm.player1_id end
   where tm.tournament_id = v_tour.id and v_me.id in (tm.player1_id, tm.player2_id) and not m.confirmed
   order by tm.round, tm.id limit 1;

  return jsonb_build_object(
    'me', jsonb_build_object('id', v_me.id, 'nickname', v_me.nickname),
    'registered', exists (select 1 from tournament_players where tournament_id = v_tour.id and player_id = v_me.id),
    'tournament', jsonb_build_object('id', v_tour.id, 'name', v_tour.name, 'status', v_tour.status, 'discipline', v_tour.discipline,
                                     'format', v_tour.format, 'organizer', (select nickname from players where id = v_tour.organizer_id)),
    'roster', coalesce((select jsonb_agg(jsonb_build_object('nickname', p.nickname, 'is_guest', coalesce(p.is_guest, false)) order by p.nickname)
                          from tournament_players tp join players p on p.id = tp.player_id where tp.tournament_id = v_tour.id), '[]'::jsonb),
    'ready', v_ready,
    'confirm', v_conf
  );
end;
$function$;

-- 3) Anmeldung zuruecknehmen: nur in der Anmeldephase.
create or replace function public.guest_withdraw(p_token text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tok tournament_guest_tokens;
  v_tour tournaments;
begin
  select * into v_tok from tournament_guest_tokens where token = p_token;
  if not found then raise exception 'Ungültiger Gast-Zugang.'; end if;
  select * into v_tour from tournaments where id = v_tok.tournament_id;
  if v_tour.status <> 'setup' then raise exception 'Abmelden ist nach Turnierstart nicht mehr möglich.'; end if;
  delete from tournament_players where tournament_id = v_tok.tournament_id and player_id = v_tok.player_id;
end;
$function$;

-- 4) Ergebnis der eigenen Turnierpartie melden (wie tournament_report_match, aber ueber das Token). Das Ergebnis ist danach noch
--    UNBESTAETIGT; bestaetigen kann es der Gegner oder derselbe Gast direkt danach (guest_confirm_match).
create or replace function public.guest_report_match(p_token text, p_tournament_match_id uuid, p_my_score integer, p_opp_score integer)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tok  tournament_guest_tokens;
  v_tm   tournament_matches;
  v_tour tournaments;
  v_opp  uuid;
  v_row  matches;
begin
  select * into v_tok from tournament_guest_tokens where token = p_token;
  if not found then raise exception 'Ungültiger Gast-Zugang.'; end if;
  select * into v_tm from tournament_matches where id = p_tournament_match_id;
  if not found or v_tm.tournament_id <> v_tok.tournament_id then raise exception 'Turnier-Match nicht gefunden.'; end if;
  if v_tm.is_bye then raise exception 'Dieses Match ist ein Freilos.'; end if;
  if coalesce(v_tm.void, false) then raise exception 'Für dieses Match wurde ein Nichterscheinen gemeldet.'; end if;
  if v_tm.match_id is not null then raise exception 'Für dieses Match wurde bereits ein Ergebnis gemeldet.'; end if;
  if v_tm.player1_id is null or v_tm.player2_id is null then raise exception 'Die Paarung steht noch nicht fest.'; end if;
  if v_tok.player_id not in (v_tm.player1_id, v_tm.player2_id) then raise exception 'Nur die beiden Spieler dieses Matches können das Ergebnis melden.'; end if;
  if p_my_score is null or p_opp_score is null or p_my_score < 0 or p_opp_score < 0 then raise exception 'Ungültiges Ergebnis.'; end if;
  if p_my_score = p_opp_score then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;
  select * into v_tour from tournaments where id = v_tm.tournament_id;
  if v_tour.status <> 'running' then raise exception 'Dieses Turnier ist nicht mehr aktiv.'; end if;
  v_opp := case when v_tok.player_id = v_tm.player1_id then v_tm.player2_id else v_tm.player1_id end;

  insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed, tournament_id)
  values (v_tok.player_id, v_opp, p_my_score, p_opp_score, v_tour.discipline, v_tok.player_id, false, v_tour.id)
  returning * into v_row;

  update tournament_matches set match_id = v_row.id where id = p_tournament_match_id;
  perform tournament_assign_free_tables(v_tour.id);
end;
$function$;

-- 5) Ergebnis der eigenen Partie bestaetigen (beide Spieler, auch der Meldende direkt danach auf demselben Geraet - wie
--    tournament_confirm_own_match bei Mitgliedern).
create or replace function public.guest_confirm_match(p_token text, p_tournament_match_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tok tournament_guest_tokens;
  v_tm  tournament_matches;
  v_m   matches;
begin
  select * into v_tok from tournament_guest_tokens where token = p_token;
  if not found then raise exception 'Ungültiger Gast-Zugang.'; end if;
  select * into v_tm from tournament_matches where id = p_tournament_match_id;
  if not found or v_tm.tournament_id <> v_tok.tournament_id then raise exception 'Turnier-Match nicht gefunden.'; end if;
  if v_tok.player_id not in (v_tm.player1_id, v_tm.player2_id) then raise exception 'Nur die beiden Spieler dieses Matches können bestätigen.'; end if;
  if v_tm.match_id is null then raise exception 'Für dieses Match wurde noch kein Ergebnis gemeldet.'; end if;
  select * into v_m from matches where id = v_tm.match_id;
  if v_m.confirmed then return; end if;
  update matches set confirmed = true, confirmed_by = v_tok.player_id where id = v_m.id;
end;
$function$;

revoke all on function public.tournament_join_guest(uuid, text) from public;
revoke all on function public.guest_tournament_state(text) from public;
revoke all on function public.guest_withdraw(text) from public;
revoke all on function public.guest_report_match(text, uuid, integer, integer) from public;
revoke all on function public.guest_confirm_match(text, uuid) from public;
grant execute on function public.tournament_join_guest(uuid, text) to anon, authenticated;
grant execute on function public.guest_tournament_state(text) to anon, authenticated;
grant execute on function public.guest_withdraw(text) to anon, authenticated;
grant execute on function public.guest_report_match(text, uuid, integer, integer) to anon, authenticated;
grant execute on function public.guest_confirm_match(text, uuid) to anon, authenticated;

select proname from pg_proc where proname like 'guest\_%' or proname = 'tournament_join_guest';
