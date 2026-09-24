-- KEINE Migration: Messung + Gleichheitsbeweis fuer 2026-09-24e_rebuild_elo_fast.sql.
-- Aendert NICHTS dauerhaft: der Block endet immer mit RAISE EXCEPTION, dadurch
-- wird die ganze Transaktion (alle Neuberechnungen, Badges, Test-Stoerungen)
-- zurueckgerollt. Das Ergebnis steht in der Fehlermeldung ("ERGEBNIS ...").
--
-- Voraussetzung: 2026-09-24e ist ausgefuehrt. Im Testprojekt im SQL-Editor
-- ausfuehren (Produktion geht auch, schreibt ja nichts - haelt aber waehrend der
-- Laufzeit die Rating-Sperre, Match-Meldungen warten so lange).
--
-- Gemessen wird:
--   1. jede Funktion, die trg_rebuild_ratings() bzw. trg_streak_extra() bei
--      einer Match-Aenderung aufrufen, einzeln (alte rebuild_elo);
--   2. rebuild_elo_v2() in drei Lagen, jeweils mit Vergleich gegen das
--      Ergebnis der alten Funktion (Pruefsumme ueber alle Zeilen, Zahlen als
--      Text, also inkl. aller Nachkommastellen):
--        a) Tabellen schon aktuell (typisch: nichts zu schreiben)
--        b) alle Anker verfaelscht, einige geloescht, ein ueberzaehliger dazu
--           (schlimmster Fall: Match rueckdatiert, alles danach aendert sich)
--        c) elo_anchors leer
--   Da alles in EINER Transaktion laeuft, ist now() fuer alt und neu gleich -
--   auch ratings (Verfall bis jetzt) muss also exakt uebereinstimmen.

do $mess$
declare
  t0 timestamptz;
  msg text := '';
  h_anch_old text; h_rat_old text; h_anch text; h_rat text;
  n_old int;
  ok boolean := true;
  fn text;
begin
  perform pg_advisory_xact_lock(hashtext('rebuild_ratings'));

  -- 1. alte Kette, Funktion fuer Funktion
  t0 := clock_timestamp(); perform rebuild_elo();
  msg := msg || 'rebuild_elo(alt)=' || round(extract(epoch from clock_timestamp() - t0) * 1000) || 'ms';
  t0 := clock_timestamp(); perform snapshot_ratings();
  msg := msg || ' snapshot_ratings=' || round(extract(epoch from clock_timestamp() - t0) * 1000) || 'ms';
  foreach fn in array array['compute_badges', 'compute_recruit_badges', 'compute_141_badges',
                            'compute_opponent_streak_badges', 'compute_ghost_badges',
                            'compute_challenge_badges', 'compute_membership_badges',
                            'compute_tournament_badges', 'compute_streak_badges'] loop
    if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
               where ns.nspname = 'public' and p.proname = fn) then
      t0 := clock_timestamp();
      execute format('select public.%I()', fn);
      msg := msg || ' ' || fn || '=' || round(extract(epoch from clock_timestamp() - t0) * 1000) || 'ms';
    end if;
  end loop;

  select md5(string_agg(concat_ws('|', player_id, discipline, anchor_at, rating::text, games), ','
                        order by player_id, discipline, anchor_at)), count(*)
    into h_anch_old, n_old from elo_anchors;
  select md5(string_agg(concat_ws('|', player_id, discipline, rating::text, games_played, provisional, updated_at), ','
                        order by player_id, discipline))
    into h_rat_old from ratings;

  -- 2a. v2, Tabellen bereits aktuell
  t0 := clock_timestamp(); perform rebuild_elo_v2();
  msg := msg || ' || v2(aktuell)=' || round(extract(epoch from clock_timestamp() - t0) * 1000) || 'ms';
  select md5(string_agg(concat_ws('|', player_id, discipline, anchor_at, rating::text, games), ','
                        order by player_id, discipline, anchor_at)) into h_anch from elo_anchors;
  select md5(string_agg(concat_ws('|', player_id, discipline, rating::text, games_played, provisional, updated_at), ','
                        order by player_id, discipline)) into h_rat from ratings;
  msg := msg || case when h_anch = h_anch_old and h_rat = h_rat_old then ' gleich' else ' ABWEICHUNG' end;
  ok := ok and h_anch = h_anch_old and h_rat = h_rat_old;

  -- 2b. v2 nach Stoerung: alle Werte verfaelscht, Doppel-Anker weg, ein Fremdanker dazu
  update elo_anchors set rating = rating + 1, games = games + 1 where true;
  delete from elo_anchors where discipline = 'Doppel';
  insert into elo_anchors (player_id, discipline, anchor_at, rating, games)
  select id, 'Gesamt', '1900-01-01', 1, 1 from players limit 1;
  t0 := clock_timestamp(); perform rebuild_elo_v2();
  msg := msg || ' v2(alles_geaendert)=' || round(extract(epoch from clock_timestamp() - t0) * 1000) || 'ms';
  select md5(string_agg(concat_ws('|', player_id, discipline, anchor_at, rating::text, games), ','
                        order by player_id, discipline, anchor_at)) into h_anch from elo_anchors;
  select md5(string_agg(concat_ws('|', player_id, discipline, rating::text, games_played, provisional, updated_at), ','
                        order by player_id, discipline)) into h_rat from ratings;
  msg := msg || case when h_anch = h_anch_old and h_rat = h_rat_old then ' gleich' else ' ABWEICHUNG' end;
  ok := ok and h_anch = h_anch_old and h_rat = h_rat_old;

  -- 2c. v2 auf leerer Tabelle
  delete from elo_anchors where true;
  t0 := clock_timestamp(); perform rebuild_elo_v2();
  msg := msg || ' v2(leer)=' || round(extract(epoch from clock_timestamp() - t0) * 1000) || 'ms';
  select md5(string_agg(concat_ws('|', player_id, discipline, anchor_at, rating::text, games), ','
                        order by player_id, discipline, anchor_at)) into h_anch from elo_anchors;
  select md5(string_agg(concat_ws('|', player_id, discipline, rating::text, games_played, provisional, updated_at), ','
                        order by player_id, discipline)) into h_rat from ratings;
  msg := msg || case when h_anch = h_anch_old and h_rat = h_rat_old then ' gleich' else ' ABWEICHUNG' end;
  ok := ok and h_anch = h_anch_old and h_rat = h_rat_old;

  raise exception 'ERGEBNIS % | Anker=% | %', case when ok then 'IDENTISCH' else 'NICHT IDENTISCH' end, n_old, msg;
end
$mess$;
