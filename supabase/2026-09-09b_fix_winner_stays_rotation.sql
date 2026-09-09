-- Bugfix fuer winner_stays_report_game() (siehe 2026-09-09_winner_stays.sql):
-- bei genau 3 Teilnehmern schlug das Eintragen eines Ergebnisses fehl mit
-- "duplicate key value violates unique constraint
-- winner_stays_entries_session_id_queue_position_key". Ursache: die Rotation
-- hat die nachrueckende Person (Position 2 -> 1) per UPDATE verschoben,
-- WAEHREND der/die Verlierer:in noch auf der alten Position 1 stand - zwei
-- Zeilen mit derselben queue_position gleichzeitig verletzen den
-- Unique-Constraint sofort am Ende dieses einzelnen UPDATE-Statements
-- (Postgres prueft nicht-deferred Constraints direkt nach jedem Statement,
-- nicht erst am Transaktionsende). Live-getestet mit 3 Teilnehmern (Test-DB)
-- - mit nur 2 Teilnehmern trat der Fehler nicht auf, da dort niemand
-- nachrueckt.
--
-- Fix: den/die Verlierer:in ZUERST auf eine garantiert freie Position (-1)
-- schieben, bevor die anderen aufruecken - danach ist die alte Position nie
-- mehr belegt, wenn jemand anderes sie einnimmt.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

create or replace function public.winner_stays_report_game(p_session_id uuid, p_score_a int, p_score_b int)
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
  v_match_id uuid;
  v_game_no int;
  v_count int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if not (is_admin() or v_sess.organizer_id = v_me) then
    raise exception 'Nur die Leitung dieser Runde kann Ergebnisse eintragen.';
  end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;
  if p_score_a = p_score_b then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;

  select * into v_a from winner_stays_entries where session_id = p_session_id and queue_position = 0;
  select * into v_b from winner_stays_entries where session_id = p_session_id and queue_position = 1;
  if v_a.id is null or v_b.id is null then
    raise exception 'Es müssen mindestens zwei Teilnehmer in der Runde sein.';
  end if;

  if p_score_a > p_score_b then v_winner := v_a; v_loser := v_b;
  else v_winner := v_b; v_loser := v_a; end if;

  if v_sess.is_doubles then
    insert into matches (player1_id, player1b_id, player2_id, player2b_id, score1, score2, discipline, reported_by, confirmed, confirmed_by)
    values (v_a.player1_id, v_a.player2_id, v_b.player1_id, v_b.player2_id, p_score_a, p_score_b, v_sess.discipline, v_me, true, v_me)
    returning id into v_match_id;
  else
    insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed, confirmed_by)
    values (v_a.player1_id, v_b.player1_id, p_score_a, p_score_b, v_sess.discipline, v_me, true, v_me)
    returning id into v_match_id;
  end if;

  select coalesce(max(game_no), 0) + 1 into v_game_no from winner_stays_games where session_id = p_session_id;

  insert into winner_stays_games (session_id, game_no, entry_a_id, entry_b_id, score_a, score_b, winner_entry_id, match_id, reported_by)
  values (p_session_id, v_game_no, v_a.id, v_b.id, p_score_a, p_score_b, v_winner.id, v_match_id, v_me);

  update winner_stays_entries set wins = wins + 1, games = games + 1, streak = streak + 1,
    best_streak = greatest(best_streak, streak + 1)
    where id = v_winner.id;
  update winner_stays_entries set losses = losses + 1, games = games + 1, streak = 0
    where id = v_loser.id;

  select count(*) into v_count from winner_stays_entries where session_id = p_session_id;
  if v_count > 2 then
    -- Verlierer:in zuerst aus dem Weg schieben (-1 ist nie regulaer belegt),
    -- SONST verletzt das naechste UPDATE (nachrueckende Person auf dieselbe
    -- Position) kurzzeitig den Unique-Constraint (session_id, queue_position).
    update winner_stays_entries set queue_position = -1 where id = v_loser.id;
    update winner_stays_entries set queue_position = queue_position - 1
      where session_id = p_session_id and queue_position > v_loser.queue_position;
    update winner_stays_entries set queue_position = v_count - 1 where id = v_loser.id;
  end if;
end;
$function$;
