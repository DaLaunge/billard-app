-- Winner Stays: "Turnier beenden" lief bei vielen Paarungen in den Statement-Timeout
-- ("canceling statement due to statement timeout").
--
-- Ursache: winner_stays_aggregate_session() legte je Paarung EIN Match an und loeschte danach die alten Einzelspiel-
-- Matches (je Paarung ein INSERT und ein DELETE). Auf matches haengt ein Statement-Trigger, der bei jeder solchen
-- Anweisung die komplette Rating-Neuberechnung (~1 s) ausloest - bei 10 Paarungen also ~20 Neuberechnungen.
--
-- Jetzt: die Paarungen werden in einer Temp-Tabelle gesammelt, danach gibt es GENAU EIN INSERT und EIN DELETE auf matches,
-- also nur zwei Neuberechnungen, egal wie viele Paarungen es sind. Ergebnis (Matches inkl. winner_stays_session_id, run_log
-- mit der Dauer je Rack als 4. Wert, match_id der Spiele) ist unveraendert gegenueber der alten Fassung. In Test und
-- Produktion ausfuehren (zuerst Test). Idempotent.

create or replace function public.winner_stays_aggregate_session(p_session_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_sess winner_stays_sessions;
  v_old_match_ids uuid[];
begin
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;

  create temporary table if not exists _ws_agg (
    side1_id uuid, side2_id uuid, match_id uuid,
    p1 uuid, p1b uuid, p2 uuid, p2b uuid,
    score1 int, score2 int, played_at timestamptz, reporter uuid, run_log jsonb
  ) on commit drop;
  -- Supabase lehnt ein DELETE ohne WHERE ab ("DELETE requires a WHERE clause") - deshalb ausdruecklich "where true".
  delete from _ws_agg where true;

  -- Alle Paarungen auf einmal berechnen (statt Schleife mit je einem Match-INSERT).
  insert into _ws_agg (side1_id, side2_id, match_id, p1, p1b, p2, p2b, score1, score2, played_at, reporter, run_log)
  select pr.side1_id, pr.side2_id, gen_random_uuid(),
         e1.player1_id, e1.player2_id, e2.player1_id, e2.player2_id,
         t.score1, t.score2, t.played_at,
         coalesce((select g.reported_by from winner_stays_games g
                    where g.session_id = p_session_id
                      and least(g.entry_a_id, g.entry_b_id) = pr.side1_id
                      and greatest(g.entry_a_id, g.entry_b_id) = pr.side2_id
                    order by g.game_no desc limit 1), v_sess.organizer_id),
         (select jsonb_agg(
                   case when sd.duration_ms is not null
                     then jsonb_build_array(r.s1_running, r.s2_running, extract(epoch from r.played_at) * 1000, sd.duration_ms)
                     else jsonb_build_array(r.s1_running, r.s2_running, extract(epoch from r.played_at) * 1000)
                   end order by r.game_no)
            from (
              select g.game_no, g.played_at,
                sum(case when g.entry_a_id = pr.side1_id then g.score_a else g.score_b end) over (order by g.game_no) as s1_running,
                sum(case when g.entry_a_id = pr.side1_id then g.score_b else g.score_a end) over (order by g.game_no) as s2_running
              from winner_stays_games g
              where g.session_id = p_session_id
                and least(g.entry_a_id, g.entry_b_id) = pr.side1_id
                and greatest(g.entry_a_id, g.entry_b_id) = pr.side2_id
            ) r
            -- Dauer je Rack aus der SESSION-WEITEN Reihenfolge (nicht aus der nach Paarung gefilterten) - wie in der alten Fassung
            left join (
              select game_no,
                extract(epoch from (played_at - lag(played_at) over (order by game_no))) * 1000 as duration_ms
              from winner_stays_games
              where session_id = p_session_id
            ) sd on sd.game_no = r.game_no)
  from (
    select least(entry_a_id, entry_b_id) as side1_id, greatest(entry_a_id, entry_b_id) as side2_id
    from winner_stays_games
    where session_id = p_session_id
    group by 1, 2
  ) pr
  join winner_stays_entries e1 on e1.id = pr.side1_id
  join winner_stays_entries e2 on e2.id = pr.side2_id
  cross join lateral (
    select coalesce(sum(case when g.entry_a_id = pr.side1_id then g.score_a else g.score_b end), 0)::int as score1,
           coalesce(sum(case when g.entry_a_id = pr.side1_id then g.score_b else g.score_a end), 0)::int as score2,
           max(g.played_at) as played_at
    from winner_stays_games g
    where g.session_id = p_session_id
      and least(g.entry_a_id, g.entry_b_id) = pr.side1_id
      and greatest(g.entry_a_id, g.entry_b_id) = pr.side2_id
  ) t;

  select array_agg(distinct match_id) into v_old_match_ids
    from winner_stays_games where session_id = p_session_id and match_id is not null;

  -- EIN INSERT = eine Rating-Neuberechnung.
  insert into matches (id, player1_id, player1b_id, player2_id, player2b_id, score1, score2, discipline,
                       reported_by, confirmed, confirmed_by, played_at, run_log, winner_stays_session_id)
  select match_id, p1, p1b, p2, p2b, score1, score2, v_sess.discipline,
         reporter, true, reporter, played_at, run_log, p_session_id
  from _ws_agg;

  update winner_stays_games g set match_id = a.match_id
    from _ws_agg a
    where g.session_id = p_session_id
      and least(g.entry_a_id, g.entry_b_id) = a.side1_id
      and greatest(g.entry_a_id, g.entry_b_id) = a.side2_id;

  -- EIN DELETE = eine weitere Neuberechnung.
  if v_old_match_ids is not null then
    delete from match_confirmations where match_id = any(v_old_match_ids);
    update challenges set resolved_match_id = null where resolved_match_id = any(v_old_match_ids);
    delete from matches where id = any(v_old_match_ids);
  end if;
end;
$function$;
