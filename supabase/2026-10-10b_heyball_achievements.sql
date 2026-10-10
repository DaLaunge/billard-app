-- Erfolge fuer die Disziplin Heyball (Kategorie "Heyball", 12 Stueck).
--
--   Matches : heyball_1 / _10 / _50           (Heyball-Matches gespielt)
--   Siege   : heyball_win1 / _10 / _25 / _50 / _100
--   Skill   : heyball_shutout (zu null gewonnen), heyball_streak3 / _5 (Siege in Folge),
--             heyball_opp5 (gegen 5 verschiedene Gegner gespielt)
--
-- Vergabe in compute_heyball_badges(). Sie haengt an einem eigenen Statement-Trigger auf matches
-- (wie matches_rebuild_ratings), statt trg_rebuild_ratings()/admin_refresh_stats() umzuschreiben -
-- so bleiben deren aktuelle Fassungen unangetastet. Gezaehlt werden nur bestaetigte Matches ohne
-- Gast-Beteiligung (wie compute_badges); Gaeste bekommen ohnehin keine Erfolge
-- (trg_no_badges_for_guests). Erfolge werden nur eingefuegt, nie geloescht.
--
-- Ist Heyball ausgeschaltet (app_settings.heyball_enabled), zeigt die App die Kategorie nicht;
-- bereits erreichte Erfolge bleiben gespeichert.
--
-- Emoji-Eindeutigkeit: alle zwoelf wurden gegen den vollstaendigen Katalog geprueft (keines kommt
-- vor), die Kontrollabfrage am Ende muss leer sein. In Test UND Produktion ausfuehren. Idempotent.

insert into public.badge_catalog (badge_key, name, description, emoji, category, tier, sort, secret) values
  ('heyball_1',       'Heyball-Debüt',        '1 Heyball-Match gespielt',                '🀄', 'Heyball', 1,  1, false),
  ('heyball_10',      'Laternenträger',       '10 Heyball-Matches gespielt',             '🏮', 'Heyball', 2,  2, false),
  ('heyball_50',      'Heyball-Stammgast',    '50 Heyball-Matches gespielt',             '🐼', 'Heyball', 3,  3, false),
  ('heyball_win1',    'Glücksbringer',        'Dein erstes Heyball-Match gewonnen',      '🧧', 'Heyball', 1,  4, false),
  ('heyball_win10',   'Feine Klinge',         '10 Heyball-Siege',                        '🥢', 'Heyball', 2,  5, false),
  ('heyball_win25',   'Dickes Fell',          '25 Heyball-Siege',                        '🐘', 'Heyball', 3,  6, false),
  ('heyball_win50',   'Festungsherr',         '50 Heyball-Siege',                        '🏯', 'Heyball', 4,  7, false),
  ('heyball_win100',  'Teemeister',           '100 Heyball-Siege',                       '🍵', 'Heyball', 5,  8, false),
  ('heyball_shutout', 'Weiße Weste',          'Ein Heyball-Match zu null gewonnen',      '🥋', 'Heyball', 1,  9, false),
  ('heyball_streak3', 'Tigersprung',          '3 Heyball-Siege in Folge',                '🐅', 'Heyball', 2, 10, false),
  ('heyball_streak5', 'Pfauenrad',            '5 Heyball-Siege in Folge',                '🦚', 'Heyball', 3, 11, false),
  ('heyball_opp5',    'Karpfenschwarm',       'Heyball gegen 5 verschiedene Gegner gespielt', '🎏', 'Heyball', 2, 12, false)
on conflict (badge_key) do nothing;

create or replace function public.compute_heyball_badges()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  drop table if exists hb_results;
  create temp table hb_results as
    select m.player1_id as player_id, m.player2_id as opp_id, m.played_at, m.id as mid,
           (m.score1 > m.score2) as won, m.score1 as my_score, m.score2 as opp_score
      from matches m
     where m.confirmed and m.discipline = 'Heyball'
       and not exists (select 1 from players p where p.id in (m.player1_id, m.player2_id) and p.is_guest)
    union all
    select m.player2_id, m.player1_id, m.played_at, m.id,
           (m.score2 > m.score1), m.score2, m.score1
      from matches m
     where m.confirmed and m.discipline = 'Heyball'
       and not exists (select 1 from players p where p.id in (m.player1_id, m.player2_id) and p.is_guest);

  -- Matches gespielt
  insert into player_badges (player_id, badge_key)
  select r.player_id, t.key
    from (select player_id, count(*) as n from hb_results group by player_id) r
    cross join (values ('heyball_1',1),('heyball_10',10),('heyball_50',50)) as t(key, thr)
   where r.n >= t.thr
  on conflict do nothing;

  -- Siege
  insert into player_badges (player_id, badge_key)
  select r.player_id, t.key
    from (select player_id, count(*) filter (where won) as wins from hb_results group by player_id) r
    cross join (values ('heyball_win1',1),('heyball_win10',10),('heyball_win25',25),
                       ('heyball_win50',50),('heyball_win100',100)) as t(key, thr)
   where r.wins >= t.thr
  on conflict do nothing;

  -- Zu null gewonnen
  insert into player_badges (player_id, badge_key)
  select distinct player_id, 'heyball_shutout' from hb_results where won and opp_score = 0
  on conflict do nothing;

  -- Gegen 5 verschiedene Gegner gespielt
  insert into player_badges (player_id, badge_key)
  select player_id, 'heyball_opp5' from hb_results group by player_id having count(distinct opp_id) >= 5
  on conflict do nothing;

  -- Siege in Folge (nur Heyball-Matches, nach Zeit geordnet)
  insert into player_badges (player_id, badge_key)
  select s.player_id, t.key
    from (
      select player_id, max(streak) as best from (
        select player_id, count(*) as streak from (
          select player_id, won,
                 row_number() over (partition by player_id order by played_at, mid)
                 - row_number() over (partition by player_id, won order by played_at, mid) as grp
            from hb_results
        ) x
        where won
        group by player_id, grp
      ) y group by player_id
    ) s
    cross join (values ('heyball_streak3',3),('heyball_streak5',5)) as t(key, thr)
   where s.best >= t.thr
  on conflict do nothing;

  drop table if exists hb_results;
end;
$function$;

create or replace function public.trg_heyball_badges()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform compute_heyball_badges();
  return null;
end;
$function$;

drop trigger if exists matches_heyball_badges on public.matches;
create trigger matches_heyball_badges
  after insert or update or delete on public.matches
  for each statement execute function public.trg_heyball_badges();

-- Bestehende Heyball-Matches einmal nachrechnen.
select compute_heyball_badges();

-- Kontrolle: Emoji-Duplikate im gesamten Katalog (muss leer sein).
select emoji, array_agg(badge_key order by badge_key) as badge_keys, count(*)
from badge_catalog group by emoji having count(*) > 1;
