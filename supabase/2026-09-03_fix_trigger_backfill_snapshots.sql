-- Nachtrag zu 2026-09-03_fix_backfill_snapshots_bug.sql: dort wurden nur
-- die zwei BEKANNTEN Aufrufer von backfill_snapshots() (nightly_refresh,
-- admin_refresh_stats) angepasst und die Funktion dann geloescht. Es gab
-- aber einen DRITTEN Aufrufer, der dabei uebersehen wurde: den Trigger
-- "matches_rebuild_ratings" auf der matches-Tabelle (Funktion
-- trg_rebuild_ratings()) - der feuert bei JEDER Aenderung an matches,
-- also auch bei confirm_match(). Seit backfill_snapshots() geloescht ist,
-- schlaegt dieser Trigger und damit jede Match-Bestaetigung mit
-- "function backfill_snapshots() does not exist" fehl.
--
-- Fix: trg_rebuild_ratings() auf snapshot_ratings() umstellen, exakt wie
-- schon bei nightly_refresh()/admin_refresh_stats().
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion:
-- wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat laufen,
-- auf Produktion moeglichst sofort (Match-Bestaetigung ist dort aktuell
-- kaputt).

create or replace function public.trg_rebuild_ratings()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform rebuild_elo();
  perform snapshot_ratings();     -- heutigen Punkt pro Disziplin schreiben
  perform compute_badges();
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_recruit_badges') then
    perform compute_recruit_badges();
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_141_badges') then
    perform compute_141_badges();
  end if;
  return null;
end;
$function$;
