/* Erzeugt supabase/2026-10-18c_activity_badges.sql (idempotent; die frueheren Stufen stammen aus 2026-10-11_discipline_badges.sql) aus src/lib/disciplineBadges.js:  node scripts/genDisciplineBadges.mjs
   Die Datei NICHT von Hand aendern - Katalogtexte, Stufen und Emoji stehen nur in disciplineBadges.js. */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BADGES as ALL_BADGES, DISCIPLINES, OLD_HEYBALL, OLD_ALL, CATEGORY, ALL_SUFFIX } from "../src/lib/disciplineBadges.js";

// Erkundungs-Erfolge (Familie ex) gehoeren zur eigenen Migration (scripts/genExplorerBadges.mjs): sie brauchen die Tabelle locations
const BADGES = ALL_BADGES.filter((b) => b.family !== "ex");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const q = (s) => (s == null ? "null" : "'" + String(s).replace(/'/g, "''") + "'");

const rows = BADGES.map((b) =>
  `  (${q(b.key)}, ${q(b.emoji)}, ${q(b.name)}, ${q(b.descDe)}, ${q(CATEGORY)}, ${q(b.sub)}, ${q(b.family)}, ${b.threshold}, ${q(b.discipline)}, ${b.tier}, ${b.sort}, false)`
).join(",\n");
const discList = DISCIPLINES.map(q).join(", ");
const oldMap = Object.entries(OLD_HEYBALL).map(([o, n]) => `(${q(o)}, ${q(n)})`).join(", ");
const oldAll = OLD_ALL.map(q).join(", ");

const sql = `-- Erfolge je Disziplin (Kategorie "Disziplinen"), "Alle Disziplinen" und "Doppel": ${BADGES.length} neue Erfolge.
-- GENERIERT von scripts/genDisciplineBadges.mjs aus src/lib/disciplineBadges.js - nicht von Hand aendern.
--
-- Je Disziplin (8 Ball, 9 Ball, 10 Ball, 14/1 Endlos, Heyball) dieselbe Familie:
--   m Matches gespielt (1/10/50/100/200/500) | w Siege (1/10/25/50/100) | n zu null gewonnen (1/5/10)
--   s Siege in Folge in dieser Disziplin (3/5)  | g verschiedene Gegner (5/10)
-- "Alle Disziplinen": xw Siege in JEDER Disziplin (1/5/10/25/50), xm Matches in jeder (10/50/100), xn zu null in jeder (1/5)
-- "Hill-Hill" (Einzel, ohne 14/1, Endstand W:W-1 ab W=3): hm gespielt (1/5/10/25), hw gewonnen (1/5/10/25),
--   hc gewonnen nach 2 Punkten Rueckstand (1/3; braucht das Punkte-Protokoll run_log)
-- "Doppel": dm Doppel gespielt, dw Doppel-Siege, ds Doppel-Siege in Folge, dp verschiedene Partner
-- Gezaehlt wird wie bei allen Erfolgen: bestaetigte Matches ohne Gast-Beteiligung; je Disziplin und "Alle" nur Einzel,
-- "Doppel" nur Doppel (ein Doppel zaehlt fuer alle vier Spieler mit dem Ergebnis der eigenen Seite).
--
-- Die alten Gesamt-Erfolge (Siege insgesamt, Serien, Matches insgesamt, zu null, verschiedene Gegner) bleiben unveraendert
-- und zaehlen weiter ueber alle Disziplinen; ihre Beschreibung bekommt den Zusatz "${ALL_SUFFIX.trim()}".
-- Die zwoelf frueheren Heyball-Erfolge (2026-10-10b) wandern auf die neuen Schluessel, bereits vergebene bleiben erhalten.
-- Vergabe: compute_discipline_badges(), haengt an einem eigenen Statement-Trigger auf matches (wie zuvor bei Heyball),
-- nicht an trg_rebuild_ratings(). Erfolge werden nur eingefuegt, nie geloescht.
--
-- Emoji-Eindeutigkeit: alle ${BADGES.length} Symbole und Namen wurden vorab gegen den vollstaendigen Katalog geprueft; die
-- Kontrollabfrage am Ende muss leer sein. In Test UND Produktion ausfuehren, zuerst Test. Idempotent.

-- 1) Neue Katalog-Spalten: Unterblock, Familie, Schwelle, Disziplin (fuer Profil-Liste und Fortschrittsanzeige)
alter table public.badge_catalog
  add column if not exists subcategory text,
  add column if not exists family text,
  add column if not exists threshold integer,
  add column if not exists discipline text;

-- 2) Katalog: neue Erfolge (bei erneutem Ausfuehren werden Texte/Symbole nachgezogen)
insert into public.badge_catalog (badge_key, emoji, name, description, category, subcategory, family, threshold, discipline, tier, sort, secret) values
${rows}
on conflict (badge_key) do update set
  emoji = excluded.emoji, name = excluded.name, description = excluded.description, category = excluded.category,
  subcategory = excluded.subcategory, family = excluded.family, threshold = excluded.threshold, discipline = excluded.discipline,
  tier = excluded.tier, sort = excluded.sort, secret = excluded.secret;

-- 3) Alte Heyball-Erfolge auf die neuen Schluessel umhaengen (vergebene Erfolge und gewaehlter Avatar bleiben erhalten)
-- (ein einziger Block ohne temporaere Tabelle: die SQL-Oberflaeche fuehrt Statements nicht zwingend in derselben Sitzung aus)
do $migrate$
declare
  r record;
begin
  for r in select * from (values ${oldMap}) as m(old_key, new_key) loop
    update public.player_badges pb set badge_key = r.new_key
     where pb.badge_key = r.old_key
       and not exists (select 1 from public.player_badges x where x.player_id = pb.player_id and x.badge_key = r.new_key);
    delete from public.player_badges where badge_key = r.old_key;
    update public.players set selected_badge = r.new_key where selected_badge = r.old_key;
    delete from public.badge_catalog where badge_key = r.old_key;
  end loop;
end
$migrate$;

-- 4) Alte Gesamt-Erfolge: Beschreibung nennt jetzt, dass sie ueber alle Disziplinen zaehlen
update public.badge_catalog
   set description = description || '${ALL_SUFFIX}'
 where badge_key in (${oldAll})
   and description not like '%${ALL_SUFFIX}';

-- 5) Berechnung
create or replace function public.compute_discipline_badges()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- Einzel je Spieler und Disziplin (jedes Match zweimal: aus Sicht beider Spieler), ohne Gaeste
  drop table if exists dsc_singles;
  create temp table dsc_singles as
    select m.player1_id as player_id, m.player2_id as opp_id, m.discipline, m.played_at, m.id as mid,
           (m.score1 > m.score2) as won, m.score2 as opp_score
      from matches m
     where m.confirmed and m.player1b_id is null and m.discipline in (${discList})
       and not exists (select 1 from players p where p.id in (m.player1_id, m.player2_id) and p.is_guest)
    union all
    select m.player2_id, m.player1_id, m.discipline, m.played_at, m.id,
           (m.score2 > m.score1), m.score1
      from matches m
     where m.confirmed and m.player1b_id is null and m.discipline in (${discList})
       and not exists (select 1 from players p where p.id in (m.player1_id, m.player2_id) and p.is_guest);

  drop table if exists dsc_stats;
  create temp table dsc_stats as
    select player_id, discipline,
           count(*) as m,
           count(*) filter (where won) as w,
           count(*) filter (where won and opp_score = 0) as n,
           count(distinct opp_id) as g
      from dsc_singles group by player_id, discipline;

  -- laengste Siegesserie je Spieler und Disziplin (Reihenfolge nach Zeit; Unentschieden beenden die Serie)
  drop table if exists dsc_streaks;
  create temp table dsc_streaks as
    select player_id, discipline, max(streak) as s from (
      select player_id, discipline, count(*) as streak from (
        select player_id, discipline, won,
               row_number() over (partition by player_id, discipline order by played_at, mid)
               - row_number() over (partition by player_id, discipline, won order by played_at, mid) as grp
          from dsc_singles
      ) x
      where won
      group by player_id, discipline, grp
    ) y
    group by player_id, discipline;

  -- je Disziplin: Matches, Siege, zu null, Gegner
  insert into player_badges (player_id, badge_key)
  select s.player_id, c.badge_key
    from dsc_stats s
    join badge_catalog c on c.category = '${CATEGORY}' and c.discipline = s.discipline and c.family in ('m', 'w', 'n', 'g')
   where case c.family when 'm' then s.m when 'w' then s.w when 'n' then s.n else s.g end >= c.threshold
  on conflict do nothing;

  -- je Disziplin: Siege in Folge
  insert into player_badges (player_id, badge_key)
  select s.player_id, c.badge_key
    from dsc_streaks s
    join badge_catalog c on c.category = '${CATEGORY}' and c.discipline = s.discipline and c.family = 's'
   where s.s >= c.threshold
  on conflict do nothing;

  -- in JEDER Disziplin (alle ${DISCIPLINES.length} muessen mindestens ein Match haben; der kleinste Wert zaehlt)
  insert into player_badges (player_id, badge_key)
  select x.player_id, c.badge_key
    from (select player_id, min(w) as w, min(m) as m, min(n) as n
            from dsc_stats group by player_id having count(*) = ${DISCIPLINES.length}) x
    join badge_catalog c on c.category = '${CATEGORY}' and c.family in ('xw', 'xm', 'xn')
   where case c.family when 'xw' then x.w when 'xm' then x.m else x.n end >= c.threshold
  on conflict do nothing;

  -- Doppel: eine Zeile je Spieler und Doppelmatch, ohne Gaeste
  drop table if exists dsc_doubles;
  create temp table dsc_doubles as
    select v.player_id, v.partner_id, m.played_at, m.id as mid, v.won
      from matches m
     cross join lateral (values
       (m.player1_id,  m.player1b_id, m.score1 > m.score2),
       (m.player1b_id, m.player1_id,  m.score1 > m.score2),
       (m.player2_id,  m.player2b_id, m.score2 > m.score1),
       (m.player2b_id, m.player2_id,  m.score2 > m.score1)) as v(player_id, partner_id, won)
     where m.confirmed and m.player1b_id is not null and m.player2b_id is not null
       and not exists (select 1 from players p
                        where p.id in (m.player1_id, m.player1b_id, m.player2_id, m.player2b_id) and p.is_guest);

  insert into player_badges (player_id, badge_key)
  select d.player_id, c.badge_key
    from (select player_id, count(*) as m, count(*) filter (where won) as w, count(distinct partner_id) as p
            from dsc_doubles group by player_id) d
    join badge_catalog c on c.category = '${CATEGORY}' and c.family in ('dm', 'dw', 'dp')
   where case c.family when 'dm' then d.m when 'dw' then d.w else d.p end >= c.threshold
  on conflict do nothing;

  insert into player_badges (player_id, badge_key)
  select s.player_id, c.badge_key
    from (select player_id, max(streak) as s from (
            select player_id, count(*) as streak from (
              select player_id, won,
                     row_number() over (partition by player_id order by played_at, mid)
                     - row_number() over (partition by player_id, won order by played_at, mid) as grp
                from dsc_doubles
            ) x
            where won
            group by player_id, grp
          ) y group by player_id) s
    join badge_catalog c on c.category = '${CATEGORY}' and c.family = 'ds'
   where s.s >= c.threshold
  on conflict do nothing;

  -- Hill-Hill: Einzel (ohne 14/1, Gaeste ausgeschlossen), Endstand W:W-1 mit W >= 3, d.h. beide standen einen Punkt vor dem Ziel.
  -- hc: der Sieger lag laut Punkte-Protokoll (run_log = [[s1, s2, ts], ...]) zeitweise mit 2 oder mehr Punkten hinten.
  drop table if exists dsc_hill;
  create temp table dsc_hill as
    select v.player_id, v.won,
           v.won and jsonb_typeof(m.run_log) = 'array' and jsonb_typeof(m.run_log -> 0) = 'array'
             and exists (select 1 from jsonb_array_elements(m.run_log) e
                          where case when m.score1 > m.score2 then (e ->> 1)::int - (e ->> 0)::int
                                     else (e ->> 0)::int - (e ->> 1)::int end >= 2) as came_back
      from matches m
     cross join lateral (values (m.player1_id, m.score1 > m.score2), (m.player2_id, m.score2 > m.score1)) as v(player_id, won)
     where m.confirmed and m.player1b_id is null and m.discipline <> '14/1 Endlos'
       and abs(m.score1 - m.score2) = 1 and greatest(m.score1, m.score2) >= 3
       and not exists (select 1 from players p where p.id in (m.player1_id, m.player2_id) and p.is_guest);

  insert into player_badges (player_id, badge_key)
  select h.player_id, c.badge_key
    from (select player_id, count(*) as m, count(*) filter (where won) as w, count(*) filter (where came_back) as c
            from dsc_hill group by player_id) h
    join badge_catalog c on c.category = '${CATEGORY}' and c.family in ('hm', 'hw', 'hc')
   where case c.family when 'hm' then h.m when 'hw' then h.w else h.c end >= c.threshold
  on conflict do nothing;

  -- Aktivitaet: eine Zeile je Spieler und Match (Einzel und Doppel), ohne Gaeste und Walkover; Tag = Wiener Kalendertag,
  -- Woche = floor((Tag + 3) / 7) (Montag-Wochen; Tag 0 = 1.1.1970, ein Donnerstag). Gleiche Formel in achievements.js.
  drop table if exists dsc_act;
  create temp table dsc_act as
    select distinct v.player_id, ((m.played_at at time zone 'Europe/Vienna')::date - date '1970-01-01') as day
      from matches m
     cross join lateral (values (m.player1_id), (m.player2_id), (m.player1b_id), (m.player2b_id)) as v(player_id)
     where m.confirmed and not m.walkover and v.player_id is not null
       and not exists (select 1 from players p
                        where p.id in (m.player1_id, m.player2_id, m.player1b_id, m.player2b_id) and p.is_guest);

  insert into player_badges (player_id, badge_key)
  select a.player_id, c.badge_key
    from (select player_id, count(*) as d from dsc_act group by player_id) a
    join badge_catalog c on c.category = '${CATEGORY}' and c.family = 'ad'
   where a.d >= c.threshold
  on conflict do nothing;

  insert into player_badges (player_id, badge_key)
  select s.player_id, c.badge_key
    from (select player_id, max(n) as w from (
            select player_id, count(*) as n from (
              select player_id, wk - row_number() over (partition by player_id order by wk) as grp
                from (select distinct player_id, (day + 3) / 7 as wk from dsc_act) x
            ) y group by player_id, grp
          ) z group by player_id) s
    join badge_catalog c on c.category = '${CATEGORY}' and c.family = 'aw'
   where s.w >= c.threshold
  on conflict do nothing;

  insert into player_badges (player_id, badge_key)
  select r.player_id, c.badge_key
    from (select player_id, count(*) filter (where day - prev >= 30) as back
            from (select player_id, day, lag(day) over (partition by player_id order by day) as prev from dsc_act) x
           group by player_id) r
    join badge_catalog c on c.category = '${CATEGORY}' and c.family = 'ac'
   where r.back >= c.threshold
  on conflict do nothing;

  drop table if exists dsc_singles, dsc_stats, dsc_streaks, dsc_doubles, dsc_hill, dsc_act;
end;
$function$;

create or replace function public.trg_discipline_badges()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform compute_discipline_badges();
  return null;
end;
$function$;

-- 6) Trigger: der fruehere Heyball-Trigger (2026-10-10b) wird durch den allgemeinen ersetzt
drop trigger if exists matches_heyball_badges on public.matches;
drop function if exists public.trg_heyball_badges();
drop function if exists public.compute_heyball_badges();
drop trigger if exists matches_discipline_badges on public.matches;
create trigger matches_discipline_badges
  after insert or update or delete on public.matches
  for each statement execute function public.trg_discipline_badges();

-- 7) Bestehende Matches einmal nachrechnen
select public.compute_discipline_badges();

-- Kontrolle 1: Emoji-Duplikate im gesamten Katalog (muss leer sein)
select emoji, array_agg(badge_key order by badge_key) as badge_keys, count(*)
from badge_catalog group by emoji having count(*) > 1;

-- Kontrolle 2: Zahl der neuen Erfolge (muss ${BADGES.length} sein)
select count(*) as neue_erfolge from badge_catalog where category = '${CATEGORY}';
`;
writeFileSync(resolve(root, "supabase", "2026-10-18c_activity_badges.sql"), sql);
console.log(`geschrieben: ${BADGES.length} Erfolge, ${(sql.length / 1024).toFixed(1)} KB`);
