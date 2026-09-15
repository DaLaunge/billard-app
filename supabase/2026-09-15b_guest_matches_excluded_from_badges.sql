-- Nachtrag zu 2026-09-15_guest_players_everywhere.sql: beim Live-Test im
-- Browser (Testmatch TestClaudeAdmin vs. TestGast1) hat sich gezeigt, dass
-- Gast-Matches zwar korrekt vom Rating ausgeschlossen sind (rebuild_elo()
-- schloss sie schon vorher aus) und clientseitig korrekt aus Serien/Quote/
-- Rekorden herausgefiltert werden (achievements.js/stats.js/runLog.js,
-- StatistikScreen.jsx, HeadToHeadCard.jsx), die SERVERSEITIGE Erfolge-
-- Vergabe (compute_badges(), compute_141_badges(),
-- compute_opponent_streak_badges() - alle per trg_rebuild_ratings() nach
-- jedem bestaetigten Match aufgerufen) aber komplett unabhaengig davon ist
-- und direkt auf matches liest, OHNE jede Gast-Ausnahme. Folge im Test:
-- ein einzelner Sieg gegen einen frisch angelegten Gast loeste sofort den
-- Erfolg "Hattrick" (3 Siege in Folge) aus, obwohl die Anzeige in der
-- Statistik-Uebersicht (die die gefixte achievements.js/stats.js-Logik
-- nutzt) korrekt bei der alten Serie blieb - ein sichtbarer Widerspruch
-- zwischen angezeigter und tatsaechlich vergebener Serie.
--
-- Fix: alle drei Funktionen bekommen dieselbe Gast-Ausschluss-Bedingung wie
-- rebuild_elo() (siehe 2026-09-10_tournament_guests.sql) - ein Match mit
-- Gast-Beteiligung (Einzel: player1_id/player2_id, wo vorhanden zusaetzlich
-- player1b_id/player2b_id) zaehlt fuer KEINE Erfolge-Kategorie mehr, weder
-- fuer den Gast selbst noch fuer den echten Gegner.
--
-- Bereits FAELSCHLICH vergebene Erfolge (aus dem Testmatch, oder falls
-- diese Migration spaeter als geplant kommt) werden durch diese Migration
-- NICHT automatisch zurueckgenommen - player_badges ist wie im gesamten
-- bestehenden System reines Anfuegen (on conflict do nothing), es gibt
-- nirgends eine Entzug-Funktion. Betroffene Einzelfaelle muessten manuell
-- aus player_badges geloescht werden.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

-- =========================================================================
-- 1) compute_badges(): identisch zur bisherigen Logik (siehe
--    2026-09-12_top3_ranking_badges.sql), nur bt_results schliesst jetzt
--    Matches mit Gast-Beteiligung aus.
-- =========================================================================
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
      and not exists (
        select 1 from players p
        where p.id in (m.player1_id, m.player2_id, m.player1b_id, m.player2b_id)
          and p.is_guest
      )
    union all
    select m.player2_id, m.played_at, m.id,
           (m.score2 > m.score1), m.score2, m.score1,
           m.discipline, m.player1_id
    from matches m where m.confirmed
      and not exists (
        select 1 from players p
        where p.id in (m.player1_id, m.player2_id, m.player1b_id, m.player2b_id)
          and p.is_guest
      );

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

  -- SKILL: König / über 500
  insert into player_badges (player_id, badge_key)
  select s.player_id, t.key
  from (select player_id, count(distinct iso_week) filter (where rank = 1) as w1
        from rating_snapshots where discipline = 'Gesamt' group by player_id) s
  cross join (values ('king4',4),('king12',12)) as t(key, thr)
  where s.w1 >= t.thr on conflict do nothing;

  -- SKILL: Podium (Top 3)
  insert into player_badges (player_id, badge_key)
  select s.player_id, t.key
  from (select player_id, count(distinct iso_week) filter (where rank <= 3) as w3
        from rating_snapshots where discipline = 'Gesamt' group by player_id) s
  cross join (values ('top3_1',1),('top3_4',4),('top3_12',12)) as t(key, thr)
  where s.w3 >= t.thr on conflict do nothing;

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

  -- KURIOS: Marathon / Ultramarathon / Nimmermüde
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

  -- KURIOS: Erstschlag
  insert into player_badges (player_id, badge_key)
  select distinct player_id, 'firststrike' from (
    select player_id, opp_id, won,
           row_number() over (partition by player_id, opp_id order by played_at, mid) as rn
    from bt_results
  ) x where rn = 1 and won on conflict do nothing;

  -- KURIOS: Revanche
  insert into player_badges (player_id, badge_key)
  select distinct player_id, 'revenge' from (
    select player_id, opp_id, won,
           lag(won) over (partition by player_id, opp_id order by played_at, mid) as prev_won
    from bt_results
  ) x where won and prev_won = false on conflict do nothing;

  -- KURIOS: Dreifachschlag
  insert into player_badges (player_id, badge_key)
  select distinct player_id, 'triplewin' from (
    select player_id, opp_id, (played_at at time zone 'Europe/Vienna')::date as tag, count(*) as n
    from bt_results where won group by player_id, opp_id, tag
  ) x where n >= 3 on conflict do nothing;

  -- KURIOS: Doppelt hält besser - am selben Tag Einzel UND Doppel gespielt
  -- (Doppel-Matches selbst kommen nicht ueber bt_results, sondern direkt
  -- aus matches - Gast-Ausschluss daher auch hier separat noetig)
  insert into player_badges (player_id, badge_key)
  select s.player_id, 'bothmodes'
  from (
    select player1_id as player_id, (played_at at time zone 'Europe/Vienna')::date as tag
    from matches where confirmed and player1b_id is null
      and not exists (select 1 from players p where p.id in (player1_id, player2_id) and p.is_guest)
    union
    select player2_id, (played_at at time zone 'Europe/Vienna')::date
    from matches where confirmed and player1b_id is null
      and not exists (select 1 from players p where p.id in (player1_id, player2_id) and p.is_guest)
  ) s
  join (
    select player1_id as player_id, (played_at at time zone 'Europe/Vienna')::date as tag
      from matches where confirmed and player1b_id is not null
        and not exists (select 1 from players p where p.id in (player1_id, player2_id, player1b_id, player2b_id) and p.is_guest)
    union select player1b_id, (played_at at time zone 'Europe/Vienna')::date
      from matches where confirmed and player1b_id is not null
        and not exists (select 1 from players p where p.id in (player1_id, player2_id, player1b_id, player2b_id) and p.is_guest)
    union select player2_id, (played_at at time zone 'Europe/Vienna')::date
      from matches where confirmed and player1b_id is not null
        and not exists (select 1 from players p where p.id in (player1_id, player2_id, player1b_id, player2b_id) and p.is_guest)
    union select player2b_id, (played_at at time zone 'Europe/Vienna')::date
      from matches where confirmed and player1b_id is not null
        and not exists (select 1 from players p where p.id in (player1_id, player2_id, player1b_id, player2b_id) and p.is_guest)
  ) d on d.player_id = s.player_id and d.tag = s.tag
  on conflict do nothing;
end;
$function$;

-- =========================================================================
-- 2) compute_141_badges(): identisch zur bisherigen Logik (siehe
--    2026-08-25_backend_badge_functions.sql), jede matches-Abfrage schliesst
--    jetzt Gast-Beteiligung aus.
-- =========================================================================
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
          and not exists (select 1 from players p where p.id in (player1_id, player2_id) and p.is_guest)
      union all
      select player2_id, high_run2 from matches
        where confirmed and discipline = '14/1 Endlos' and high_run2 is not null
          and not exists (select 1 from players p where p.id in (player1_id, player2_id) and p.is_guest)
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
      and not exists (select 1 from players p where p.id in (player1_id, player2_id) and p.is_guest)
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
          and not exists (select 1 from players p where p.id in (player1_id, player2_id) and p.is_guest)
      union all
      select player2_id, avg2 from matches
        where confirmed and discipline = '14/1 Endlos' and avg2 is not null
          and not exists (select 1 from players p where p.id in (player1_id, player2_id) and p.is_guest)
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
        and not exists (select 1 from players p where p.id in (player1_id, player2_id) and p.is_guest)
    union all
    select player2_id, coalesce(twoball2, 0) from matches
      where confirmed and discipline = '14/1 Endlos'
        and not exists (select 1 from players p where p.id in (player1_id, player2_id) and p.is_guest)
  ) x
  group by pid
  having sum(tb) >= 1
  on conflict do nothing;
end;
$function$;

-- =========================================================================
-- 3) compute_opponent_streak_badges(): identisch zur bisherigen Logik
--    (siehe 2026-08-25_backend_badge_functions.sql), die Basis-Abfrage
--    schliesst jetzt Gast-Beteiligung aus.
-- =========================================================================
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
              and not exists (select 1 from players p where p.id in (player1_id, player2_id) and p.is_guest)
            union all
            select player2_id, player1_id, played_at, id, (score2 > score1)
            from matches where confirmed and player1b_id is null
              and not exists (select 1 from players p where p.id in (player1_id, player2_id) and p.is_guest)
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
