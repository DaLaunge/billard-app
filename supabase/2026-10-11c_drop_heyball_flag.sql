-- Aufraeumen: Der Heyball-Admin-Schalter (2026-10-10_heyball.sql, inzwischen aus dem Projekt entfernt) wurde noch am selben
-- Tag wieder abgeschafft, Heyball ist eine feste Disziplin. Die App ruft die beiden Funktionen nicht mehr auf, die Spalte wird
-- nirgends gelesen. In Test UND Produktion ausfuehren. Idempotent - auch auf Datenbanken, die den Schalter nie hatten.
drop function if exists public.get_feature_flags();
drop function if exists public.admin_set_heyball(boolean);
alter table public.app_settings drop column if exists heyball_enabled;

-- Kontrolle: muss 0 und 0 liefern
select (select count(*) from pg_proc where proname in ('get_feature_flags', 'admin_set_heyball')) as funktionen,
       (select count(*) from information_schema.columns where table_name = 'app_settings' and column_name = 'heyball_enabled') as spalte;
