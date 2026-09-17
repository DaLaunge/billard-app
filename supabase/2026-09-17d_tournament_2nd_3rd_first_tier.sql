-- Bugfix: 2./3. Turnierplaetze schalteten nie einen Erfolg frei, wenn sie
-- SELTEN vorkamen.
--
-- Ursache: anders als bei Turniersiegen (tournament_win1 ab EINEM Sieg)
-- gab es fuer 2./3. Plaetze keine "einmal reicht"-Stufe - die niedrigste
-- Stufe lag bei 3x (tournament_2nd3) bzw. 5x (tournament_3rd5). Ein Spieler
-- mit erst einem oder zwei zweiten/dritten Plaetzen sah also ueberhaupt
-- keinen Erfolg und keinen Fortschritt zu einem freigeschalteten Erfolg -
-- wirkte kaputt, obwohl compute_tournament_badges()/tournament_final_
-- standings() selbst korrekt rechnen (in Test verifiziert: Spieler mit
-- 7x/6x zweitem/drittem Platz haben ihre 3er/5er-Erfolge sehr wohl).
--
-- Fix: neue Einstiegsstufen tournament_2nd1 ("1x Zweiter") und
-- tournament_3rd1 ("1x Dritter"), symmetrisch zu tournament_win1 - plus
-- compute_tournament_badges() um die neuen Schwellenwerte ergaenzt und
-- die sort-Reihenfolge der Turniere-Kategorie neu durchnummeriert, damit
-- die neuen Einstiegsstufen vor den bisherigen (jetzt hoeheren) Stufen
-- der jeweiligen Familie erscheinen.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion:
-- wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat laufen.

begin;

-- Platz fuer die neuen Einstiegsstufen schaffen (bestehende Stufen ab
-- 2nd3/3rd5 um eine Position nach hinten).
update badge_catalog set sort = sort + 1 where badge_key in ('tournament_2nd3', 'tournament_2nd5', 'tournament_2nd10');
update badge_catalog set sort = sort + 2 where badge_key in ('tournament_3rd5', 'tournament_3rd10', 'tournament_3rd20');

insert into badge_catalog (badge_key, category, sort, emoji, name, description) values
  ('tournament_2nd1', 'Turniere', 105, '🪩', 'Silberdebüt', '1× Turnier-Zweiter'),
  ('tournament_3rd1', 'Turniere', 109, '🔶', 'Bronzedebüt', '1× Turnier-Dritter')
on conflict (badge_key) do nothing;

create or replace function public.compute_tournament_badges()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into player_badges (player_id, badge_key)
  select s.player_id, t.key
  from (
    select fs.player_id, count(*) as n
    from tournaments tour
    cross join lateral tournament_final_standings(tour.id) fs
    where tour.status = 'finished' and fs.placement = 1
    group by fs.player_id
  ) s
  cross join (values ('tournament_win1', 1), ('tournament_win3', 3), ('tournament_win5', 5), ('tournament_win10', 10)) as t(key, thr)
  where s.n >= t.thr
  on conflict do nothing;

  insert into player_badges (player_id, badge_key)
  select s.player_id, t.key
  from (
    select fs.player_id, count(*) as n
    from tournaments tour
    cross join lateral tournament_final_standings(tour.id) fs
    where tour.status = 'finished' and fs.placement = 2
    group by fs.player_id
  ) s
  cross join (values ('tournament_2nd1', 1), ('tournament_2nd3', 3), ('tournament_2nd5', 5), ('tournament_2nd10', 10)) as t(key, thr)
  where s.n >= t.thr
  on conflict do nothing;

  insert into player_badges (player_id, badge_key)
  select s.player_id, t.key
  from (
    select fs.player_id, count(*) as n
    from tournaments tour
    cross join lateral tournament_final_standings(tour.id) fs
    where tour.status = 'finished' and fs.placement = 3
    group by fs.player_id
  ) s
  cross join (values ('tournament_3rd1', 1), ('tournament_3rd5', 5), ('tournament_3rd10', 10), ('tournament_3rd20', 20)) as t(key, thr)
  where s.n >= t.thr
  on conflict do nothing;
end;
$function$;

-- Einmalig rueckwirkend vergeben, damit laengst verdiente Einstiegsstufen
-- nicht erst beim naechsten Turnier auftauchen.
select compute_tournament_badges();

commit;
