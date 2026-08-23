-- badge_catalog oeffentlich lesbar machen
-- In Supabase SQL-Editor ausfuehren. Getrennte Projekte, siehe
-- 2026-08-23_challenges.sql - fuer meine Emoji-/Katalog-Pruefungen reicht
-- vorerst das TEST-Projekt (hadamdvpnwslztsxmwdr); Produktion
-- (wofsutwidaitloeiwnma) nur bei Bedarf/fuer Konsistenz ebenfalls.
--
-- badge_catalog enthaelt ausschliesslich Erfolgs-Definitionen (Emoji, Name,
-- Beschreibung, Kategorie) - keine Nutzerdaten. Bisher blockiert RLS jeden
-- anonymen Read (leeres Ergebnis statt Fehler), daher kann ich den Katalog
-- nicht pruefen (z.B. auf doppelt vergebene Emojis). Diese Policy macht nur
-- das Lesen oeffentlich; Schreibrechte bleiben unveraendert (weiterhin nur
-- ueber eure bestehenden serverseitigen Funktionen/Admin-Tools).

alter table public.badge_catalog enable row level security;

drop policy if exists "badge_catalog_select_public" on public.badge_catalog;
create policy "badge_catalog_select_public" on public.badge_catalog
  for select using (true);
