-- Gaeste sind keine wiederverwendbaren Personen (Nutzer 2026-11-09): "David" oder "Sandra" gibt es viele, ohne E-Mail sind sie nicht eindeutig.
-- Bisher wurde ein Gast nach NAMEN wiedergefunden (add_guest_player, tournament_join_guest, winner_stays_join_guest, ...). Dadurch teilten sich
-- verschiedene Menschen dieselbe Gast-Zeile, und ein zweiter "David" im selben Turnier oder ein Mitglied gleichen Namens wurde abgewiesen.
-- Jetzt: JEDER Auftritt legt eine neue Gast-Zeile an; ist der Name belegt, heisst er automatisch "David 2", "David 3" ... (Spitzname ist citext,
-- Gross-/Kleinschreibung egal). Wer sich ein zweites Mal als Gast anmeldet, ist damit ein NEUER Gast (der alte Zugang gilt nur in seinem Browser).
-- Aufraeumen: cleanup_guests() loescht Gaeste, die nirgends vorkommen (kein Match, keine Turnier-/Runden-Anmeldung) und aelter als ein Tag sind;
-- wer gespielt hat, bleibt nur als Name im Protokoll (die Zeile haengt an den Matches), taucht aber nirgends in Listen oder Auswahl auf.
--
-- Test, dann Produktion. Idempotent. Als GANZE Datei ausfuehren.

-- 1) Freier Name: "David", sonst "David 2", "David 3" ... (max. 30 Zeichen)
create or replace function public.guest_free_name(p_base text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_base text := left(trim(coalesce(p_base, '')), 30);
  v_try  text := v_base;
  n      int := 1;
begin
  while exists (select 1 from players where nickname = v_try) loop
    n := n + 1;
    v_try := left(v_base, 30 - char_length(' ' || n::text)) || ' ' || n::text;
  end loop;
  return v_try;
end;
$function$;

revoke all on function public.guest_free_name(text) from public;

-- 2) Match / Doppel / Winner-Stays-Partner: immer ein neuer Gast
create or replace function public.add_guest_player(p_nickname text)
 returns players
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me   uuid := current_player_id();
  v_nick text := trim(coalesce(p_nickname, ''));
  v_guest players;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  if v_nick = '' then raise exception 'Name fehlt.'; end if;
  if char_length(v_nick) > 30 then raise exception 'Name ist zu lang (max. 30 Zeichen).'; end if;
  if (select count(*) from players where is_guest and created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Gerade sehr viele Gast-Anmeldungen - bitte in ein paar Minuten nochmal versuchen.';
  end if;
  insert into players (nickname, is_guest) values (guest_free_name(v_nick), true) returning * into v_guest;
  return v_guest;
end;
$function$;

-- 3) Turnier per Einladungslink als Gast
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
  if (select count(*) from players where is_guest and created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Gerade sehr viele Gast-Anmeldungen - bitte in ein paar Minuten nochmal versuchen.';
  end if;

  insert into players (nickname, is_guest) values (guest_free_name(v_nick), true) returning * into v_guest;
  insert into tournament_players (tournament_id, player_id) values (p_tournament_id, v_guest.id) on conflict do nothing;
  insert into tournament_guest_tokens (tournament_id, player_id) values (p_tournament_id, v_guest.id)
    on conflict (tournament_id, player_id) do update set token = replace(gen_random_uuid()::text, '-', '')
    returning token into v_token;
  return jsonb_build_object('player_id', v_guest.id, 'nickname', v_guest.nickname, 'token', v_token);
end;
$function$;

-- 4) Winner-Stays-Runde per Einladungslink als Gast
create or replace function public.winner_stays_join_guest(p_session_id uuid, p_nickname text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_sess winner_stays_sessions;
  v_nick text := trim(coalesce(p_nickname, ''));
  v_guest players;
  v_next int;
  v_token text;
begin
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;
  if v_sess.is_doubles then raise exception 'Diese Runde ist ein Doppel - bitte bei der Leitung als Team melden.'; end if;
  if char_length(v_nick) < 2 or char_length(v_nick) > 30 then raise exception 'Der Name muss 2 bis 30 Zeichen lang sein.'; end if;
  if (select count(*) from winner_stays_entries where session_id = p_session_id) >= 64 then raise exception 'Die Runde ist voll.'; end if;
  if (select count(*) from players where is_guest and created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Gerade sehr viele Gast-Anmeldungen - bitte in ein paar Minuten nochmal versuchen.';
  end if;

  insert into players (nickname, is_guest) values (guest_free_name(v_nick), true) returning * into v_guest;
  select coalesce(max(queue_position), -1) + 1 into v_next from winner_stays_entries where session_id = p_session_id;
  insert into winner_stays_entries (session_id, player1_id, queue_position) values (p_session_id, v_guest.id, v_next);
  insert into winner_stays_guest_tokens (session_id, player_id) values (p_session_id, v_guest.id)
    on conflict (session_id, player_id) do update set token = replace(gen_random_uuid()::text, '-', '')
    returning token into v_token;
  return jsonb_build_object('player_id', v_guest.id, 'nickname', v_guest.nickname, 'token', v_token);
end;
$function$;

-- 5) Turnierleitung / Rundenleitung traegt einen Gast ein: ebenfalls immer neu
create or replace function public.tournament_organizer_add_guest(p_tournament_id uuid, p_nickname text)
returns players
language sql
security definer
set search_path = public
as $$
  with ok as (
    select trim(p_nickname) as nick from tournaments
     where id = p_tournament_id and status = 'setup' and current_player_id() is not null
       and (is_admin() or organizer_id = current_player_id())
       and char_length(trim(coalesce(p_nickname, ''))) between 1 and 30
  ),
  g as (
    insert into players (nickname, is_guest)
    select guest_free_name(ok.nick), true from ok
     where (select count(*) from players where is_guest and created_at > now() - interval '10 minutes') < 40
    returning *
  ),
  reg as (
    insert into tournament_players (tournament_id, player_id)
    select p_tournament_id, g.id from g
    returning 1
  )
  select * from g
$$;

create or replace function public.winner_stays_add_guest(p_session_id uuid, p_nickname text)
returns players
language sql
security definer
set search_path = public
as $$
  with ok as (
    select trim(p_nickname) as nick from winner_stays_sessions
     where id = p_session_id and status = 'running' and not is_doubles and current_player_id() is not null
       and (is_admin() or organizer_id = current_player_id())
       and char_length(trim(coalesce(p_nickname, ''))) between 1 and 30
  ),
  g as (
    insert into players (nickname, is_guest)
    select guest_free_name(ok.nick), true from ok
     where (select count(*) from players where is_guest and created_at > now() - interval '10 minutes') < 40
    returning *
  ),
  reg as (
    insert into winner_stays_entries (session_id, player1_id, queue_position)
    select p_session_id, g.id, coalesce((select max(queue_position) from winner_stays_entries where session_id = p_session_id), -1) + 1
      from g
    returning 1
  )
  select * from g
$$;

revoke all on function public.tournament_organizer_add_guest(uuid, text) from public;
grant execute on function public.tournament_organizer_add_guest(uuid, text) to authenticated;
revoke all on function public.winner_stays_add_guest(uuid, text) from public;
grant execute on function public.winner_stays_add_guest(uuid, text) to authenticated;
grant execute on function public.tournament_join_guest(uuid, text) to anon, authenticated;
grant execute on function public.winner_stays_join_guest(uuid, text) to anon, authenticated;

-- 6) Aufraeumen: Gaeste, die nirgends vorkommen (nie gespielt, in keinem Turnier/keiner Runde), nach einem Tag loeschen.
--    Wer gespielt hat, bleibt als Name im Protokoll (seine Zeile haengt an den Matches), erscheint aber in keiner Liste.
create or replace function public.cleanup_guests()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_n integer;
begin
  with gone as (
    delete from players p
     where p.is_guest
       and p.created_at < now() - interval '1 day'
       and not exists (select 1 from matches m where p.id in (m.player1_id, m.player2_id, m.player1b_id, m.player2b_id))
       and not exists (select 1 from tournament_players tp where tp.player_id = p.id)
       and not exists (select 1 from winner_stays_entries e where p.id in (e.player1_id, e.player2_id))
    returning 1
  )
  select count(*) into v_n from gone;
  return v_n;
end;
$function$;

revoke all on function public.cleanup_guests() from public;
grant execute on function public.cleanup_guests() to service_role;

-- die naechtliche Auffrischung (nightly_refresh) raeumt ab jetzt mit auf (Rumpf sonst unveraendert, siehe 2026-09-24d)
create or replace function public.nightly_refresh()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform pg_advisory_xact_lock(hashtext('rebuild_ratings'));
  perform rebuild_elo();
  perform snapshot_ratings();
  perform cleanup_guests();
end;
$function$;

select public.cleanup_guests() as geloeschte_ungenutzte_gaeste;
