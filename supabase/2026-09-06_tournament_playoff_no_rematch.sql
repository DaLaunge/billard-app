-- Verbesserung am Doppel-K.O.-Cutover (2026-09-06_tournament_playoff_stage.sql):
-- zwei Spieler, die im selben Turnier bereits gegeneinander gespielt haben,
-- sollen in der Finalrunde (playoff_size > 2, also Halb-/Viertelfinale vor
-- dem eigentlichen Finale) nicht noch einmal aufeinandertreffen. Einzige
-- Ausnahme: das allerletzte Finalspiel selbst (bei playoff_size=2 ist DAS
-- ohnehin die gesamte Finalrunde - dort gibt es sowieso nur genau 1
-- moegliche Paarung, also nichts zu vermeiden - dieser Fall bleibt komplett
-- unveraendert auf dem bisherigen Weg).
--
-- Grund fuer den Umbau statt eines simplen Tauschs: generate_double_ko_losers()
-- laeuft EINMALIG bei der Turniererstellung, bevor auch nur ein Match
-- gespielt wurde - zu diesem Zeitpunkt steht nur die STRUKTUR fest (welche
-- Rasterplaetze ueberhaupt Qualifikanten liefern werden), nicht aber WER
-- diese Qualifikanten sein werden (das haengt vom tatsaechlichen Spielverlauf
-- ab). Eine Wiederholungsbegegnung laesst sich also nicht bei der Erstellung
-- vermeiden, sondern erst dann, wenn alle Qualifikanten-Quellmatches
-- tatsaechlich entschieden sind. Deshalb bleiben deren next_match_id/
-- loser_next_match_id bei playoff_size > 2 jetzt bewusst LEER (statt wie
-- bisher sofort auf feste Runde-1-Plaetze verdrahtet) - advance_tournament_bracket()
-- erkennt, sobald der LETZTE Qualifikant feststeht, holt sich alle
-- Qualifikanten-Sieger, sucht ueber tournament_no_rematch_pairing() eine
-- wiederholungsfreie Paarung (mehrere zufaellige Versuche, faellt auf die
-- Paarung mit den wenigsten Wiederholungen zurueck, falls keine perfekte
-- moeglich ist) und traegt sie direkt in die (schon leer vorbereiteten)
-- Finalrunde-1-Plaetze ein.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

-- Versucht eine Paarung ohne bereits im Turnier gespielte Begegnungen zu
-- finden: mehrere zufaellige Durchmischungen, jeweils paarweise (1&2, 3&4, ...)
-- geprueft gegen bestaetigte matches dieses Turniers. Bei kleinen
-- Teilnehmerzahlen (4 oder 8, mehr kommt hier nicht vor) findet das in aller
-- Regel sofort eine wiederholungsfreie Paarung; falls strukturell keine
-- moeglich ist, wird die mit den wenigsten Wiederholungen zurueckgegeben statt
-- eine Ausnahme zu werfen - eine Finalrunde soll nie komplett scheitern.
create or replace function public.tournament_no_rematch_pairing(p_tournament_id uuid, p_player_ids uuid[])
returns uuid[]
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_n int := array_length(p_player_ids, 1);
  v_attempt int;
  v_shuffled uuid[];
  v_conflicts int;
  v_best uuid[] := p_player_ids;
  v_best_conflicts int := 999;
  v_i int;
begin
  for v_attempt in 1..40 loop
    select array_agg(x) into v_shuffled from (select x from unnest(p_player_ids) x order by random()) t;
    v_conflicts := 0;
    for v_i in 1..(v_n / 2) loop
      if exists (
        select 1 from matches m
        where m.tournament_id = p_tournament_id and m.confirmed
          and ((m.player1_id = v_shuffled[2 * v_i - 1] and m.player2_id = v_shuffled[2 * v_i])
            or (m.player1_id = v_shuffled[2 * v_i] and m.player2_id = v_shuffled[2 * v_i - 1]))
      ) then
        v_conflicts := v_conflicts + 1;
      end if;
    end loop;
    if v_conflicts = 0 then
      return v_shuffled;
    end if;
    if v_conflicts < v_best_conflicts then
      v_best_conflicts := v_conflicts;
      v_best := v_shuffled;
    end if;
  end loop;
  return v_best;
end;
$function$;

revoke execute on function public.tournament_no_rematch_pairing(uuid, uuid[]) from public, anon, authenticated;

-- Baut nur das GERUEST der Finalrunde (alle Runden, intern verdrahtet) OHNE
-- die Runde-1-Startplaetze mit Spielern/Quellen zu fuellen - siehe Kommentar
-- oben. Fuer playoff_size=2 unveraendert generate_final_playoff_wired()
-- (dort verdrahtet, weil es dort ohnehin nur eine moegliche Paarung gibt).
create or replace function public.generate_final_playoff_shell(
  p_tournament_id uuid, p_playoff_size int, p_tables int[]
) returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_matches int := p_playoff_size / 2;
  v_round_ids uuid[]; v_next_ids uuid[];
  v_round int := 1; v_i int;
  v_table_idx int := 0; v_table_count int := array_length(p_tables, 1);
  v_id uuid;
begin
  v_round_ids := array_fill(null::uuid, array[v_matches]);
  for v_i in 1..v_matches loop
    v_table_idx := v_table_idx + 1;
    insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
    values (p_tournament_id, 'final', 1, v_i, p_tables[((v_table_idx - 1) % v_table_count) + 1])
    returning id into v_id;
    v_round_ids[v_i] := v_id;
  end loop;

  while v_matches > 1 loop
    v_matches := v_matches / 2;
    v_round := v_round + 1;
    v_next_ids := array_fill(null::uuid, array[v_matches]);
    for v_i in 1..v_matches loop
      v_table_idx := v_table_idx + 1;
      insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
      values (p_tournament_id, 'final', v_round, v_i, p_tables[((v_table_idx - 1) % v_table_count) + 1])
      returning id into v_id;
      v_next_ids[v_i] := v_id;
      update tournament_matches set next_match_id = v_id, next_slot = 1 where id = v_round_ids[2 * v_i - 1];
      update tournament_matches set next_match_id = v_id, next_slot = 2 where id = v_round_ids[2 * v_i];
    end loop;
    v_round_ids := v_next_ids;
  end loop;
end;
$function$;

revoke execute on function public.generate_final_playoff_shell(uuid, int, int[]) from public, anon, authenticated;

-- generate_double_ko_losers(): bei playoff_size=2 unveraendert (direkte
-- Verdrahtung, keine Paarungswahl moeglich/noetig); bei playoff_size>2 nur
-- noch das Geruest bauen, die Quellen bleiben unverdrahtet fuer die dynamische
-- Paarung in advance_tournament_bracket().
create or replace function public.generate_double_ko_losers(
  p_tournament_id uuid, p_wb_rounds int, p_tables int[], p_playoff_size int default 2
) returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_surv_ids uuid[] := array[]::uuid[];
  v_surv_via boolean[] := array[]::boolean[];
  v_new_ids uuid[];
  v_new_via boolean[];
  v_half1_ids uuid[]; v_half1_via boolean[];
  v_half2_ids uuid[]; v_half2_via boolean[];
  v_r int;
  v_lb_round int := 0;
  v_table_idx int := 0;
  v_size int;
  v_target int;
  v_k int;
  v_split int;
  v_rec record;
  v_wb_played_rounds int;
  v_wb_final_ids uuid[];
  v_playoff_sources uuid[] := array[]::uuid[];
  v_playoff_via boolean[] := array[]::boolean[];
  v_playoff_target int;
  v_i int;
begin
  v_size := power(2, p_wb_rounds)::int;
  v_playoff_target := greatest(1, p_playoff_size / 2);

  select max(round) into v_wb_played_rounds
    from tournament_matches where tournament_id = p_tournament_id and bracket = 'winners';

  for v_r in 1..v_wb_played_rounds loop
    if v_r = 1 then
      select coalesce(array_agg(id order by random()), array[]::uuid[]) into v_new_ids
        from tournament_matches
        where tournament_id = p_tournament_id and bracket = 'winners' and round = 1 and coalesce(is_bye, false) = false;
    else
      select coalesce(array_agg(id order by random()), array[]::uuid[]) into v_new_ids
        from tournament_matches
        where tournament_id = p_tournament_id and bracket = 'winners' and round = v_r;
    end if;
    select coalesce(array_agg(true), array[]::boolean[]) into v_new_via from unnest(v_new_ids);

    v_lb_round := v_lb_round + 1;
    if v_r = 1 then
      v_k := array_length(v_new_ids, 1);
      v_split := ceil(v_k / 2.0)::int;
      v_half1_ids := v_new_ids[1:v_split]; v_half1_via := v_new_via[1:v_split];
      v_half2_ids := v_new_ids[v_split + 1:v_k]; v_half2_via := v_new_via[v_split + 1:v_k];
      select * into v_rec from lb_pair(p_tournament_id, v_lb_round, v_half1_ids, v_half1_via, v_half2_ids, v_half2_via, p_tables, v_table_idx);
    else
      select * into v_rec from lb_pair(p_tournament_id, v_lb_round, v_surv_ids, v_surv_via, v_new_ids, v_new_via, p_tables, v_table_idx);
    end if;
    v_table_idx := v_rec.p_table_idx;
    v_surv_ids := v_rec.out_ids;
    v_surv_via := v_rec.out_via;

    if v_r < v_wb_played_rounds then
      v_target := greatest(v_playoff_target, (v_size / power(2, v_r + 1))::int);
    else
      v_target := v_playoff_target;
    end if;
    while array_length(v_surv_ids, 1) > v_target loop
      v_lb_round := v_lb_round + 1;
      v_k := array_length(v_surv_ids, 1);
      v_split := ceil(v_k / 2.0)::int;
      v_half1_ids := v_surv_ids[1:v_split]; v_half1_via := v_surv_via[1:v_split];
      v_half2_ids := v_surv_ids[v_split + 1:v_k]; v_half2_via := v_surv_via[v_split + 1:v_k];
      select * into v_rec from lb_pair(p_tournament_id, v_lb_round, v_half1_ids, v_half1_via, v_half2_ids, v_half2_via, p_tables, v_table_idx);
      v_table_idx := v_rec.p_table_idx;
      v_surv_ids := v_rec.out_ids;
      v_surv_via := v_rec.out_via;
    end loop;
  end loop;

  select array_agg(id order by bracket_position) into v_wb_final_ids
    from tournament_matches
    where tournament_id = p_tournament_id and bracket = 'winners' and round = v_wb_played_rounds;

  if array_length(v_wb_final_ids, 1) is distinct from array_length(v_surv_ids, 1) then
    raise exception 'Nicht genug Teilnehmer für diese Playoff-Größe bei dieser Formatkombination - bitte kleinere Playoff-Größe oder mehr Teilnehmer wählen.';
  end if;

  if p_playoff_size = 2 then
    for v_i in 1..array_length(v_wb_final_ids, 1) loop
      v_playoff_sources := v_playoff_sources || v_wb_final_ids[v_i] || v_surv_ids[v_i];
      v_playoff_via := v_playoff_via || false || v_surv_via[v_i];
    end loop;
    perform generate_final_playoff_wired(p_tournament_id, v_playoff_sources, v_playoff_via, p_tables);
  else
    -- Quellen bleiben unverdrahtet (kein tm_wire hier) - erst
    -- advance_tournament_bracket() weist ihnen, sobald alle bekannt sind,
    -- eine wiederholungsfreie Paarung zu (siehe dort).
    perform generate_final_playoff_shell(p_tournament_id, p_playoff_size, p_tables);
  end if;
end;
$function$;

revoke execute on function public.generate_double_ko_losers(uuid, int, int[], int) from public, anon, authenticated;

-- advance_tournament_bracket(): neuer Block fuers dynamische Paaren der
-- Finalrunde-1 bei playoff_size > 2 (siehe Kommentar oben). Alles andere
-- unveraendert gegenueber 2026-09-06_tournament_playoff_stage.sql.
create or replace function public.advance_tournament_bracket()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tm tournament_matches;
  v_tour tournaments;
  v_winner uuid;
  v_loser uuid;
  v_ranked uuid[];
  v_qualified uuid[];
  v_paired uuid[];
  v_slots uuid[];
  v_i int;
begin
  if new.confirmed is distinct from true or new.tournament_id is null then
    return new;
  end if;

  select * into v_tm from tournament_matches where match_id = new.id;
  if not found then return new; end if;

  v_winner := case when new.score1 > new.score2 then new.player1_id else new.player2_id end;
  v_loser := case when new.score1 > new.score2 then new.player2_id else new.player1_id end;

  update tournament_matches set winner_id = v_winner where id = v_tm.id;

  if v_tm.next_match_id is not null then
    if v_tm.next_slot = 1 then
      update tournament_matches set player1_id = v_winner where id = v_tm.next_match_id;
    else
      update tournament_matches set player2_id = v_winner where id = v_tm.next_match_id;
    end if;
    update tournament_matches set ready_at = now()
      where id = v_tm.next_match_id and ready_at is null and player1_id is not null and player2_id is not null;
  end if;

  if v_tm.loser_next_match_id is not null then
    if v_tm.loser_next_slot = 1 then
      update tournament_matches set player1_id = v_loser where id = v_tm.loser_next_match_id;
    else
      update tournament_matches set player2_id = v_loser where id = v_tm.loser_next_match_id;
    end if;
    update tournament_matches set ready_at = now()
      where id = v_tm.loser_next_match_id and ready_at is null and player1_id is not null and player2_id is not null;
  end if;

  select * into v_tour from tournaments where id = v_tm.tournament_id;

  -- Dynamisches Paaren der Finalrunde-1 bei Doppel-K.O.-Cutover mit
  -- playoff_size > 2: eine Qualifikanten-Quelle (Gewinner-/Verliererbaum-
  -- Match ohne next_match_id, d.h. die letzte Runde ihres jeweiligen Baums)
  -- ist gerade entschieden - pruefen, ob damit ALLE Quellen feststehen, und
  -- falls ja, die Finalrunde-1 jetzt mit einer wiederholungsfreien Paarung
  -- befuellen. WICHTIG: nur next_match_id ist das richtige Merkmal - eine
  -- Gewinnerbaum-Qualifikanten-Quelle hat i.d.R. TROTZDEM ein gesetztes
  -- loser_next_match_id (ihr Verlierer faellt ja weiterhin in den
  -- Verliererbaum), das darf die Erkennung nicht ausschliessen (frueherer
  -- Bug: die zusaetzliche "loser_next_match_id is null"-Bedingung liess genau
  -- die Gewinnerbaum-Qualifikanten unter den Tisch fallen).
  if v_tm.bracket in ('winners', 'losers') and v_tm.next_match_id is null
     and v_tour.format = 'double_ko' and v_tour.playoff_size is not null and v_tour.playoff_size > 2
     and not exists (select 1 from tournament_matches where tournament_id = v_tour.id and bracket = 'final' and player1_id is not null)
  then
    if not exists (
      select 1 from tournament_matches
      where tournament_id = v_tour.id and bracket in ('winners', 'losers')
        and next_match_id is null and winner_id is null
    ) then
      select array_agg(winner_id) into v_qualified
        from tournament_matches
        where tournament_id = v_tour.id and bracket in ('winners', 'losers')
          and next_match_id is null;
      v_paired := tournament_no_rematch_pairing(v_tour.id, v_qualified);
      select array_agg(id order by bracket_position) into v_slots
        from tournament_matches where tournament_id = v_tour.id and bracket = 'final' and round = 1;
      for v_i in 1..array_length(v_slots, 1) loop
        update tournament_matches set player1_id = v_paired[2 * v_i - 1], player2_id = v_paired[2 * v_i], ready_at = now()
          where id = v_slots[v_i];
      end loop;
    end if;
  end if;

  if v_tour.format = 'round_robin' and v_tour.playoff_size is not null then
    if not exists (select 1 from tournament_matches where tournament_id = v_tour.id and bracket = 'main' and winner_id is null)
       and not exists (select 1 from tournament_matches where tournament_id = v_tour.id and bracket = 'final')
    then
      v_ranked := tournament_round_robin_ranking(v_tour.id);
      perform generate_final_playoff_players(v_tour.id, v_ranked[1:v_tour.playoff_size], v_tour.table_numbers);
    elsif not exists (
      select 1 from tournament_matches
      where tournament_id = v_tour.id and next_match_id is null and loser_next_match_id is null and winner_id is null
    ) then
      update tournaments set status = 'finished', finished_at = now() where id = v_tour.id;
    end if;
  elsif v_tour.format = 'round_robin' then
    if not exists (select 1 from tournament_matches where tournament_id = v_tour.id and winner_id is null) then
      update tournaments set status = 'finished', finished_at = now() where id = v_tour.id;
    end if;
  else
    if not exists (
      select 1 from tournament_matches
      where tournament_id = v_tour.id and next_match_id is null and loser_next_match_id is null
        and winner_id is null
    ) then
      update tournaments set status = 'finished', finished_at = now() where id = v_tour.id;
    end if;
  end if;

  return new;
end;
$function$;
