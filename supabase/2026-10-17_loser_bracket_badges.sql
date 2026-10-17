-- Zwei neue Turnier-Erfolge fuer das Doppel-K.O.:
--   tournament_loser_win   "Bumerang"        - den Verliererbaum gewonnen (Sieger des letzten
--                                              Verliererbaum-Matches, das ins Finale fuehrt;
--                                              egal wie das Finale danach ausgeht).
--   tournament_win_comeback "Comeback-Sieger" - das Turnier gewonnen, obwohl im Gewinnerbaum
--                                              mindestens ein Match verloren wurde (also ueber
--                                              den Verliererbaum zurueck an die Spitze).
-- compute_tournament_badges() wird komplett neu geschrieben (Stand 2026-09-17d + die zwei
-- neuen Bloecke). Gaeste bekommen keine Erfolge (Trigger no_badges_for_guests).
--
-- Emoji katalogweit geprueft: weder 🪃 noch 🦋 kommen im Katalog vor.
--
-- In Supabase SQL-Editor ausfuehren, ZUERST Test, dann Produktion. Mehrfaches Ausfuehren ist
-- unschaedlich.

begin;

insert into badge_catalog (badge_key, emoji, name, description, category, tier, sort, secret) values
  ('tournament_loser_win',    '🪃', 'Bumerang',        'Den Verliererbaum eines Turniers gewonnen',                   'Turniere', 1, 113, false),
  ('tournament_win_comeback', '🦋', 'Comeback-Sieger', 'Ein Turnier gewonnen, obwohl du im Gewinnerbaum verloren hast', 'Turniere', 1, 114, false)
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

  -- Bumerang: Sieger des letzten Verliererbaum-Matches (fuehrt ins Finale), tatsaechlich gespielt.
  insert into player_badges (player_id, badge_key)
  select distinct tm.winner_id, 'tournament_loser_win'
  from tournament_matches tm
  join tournament_matches nx on nx.id = tm.next_match_id and nx.bracket = 'final'
  where tm.bracket = 'losers' and tm.winner_id is not null
    and tm.match_id is not null and not tm.is_bye and not tm.void
  on conflict do nothing;

  -- Comeback-Sieger: Turniersieger, der im Gewinnerbaum mindestens ein Match verloren hat.
  insert into player_badges (player_id, badge_key)
  select distinct fs.player_id, 'tournament_win_comeback'
  from tournaments tour
  cross join lateral tournament_final_standings(tour.id) fs
  where tour.status = 'finished' and fs.placement = 1
    and exists (
      select 1 from tournament_matches wm
      where wm.tournament_id = tour.id and wm.bracket = 'winners'
        and wm.winner_id is not null and wm.winner_id <> fs.player_id
        and fs.player_id in (wm.player1_id, wm.player2_id)
        and wm.match_id is not null and not wm.is_bye and not wm.void
    )
  on conflict do nothing;
end;
$function$;

-- Rueckwirkend vergeben.
select compute_tournament_badges();

commit;
