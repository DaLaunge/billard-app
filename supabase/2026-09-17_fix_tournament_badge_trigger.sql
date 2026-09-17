-- Nutzer-Feedback: "Christoph F. sollte das Turnier Achievement erhalten,
-- hat es aber nicht bekommen." - Turnier "7ΞVΞNΞЯ5 fun" (Doppel-K.O.),
-- Christoph F. gewann ungeschlagen, bekam aber keinen tournament_win*-Badge.
--
-- Root Cause (live in Test reproduziert: frisches 2-Spieler-K.O.-Turnier
-- angelegt, Match als Turnierleitung eingetragen, Turnier sofort
-- "finished" - Sieger hatte hinterher KEINEN Eintrag in player_badges,
-- obwohl tournament_final_standings() beim manuellen Aufruf korrekt
-- placement=1 fuer ihn liefert):
--
-- compute_tournament_badges() (siehe 2026-09-06_tournament_standings_and_badges.sql)
-- wurde dort korrekt sowohl in trg_rebuild_ratings() (der automatische
-- Trigger nach jedem bestaetigten Match) als auch in
-- admin_recompute_badges() (manueller "Erfolge neu berechnen"-Button)
-- verdrahtet. NOCH AM SELBEN TAG hat 2026-09-06_trigger_full_badge_recompute.sql
-- trg_rebuild_ratings() erneut per CREATE OR REPLACE ueberschrieben, um vier
-- ANDERE, bis dahin nur im manuellen Recompute vorhandene compute_*_badges()-
-- Funktionen zu ergaenzen (compute_opponent_streak_badges/ghost/challenge/
-- membership, siehe Kommentar dort) - dabei aber offenbar auf einer
-- AELTEREN Fassung der Funktion aufgesetzt, die compute_tournament_badges()
-- noch nicht kannte. Der Aufruf ist seitdem in trg_rebuild_ratings()
-- verschwunden (in admin_recompute_badges() ist er weiterhin vorhanden -
-- deshalb hat "Erfolge neu berechnen" das Problem bisher immer wieder
-- unsichtbar gemacht, sobald irgendwann danach manuell ausgefuehrt).
-- Turnier-Badges wurden seit 2026-09-06 also NIE automatisch vergeben,
-- nur wenn ein Admin zufaellig den manuellen Recompute-Button gedrueckt hat.
--
-- Fix: compute_tournament_badges() wieder in trg_rebuild_ratings()
-- ergaenzen (identisch zur bisherigen Definition, siehe
-- 2026-09-06_trigger_full_badge_recompute.sql, nur um den fehlenden Aufruf
-- erweitert - unbedingt statt ueber die exists()-Pruefung, da die Funktion
-- schon seit 2026-09-06 fest existiert, genau wie beim Aufruf in
-- admin_recompute_badges()). Zusaetzlich einmaliger Backfill-Aufruf am Ende
-- dieses Skripts, damit alle seit 2026-09-06 betroffenen, bereits
-- abgeschlossenen Turniere (inkl. "7ΞVΞNΞЯ5 fun") ihre Badges nachtraeglich
-- bekommen.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

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
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_opponent_streak_badges') then
    perform compute_opponent_streak_badges();
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_ghost_badges') then
    perform compute_ghost_badges();
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_challenge_badges') then
    perform compute_challenge_badges();
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_membership_badges') then
    perform compute_membership_badges();
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_tournament_badges') then
    perform compute_tournament_badges();
  end if;
  return null;
end;
$function$;

-- Einmaliger Backfill: vergibt sofort alle Turnier-Badges, die seit dem
-- Regressions-Datum (2026-09-06) faellig gewesen waeren, inkl. Christoph F.
select public.compute_tournament_badges();
