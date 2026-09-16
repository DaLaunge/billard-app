-- Bugfix (Nutzer-Feedback): "Die average time beim Modus Winner Stays kann
-- nicht stimmen ... man muss die Spielzeit der Spieler am Tisch vom
-- Zeitpunkt des Eintrags bis zum Zeitpunkt des naechsten Eintrags zaehlen -
-- einer der beiden Spieler bleibt am Tisch und spielt gegen einen weiteren
-- Spieler."
--
-- winner_stays_aggregate_session() baut das run_log NACH ZWEIER-PAARUNG
-- gruppiert (ein Match pro Paar, das gegeneinander gespielt hat - siehe
-- 2026-09-10b). Die bestehende Tempo-Berechnung (gameSpeedSums() in
-- src/lib/runLog.js) misst die Dauer eines Racks aber als Differenz zum
-- VORHERIGEN EINTRAG IM SELBEN PROTOKOLL - bei Winner Stays koennen
-- zwischen zwei Begegnungen DESSELBEN Paares beliebig viele Racks gegen
-- ANDERE Personen liegen (der Sieger bleibt am Tisch, der naechste
-- Herausforderer kommt), deren Spielzeit dabei faelschlich der naechsten
-- Begegnung des urspruenglichen Paares zugerechnet wurde.
--
-- Fix: jedes Rack bekommt seine Dauer nicht aus der eigenen (nach Paarung
-- gefilterten) Reihenfolge, sondern aus der SESSION-WEITEN Reihenfolge
-- ALLER Racks (unabhaengig davon, wer gegen wen gespielt hat) - das
-- entspricht genau der tatsaechlichen Tischbelegung: ein Rack endet, das
-- naechste beginnt sofort. Diese korrekt berechnete Dauer wird als 4.
-- Array-Element [s1, s2, ts, durationMs] explizit mitgespeichert; der
-- Client (src/lib/runLog.js) nutzt sie jetzt bevorzugt, statt sie aus
-- ts-Differenzen im (bei Winner Stays luecken­haften) Protokoll zu raten -
-- fuer normale, nicht aus Winner Stays stammende Matches aendert sich
-- nichts (kein 4. Element vorhanden, alte Berechnung bleibt bestehen).
--
-- Einmaliges Backfill am Ende korrigiert bereits vorhandene Winner-Stays-
-- Matches (gleiches robustes Muster wie 2026-09-10f: jede Runde in ihrer
-- eigenen Sub-Transaktion, ein Problem bei einer Runde blockiert die
-- anderen nicht).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

create or replace function public.winner_stays_aggregate_session(p_session_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_sess winner_stays_sessions;
  v_pair record;
  v_run_log jsonb;
  v_score1 int;
  v_score2 int;
  v_played_at timestamptz;
  v_reporter uuid;
  v_match_id uuid;
  v_old_match_ids uuid[];
  v_p1 uuid; v_p1b uuid; v_p2 uuid; v_p2b uuid;
begin
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;

  for v_pair in
    select
      least(entry_a_id, entry_b_id) as side1_id,
      greatest(entry_a_id, entry_b_id) as side2_id
    from winner_stays_games
    where session_id = p_session_id
    group by least(entry_a_id, entry_b_id), greatest(entry_a_id, entry_b_id)
  loop
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

    select reported_by into v_reporter
      from winner_stays_games
      where session_id = p_session_id
        and least(entry_a_id, entry_b_id) = v_pair.side1_id
        and greatest(entry_a_id, entry_b_id) = v_pair.side2_id
      order by game_no desc
      limit 1;

    -- Pro Rack: eigene, nach Paarung gefilterte laufende Punktestand-Summe
    -- (s1_running/s2_running fuer die Protokoll-Tabelle), aber die Dauer
    -- (duration_ms) kommt aus der SESSION-WEITEN Rack-Reihenfolge (sd),
    -- nicht aus dieser gefilterten - genau das war der Fehler.
    select jsonb_agg(
      case when sd.duration_ms is not null
        then jsonb_build_array(g.s1_running, g.s2_running, g.ts_ms, sd.duration_ms)
        else jsonb_build_array(g.s1_running, g.s2_running, g.ts_ms)
      end
      order by g.game_no
    )
    into v_run_log
    from (
      select game_no, extract(epoch from played_at) * 1000 as ts_ms,
        sum(case when entry_a_id = v_pair.side1_id then score_a else score_b end)
          over (order by game_no) as s1_running,
        sum(case when entry_a_id = v_pair.side1_id then score_b else score_a end)
          over (order by game_no) as s2_running
      from winner_stays_games
      where session_id = p_session_id
        and least(entry_a_id, entry_b_id) = v_pair.side1_id
        and greatest(entry_a_id, entry_b_id) = v_pair.side2_id
    ) g
    join (
      select game_no,
        extract(epoch from (played_at - lag(played_at) over (order by game_no))) * 1000 as duration_ms
      from winner_stays_games
      where session_id = p_session_id
    ) sd on sd.game_no = g.game_no;

    select player1_id, player2_id into v_p1, v_p1b from winner_stays_entries where id = v_pair.side1_id;
    select player1_id, player2_id into v_p2, v_p2b from winner_stays_entries where id = v_pair.side2_id;

    insert into matches (player1_id, player1b_id, player2_id, player2b_id, score1, score2, discipline,
                          reported_by, confirmed, confirmed_by, played_at, run_log, winner_stays_session_id)
    values (v_p1, v_p1b, v_p2, v_p2b, v_score1, v_score2, v_sess.discipline,
            coalesce(v_reporter, v_sess.organizer_id), true, coalesce(v_reporter, v_sess.organizer_id),
            v_played_at, v_run_log, p_session_id)
    returning id into v_match_id;

    update winner_stays_games set match_id = v_match_id
      where session_id = p_session_id
        and least(entry_a_id, entry_b_id) = v_pair.side1_id
        and greatest(entry_a_id, entry_b_id) = v_pair.side2_id;

    if v_old_match_ids is not null then
      delete from match_confirmations where match_id = any(v_old_match_ids);
      update challenges set resolved_match_id = null where resolved_match_id = any(v_old_match_ids);
      delete from matches where id = any(v_old_match_ids);
    end if;
  end loop;
end;
$function$;

-- Einmaliges Backfill: jede bereits "finished" Runde erneut aggregieren,
-- damit ihre Matches die korrigierte Dauer bekommen. Eigene Sub-Transaktion
-- pro Runde (siehe 2026-09-10f) - ein Problem bei einer Runde rollt nur
-- diese eine zurueck, nicht alle anderen.
do $$
declare
  v_id uuid;
  v_name text;
  v_ok int := 0;
  v_failed int := 0;
begin
  for v_id, v_name in select id, name from winner_stays_sessions where status = 'finished'
  loop
    begin
      perform winner_stays_aggregate_session(v_id);
      v_ok := v_ok + 1;
    exception when others then
      v_failed := v_failed + 1;
      raise notice 'Konnte Runde "%" (%) nicht aggregieren: %', v_name, v_id, sqlerrm;
    end;
  end loop;
  raise notice 'Fertig: % Runde(n) erfolgreich aggregiert, % fehlgeschlagen.', v_ok, v_failed;
end $$;
