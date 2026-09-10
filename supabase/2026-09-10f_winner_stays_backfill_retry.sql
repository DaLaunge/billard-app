-- Nutzer-Meldung: in Produktion sind einzelne, bereits beendete
-- Winner-Stays-Runden trotz gelaufenem Backfill (2026-09-10d) immer noch
-- NICHT zu Paarungs-Matches zusammengefasst (Beispiel: "7EVENER5 sand die
-- besten" - status "beendet", trotzdem 6 einzelne Racks statt 3
-- aggregierter Matches). Das Turnier-Flag zeigt trotzdem korrekt an, weil
-- 2026-09-10e's Spalten-Backfill (ein einfaches UPDATE, ruft KEINE
-- Aggregation auf) unabhaengig davon lief und jede einzelne alte
-- Match-Zeile mit winner_stays_session_id versehen hat.
--
-- Wahrscheinliche Ursache: das Backfill in 2026-09-10d ist ein einzelner
-- "do $$ ... $$"-Block, den der SQL-Editor als EINE Transaktion ausfuehrt -
-- wenn winner_stays_aggregate_session() fuer AUCH NUR EINE Runde in Prod
-- einen Fehler wirft (z.B. eine Runde mit einer fuer Test untypischen
-- Datenkonstellation), rollt das die GESAMTE Transaktion zurueck, inklusive
-- der fuer alle anderen, eigentlich unproblematischen Runden bereits
-- erledigten Aggregation - genau dasselbe Verhalten, das schon beim
-- max(uuid)-Bug beobachtet wurde.
--
-- Dieses Skript ersetzt nur den Backfill-Block: jede Runde bekommt ihre
-- EIGENE Sub-Transaktion (PL/pgSQL BEGIN/EXCEPTION-Block = impliziter
-- Savepoint) - schlaegt eine einzelne Runde fehl, wird nur ihre eigene
-- Aggregation zurueckgerollt (RAISE NOTICE zeigt an, welche und warum),
-- alle anderen Runden werden trotzdem fertig aggregiert.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

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
