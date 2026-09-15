-- Nutzer-Feedback: "Zusätzlich sollten beide Spieler, die beim Winner
-- Stays gerade am Tisch sind, ein Ergebnis eingeben können." Bisher durfte
-- ausschliesslich die Turnierleitung (oder ein Admin) Ergebnisse eintragen
-- - die beiden Personen, die gerade tatsaechlich am Tisch stehen (bzw.
-- beide Team-Mitglieder bei Doppel), muessten sonst jedes Mal die Leitung
-- suchen, obwohl sie das Ergebnis selbst am besten kennen.
--
-- Dazu muss der v_a/v_b-Lookup (wer steht gerade an Position 0/1) VOR die
-- Rechte-Pruefung wandern, damit deren Spieler-IDs dort schon zur
-- Verfuegung stehen. Kein Verlust der bisherigen Fehlermeldungs-
-- Reihenfolge: "Runde nicht gefunden"/"nicht aktiv" bleiben vor der
-- Teilnehmer-Pruefung, nur die eigentliche Rechte-Pruefung ruckt hinter
-- den Lookup.
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

  -- Kein eigenes matches-Match mehr pro Rack (siehe 2026-09-10b) -
  -- match_id bleibt bis zum Beenden der Runde null.
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
end;
$function$;
