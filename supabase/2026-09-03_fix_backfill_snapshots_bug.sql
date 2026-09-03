-- Bug: backfill_snapshots() ist ein Ueberbleibsel aus der Zeit VOR der
-- Pro-Disziplin-Umstellung (siehe 2026-09-03_per_discipline_snapshots.sql).
-- Sie schreibt ausschliesslich discipline='Gesamt' und waehlt pro Spieler
-- den juengsten elo_anchors-Eintrag per "distinct on (player_id)" - OHNE
-- nach discipline zu filtern. Seit elo_anchors pro Match UND Disziplin
-- einen eigenen Anker bekommt (mehrere Zeilen mit gleichem/nahem
-- anchor_at fuer denselben Spieler, je nach Disziplin unterschiedliches
-- Rating), pickt "distinct on (player_id)" bei Gleichstand/Naehe nicht-
-- deterministisch MAL den Gesamt-Anker, MAL einen disziplinspezifischen
-- Anker - und schreibt dessen (falsches) Rating als "Gesamt"-Tagespunkt.
--
-- Sowohl der naechtliche Cron (nightly_refresh) als auch der Admin-Button
-- "Neu berechnen" (admin_refresh_stats) riefen diese Funktion NACH der
-- bereits korrekten snapshot_ratings() auf und ueberschrieben deren
-- richtiges Ergebnis fuer 'Gesamt' wieder mit den verfaelschten Werten.
-- Sichtbar als Zacken/Sprung im "Entwicklung ueber die Zeit"-Graph genau
-- an Tagen ganz ohne neues Match.
--
-- Fix: backfill_snapshots() nicht mehr aufrufen und entfernen - die
-- einmalige komplette Rueckrechnung der Historie ist bereits per
-- 2026-09-03_backfill_discipline_history.sql erledigt; fuer den
-- laufenden Betrieb reicht snapshot_ratings() (bereits korrekt pro
-- Disziplin), das den heutigen Punkt schreibt.
--
-- Nach diesem Skript einmalig 2026-09-03_backfill_discipline_history.sql
-- ERNEUT ausfuehren (ist idempotent/nur Upserts) - das repariert die in
-- der Zwischenzeit durch den Bug verfaelschten Tage rueckwirkend.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion:
-- wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat laufen.

create or replace function public.nightly_refresh()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform rebuild_elo();          -- Rangliste (ratings) mit Verfall bis jetzt
  perform snapshot_ratings();     -- Verlauf (snapshots) fuer heute, pro Disziplin
end;
$function$;

create or replace function public.admin_refresh_stats()
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  perform rebuild_elo();
  perform snapshot_ratings();
  perform compute_badges();
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_recruit_badges') then
    perform compute_recruit_badges();
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_141_badges') then
    perform compute_141_badges();
  end if;
  return 'ok';
end;
$function$;

-- Wird nirgends mehr aufgerufen und ist fehlerhaft - entfernen, damit sie
-- nicht versehentlich (z.B. manuell im SQL-Editor) erneut Schaden anrichtet.
drop function if exists public.backfill_snapshots();

-- Heutigen Punkt sofort mit der korrekten Funktion nachziehen.
select public.snapshot_ratings();
