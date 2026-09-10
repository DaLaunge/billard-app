-- Bugfix/Nutzer-Feedback: winner_stays_report_game() hat bisher JEDES
-- einzelne Rack als eigenstaendiges, sofort bestaetigtes matches-Match
-- eingetragen ("Sämtliche Winner Stays-Spiele werden als eigenständiges
-- 1:0 Match gespeichert" - Nutzer-Zitat). Das flutet die Match-Historie mit
-- trivialen 1:0-Eintraegen und verzerrt Elo/Spielanzahl (jedes Rack zaehlt
-- einzeln statt als Teil einer zusammenhaengenden Partie).
--
-- Neues Verhalten: waehrend der Runde wird jedes Rack nur noch in
-- winner_stays_games protokolliert (match_id bleibt null, Live-Rangliste
-- unveraendert ueber winner_stays_entries.wins/losses/streak). ERST beim
-- Beenden der Runde (winner_stays_finish_session) wird pro Zweier-Paarung
-- (Einzel: 2 Personen, Doppel: 2 Teams), die mindestens einmal gegeneinander
-- gespielt hat, EIN aggregiertes Match erzeugt - Endstand = Summe der
-- gewonnenen Racks, run_log = ein Eintrag pro Rack im selben simplen
-- [score1, score2, ts]-Format wie bei normalen 8/9/10-Ball-Matches (siehe
-- src/lib/runLog.js isSimpleScoreLog) - dadurch funktioniert die bestehende
-- Protokoll-Ansicht/Tempo-Statistik unveraendert, "wie wir es nun gewohnt
-- sind" (Nutzer-Zitat).
--
-- Eine Paarung wird ueber die kleinere/groessere entry_id kanonisiert,
-- damit zwei Personen, die sich im Laufe der Runde MEHRFACH begegnen
-- (Verteidiger/Herausforderer-Seite kann beim zweiten Mal vertauscht sein),
-- trotzdem in EINEM Match zusammengefasst werden.
--
-- Bereits als Einzel-1:0-Matches gespeicherte Racks (aus noch laufenden
-- Runden vor diesem Fix, z.B. Testrunden) werden beim naechsten Beenden
-- automatisch bereinigt: winner_stays_finish_session() loescht die alten,
-- jetzt ueberholten Match-Zeilen dieser Paarung, bevor es das neue
-- aggregierte Match eintraegt - kein separates Backfill-Skript noetig, da
-- laut aktuellem Datenbestand keine Runde mit altem Verhalten schon
-- "finished" ist.
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

  select coalesce(max(game_no), 0) + 1 into v_game_no from winner_stays_games where session_id = p_session_id;

  -- Kein eigenes matches-Match mehr pro Rack (siehe Kommentar oben) -
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

create or replace function public.winner_stays_finish_session(p_session_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
  v_pair record;
  v_run_log jsonb;
  v_score1 int;
  v_score2 int;
  v_played_at timestamptz;
  v_match_id uuid;
  v_old_match_ids uuid[];
  v_p1 uuid; v_p1b uuid; v_p2 uuid; v_p2b uuid;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if not (is_admin() or v_sess.organizer_id = v_me) then
    raise exception 'Nur die Leitung dieser Runde kann sie beenden.';
  end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist nicht aktiv.'; end if;

  for v_pair in
    select
      least(entry_a_id, entry_b_id) as side1_id,
      greatest(entry_a_id, entry_b_id) as side2_id
    from winner_stays_games
    where session_id = p_session_id
    group by least(entry_a_id, entry_b_id), greatest(entry_a_id, entry_b_id)
  loop
    -- Etwaige alte Einzel-1:0-Matches dieser Paarung (aus Runden, die
    -- schon vor diesem Fix Racks gemeldet haben) zuerst wieder entfernen,
    -- bevor das neue aggregierte Match eingetragen wird - sonst blieben
    -- sie als verwaiste Duplikate liegen und wuerden weiterhin ins Rating
    -- einfliessen.
    select array_agg(distinct match_id) into v_old_match_ids
      from winner_stays_games
      where session_id = p_session_id
        and least(entry_a_id, entry_b_id) = v_pair.side1_id
        and greatest(entry_a_id, entry_b_id) = v_pair.side2_id
        and match_id is not null;

    select
      coalesce(sum(case when g.entry_a_id = v_pair.side1_id then g.score_a else g.score_b end), 0),
      coalesce(sum(case when g.entry_a_id = v_pair.side1_id then g.score_b else g.score_a end), 0),
      max(g.played_at)
    into v_score1, v_score2, v_played_at
    from winner_stays_games g
    where g.session_id = p_session_id
      and least(g.entry_a_id, g.entry_b_id) = v_pair.side1_id
      and greatest(g.entry_a_id, g.entry_b_id) = v_pair.side2_id;

    select jsonb_agg(jsonb_build_array(s1_running, s2_running, extract(epoch from played_at) * 1000) order by game_no)
    into v_run_log
    from (
      select game_no, played_at,
        sum(case when entry_a_id = v_pair.side1_id then score_a else score_b end)
          over (order by game_no) as s1_running,
        sum(case when entry_a_id = v_pair.side1_id then score_b else score_a end)
          over (order by game_no) as s2_running
      from winner_stays_games
      where session_id = p_session_id
        and least(entry_a_id, entry_b_id) = v_pair.side1_id
        and greatest(entry_a_id, entry_b_id) = v_pair.side2_id
    ) g;

    select player1_id, player2_id into v_p1, v_p1b from winner_stays_entries where id = v_pair.side1_id;
    select player1_id, player2_id into v_p2, v_p2b from winner_stays_entries where id = v_pair.side2_id;

    insert into matches (player1_id, player1b_id, player2_id, player2b_id, score1, score2, discipline,
                          reported_by, confirmed, confirmed_by, played_at, run_log)
    values (v_p1, v_p1b, v_p2, v_p2b, v_score1, v_score2, v_sess.discipline,
            v_me, true, v_me, v_played_at, v_run_log)
    returning id into v_match_id;

    update winner_stays_games set match_id = v_match_id
      where session_id = p_session_id
        and least(entry_a_id, entry_b_id) = v_pair.side1_id
        and greatest(entry_a_id, entry_b_id) = v_pair.side2_id;

    -- Erst JETZT sind die alten Match-Zeilen (falls vorhanden) von keiner
    -- winner_stays_games-Zeile mehr referenziert (alle zeigen jetzt auf
    -- v_match_id) - vorher haette das DELETE an genau dieser
    -- Fremdschluessel-Regel gescheitert (live beim Testen aufgefallen).
    if v_old_match_ids is not null then
      delete from match_confirmations where match_id = any(v_old_match_ids);
      update challenges set resolved_match_id = null where resolved_match_id = any(v_old_match_ids);
      delete from matches where id = any(v_old_match_ids);
    end if;
  end loop;

  update winner_stays_sessions set status = 'finished', finished_at = now() where id = p_session_id;
end;
$function$;
