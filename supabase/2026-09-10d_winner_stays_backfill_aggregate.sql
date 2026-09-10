-- Nachtraeglicher Fix fuer Winner-Stays-Runden, die schon VOR
-- 2026-09-10b_winner_stays_aggregate_match.sql beendet wurden (z.B. echtes
-- Spiel in Produktion am 09./10.09.2026, siehe Nutzer-Screenshot: mehrere
-- 1:0/0:1-9-Ball-Matches zwischen denselben Personen in "Letzte Matches").
-- winner_stays_finish_session() aggregiert erst SEIT diesem Fix - eine
-- schon abgeschlossene Runde bekommt dadurch keine zweite Chance, ihre
-- Racks nachtraeglich zusammenzufassen. Dieses Skript raeumt das einmalig
-- rueckwirkend auf.
--
-- Dazu wird die Aggregations-Logik aus winner_stays_finish_session() in
-- eine eigene, wiederverwendbare Funktion ausgelagert
-- (winner_stays_aggregate_session()) - finish_session() ruft sie jetzt nur
-- noch auf und setzt danach den Status. Das Backfill am Ende dieses
-- Skripts ruft dieselbe Funktion einmalig fuer JEDE bereits "finished"
-- Runde auf (auch fuer laengst korrekt aggregierte, z.B. aus dem
-- Test-Projekt - dort passiert dabei nichts Sichtbares, die Paarung hat ja
-- schon genau ein Match, das wird 1:1 durch ein gleichwertiges neues
-- ersetzt - kein Datenverlust, nur eine neue match_id).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

-- Bewusst OHNE current_player_id()/Rechte-Pruefung: diese Funktion ist ein
-- interner Baustein (aufgerufen von winner_stays_finish_session() UND vom
-- Backfill-Block unten, der ohne eingeloggte Session direkt im SQL-Editor
-- laeuft) - reported_by/confirmed_by kommen daher aus den Original-Racks
-- selbst (wer sie live gemeldet hat), nicht aus einem "aktuellen Nutzer".
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

    -- max()/min() existieren fuer uuid nicht ("function max(uuid) does not
    -- exist", live beim Ausfuehren aufgefallen, anders als bei least()/
    -- greatest() oben, die ueber Vergleichsoperatoren statt eines
    -- Aggregat-Funktionskatalogeintrags funktionieren) - stattdessen den
    -- Melder des zeitlich letzten Racks dieser Paarung gezielt holen.
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
                          reported_by, confirmed, confirmed_by, played_at, run_log)
    values (v_p1, v_p1b, v_p2, v_p2b, v_score1, v_score2, v_sess.discipline,
            coalesce(v_reporter, v_sess.organizer_id), true, coalesce(v_reporter, v_sess.organizer_id),
            v_played_at, v_run_log)
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

create or replace function public.winner_stays_finish_session(p_session_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if not (is_admin() or v_sess.organizer_id = v_me) then
    raise exception 'Nur die Leitung dieser Runde kann sie beenden.';
  end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist nicht aktiv.'; end if;

  perform winner_stays_aggregate_session(p_session_id);

  update winner_stays_sessions set status = 'finished', finished_at = now() where id = p_session_id;
end;
$function$;

-- Einmaliges Backfill: jede bereits "finished" Runde erneut aggregieren -
-- betrifft nur Runden, die schon abgeschlossen wurden, BEVOR diese
-- Aggregation existierte (fuer laengst korrekt aggregierte Runden aendert
-- sich dabei nur die match_id, nicht der Inhalt).
do $$
declare
  v_id uuid;
begin
  for v_id in select id from winner_stays_sessions where status = 'finished'
  loop
    perform winner_stays_aggregate_session(v_id);
  end loop;
end $$;
