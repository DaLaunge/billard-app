-- Zweiter, subtilerer Fall desselben Grundproblems wie in
-- 2026-09-09b_fix_winner_stays_rotation.sql (siehe auch den CLAUDE.md-
-- Eintrag dazu): winner_stays_report_game() rotiert bei einem Verlust NICHT
-- nur eine, sondern potenziell MEHRERE Warteschlangen-Positionen gleichzeitig
-- nach unten ("update ... set queue_position = queue_position - 1 where
-- queue_position > N"). Mit 4+ Teilnehmern kann das GLEICH ZWEI (oder mehr)
-- Zeilen in EINEM UPDATE-Statement betreffen, deren Ziel-Position genau die
-- Ausgangs-Position der jeweils naechsten verschobenen Zeile ist (eine
-- Verschiebungs-Kette). Anders als angenommen prueft Postgres den
-- Unique-Constraint bei einem nicht-deferrable Constraint NICHT erst am
-- Ende des gesamten Statements, sondern sobald die neue Indexzeile
-- geschrieben wird - trifft Postgres die Zeilen einer solchen Kette in
-- "falscher" Reihenfolge (Zielposition ist zum Zeitpunkt des Schreibens
-- noch von der naechsten, noch unverarbeiteten Zeile belegt), schlaegt der
-- Constraint trotzdem kurzzeitig fehl - live reproduziert mit 3 Teilnehmern
-- beim zweiten Rack (Rotation musste dort zwei Zeilen auf einmal
-- verschieben).
--
-- Die robuste Loesung ist nicht noch ein Sentinel-Wert fuer den naechsten
-- Sonderfall, sondern den Constraint DEFERRABLE INITIALLY DEFERRED zu
-- machen - Postgres prueft ihn dann erst am Ende der Transaktion (hier:
-- am Ende der RPC-Funktion), wenn ohnehin alle Zeilen ihre finalen,
-- eindeutigen Positionen haben. Das macht jede Rotation unabhaengig davon
-- robust, wie viele Zeilen in einem Aufruf verschoben werden muessen.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

-- ALTER CONSTRAINT ... DEFERRABLE geht in Postgres nur bei Fremdschluesseln,
-- nicht bei UNIQUE-Constraints ("is not a foreign key constraint", live
-- beim Ausfuehren aufgefallen) - deshalb hier Drop + Re-Add statt eines
-- simplen ALTER.
alter table public.winner_stays_entries
  drop constraint winner_stays_entries_session_id_queue_position_key;
alter table public.winner_stays_entries
  add constraint winner_stays_entries_session_id_queue_position_key
  unique (session_id, queue_position) deferrable initially deferred;
