-- Backend-Neuberechnung fuer die neuen Erfolge aus 2026-08-25_achievement_
-- expansion.sql: bisher waren compute_badges()/compute_141_badges() fest
-- auf die damals bekannten badge_keys programmiert (nicht dynamisch aus
-- badge_catalog abgeleitet), daher wurden neue Erfolge beim Klick auf
-- "Nur Erfolge neu berechnen" stillschweigend ignoriert.
--
-- Dieses Skript aendert NUR die drei unten genannten Funktionen und fuegt
-- eine neue hinzu - der Rest jeder Funktion ist 1:1 aus dem aktuell
-- eingespielten Code uebernommen (per pg_get_functiondef abgefragt), um
-- nichts Bestehendes zu veraendern.
--
-- Am Ende wird direkt (mit den Rechten des SQL-Editors, ohne den
-- is_admin()-Check von admin_recompute_badges() zu durchlaufen) einmalig
-- rueckwirkend neu berechnet - kein Klick auf den Admin-Button noetig.
--
-- In Supabase SQL-Editor ausfuehren (Testprojekt).

begin;

-- ============================================================
-- 1) compute_badges(): rival100/150/200 ergaenzt, "Marathon"-Block auf
--    Schwellenwert-Liste umgebaut (matches_day10/15 dazu), plus vier
--    komplett neue Bloecke am Ende (firststrike/revenge/triplewin/
--    bothmodes) - alles andere unveraendert.
-- ============================================================

create or replace function public.compute_badges()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  drop table if exists bt_results;
  create temp table bt_results as
    select m.player1_id as player_id, m.played_at, m.id as mid,
           (m.score1 > m.score2) as won, m.score1 as my_score, m.score2 as opp_score,
           m.discipline, m.player2_id as opp_id
    from matches m where m.confirmed
    union all
    select m.player2_id, m.played_at, m.id,
           (m.score2 > m.score1), m.score2, m.score1,
           m.discipline, m.player1_id
    from matches m where m.confirmed;

  -- SIEGE
  insert into player_badges (player_id, badge_key)
  select w.player_id, t.key
  from (select player_id, count(*) filter (where won) as wins from bt_results group by player_id) w
  cross join (values ('wins1',1),('wins10',10),('wins25',25),('wins50',50),
    ('wins100',100),('wins250',250),('wins500',500)) as t(key, thr)
  where w.wins >= t.thr on conflict do nothing;

  -- SERIEN
  insert into player_badges (player_id, badge_key)
  select s.player_id, t.key
  from (
    select player_id, max(streak) as best from (
      select player_id, count(*) as streak from (
        select player_id, won, (rn - rnw) as grp from (
          select player_id, won,
                 row_number() over (partition by player_id order by played_at, mid) as rn,
                 row_number() over (partition by player_id, won order by played_at, mid) as rnw
          from bt_results
        ) a
      ) b where won group by player_id, grp
    ) c group by player_id
  ) s
  cross join (values ('streak3',3),('streak5',5),('streak10',10),('streak15',15),('streak20',20)) as t(key, thr)
  where s.best >= t.thr on conflict do nothing;

  -- TREUE: Matches
  insert into player_badges (player_id, badge_key)
  select c.player_id, t.key
  from (select player_id, count(*) as n from bt_results group by player_id) c
  cross join (values ('matches10',10),('matches50',50),('matches100',100),('matches250',250)) as t(key, thr)
  where c.n >= t.thr on conflict do nothing;

  -- TREUE: verschiedene Gegner
  insert into player_badges (player_id, badge_key)
  select c.player_id, t.key
  from (select player_id, count(distinct opp_id) as g from bt_results group by player_id) c
  cross join (values ('opponents5',5),('opponents10',10)) as t(key, thr)
  where c.g >= t.thr on conflict do nothing;

  -- TREUE: Erzrivale (100/150/200 neu ergaenzt)
  insert into player_badges (player_id, badge_key)
  select x.player_id, t.key
  from (select player_id, opp_id, count(*) as n from bt_results group by player_id, opp_id) x
  cross join (values ('rival',10),('rival25',25),('rival50',50),
    ('rival100',100),('rival150',150),('rival200',200)) as t(key, thr)
  where x.n >= t.thr on conflict do nothing;

  -- SKILL: Zu-null
  insert into player_badges (player_id, badge_key)
  select s.player_id, t.key
  from (select player_id, count(*) as n from bt_results where won and opp_score = 0 group by player_id) s
  cross join (values ('shutout',1),('shutout5',5),('shutout10',10),('shutout25',25),('shutout50',50),('shutout100',100)) as t(key, thr)
  where s.n >= t.thr on conflict do nothing;

  -- SKILL: Stärkeren geschlagen (aktuelle Ratings)
  insert into player_badges (player_id, badge_key)
  select distinct r.player_id, t.key
  from bt_results r
  join ratings me on me.player_id = r.player_id and me.discipline = 'Gesamt'
  join ratings op on op.player_id = r.opp_id   and op.discipline = 'Gesamt'
  cross join (values ('giant50',50),('giant100',100),('giant150',150)) as t(key, diff)
  where r.won and op.rating >= me.rating + t.diff on conflict do nothing;

  -- SKILL: Disziplinen
  insert into player_badges (player_id, badge_key)
  select d.player_id, t.key
  from (select player_id, count(distinct discipline) as k from bt_results where won group by player_id) d
  cross join (values ('disc1',1),('disc2',2),('disc3',3),('disc4',4)) as t(key, thr)
  where d.k >= t.thr on conflict do nothing;

  -- SKILL: Comeback-König
  insert into player_badges (player_id, badge_key)
  select distinct player_id, 'comeback' from bt_results
  where won and opp_score >= 4 and (my_score - opp_score) <= 2 on conflict do nothing;

  -- SKILL: Krimi
  insert into player_badges (player_id, badge_key)
  select distinct player_id, 'hardfought' from bt_results
  where won and (my_score + opp_score) >= 15 and (my_score + opp_score) <= 30 on conflict do nothing;

  -- SKILL: Peak 600 (Snapshots)
  insert into player_badges (player_id, badge_key)
  select distinct player_id, 'peak600' from rating_snapshots
  where discipline = 'Gesamt' and rating >= 600 on conflict do nothing;

  -- SKILL: König / über 500  ***FIX: Wochen statt Snapshots zählen***
  insert into player_badges (player_id, badge_key)
  select s.player_id, t.key
  from (select player_id, count(distinct iso_week) filter (where rank = 1) as w1
        from rating_snapshots where discipline = 'Gesamt' group by player_id) s
  cross join (values ('king4',4),('king12',12)) as t(key, thr)
  where s.w1 >= t.thr on conflict do nothing;

  insert into player_badges (player_id, badge_key)
  select s.player_id, t.key
  from (select player_id, count(distinct iso_week) filter (where rating >= 500 and not provisional) as w5
        from rating_snapshots where discipline = 'Gesamt' group by player_id) s
  cross join (values ('over500_4',4),('over500_12',12)) as t(key, thr)
  where s.w5 >= t.thr on conflict do nothing;

  -- KURIOS: Angstgegner
  insert into player_badges (player_id, badge_key)
  select distinct player_id, 'nemesis'
  from (select player_id, opp_id, count(*) as w from bt_results where won group by player_id, opp_id) x
  where x.w >= 5 on conflict do nothing;

  -- KURIOS: Tageszeiten
  insert into player_badges (player_id, badge_key)
  select distinct player_id, 'nightowl' from bt_results
  where extract(hour from played_at at time zone 'Europe/Vienna') between 1 and 4 on conflict do nothing;
  insert into player_badges (player_id, badge_key)
  select distinct player_id, 'earlybird' from bt_results
  where extract(hour from played_at at time zone 'Europe/Vienna') between 5 and 8 on conflict do nothing;

  -- KURIOS: Wochenendkrieger
  insert into player_badges (player_id, badge_key)
  select player_id, 'weekend' from bt_results
  where extract(dow from played_at at time zone 'Europe/Vienna') in (0, 6)
  group by player_id having count(*) >= 20 on conflict do nothing;

  -- KURIOS: Marathon / Ultramarathon / Nimmermüde (Matches an einem Tag,
  -- vorher nur "Marathon" als Einzelfall - jetzt als Schwellenwert-Liste)
  insert into player_badges (player_id, badge_key)
  select d.player_id, t.key
  from (select player_id, (played_at at time zone 'Europe/Vienna')::date as tag, count(*) as n
        from bt_results group by player_id, tag) d
  cross join (values ('marathon',4),('matches_day10',10),('matches_day15',15)) as t(key, thr)
  where d.n >= t.thr on conflict do nothing;

  -- KURIOS: Pechvogel
  insert into player_badges (player_id, badge_key)
  select distinct player_id, 'heartbreak' from bt_results
  where not won and (opp_score - my_score) = 1 and (my_score + opp_score) >= 13 on conflict do nothing;

  -- KURIOS: David (vorläufig gg. Top-3)
  insert into player_badges (player_id, badge_key)
  select distinct r.player_id, 'david'
  from bt_results r
  join ratings me on me.player_id = r.player_id and me.discipline = 'Gesamt' and me.provisional
  join (select player_id, row_number() over (order by rating desc) as rnk
        from ratings where discipline = 'Gesamt' and not provisional) top
    on top.player_id = r.opp_id and top.rnk <= 3
  where r.won on conflict do nothing;

  -- KURIOS: Phönix
  insert into player_badges (player_id, badge_key)
  select distinct player_id, 'phoenix' from (
    select player_id, won,
           lag(won,1) over w as l1, lag(won,2) over w as l2, lag(won,3) over w as l3
    from bt_results window w as (partition by player_id order by played_at, mid)
  ) s where won and l1 = false and l2 = false and l3 = false on conflict do nothing;

  -- KURIOS (neu): Erstschlag - neuen Gegner beim allerersten Aufeinandertreffen besiegt
  insert into player_badges (player_id, badge_key)
  select distinct player_id, 'firststrike' from (
    select player_id, opp_id, won,
           row_number() over (partition by player_id, opp_id order by played_at, mid) as rn
    from bt_results
  ) x where rn = 1 and won on conflict do nothing;

  -- KURIOS (neu): Revanche - direkt nach einer Niederlage gg. denselben Gegner gewonnen
  insert into player_badges (player_id, badge_key)
  select distinct player_id, 'revenge' from (
    select player_id, opp_id, won,
           lag(won) over (partition by player_id, opp_id order by played_at, mid) as prev_won
    from bt_results
  ) x where won and prev_won = false on conflict do nothing;

  -- KURIOS (neu): Dreifachschlag - denselben Gegner 3x an einem Tag besiegt
  insert into player_badges (player_id, badge_key)
  select distinct player_id, 'triplewin' from (
    select player_id, opp_id, (played_at at time zone 'Europe/Vienna')::date as tag, count(*) as n
    from bt_results where won group by player_id, opp_id, tag
  ) x where n >= 3 on conflict do nothing;

  -- KURIOS (neu): Doppelt hält besser - am selben Tag Einzel UND Doppel gespielt
  insert into player_badges (player_id, badge_key)
  select s.player_id, 'bothmodes'
  from (
    select player1_id as player_id, (played_at at time zone 'Europe/Vienna')::date as tag
    from matches where confirmed and player1b_id is null
    union
    select player2_id, (played_at at time zone 'Europe/Vienna')::date
    from matches where confirmed and player1b_id is null
  ) s
  join (
    select player1_id as player_id, (played_at at time zone 'Europe/Vienna')::date as tag
      from matches where confirmed and player1b_id is not null
    union select player1b_id, (played_at at time zone 'Europe/Vienna')::date
      from matches where confirmed and player1b_id is not null
    union select player2_id, (played_at at time zone 'Europe/Vienna')::date
      from matches where confirmed and player1b_id is not null
    union select player2b_id, (played_at at time zone 'Europe/Vienna')::date
      from matches where confirmed and player1b_id is not null
  ) d on d.player_id = s.player_id and d.tag = s.tag
  on conflict do nothing;
end;
$function$;

-- ============================================================
-- 2) compute_141_badges(): Höchstserie-Schwellenwerte um die neuen,
--    feineren Stufen ergaenzt (3-9 einzeln, dann 5er-Schritte) - der
--    Rest der Funktion (Aufholjagd/Schnitt/Doppelpack) unveraendert.
-- ============================================================

create or replace function public.compute_141_badges()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- Höchstserie
  insert into player_badges (player_id, badge_key)
  select r.pid, t.key
  from (
    select pid, max(run) as best from (
      select player1_id as pid, high_run1 as run from matches
        where confirmed and discipline = '14/1 Endlos' and high_run1 is not null
      union all
      select player2_id, high_run2 from matches
        where confirmed and discipline = '14/1 Endlos' and high_run2 is not null
    ) x group by pid
  ) r
  cross join (values
    ('run3',3),('run4',4),('run5',5),('run6',6),('run7',7),('run8',8),('run9',9),
    ('run10',10),('run15',15),('run20',20),('run25',25),('run30',30),('run35',35),
    ('run40',40),('run45',45),('run50',50),('run55',55),('run60',60),('run65',65),
    ('run70',70),('run75',75),('run80',80),('run85',85),('run90',90),('run95',95),
    ('run100',100)
  ) as t(key, thr)
  where r.best >= t.thr
  on conflict do nothing;

  -- Aufholjagd
  insert into player_badges (player_id, badge_key)
  select c.winner, t.key
  from (
    select case when score1 > score2 then player1_id else player2_id end as winner,
           case when score1 > score2 then deficit1  else deficit2  end as deficit
    from matches
    where confirmed and discipline = '14/1 Endlos' and score1 <> score2
  ) c
  cross join (values ('cb30',30),('cb50',50)) as t(key, thr)
  where c.deficit is not null and c.deficit >= t.thr
  on conflict do nothing;

  -- Offensivschnitt (jetzt inkl. Einsteiger-Stufe Ø 1)
  insert into player_badges (player_id, badge_key)
  select r.pid, t.key
  from (
    select pid, max(a) as best from (
      select player1_id as pid, avg1 as a from matches
        where confirmed and discipline = '14/1 Endlos' and avg1 is not null
      union all
      select player2_id, avg2 from matches
        where confirmed and discipline = '14/1 Endlos' and avg2 is not null
    ) x group by pid
  ) r
  cross join (values ('avg1',1),('avg3',3),('avg5',5),('avg8',8),('avg12',12)) as t(key, thr)
  where r.best >= t.thr
  on conflict do nothing;

  -- Doppelpack (mindestens eine Zwei-Kugel-Räumung)
  insert into player_badges (player_id, badge_key)
  select pid, 'tb1' from (
    select player1_id as pid, coalesce(twoball1, 0) as tb from matches
      where confirmed and discipline = '14/1 Endlos'
    union all
    select player2_id, coalesce(twoball2, 0) from matches
      where confirmed and discipline = '14/1 Endlos'
  ) x
  group by pid
  having sum(tb) >= 1
  on conflict do nothing;
end;
$function$;

-- ============================================================
-- 3) Neu: compute_opponent_streak_badges() fuer die Siegesserien gegen
--    denselben Gegner. Doppel-Matches werden ausgeschlossen (player1b_id
--    is null) - bei zwei Gegnern im Doppel ist "ein Gegner" nicht
--    eindeutig, anders als bei den restlichen Funktionen oben, die
--    Doppel bisher ueberall mitzaehlen.
-- ============================================================

create or replace function public.compute_opponent_streak_badges()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into player_badges (player_id, badge_key)
  select s.player_id, t.key
  from (
    select player_id, opp_id, max(streak) as best
    from (
      select player_id, opp_id, count(*) as streak
      from (
        select player_id, opp_id, won, (rn - rnw) as grp
        from (
          select player_id, opp_id, won,
                 row_number() over (partition by player_id, opp_id order by played_at, mid) as rn,
                 row_number() over (partition by player_id, opp_id, won order by played_at, mid) as rnw
          from (
            select player1_id as player_id, player2_id as opp_id, played_at, id as mid, (score1 > score2) as won
            from matches where confirmed and player1b_id is null
            union all
            select player2_id, player1_id, played_at, id, (score2 > score1)
            from matches where confirmed and player1b_id is null
          ) r
        ) a
      ) b
      where won
      group by player_id, opp_id, grp
    ) c
    group by player_id, opp_id
  ) s
  cross join (values
      ('oppstreak2', 2), ('oppstreak3', 3), ('oppstreak4', 4), ('oppstreak5', 5),
      ('oppstreak7', 7), ('oppstreak10', 10), ('oppstreak15', 15), ('oppstreak20', 20)
    ) as t(key, thr)
  where s.best >= t.thr
  on conflict do nothing;
end;
$function$;

-- ============================================================
-- 4) admin_recompute_badges(): neue Funktion mit aufnehmen
-- ============================================================

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
  return 'ok';
end;
$function$;

-- ============================================================
-- 5) Einmalig direkt rueckwirkend neu berechnen (mit den Rechten des
--    SQL-Editors - kein Login/Admin-Klick noetig).
-- ============================================================

select compute_badges();
select compute_141_badges();
select compute_recruit_badges();
select compute_ghost_badges();
select compute_opponent_streak_badges();

commit;
