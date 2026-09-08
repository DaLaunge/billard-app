-- Fix: create_tournament() existiert seit der letzten Migration DOPPELT.
-- "create or replace function" ersetzt eine Funktion nur bei EXAKT
-- gleicher Parameterliste - da die neue Version (Anmeldephase) p_player_ids
-- komplett weggelassen hat, legte Postgres eine ZWEITE, unabhaengige
-- Ueberladung an, statt die alte zu ersetzen. Die alte 7-Parameter-Version
-- (mit p_player_ids) ist dadurch immer noch live und voll funktionsfaehig -
-- legt sofort ein laufendes Turnier mit fester Teilnehmerliste an,
-- KOMPLETT AN DER NEUEN ANMELDEPHASE VORBEI. Das ist kein theoretisches
-- Risiko, sondern ein echter Umgehungsweg (jeder authentifizierte Client,
-- der die alte Parameterform kennt/cached hat, koennte ihn weiter nutzen) -
-- (Aehnlicher Fall schon einmal aufgetreten, siehe
-- 2026-09-05_fix_tournament_report_overload.sql).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

drop function if exists public.create_tournament(text, text, text, uuid[], integer[], integer, boolean);
