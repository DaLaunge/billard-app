-- Nutzer-Feedback: "Zusaetzlich moechte ich, dass der Winner-Stays Modus
-- einen 'ueberspringen' Button bekommt. Das macht natuerlich nur Sinn, wenn
-- es mehr als 3 Spieler sind. Aber dadurch ist gewaehrleistet, dass der
-- Tisch so gut als moeglich ausgenutzt wird, auch wenn der naechste Spieler
-- in der Reihe gerade am WC ist oder ein dringendes Telefonat fuehren muss."
--
-- winner_stays_skip_next(): der Herausforderer (queue_position = 1, "der
-- naechste Spieler in der Reihe") geht ans Ende der Warteschlange - exakt
-- dieselbe sentinel/shift-Rotation wie beim Verlieren in
-- winner_stays_report_game() (siehe dort und 2026-09-10c fuer den
-- DEFERRABLE-UNIQUE-Constraint, der genau dieses Bulk-Update sicher macht),
-- aber OHNE winner_stays_games-Eintrag und OHNE wins/losses/streak zu
-- veraendern - es wurde ja kein Rack gespielt, die Person war nur gerade
-- nicht verfuegbar. Nur Leitung/Admin duerfen ueberspringen (anders als
-- winner_stays_report_game(), das bewusst auch den beiden Spielern am Tisch
-- erlaubt ist) - ein Ueberspringen veraendert die Reihenfolge fuer jemand
-- ANDEREN, das soll nicht beliebig von Mitspielern ausgeloest werden
-- koennen. Braucht mind. 4 Teilnehmer (mehr als 3, wie im Feedback), sonst
-- waere ein Ueberspringen sinnlos (die Person kaeme sofort wieder dran).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

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
  if not (is_admin() or v_sess.organizer_id = v_me) then
    raise exception 'Nur die Leitung dieser Runde kann jemanden überspringen.';
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
