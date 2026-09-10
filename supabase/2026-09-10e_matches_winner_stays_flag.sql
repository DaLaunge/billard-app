-- Nutzer-Feedback: "Bei 'Winner Stays' sehe ich zwar das Protokoll, aber
-- nicht das Flag, dass es ein Turnierspiel war." Das bestehende Turnier-
-- Flag (🏆 in "Letzte Matches"/Protokoll) haengt an matches.tournament_id -
-- Winner-Stays-Matches sind aber nicht in der tournaments-Tabelle, sondern
-- in winner_stays_sessions organisiert, hatten also nie eine Chance, das
-- Flag zu zeigen. Neue Spalte matches.winner_stays_session_id schliesst
-- diese Luecke; der Client (App.jsx) zeigt das Flag jetzt bei tournament_id
-- ODER winner_stays_session_id.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

alter table public.matches
  add column if not exists winner_stays_session_id uuid references public.winner_stays_sessions(id);

create or replace function public.winner_stays_aggregate_session(p_session_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_sess winner_stays_sessions;
  v_pair record;
  v_run_log jsonb;
  v_score1 int;
  v_score2 int;
  v_played_at timestamptz;
  v_reporter uuid;
  v_match_id uuid;
  v_old_match_ids uuid[];
  v_p1 uuid; v_p1b uuid; v_p2 uuid; v_p2b uuid;
begin
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;

  for v_pair in
    select
      least(entry_a_id, entry_b_id) as side1_id,
      greatest(entry_a_id, entry_b_id) as side2_id
    from winner_stays_games
    where session_id = p_session_id
    group by least(entry_a_id, entry_b_id), greatest(entry_a_id, entry_b_id)
  loop
    select array_agg(distinct match_id) into v_old_match_ids
      from winner_stays_games
      where session_id = p_session_id
        and least(entry_a_id, entry_b_id) = v_pair.side1_id
        and greatest(entry_a_id, entry_b_id) = v_pair.side2_id
        and match_id is not null;

    select
      coalesce(sum(case when g.entry_a_id = v_pair.side1_id then g.score_a else g.score_b end), 0),
      coalesce(sum(case when g.entry_a_id = v_pair.side1_id then g.score_b else g.score_a end), 0),
      max(g.played_at)
    into v_score1, v_score2, v_played_at
    from winner_stays_games g
    where g.session_id = p_session_id
      and least(g.entry_a_id, g.entry_b_id) = v_pair.side1_id
      and greatest(g.entry_a_id, g.entry_b_id) = v_pair.side2_id;

    select reported_by into v_reporter
      from winner_stays_games
      where session_id = p_session_id
        and least(entry_a_id, entry_b_id) = v_pair.side1_id
        and greatest(entry_a_id, entry_b_id) = v_pair.side2_id
      order by game_no desc
      limit 1;

    select jsonb_agg(jsonb_build_array(s1_running, s2_running, extract(epoch from played_at) * 1000) order by game_no)
    into v_run_log
    from (
      select game_no, played_at,
        sum(case when entry_a_id = v_pair.side1_id then score_a else score_b end)
          over (order by game_no) as s1_running,
        sum(case when entry_a_id = v_pair.side1_id then score_b else score_a end)
          over (order by game_no) as s2_running
      from winner_stays_games
      where session_id = p_session_id
        and least(entry_a_id, entry_b_id) = v_pair.side1_id
        and greatest(entry_a_id, entry_b_id) = v_pair.side2_id
    ) g;

    select player1_id, player2_id into v_p1, v_p1b from winner_stays_entries where id = v_pair.side1_id;
    select player1_id, player2_id into v_p2, v_p2b from winner_stays_entries where id = v_pair.side2_id;

    insert into matches (player1_id, player1b_id, player2_id, player2b_id, score1, score2, discipline,
                          reported_by, confirmed, confirmed_by, played_at, run_log, winner_stays_session_id)
    values (v_p1, v_p1b, v_p2, v_p2b, v_score1, v_score2, v_sess.discipline,
            coalesce(v_reporter, v_sess.organizer_id), true, coalesce(v_reporter, v_sess.organizer_id),
            v_played_at, v_run_log, p_session_id)
    returning id into v_match_id;

    update winner_stays_games set match_id = v_match_id
      where session_id = p_session_id
        and least(entry_a_id, entry_b_id) = v_pair.side1_id
        and greatest(entry_a_id, entry_b_id) = v_pair.side2_id;

    if v_old_match_ids is not null then
      delete from match_confirmations where match_id = any(v_old_match_ids);
      update challenges set resolved_match_id = null where resolved_match_id = any(v_old_match_ids);
      delete from matches where id = any(v_old_match_ids);
    end if;
  end loop;
end;
$function$;

-- Backfill: bereits vorhandene, korrekt aggregierte Winner-Stays-Matches
-- (aus dem letzten Backfill-Lauf) bekommen die neue Spalte nachtraeglich
-- gesetzt, ohne sie komplett neu zu erzeugen.
update matches m set winner_stays_session_id = g.session_id
from winner_stays_games g
where g.match_id = m.id and m.winner_stays_session_id is null;
