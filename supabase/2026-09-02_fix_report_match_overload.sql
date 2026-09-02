-- FIX: "Could not choose the best candidate function" beim Melden von
-- Matches (betrifft ALLE Disziplinen, nicht nur 14/1).
--
-- Ursache: die Migration 2026-09-02_141_run_log.sql hat report_match() per
-- "create or replace function" um den Parameter p_run_log erweitert. In
-- Postgres wird eine Funktion aber ueber Name + Parameter-TYPLISTE
-- identifiziert (nicht ueber den Namen allein) - durch den zusaetzlichen
-- Parameter hatte die neue Version eine andere Signatur als die alte, also
-- hat "create or replace" NICHT ersetzt, sondern eine zweite, ueberladene
-- Funktion report_match() angelegt. Seitdem gibt es zwei Versionen
-- gleichzeitig (12 und 13 Parameter). Ein Aufruf, der p_run_log nicht
-- mitschickt (z.B. ein noch nicht aktualisierter, gecachter Browser/PWA-
-- Client), passt auf BEIDE (der 13. Parameter hat ja einen Default) -
-- PostgREST kann dann nicht mehr eindeutig entscheiden, welche gemeint ist,
-- und lehnt den Aufruf komplett ab.
--
-- Fix: die alte 12-Parameter-Version explizit loeschen, damit nur noch die
-- neue (mit p_run_log) uebrig bleibt.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen. Produktion ist dringend,
-- da dort aktuell das Melden JEDES Matches fehlschlagen kann.

drop function if exists public.report_match(
  uuid, integer, integer, text, integer, integer, integer, integer, numeric, numeric, integer, integer
);
