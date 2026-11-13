-- Winner Stays: Teilnehmer koennen JEDERZEIT entfernt werden (bis nur noch zwei uebrig sind) - auch wenn sie schon gespielt haben.
-- Test, dann Produktion. Idempotent.
--
-- Bisher: winner_stays_remove_entry() loeschte die Zeile; winner_stays_games zeigt aber (ohne ON DELETE) auf winner_stays_entries, das DELETE
-- scheiterte also an einem Fremdschluessel, sobald die Person ein Spiel gespielt hatte - nur wer noch nie dran war, liess sich entfernen.
-- Jetzt "verlaesst" ein Teilnehmer die Runde: die Zeile bleibt (Spiele, Siege/Niederlagen und die spaetere Wertung der Paarungen bleiben erhalten),
-- bekommt left_at und eine eindeutige NEGATIVE Position (<= -1001), faellt also aus Tisch, Warteschlange und allen Zaehlungen heraus
-- (aktiv = queue_position >= 0). Dieselbe Person kann spaeter neu hinzugefuegt werden (neue Zeile, die Spiele der alten bleiben in der Wertung).
-- Aus der Regel "mindestens zwei Teilnehmer" bleibt: bis zwei uebrig sind, laeuft die Runde weiter, bis jemand dazukommt oder beendet wird.
-- Beenden: die Leitung wie bisher, zusaetzlich jeder verbliebene Teilnehmer, solange nur noch zwei aktiv sind.
-- Entfernen darf die Leitung/Admins jeden, jeder Teilnehmer sich selbst. Gast-Abmeldung (guest_ws_withdraw) nutzt dieselbe Funktion.
-- Hinweis: alle Funktionen sind mit $function$ begrenzt und im selben Stil wie die bisherigen winner_stays_*-Funktionen geschrieben.

alter table public.winner_stays_entries add column if not exists left_at timestamptz;

-- Intern: Teilnehmer aus der Runde nehmen (nicht loeschen), Warteschlange rueckt nach. Wird nur von den Funktionen unten aufgerufen.
create or replace function public.winner_stays_leave(p_entry_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_entry winner_stays_entries;
  v_left int;
begin
  select * into v_entry from winner_stays_entries where id = p_entry_id;
  if not found or v_entry.left_at is not null then return; end if;

  select least(coalesce(min(queue_position), 0), -1000) - 1 into v_left
    from winner_stays_entries where session_id = v_entry.session_id;

  update winner_stays_entries set left_at = now(), queue_position = v_left, is_paused = false where id = p_entry_id;
  update winner_stays_entries set queue_position = queue_position - 1
    where session_id = v_entry.session_id and queue_position > v_entry.queue_position;

  perform winner_stays_skip_paused(v_entry.session_id);
end;
$function$;
revoke all on function public.winner_stays_leave(uuid) from public, anon, authenticated;

create or replace function public.winner_stays_remove_entry(p_session_id uuid, p_entry_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
  v_entry winner_stays_entries;
  v_count int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;

  select * into v_entry from winner_stays_entries where id = p_entry_id and session_id = p_session_id;
  if not found then raise exception 'Teilnehmer nicht gefunden.'; end if;
  if v_entry.left_at is not null then return; end if;
  if not (is_admin() or v_sess.organizer_id = v_me or v_entry.player1_id = v_me or v_entry.player2_id = v_me) then
    raise exception 'Nur die Leitung dieser Runde oder die Person selbst kann einen Teilnehmer entfernen.';
  end if;

  select count(*) into v_count from winner_stays_entries where session_id = p_session_id and queue_position >= 0;
  if v_count <= 2 then raise exception 'Es müssen mindestens zwei Teilnehmer in der Runde bleiben.'; end if;

  perform winner_stays_leave(p_entry_id);
end;
$function$;

create or replace function public.winner_stays_report_game(p_session_id uuid, p_score_a integer, p_score_b integer)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
  v_a winner_stays_entries;
  v_b winner_stays_entries;
  v_winner winner_stays_entries;
  v_loser winner_stays_entries;
  v_game_no int;
  v_count int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;

  select * into v_a from winner_stays_entries where session_id = p_session_id and queue_position = 0;
  select * into v_b from winner_stays_entries where session_id = p_session_id and queue_position = 1;
  if v_a.id is null or v_b.id is null then
    raise exception 'Es müssen mindestens zwei Teilnehmer in der Runde sein.';
  end if;

  if not (
    is_admin() or v_sess.organizer_id = v_me
    or v_me in (v_a.player1_id, v_a.player2_id, v_b.player1_id, v_b.player2_id)
  ) then
    raise exception 'Nur die Leitung dieser Runde oder die gerade am Tisch stehenden Spieler können Ergebnisse eintragen.';
  end if;
  if p_score_a = p_score_b then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;

  if p_score_a > p_score_b then v_winner := v_a; v_loser := v_b;
  else v_winner := v_b; v_loser := v_a; end if;

  select coalesce(max(game_no), 0) + 1 into v_game_no from winner_stays_games where session_id = p_session_id;

  insert into winner_stays_games (session_id, game_no, entry_a_id, entry_b_id, score_a, score_b, winner_entry_id, reported_by)
  values (p_session_id, v_game_no, v_a.id, v_b.id, p_score_a, p_score_b, v_winner.id, v_me);

  update winner_stays_entries set wins = wins + 1, games = games + 1, streak = streak + 1,
    best_streak = greatest(best_streak, streak + 1)
    where id = v_winner.id;
  update winner_stays_entries set losses = losses + 1, games = games + 1, streak = 0
    where id = v_loser.id;

  select count(*) into v_count from winner_stays_entries where session_id = p_session_id and queue_position >= 0;
  if v_count > 2 then
    update winner_stays_entries set queue_position = -1 where id = v_loser.id;
    update winner_stays_entries set queue_position = queue_position - 1
      where session_id = p_session_id and queue_position > v_loser.queue_position;
    update winner_stays_entries set queue_position = v_count - 1 where id = v_loser.id;
  end if;

  perform winner_stays_skip_paused(p_session_id);
end;
$function$;

create or replace function public.winner_stays_report_game_core(p_session_id uuid, p_score_a integer, p_score_b integer, p_actor uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_sess winner_stays_sessions;
  v_a winner_stays_entries;
  v_b winner_stays_entries;
  v_winner winner_stays_entries;
  v_loser winner_stays_entries;
  v_game_no int;
  v_count int;
begin
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;

  select * into v_a from winner_stays_entries where session_id = p_session_id and queue_position = 0;
  select * into v_b from winner_stays_entries where session_id = p_session_id and queue_position = 1;
  if v_a.id is null or v_b.id is null then
    raise exception 'Es müssen mindestens zwei Teilnehmer in der Runde sein.';
  end if;
  if p_actor not in (v_a.player1_id, v_a.player2_id, v_b.player1_id, v_b.player2_id) then
    raise exception 'Nur die gerade am Tisch stehenden Spieler können Ergebnisse eintragen.';
  end if;
  if p_score_a = p_score_b then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;

  if p_score_a > p_score_b then v_winner := v_a; v_loser := v_b;
  else v_winner := v_b; v_loser := v_a; end if;

  select coalesce(max(game_no), 0) + 1 into v_game_no from winner_stays_games where session_id = p_session_id;

  insert into winner_stays_games (session_id, game_no, entry_a_id, entry_b_id, score_a, score_b, winner_entry_id, reported_by)
  values (p_session_id, v_game_no, v_a.id, v_b.id, p_score_a, p_score_b, v_winner.id, p_actor);

  update winner_stays_entries set wins = wins + 1, games = games + 1, streak = streak + 1,
    best_streak = greatest(best_streak, streak + 1)
    where id = v_winner.id;
  update winner_stays_entries set losses = losses + 1, games = games + 1, streak = 0
    where id = v_loser.id;

  select count(*) into v_count from winner_stays_entries where session_id = p_session_id and queue_position >= 0;
  if v_count > 2 then
    update winner_stays_entries set queue_position = -1 where id = v_loser.id;
    update winner_stays_entries set queue_position = queue_position - 1
      where session_id = p_session_id and queue_position > v_loser.queue_position;
    update winner_stays_entries set queue_position = v_count - 1 where id = v_loser.id;
  end if;

  perform winner_stays_skip_paused(p_session_id);
end;
$function$;

create or replace function public.winner_stays_skip_next(p_session_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
  v_next winner_stays_entries;
  v_count int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;
  if not (
    is_admin() or v_sess.organizer_id = v_me
    or exists (select 1 from winner_stays_entries where session_id = p_session_id and queue_position >= 0 and (player1_id = v_me or player2_id = v_me))
  ) then
    raise exception 'Nur Teilnehmer dieser Runde können überspringen.';
  end if;

  select count(*) into v_count from winner_stays_entries where session_id = p_session_id and queue_position >= 0;
  if v_count <= 3 then
    raise exception 'Überspringen ist erst ab mehr als drei Teilnehmern möglich.';
  end if;

  select * into v_next from winner_stays_entries where session_id = p_session_id and queue_position = 1;
  if v_next.id is null then raise exception 'Kein Herausforderer zum Überspringen vorhanden.'; end if;

  update winner_stays_entries set queue_position = -1 where id = v_next.id;
  update winner_stays_entries set queue_position = queue_position - 1
    where session_id = p_session_id and queue_position > v_next.queue_position;
  update winner_stays_entries set queue_position = v_count - 1 where id = v_next.id;

  perform winner_stays_skip_paused(p_session_id);
end;
$function$;

create or replace function public.winner_stays_skip_paused(p_session_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_count int;
  v_entry winner_stays_entries;
  v_guard int := 0;
begin
  select count(*) into v_count from winner_stays_entries where session_id = p_session_id and queue_position >= 0;
  -- Bei nur zwei Teilnehmern gibt es niemanden zum Tauschen: die Runde laeuft einfach weiter (Pause hat dann keine Wirkung).
  if v_count <= 2 then return; end if;

  loop
    v_guard := v_guard + 1;
    exit when v_guard > v_count + 2;

    select * into v_entry from winner_stays_entries
      where session_id = p_session_id and queue_position in (0, 1) and is_paused
      order by queue_position limit 1;
    exit when not found;

    update winner_stays_entries set queue_position = -1 where id = v_entry.id;
    update winner_stays_entries set queue_position = queue_position - 1
      where session_id = p_session_id and queue_position > v_entry.queue_position;
    update winner_stays_entries set queue_position = v_count - 1 where id = v_entry.id;
  end loop;
end;
$function$;

create or replace function public.winner_stays_set_paused(p_session_id uuid, p_entry_id uuid, p_paused boolean)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
  v_entry winner_stays_entries;
  v_count int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;

  select * into v_entry from winner_stays_entries where id = p_entry_id and session_id = p_session_id and queue_position >= 0;
  if not found then raise exception 'Teilnehmer nicht gefunden.'; end if;

  if not (
    is_admin() or v_sess.organizer_id = v_me
    or v_entry.player1_id = v_me or v_entry.player2_id = v_me
  ) then
    raise exception 'Nur die Person selbst oder die Leitung kann hier pausieren.';
  end if;

  select count(*) into v_count from winner_stays_entries where session_id = p_session_id and queue_position >= 0;
  if p_paused and v_count <= 2 then raise exception 'Bei nur zwei Teilnehmern gibt es nichts zu pausieren.'; end if;

  update winner_stays_entries set is_paused = p_paused where id = v_entry.id;

  if p_paused and v_entry.queue_position in (0, 1) then
    update winner_stays_entries set queue_position = -1 where id = v_entry.id;
    update winner_stays_entries set queue_position = queue_position - 1
      where session_id = p_session_id and queue_position > v_entry.queue_position;
    update winner_stays_entries set queue_position = v_count - 1 where id = v_entry.id;
  end if;

  perform winner_stays_skip_paused(p_session_id);
end;
$function$;

create or replace function public.winner_stays_move_entry(p_session_id uuid, p_entry_id uuid, p_delta integer)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
  v_entry winner_stays_entries;
  v_target winner_stays_entries;
  v_target_pos int;
  v_count int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;
  if not (
    is_admin() or v_sess.organizer_id = v_me
    or exists (select 1 from winner_stays_entries where session_id = p_session_id and queue_position >= 0 and (player1_id = v_me or player2_id = v_me))
  ) then
    raise exception 'Nur Teilnehmer dieser Runde können die Warteschlange verschieben.';
  end if;
  if p_delta <> 1 and p_delta <> -1 then raise exception 'Ungültiger Schritt.'; end if;

  select * into v_entry from winner_stays_entries where id = p_entry_id and session_id = p_session_id;
  if not found then raise exception 'Teilnehmer nicht gefunden.'; end if;
  if v_entry.queue_position < 2 then
    raise exception 'Die beiden Positionen am Tisch können hier nicht verschoben werden.';
  end if;

  select count(*) into v_count from winner_stays_entries where session_id = p_session_id and queue_position >= 0;
  v_target_pos := v_entry.queue_position + p_delta;
  if v_target_pos < 2 or v_target_pos > v_count - 1 then
    raise exception 'Ungültige Position.';
  end if;

  select * into v_target from winner_stays_entries where session_id = p_session_id and queue_position = v_target_pos;
  if not found then raise exception 'Zielposition nicht gefunden.'; end if;

  update winner_stays_entries set queue_position = -1 where id = v_entry.id;
  update winner_stays_entries set queue_position = v_entry.queue_position where id = v_target.id;
  update winner_stays_entries set queue_position = v_target_pos where id = v_entry.id;

  perform winner_stays_skip_paused(p_session_id);
end;
$function$;

create or replace function public.winner_stays_add_entries(p_session_id uuid, p_player_ids uuid[])
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
  v_next_pos int;
  v_pid uuid;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if not (is_admin() or v_sess.organizer_id = v_me) then
    raise exception 'Nur die Leitung dieser Runde kann Teilnehmer hinzufügen.';
  end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;
  if v_sess.is_doubles then raise exception 'Diese Runde ist ein Doppel - Teams einzeln hinzufügen.'; end if;
  if coalesce(array_length(p_player_ids, 1), 0) = 0 then raise exception 'Keine Spieler ausgewählt.'; end if;
  if exists (
    select 1 from unnest(p_player_ids) pid
    where not exists (select 1 from players where id = pid)
       or exists (select 1 from players where id = pid and coalesce(is_ghost, false))
  ) then
    raise exception 'Auswahl enthält einen ungültigen Spieler oder den Ghost.';
  end if;
  if exists (
    select 1 from winner_stays_entries e
    where e.session_id = p_session_id and e.queue_position >= 0 and e.player1_id = any(p_player_ids)
  ) then
    raise exception 'Mindestens eine ausgewählte Person spielt in dieser Runde bereits mit.';
  end if;

  select greatest(coalesce(max(queue_position), -1), -1) into v_next_pos from winner_stays_entries where session_id = p_session_id;

  foreach v_pid in array p_player_ids loop
    v_next_pos := v_next_pos + 1;
    insert into winner_stays_entries (session_id, player1_id, queue_position) values (p_session_id, v_pid, v_next_pos);
  end loop;
end;
$function$;

create or replace function public.winner_stays_add_team(p_session_id uuid, p_player1_id uuid, p_player2_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
  v_next_pos int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if not (is_admin() or v_sess.organizer_id = v_me) then
    raise exception 'Nur die Leitung dieser Runde kann Teilnehmer hinzufügen.';
  end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;
  if not v_sess.is_doubles then raise exception 'Diese Runde ist kein Doppel.'; end if;
  if p_player1_id = p_player2_id then raise exception 'Ein Team braucht zwei verschiedene Personen.'; end if;
  if exists (select 1 from players where id in (p_player1_id, p_player2_id) and coalesce(is_ghost, false)) then
    raise exception 'Der Ghost kann hier nicht mitspielen.';
  end if;
  if exists (
    select 1 from winner_stays_entries e
    where e.session_id = p_session_id and e.queue_position >= 0
      and (e.player1_id in (p_player1_id, p_player2_id) or e.player2_id in (p_player1_id, p_player2_id))
  ) then
    raise exception 'Mindestens eine ausgewählte Person spielt in dieser Runde bereits mit.';
  end if;

  select greatest(coalesce(max(queue_position), -1), -1) + 1 into v_next_pos from winner_stays_entries where session_id = p_session_id;

  insert into winner_stays_entries (session_id, player1_id, player2_id, queue_position)
  values (p_session_id, p_player1_id, p_player2_id, v_next_pos);
end;
$function$;

create or replace function public.winner_stays_add_guest(p_session_id uuid, p_nickname text)
returns players
 language sql
 security definer
 set search_path to 'public'
as $function$
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
    select p_session_id, g.id, greatest(coalesce((select max(queue_position) from winner_stays_entries where session_id = p_session_id), -1), -1) + 1
      from g
    returning 1
  )
  select * from g
$function$;

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
  if exists (select 1 from winner_stays_entries where session_id = p_session_id and queue_position >= 0 and (player1_id = v_me or player2_id = v_me)) then return; end if;
  select greatest(coalesce(max(queue_position), -1), -1) + 1 into v_next from winner_stays_entries where session_id = p_session_id;
  insert into winner_stays_entries (session_id, player1_id, queue_position) values (p_session_id, v_me, v_next);
end;
$function$;

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
  if (select count(*) from winner_stays_entries where session_id = p_session_id and queue_position >= 0) >= 64 then raise exception 'Die Runde ist voll.'; end if;
  if (select count(*) from players where is_guest and created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Gerade sehr viele Gast-Anmeldungen - bitte in ein paar Minuten nochmal versuchen.';
  end if;

  insert into players (nickname, is_guest) values (guest_free_name(v_nick), true) returning * into v_guest;
  select greatest(coalesce(max(queue_position), -1), -1) + 1 into v_next from winner_stays_entries where session_id = p_session_id;
  insert into winner_stays_entries (session_id, player1_id, queue_position) values (p_session_id, v_guest.id, v_next);
  insert into winner_stays_guest_tokens (session_id, player_id) values (p_session_id, v_guest.id)
    on conflict (session_id, player_id) do update set token = replace(gen_random_uuid()::text, '-', '')
    returning token into v_token;
  return jsonb_build_object('player_id', v_guest.id, 'nickname', v_guest.nickname, 'token', v_token);
end;
$function$;

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
    'players', (select count(*) from winner_stays_entries where session_id = v_sess.id and queue_position >= 0));
end;
$function$;

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
  select * into v_me from winner_stays_entries where session_id = v_sess.id and player1_id = v_tok.player_id and queue_position >= 0;
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
                         from winner_stays_entries e join players p on p.id = e.player1_id where e.session_id = v_sess.id and e.queue_position >= 0), '[]'::jsonb));
end;
$function$;

create or replace function public.guest_ws_report_game(p_token text, p_my_score integer, p_opp_score integer)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tok winner_stays_guest_tokens;
  v_me winner_stays_entries;
begin
  select * into v_tok from winner_stays_guest_tokens where token = p_token;
  if not found then raise exception 'Ungültiger Gast-Zugang.'; end if;
  if p_my_score is null or p_opp_score is null or p_my_score < 0 or p_opp_score < 0 then raise exception 'Ungültiges Ergebnis.'; end if;
  select * into v_me from winner_stays_entries where session_id = v_tok.session_id and player1_id = v_tok.player_id and queue_position >= 0;
  if not found or v_me.queue_position > 1 then raise exception 'Du stehst gerade nicht am Tisch.'; end if;
  if v_me.queue_position = 0 then
    perform winner_stays_report_game_core(v_tok.session_id, p_my_score, p_opp_score, v_tok.player_id);
  else
    perform winner_stays_report_game_core(v_tok.session_id, p_opp_score, p_my_score, v_tok.player_id);
  end if;
end;
$function$;

-- Gast meldet sich selbst ab: bleibt in der Wertung (left_at), steht aber nicht mehr in der Warteschlange
create or replace function public.guest_ws_withdraw(p_token text)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tok winner_stays_guest_tokens;
  v_e winner_stays_entries;
  v_count int;
begin
  select * into v_tok from winner_stays_guest_tokens where token = p_token;
  if not found then raise exception 'Ungültiger Gast-Zugang.'; end if;
  select * into v_e from winner_stays_entries where session_id = v_tok.session_id and player1_id = v_tok.player_id and queue_position >= 0;
  if not found then return; end if;
  select count(*) into v_count from winner_stays_entries where session_id = v_tok.session_id and queue_position >= 0;
  if v_e.queue_position <= 1 then raise exception 'Du stehst gerade am Tisch - bitte erst das Spiel beenden.'; end if;
  if v_count <= 2 then raise exception 'Es müssen mindestens zwei Teilnehmer in der Runde bleiben.'; end if;
  perform winner_stays_leave(v_e.id);
end;
$function$;

-- Beenden: die Leitung wie bisher; zusaetzlich jeder verbliebene Teilnehmer, solange nur noch zwei aktiv sind (dann laeuft die Runde sonst endlos weiter)
create or replace function public.winner_stays_finish_session(p_session_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
  v_active int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  select count(*) into v_active from winner_stays_entries where session_id = p_session_id and queue_position >= 0;
  if not (
    is_admin() or v_sess.organizer_id = v_me
    or (v_active <= 2 and exists (select 1 from winner_stays_entries where session_id = p_session_id and queue_position >= 0 and (player1_id = v_me or player2_id = v_me)))
  ) then
    raise exception 'Nur die Leitung dieser Runde kann sie beenden.';
  end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist nicht aktiv.'; end if;

  perform winner_stays_aggregate_session(p_session_id);

  update winner_stays_sessions set status = 'finished', finished_at = now() where id = p_session_id;
end;
$function$;

revoke all on function public.winner_stays_remove_entry(uuid, uuid) from public, anon;
grant execute on function public.winner_stays_remove_entry(uuid, uuid) to authenticated;
