-- Nutzer-Feedback: "Winner stays ist der einzige Turniermodus, bei dem
-- jeder Spieler etwas eingeben kann. Das heisst, dass das Verschieben eines
-- wartenden Spielers fuer jeden moeglich sein muss, der im Turnier
-- mitspielt" - im Anschluss an die Frage, ob die Warteschlange per Drag &
-- Drop umsortierbar sein soll (siehe winner_stays_move_entry() unten;
-- UI nutzt bewusst Pfeil-Buttons statt echtem Drag & Drop, siehe
-- WinnerStaysScreen.jsx - robuster am Handy als Touch-Gesten auf einer
-- scrollenden Liste).
--
-- Rechte-Modell fuer BEIDES (Verschieben und - per Nutzer-Bestaetigung neu
-- auch - Ueberspringen): jede Person, die aktuell an dieser Runde
-- teilnimmt (irgendein player1_id/player2_id unter den entries dieser
-- Session), nicht nur Leitung/Admin - konsistent mit
-- winner_stays_report_game(), das schon immer auch den beiden Spielern am
-- Tisch erlaubt war, nicht nur der Leitung. winner_stays_skip_next() war
-- bisher bewusst enger (nur Leitung/Admin) - laut Nutzer-Feedback soll das
-- jetzt vereinheitlicht werden.
--
-- winner_stays_move_entry(): verschiebt einen wartenden Teilnehmer um
-- p_delta Positionen (+1 = eine Position spaeter/weiter hinten, -1 = eine
-- Position frueher). Bewusst nur innerhalb der Warteschlange (Position >=
-- 2) - die beiden Tisch-Positionen (0/1, "Verteidigt"/"Herausforderer")
-- sind davon ausgenommen, das waere ein eigenes, komplizierteres Feature
-- (wuerde z.B. ein laufendes Match am Tisch betreffen). Ein einzelner Swap
-- zweier Zeilen ist dank des DEFERRABLE-UNIQUE-Constraints auf
-- queue_position (siehe 2026-09-10c) ohne Sentinel-Trick sicher moeglich,
-- aber der Code verwendet trotzdem denselben Sentinel-Ansatz wie
-- winner_stays_report_game()/winner_stays_skip_next() fuer Konsistenz.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

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
end;
$function$;

-- winner_stays_skip_next(): identisch zur bisherigen Version (siehe
-- 2026-09-16d), nur die Rechte-Pruefung erweitert - jetzt auch fuer alle
-- Teilnehmer der Runde, nicht mehr nur Leitung/Admin.
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
end;
$function$;
