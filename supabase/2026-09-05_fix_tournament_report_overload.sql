-- FIX: derselbe Overload-Bug wie schon einmal in
-- 2026-09-02_fix_report_match_overload.sql (siehe dortiger Kommentar fuer
-- die volle Erklaerung) - diesmal bei tournament_report_match() und
-- tournament_organizer_report_match(). 2026-09-05_tournament_report_141_details.sql
-- hat beide Funktionen per "create or replace" um die 14/1-Parameter
-- erweitert. Da Postgres Funktionen ueber Name + Parameter-TYPLISTE
-- identifiziert, hat das NICHT ersetzt, sondern je eine zweite,
-- ueberladene Version angelegt - die alten 3-Parameter-Versionen
-- existieren jetzt parallel weiter. PostgREST kann dann nicht mehr
-- eindeutig entscheiden, welche gemeint ist, und lehnt den Aufruf ab
-- ("Could not choose the best candidate function").
--
-- Fix: die alten 3-Parameter-Versionen explizit loeschen, damit nur noch
-- die neuen (mit den 14/1-Parametern) uebrig bleiben.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion:
-- wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat laufen.

drop function if exists public.tournament_report_match(uuid, integer, integer);
drop function if exists public.tournament_organizer_report_match(uuid, integer, integer);
