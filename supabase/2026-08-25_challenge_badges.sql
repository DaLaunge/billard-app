-- Erfolge "Herausforderungen angenommen" tatsaechlich freischalten
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen: zuerst Test, und erst wenn
-- der Fix auf main geht, auch in Produktion.
--
-- Hintergrund: 2026-08-23_challenges.sql hat die drei badge_catalog-Zeilen
-- challenge_accepted_1/5/15 angelegt, aber nie eine Berechnungsfunktion
-- dafuer geschrieben (siehe Kommentar dort). Der Live-Fortschritt in der
-- Erfolge-Ansicht zeigte daher zwar korrekt an, wie viele Herausforderungen
-- angenommen wurden, aber player_badges wurde nie befuellt - der Erfolg
-- konnte nie tatsaechlich freigeschaltet werden.

create or replace function public.compute_challenge_badges()
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into player_badges (player_id, badge_key)
  select c.challenged_id, t.key
  from (
    select challenged_id, count(*) as n
    from challenges
    where status = 'fulfilled'
    group by challenged_id
  ) c
  cross join (values
      ('challenge_accepted_1', 1), ('challenge_accepted_5', 5), ('challenge_accepted_15', 15)
    ) as t(key, thr)
  where c.n >= t.thr
  on conflict do nothing;
end;
$$;

-- admin_recompute_badges() um den neuen Aufruf erweitern (identisch zur
-- bestehenden Funktion aus 2026-08-25_backend_badge_functions.sql, nur mit
-- der zusaetzlichen compute_challenge_badges()-Zeile).
create or replace function public.admin_recompute_badges()
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  perform compute_badges();
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_recruit_badges') then
    perform compute_recruit_badges();
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_141_badges') then
    perform compute_141_badges();
  end if;
  perform compute_ghost_badges();
  perform compute_opponent_streak_badges();
  perform compute_challenge_badges();
  return 'ok';
end;
$function$;

-- Einmalig direkt rueckwirkend neu berechnen (mit den Rechten des
-- SQL-Editors - kein Login/Admin-Klick noetig), falls schon vor diesem Fix
-- Herausforderungen erfuellt wurden.
select compute_challenge_badges();
