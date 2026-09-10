-- Bugfix: Forderungs-Achievement (und drei weitere Kategorien) wurden nach
-- einem Match nie automatisch vergeben.
--
-- Ursache: trg_rebuild_ratings() (Trigger auf matches, feuert bei jeder
-- confirm_match()) ruft compute_badges()/compute_recruit_badges()/
-- compute_141_badges() auf - das war der vollstaendige Satz, als der
-- Trigger zuletzt angepasst wurde (2026-09-03_fix_trigger_backfill_
-- snapshots.sql). Seitdem kamen vier weitere compute_*_badges()-Funktionen
-- dazu (compute_opponent_streak_badges, compute_ghost_badges,
-- compute_challenge_badges, compute_membership_badges), die aber nur in
-- admin_recompute_badges() (dem manuellen "Erfolge neu berechnen"-Button)
-- verdrahtet wurden, nicht im Trigger. Ergebnis: alle Erfolge aus diesen
-- vier Kategorien - u.a. "Herausforderung angenommen" - wurden nach einem
-- Match nie automatisch vergeben, sondern nur wenn ein Admin manuell auf
-- "Erfolge neu berechnen" klickt (was hier seit Einfuehrung des Features
-- offenbar nie passiert ist).
--
-- Konkreter Anlass: Forderung Raphael Hamacher -> Christoph F. wurde am
-- 2026-09-03 erstellt und durch das Match vom 2026-09-05 automatisch als
-- "fulfilled" markiert (challenges.status), aber challenge_accepted_1
-- wurde nie in player_badges eingetragen.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion:
-- wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat laufen.

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
  return null;
end;
$function$;

-- Einmalig rueckwirkend nachholen, was der Trigger bisher verpasst hat
-- (u.a. Christophs "Herausforderung angenommen").
select compute_opponent_streak_badges();
select compute_ghost_badges();
select compute_challenge_badges();
select compute_membership_badges();
