-- Einladungs-QR fuer Winner-Stays-Runden (Nutzer-Wunsch 2026-10-27): Link /?ws=<Runden-id>, auch NACH dem Start der Runde gueltig (Winner Stays
-- laeuft, solange jemand spielt). Mitglieder reihen sich per Scan selbst ans Ende der Warteschlange ein; wer kein Konto hat, kann sich mit nur
-- einem Namen als Gast einreihen (geheimes Zeichen im Browser, wie bei Turnieren: 2026-10-29b_guest_tournament.sql). Der Gast sieht seinen Platz,
-- bekommt "Du bist dran" und kann sich abmelden, solange er nicht am Tisch steht. Ergebnisse tragen wie bisher die Spieler am Tisch (Mitglieder)
-- oder die Leitung ein. Nur Einzel-Runden: bei einem Doppel braucht ein Team zwei Personen, das reiht weiter die Leitung ein.
--
-- Test, dann Produktion. Idempotent. Als GANZE Datei ausfuehren.

create table if not exists public.winner_stays_guest_tokens (
  token      text primary key default replace(gen_random_uuid()::text, '-', ''),
  session_id uuid not null references public.winner_stays_sessions(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, player_id)
);
alter table public.winner_stays_guest_tokens enable row level security;
revoke all on public.winner_stays_guest_tokens from anon, authenticated;
grant select, insert, update, delete on public.winner_stays_guest_tokens to service_role;

-- 1) Mitglied reiht sich selbst ein (idempotent: wer schon drin ist, bleibt wo er ist).
create or replace function public.winner_stays_join_self(p_session_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
  v_next int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;
  if v_sess.is_doubles then raise exception 'Diese Runde ist ein Doppel - bitte bei der Leitung als Team melden.'; end if;
  if exists (select 1 from players where id = v_me and coalesce(is_ghost, false)) then raise exception 'Der Ghost kann hier nicht mitspielen.'; end if;
  if exists (select 1 from winner_stays_entries where session_id = p_session_id and (player1_id = v_me or player2_id = v_me)) then return; end if;
  select coalesce(max(queue_position), -1) + 1 into v_next from winner_stays_entries where session_id = p_session_id;
  insert into winner_stays_entries (session_id, player1_id, queue_position) values (p_session_id, v_me, v_next);
end;
$function$;

-- 2) Infos fuer die Einladungsseite (ohne Login), inkl. Einladungscode der Leitung als Werbe-Code.
create or replace function public.winner_stays_invite_info(p_session_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_sess winner_stays_sessions;
  v_org players;
  v_code text;
begin
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then return null; end if;
  select * into v_org from players where id = v_sess.organizer_id;
  if v_sess.status = 'running' and v_org.id is not null and not coalesce(v_org.is_guest, false) and not coalesce(v_org.is_ghost, false) then
    select code into v_code from invites where inviter_id = v_org.id and revoked_at is null order by created_at desc limit 1;
    if v_code is null then
      v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      insert into invites (code, inviter_id) values (v_code, v_org.id);
    end if;
  end if;
  return jsonb_build_object('id', v_sess.id, 'name', v_sess.name, 'discipline', v_sess.discipline, 'status', v_sess.status,
    'is_doubles', v_sess.is_doubles, 'organizer', v_org.nickname, 'ref', v_code,
    'players', (select count(*) from winner_stays_entries where session_id = v_sess.id));
end;
$function$;

-- 3) Gast ohne Konto reiht sich mit einem Namen ein und bekommt das geheime Zeichen.
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

  select * into v_guest from players where nickname = v_nick and is_guest;
  if found then
    if exists (select 1 from winner_stays_entries where session_id = p_session_id and player1_id = v_guest.id) then
      raise exception 'Der Name "%" ist in dieser Runde schon dabei - bitte einen anderen Namen verwenden (z. B. mit Zusatz).', v_nick;
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

  select coalesce(max(queue_position), -1) + 1 into v_next from winner_stays_entries where session_id = p_session_id;
  insert into winner_stays_entries (session_id, player1_id, queue_position) values (p_session_id, v_guest.id, v_next);
  insert into winner_stays_guest_tokens (session_id, player_id) values (p_session_id, v_guest.id)
    on conflict (session_id, player_id) do update set token = replace(gen_random_uuid()::text, '-', '')
    returning token into v_token;
  return jsonb_build_object('player_id', v_guest.id, 'nickname', v_guest.nickname, 'token', v_token);
end;
$function$;

-- 4) Stand fuer das Gast-Dashboard: mein Platz, wer am Tisch steht, die Warteschlange.
create or replace function public.guest_ws_state(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tok winner_stays_guest_tokens;
  v_sess winner_stays_sessions;
  v_me winner_stays_entries;
begin
  select * into v_tok from winner_stays_guest_tokens where token = p_token;
  if not found then return null; end if;
  select * into v_sess from winner_stays_sessions where id = v_tok.session_id;
  select * into v_me from winner_stays_entries where session_id = v_sess.id and player1_id = v_tok.player_id;
  return jsonb_build_object(
    'me', (select nickname from players where id = v_tok.player_id),
    'session', jsonb_build_object('id', v_sess.id, 'name', v_sess.name, 'status', v_sess.status, 'discipline', v_sess.discipline,
      'table_number', v_sess.table_number, 'organizer', (select nickname from players where id = v_sess.organizer_id)),
    'in_queue', v_me.id is not null,
    'position', v_me.queue_position,
    'at_table', coalesce(v_me.queue_position, 99) <= 1,
    'wins', v_me.wins, 'losses', v_me.losses, 'streak', v_me.streak,
    'opponent', case when v_me.id is null or v_me.queue_position > 1 then null
      else (select p.nickname from winner_stays_entries e join players p on p.id = e.player1_id
             where e.session_id = v_sess.id and e.queue_position = 1 - v_me.queue_position) end,
    'queue', coalesce((select jsonb_agg(jsonb_build_object('nickname', p.nickname, 'position', e.queue_position, 'is_guest', coalesce(p.is_guest, false))
                                          order by e.queue_position)
                         from winner_stays_entries e join players p on p.id = e.player1_id where e.session_id = v_sess.id), '[]'::jsonb));
end;
$function$;

-- 5) Gast nimmt sich aus der Schlange, solange er nicht am Tisch steht (und mindestens zwei Personen bleiben).
create or replace function public.guest_ws_withdraw(p_token text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tok winner_stays_guest_tokens;
  v_e winner_stays_entries;
begin
  select * into v_tok from winner_stays_guest_tokens where token = p_token;
  if not found then raise exception 'Ungültiger Gast-Zugang.'; end if;
  select * into v_e from winner_stays_entries where session_id = v_tok.session_id and player1_id = v_tok.player_id;
  if not found then return; end if;
  if v_e.queue_position <= 1 then raise exception 'Du stehst gerade am Tisch - bitte erst das Spiel beenden.'; end if;
  delete from winner_stays_entries where id = v_e.id;
  update winner_stays_entries set queue_position = queue_position - 1 where session_id = v_tok.session_id and queue_position > v_e.queue_position;
end;
$function$;

revoke all on function public.winner_stays_join_self(uuid) from public;
revoke all on function public.winner_stays_invite_info(uuid) from public;
revoke all on function public.winner_stays_join_guest(uuid, text) from public;
revoke all on function public.guest_ws_state(text) from public;
revoke all on function public.guest_ws_withdraw(text) from public;
grant execute on function public.winner_stays_join_self(uuid) to authenticated;
grant execute on function public.winner_stays_invite_info(uuid) to anon, authenticated;
grant execute on function public.winner_stays_join_guest(uuid, text) to anon, authenticated;
grant execute on function public.guest_ws_state(text) to anon, authenticated;
grant execute on function public.guest_ws_withdraw(text) to anon, authenticated;

select proname from pg_proc where proname in ('winner_stays_join_self', 'winner_stays_invite_info', 'winner_stays_join_guest', 'guest_ws_state', 'guest_ws_withdraw');
