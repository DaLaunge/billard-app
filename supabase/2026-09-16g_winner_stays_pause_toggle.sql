-- Nutzer-Feedback: "Aber wie kann ich den Aussetzen Button wieder
-- ausschalten? Offenbar kann ich das kaffee-icon nur aktivieren aber nicht
-- deaktivieren." - der bisherige "Aussetzen"-Button (winner_stays_sit_out,
-- siehe 2026-09-16f) war eine einmalige Aktion (sofort ans Ende der
-- Warteschlange, wie Selbst-Ueberspringen). Gewuenscht ist stattdessen ein
-- echter Ein/Aus-Schalter: "pausiert"-Status pro Teilnehmer, der die Person
-- automatisch uebergeht, sobald sie an der Reihe waere, bis sie sich selbst
-- wieder aktiv meldet. winner_stays_sit_out() wird durch
-- winner_stays_set_paused() ersetzt (noch nicht in Prod gelandet, daher
-- sauberer Ersatz statt Migration von Altdaten).
--
-- is_paused: neue Spalte auf winner_stays_entries.
--
-- winner_stays_skip_paused(): interner Hilfsbaustein (nicht direkt vom
-- Client aufgerufen) - schiebt so lange pausierte Personen von Position 0
-- oder 1 ans Ende der Warteschlange (dieselbe Sentinel/Shift-Rotation wie
-- ueberall sonst), bis dort niemand Pausiertes mehr steht. Wird an EXAKT
-- den Stellen aufgerufen, an denen jemand Neues auf Position 0/1 rutschen
-- kann: nach einer Rack-Meldung (winner_stays_report_game), nach
-- Ueberspringen (winner_stays_skip_next), nach dem Entfernen eines
-- Teilnehmers (winner_stays_remove_entry) und - defensiv, auch wenn dort
-- Position 0/1 eigentlich ausgeschlossen sind - nach dem Verschieben
-- (winner_stays_move_entry). Eine Sicherheitsgrenze (v_guard) verhindert
-- eine Endlosschleife fuer den entarteten Fall, dass wirklich alle
-- Teilnehmer pausiert sind.
--
-- winner_stays_set_paused(): schaltet is_paused fuer eine Person um. Wird
-- sie dabei pausiert UND steht gerade auf Position 0/1, geht sie sofort
-- ans Ende (plus Kaskade fuer die neu nachgerueckte Person, falls die auch
-- pausiert ist). Beim Entpausieren passiert keine Rotation - die Person
-- bleibt, wo sie in der Warteschlange steht, und ist einfach wieder normal
-- dran, wenn sie an der Reihe ist. Rechte wie beim bisherigen Aussetzen:
-- die Person selbst oder Leitung/Admin fuer jede Person.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

alter table public.winner_stays_entries add column if not exists is_paused boolean not null default false;

drop function if exists public.winner_stays_sit_out(uuid, uuid);

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
  select count(*) into v_count from winner_stays_entries where session_id = p_session_id;
  if v_count < 2 then return; end if;

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

  select * into v_entry from winner_stays_entries where id = p_entry_id and session_id = p_session_id;
  if not found then raise exception 'Teilnehmer nicht gefunden.'; end if;

  if not (
    is_admin() or v_sess.organizer_id = v_me
    or v_entry.player1_id = v_me or v_entry.player2_id = v_me
  ) then
    raise exception 'Nur die Person selbst oder die Leitung kann hier pausieren.';
  end if;

  update winner_stays_entries set is_paused = p_paused where id = v_entry.id;

  if p_paused and v_entry.queue_position in (0, 1) then
    select count(*) into v_count from winner_stays_entries where session_id = p_session_id;
    update winner_stays_entries set queue_position = -1 where id = v_entry.id;
    update winner_stays_entries set queue_position = queue_position - 1
      where session_id = p_session_id and queue_position > v_entry.queue_position;
    update winner_stays_entries set queue_position = v_count - 1 where id = v_entry.id;
  end if;

  perform winner_stays_skip_paused(p_session_id);
end;
$function$;

-- winner_stays_report_game(): identisch zur bisherigen Version (siehe
-- 2026-09-15), nur ein winner_stays_skip_paused()-Aufruf am Ende ergaenzt.
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

  select count(*) into v_count from winner_stays_entries where session_id = p_session_id;
  if v_count > 2 then
    update winner_stays_entries set queue_position = -1 where id = v_loser.id;
    update winner_stays_entries set queue_position = queue_position - 1
      where session_id = p_session_id and queue_position > v_loser.queue_position;
    update winner_stays_entries set queue_position = v_count - 1 where id = v_loser.id;
  end if;

  perform winner_stays_skip_paused(p_session_id);
end;
$function$;

-- winner_stays_skip_next(): identisch zur bisherigen Version (siehe
-- 2026-09-16e), nur ein winner_stays_skip_paused()-Aufruf am Ende ergaenzt.
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
    or exists (select 1 from winner_stays_entries where session_id = p_session_id and (player1_id = v_me or player2_id = v_me))
  ) then
    raise exception 'Nur Teilnehmer dieser Runde können überspringen.';
  end if;

  select count(*) into v_count from winner_stays_entries where session_id = p_session_id;
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

-- winner_stays_move_entry(): identisch zur bisherigen Version (siehe
-- 2026-09-16e), nur defensiv ein winner_stays_skip_paused()-Aufruf am Ende
-- ergaenzt (Position 0/1 sind hier zwar schon ausgeschlossen, aber so
-- bleibt das Verhalten robust, falls sich das je aendert).
create or replace function public.winner_stays_move_entry(p_session_id uuid, p_entry_id uuid, p_delta int)
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
    or exists (select 1 from winner_stays_entries where session_id = p_session_id and (player1_id = v_me or player2_id = v_me))
  ) then
    raise exception 'Nur Teilnehmer dieser Runde können die Warteschlange verschieben.';
  end if;
  if p_delta <> 1 and p_delta <> -1 then raise exception 'Ungültiger Schritt.'; end if;

  select * into v_entry from winner_stays_entries where id = p_entry_id and session_id = p_session_id;
  if not found then raise exception 'Teilnehmer nicht gefunden.'; end if;
  if v_entry.queue_position < 2 then
    raise exception 'Die beiden Positionen am Tisch können hier nicht verschoben werden.';
  end if;

  select count(*) into v_count from winner_stays_entries where session_id = p_session_id;
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

-- winner_stays_remove_entry(): identisch zur bisherigen Version, nur ein
-- winner_stays_skip_paused()-Aufruf am Ende ergaenzt (falls das Entfernen
-- jemanden auf Position 0/1 nachrutschen laesst).
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
  if not (is_admin() or v_sess.organizer_id = v_me) then
    raise exception 'Nur die Leitung dieser Runde kann Teilnehmer entfernen.';
  end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;

  select * into v_entry from winner_stays_entries where id = p_entry_id and session_id = p_session_id;
  if not found then raise exception 'Teilnehmer nicht gefunden.'; end if;

  select count(*) into v_count from winner_stays_entries where session_id = p_session_id;
  if v_count <= 2 then raise exception 'Es müssen mindestens zwei Teilnehmer in der Runde bleiben.'; end if;

  delete from winner_stays_entries where id = p_entry_id;
  update winner_stays_entries set queue_position = queue_position - 1
    where session_id = p_session_id and queue_position > v_entry.queue_position;

  perform winner_stays_skip_paused(p_session_id);
end;
$function$;
