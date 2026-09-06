-- Turnier-Bestenliste mit korrekten geteilten Plaetzen + zehn neue
-- Turniererfolge (Serien-Charakter: mehrfach 1./2./3. Platz erreicht).
--
-- Kernidee (formatuebergreifend, ohne Sonderfaelle je Turnierart): jeder
-- Spieler ausser dem/den Sieger(n) scheidet in GENAU einem Match endgueltig
-- aus - dem Match, das er verliert UND das loser_next_match_id is null hat
-- (kein weiterer Weg danach). Bei K.O. ist das jedes Match (kein
-- Verliererbaum). Bei Doppel-K.O. ist das nur ein Verliererbaum-/Finale-
-- Match, weil jeder Gewinnerbaum-Verlierer ja ueber loser_next_match_id in
-- den Verliererbaum weiterzieht und dort erst wirklich ausscheidet. Die
-- "Tiefe" eines Matches (Anzahl next_match_id-Schritte bis zum
-- Championship-Match) erfasst dadurch automatisch auch den kompletten
-- Verliererbaum, weil dessen Konsolidierungs-Matches am Ende selbst ueber
-- next_match_id ins Finale muenden. Alle Verlierer derselben Tiefe teilen
-- sich denselben Platz.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion:
-- wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat laufen,
-- zuerst Test.

-- =========================================================================
-- tournament_final_standings(): Endplatzierung eines Turniers inkl. echter
-- geteilter Plaetze. Client-aufrufbar (zeigt die Bestenliste an) UND intern
-- von compute_tournament_badges() genutzt.
-- =========================================================================

create or replace function public.tournament_final_standings(p_tournament_id uuid)
returns table (player_id uuid, placement int, tied_count int)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tour tournaments;
  v_has_final boolean;
begin
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then return; end if;

  select exists (
    select 1 from tournament_matches where tournament_id = p_tournament_id and bracket = 'final'
  ) into v_has_final;

  -- Bracket-Teil: deckt K.O./Doppel-K.O. komplett ab, bei Jeder-gegen-jeden
  -- nur den Playoff-Finalbaum (falls vorhanden).
  if v_tour.format in ('ko', 'double_ko') or v_has_final then
    return query
    with recursive scope as (
      select * from tournament_matches
      where tournament_id = p_tournament_id
        and (v_tour.format in ('ko', 'double_ko') or bracket = 'final')
    ),
    champion as (
      select id from scope where next_match_id is null and winner_id is not null limit 1
    ),
    depths as (
      select id, 0 as depth from scope where id = (select id from champion)
      union all
      select s.id, d.depth + 1
      from scope s
      join depths d on s.next_match_id = d.id
    ),
    eliminated as (
      -- Sieger: Platz 1 (Marker-Tiefe -1, garantiert die kleinste Gruppe)
      select s.winner_id as elim_player_id, -1 as elim_depth
      from scope s join depths d on d.id = s.id and d.depth = 0
      where s.winner_id is not null
      union all
      -- Finalist: Platz 2 (Verlierer des Championship-Matches, Tiefe 0)
      select (case when s.winner_id = s.player1_id then s.player2_id else s.player1_id end), 0
      from scope s join depths d on d.id = s.id and d.depth = 0
      where s.winner_id is not null
      union all
      -- Alle anderen: wirklich ausgeschieden, wenn kein loser_next_match_id
      select (case when s.winner_id = s.player1_id then s.player2_id else s.player1_id end), d.depth
      from scope s join depths d on d.id = s.id
      where s.winner_id is not null and coalesce(s.is_bye, false) = false
        and d.depth >= 1 and s.loser_next_match_id is null
    ),
    grp as (
      select elim_player_id, elim_depth, dense_rank() over (order by elim_depth) as grp_no
      from eliminated
    ),
    grp_sizes as (
      select grp_no, count(*) as cnt from grp group by grp_no
    ),
    placements as (
      select g.elim_player_id as out_player_id,
        (1 + coalesce((select sum(gs2.cnt) from grp_sizes gs2 where gs2.grp_no < g.grp_no), 0))::int as out_placement
      from grp g
    )
    select p.out_player_id, p.out_placement,
      (select count(*) from placements p2 where p2.out_placement = p.out_placement)::int
    from placements p;
  end if;

  -- Record-Teil: Jeder-gegen-jeden - volles Feld ohne Playoff, sonst nur die
  -- nicht qualifizierten Spieler unterhalb des Playoffs (echte Ties statt
  -- des Zufalls-Tiebreaks aus tournament_round_robin_ranking()).
  if v_tour.format = 'round_robin' then
    return query
    with qualifiers as (
      select player1_id as pid from tournament_matches where tournament_id = p_tournament_id and bracket = 'final' and player1_id is not null
      union
      select player2_id from tournament_matches where tournament_id = p_tournament_id and bracket = 'final' and player2_id is not null
    ),
    recs as (
      select tp.player_id as rec_player_id,
        count(*) filter (where tm.winner_id = tp.player_id) as wins,
        count(*) filter (where tm.winner_id is not null and tm.winner_id <> tp.player_id
                          and (tm.player1_id = tp.player_id or tm.player2_id = tp.player_id)) as losses
      from tournament_players tp
      left join tournament_matches tm
        on tm.tournament_id = p_tournament_id and tm.bracket = 'main'
        and (tm.player1_id = tp.player_id or tm.player2_id = tp.player_id)
      where tp.tournament_id = p_tournament_id
        and tp.player_id not in (select pid from qualifiers)
      group by tp.player_id
    ),
    ranked as (
      select rec_player_id, dense_rank() over (order by wins desc, losses asc) as r
      from recs
    )
    select ranked.rec_player_id, (ranked.r + coalesce(v_tour.playoff_size, 0))::int,
      (select count(*) from ranked r2 where r2.r = ranked.r)::int
    from ranked;
  end if;

  return;
end;
$function$;

-- =========================================================================
-- Zehn neue Turnier-Erfolge (Kategorie "Turniere") + compute_tournament_
-- badges() nach demselben Muster wie compute_challenge_badges() - zaehlt
-- ueber alle beendeten Turniere per tournament_final_standings().
-- =========================================================================

insert into badge_catalog (badge_key, emoji, name, description, category, tier, sort, secret) values
  ('tournament_win1',  '🏆', 'Turniersieger',        '1 Turnier gewonnen',   'Turniere', 1, 101, false),
  ('tournament_win3',  '👑', 'Serienmeister',        '3 Turniere gewonnen',  'Turniere', 2, 102, false),
  ('tournament_win5',  '💎', 'Turnierkönig',         '5 Turniere gewonnen',  'Turniere', 3, 103, false),
  ('tournament_win10', '🐐', 'Turnier-Dynastie',     '10 Turniere gewonnen', 'Turniere', 4, 104, false),
  ('tournament_2nd3',  '🥈', 'Ewiger Zweiter',       '3× Turnier-Zweiter',   'Turniere', 1, 105, false),
  ('tournament_2nd5',  '🎖️', 'Vizemeister',          '5× Turnier-Zweiter',   'Turniere', 2, 106, false),
  ('tournament_2nd10', '🪞', 'Silberrücken',         '10× Turnier-Zweiter',  'Turniere', 3, 107, false),
  ('tournament_3rd5',  '🥉', 'Podestjäger',          '5× Turnier-Dritter',   'Turniere', 1, 108, false),
  ('tournament_3rd10', '🧱', 'Bronze-Sammler',       '10× Turnier-Dritter',  'Turniere', 2, 109, false),
  ('tournament_3rd20', '⛰️', 'Fels in der Brandung', '20× Turnier-Dritter',  'Turniere', 3, 110, false)
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
  cross join (values ('tournament_2nd3', 3), ('tournament_2nd5', 5), ('tournament_2nd10', 10)) as t(key, thr)
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
  cross join (values ('tournament_3rd5', 5), ('tournament_3rd10', 10), ('tournament_3rd20', 20)) as t(key, thr)
  where s.n >= t.thr
  on conflict do nothing;
end;
$function$;

-- =========================================================================
-- Verdrahtung: trg_rebuild_ratings() (laeuft nach jedem bestaetigten Match,
-- auch Turniermatches) und admin_recompute_badges() (manueller "Erfolge neu
-- berechnen"-Button) - exaktes Verdrahtungsmuster wie die uebrigen
-- compute_*_badges()-Aufrufe (siehe is-admin-Recompute/Trigger).
-- =========================================================================

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
  perform compute_membership_badges();
  perform compute_tournament_badges();
  return 'ok';
end;
$function$;
