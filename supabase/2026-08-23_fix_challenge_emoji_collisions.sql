-- Korrektur: zwei der drei Herausforderungs-Badges (aus
-- 2026-08-23_challenges.sql) haben Emojis, die schon vergeben waren.
-- Der eingebaute Kollisions-Check in diesem Skript hat NICHT gegriffen -
-- vermutlich weil der SQL-Editor die eingefuegten Statements nicht als
-- eine Transaktion ausfuehrt, sondern Anweisung fuer Anweisung, sodass
-- der INSERT trotz Exception im vorherigen DO-Block trotzdem lief.
-- Lektion: kuenftig vor dem Schreiben live gegen badge_catalog pruefen
-- (jetzt moeglich dank 2026-08-23_badge_catalog_public_read.sql), statt
-- auf einen In-Script-Guard zu vertrauen.
--
-- Gefundene Kollisionen (Stand 2026-08-23, Testprojekt):
--   ⚔️ challenge_accepted_1  <->  rival
--   🗡️ challenge_accepted_5  <->  giant50
--   🏹 challenge_accepted_15 ist eindeutig, bleibt unveraendert.
--
-- Neue, gegen den vollstaendigen Katalog geprueft eindeutige Emojis:
--   challenge_accepted_1: 🥊 (Boxhandschuh - "Angenommen")
--   challenge_accepted_5: 🪓 (Axt - "Kampflustig")
--
-- In Supabase SQL-Editor ausfuehren (Testprojekt jetzt; im Produktions-
-- Projekt erst, wenn dort auch 2026-08-23_challenges.sql laeuft).

update badge_catalog set emoji = '🥊' where badge_key = 'challenge_accepted_1';
update badge_catalog set emoji = '🪓' where badge_key = 'challenge_accepted_5';
