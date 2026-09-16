-- Nutzer-Feedback: "Ein 'Aussetzen' Button. Es kann jederzeit einer der
-- Spieler ausfallen. Diese Moeglichkeit sollte jeder haben." - anders als
-- winner_stays_skip_next() (das nur den Herausforderer betrifft und von
-- JEDER Person der Runde fuer jemand ANDEREN ausgeloest werden kann, siehe
-- 2026-09-16e), geht es hier um Selbstbedienung: jede Person soll sich
-- SELBST jederzeit aus der aktiven Rotation nehmen koennen - egal ob sie
-- gerade am Tisch steht (Position 0/1, mitten im Rack) oder irgendwo in
-- der Warteschlange wartet.
--
-- winner_stays_sit_out(): verallgemeinerte Version der Sentinel/Shift-
-- Rotation aus winner_stays_report_game()/winner_stays_skip_next() - statt
-- fest auf den Verlierer bzw. Position 1 geht das hier von JEDER
-- Ausgangsposition (0, 1 oder Warteschlange) ans Ende der Warteschlange.
-- Keine Statistik-Aenderung (kein Sieg/keine Niederlage/kein Rack), kein
-- Teilnehmerlimit noetig (anders als Ueberspringen - Aussetzen soll immer
-- moeglich sein). Rechte: die Person selbst (player1_id/player2_id der
-- eigenen entry) oder Leitung/Admin fuer jede Person.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

create or replace function public.winner_stays_sit_out(p_session_id uuid, p_entry_id uuid)
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
    raise exception 'Nur die Person selbst oder die Leitung kann hier aussetzen.';
  end if;

  select count(*) into v_count from winner_stays_entries where session_id = p_session_id;

  update winner_stays_entries set queue_position = -1 where id = v_entry.id;
  update winner_stays_entries set queue_position = queue_position - 1
    where session_id = p_session_id and queue_position > v_entry.queue_position;
  update winner_stays_entries set queue_position = v_count - 1 where id = v_entry.id;
end;
$function$;
