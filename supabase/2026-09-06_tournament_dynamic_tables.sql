-- Tischnummern wurden bisher EINMALIG bei der Turniererstellung vergeben,
-- per lokalem Modulo-Zaehler in sieben unabhaengigen Generierungs-Funktionen.
-- Dadurch konnten z.B. "Gewinnerbaum Runde 1 Match 1" und "Verliererbaum
-- Runde 1 Match 1" denselben Tisch zugewiesen bekommen, obwohl beide
-- gleichzeitig spielbereit werden koennen (gemeldeter Bug: Doppelbelegung).
-- Bei Jeder-gegen-jeden ist es noch deutlicher: alle Partien einer Runde
-- werden sofort bei der Erstellung spielbereit, koennen aber weit mehr sein
-- als physische Tische vorhanden sind.
--
-- Neues Verhalten: Tischnummern werden nicht mehr fix vergeben, sondern
-- dynamisch ueber tournament_assign_free_tables() - ein Rasterplatz bekommt
-- erst dann eine Tischnummer, wenn beide Spieler feststehen UND tatsaechlich
-- ein Tisch frei ist. Ueberzaehlige Partien bleiben mit table_number = null
-- in einer FIFO-Warteschlange (aeltestes ready_at zuerst) und werden
-- automatisch bedient, sobald ein Tisch frei wird - das gilt bereits ab
-- Ergebnismeldung (match_id gesetzt), nicht erst ab Bestaetigung, weil der
-- Tisch dann physisch schon wieder frei ist.
--
-- Alle sieben Generierungs-Funktionen behalten ihre Signatur (die jetzt
-- ungenutzten p_tables/p_table_idx-Parameter bleiben formal bestehen) und
-- setzen table_number nur noch auf null statt ihn zu berechnen - reines
-- create or replace, kein drop function noetig.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion:
-- wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat laufen,
-- zuerst Test.

-- =========================================================================
-- tournament_assign_free_tables(): verteilt freie Tische an die am
-- laengsten wartenden spielbereiten Partien. Rein lesend+idempotent,
-- gefahrlos mehrfach aufrufbar.
-- =========================================================================

create or replace function public.tournament_assign_free_tables(p_tournament_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tables int[];
  v_table_count int;
  v_busy int[];
  v_free int[];
  v_waiting uuid[];
  v_i int;
begin
  select table_numbers into v_tables from tournaments where id = p_tournament_id;
  v_table_count := coalesce(array_length(v_tables, 1), 0);
  if v_table_count = 0 then return; end if;

  -- Ein Tisch gilt als belegt, solange fuer die dortige Partie noch KEIN
  -- Ergebnis gemeldet wurde (match_id is null) - ab Ergebnismeldung ist der
  -- Tisch physisch wieder frei, auch wenn das Ergebnis noch nicht bestaetigt ist.
  select coalesce(array_agg(distinct table_number), array[]::int[]) into v_busy
    from tournament_matches
    where tournament_id = p_tournament_id and table_number is not null and match_id is null;

  select coalesce(array_agg(t), array[]::int[]) into v_free
    from unnest(v_tables) t
    where not (t = any(v_busy));

  if coalesce(array_length(v_free, 1), 0) = 0 then return; end if;

  select coalesce(array_agg(id order by ready_at asc nulls last), array[]::uuid[]) into v_waiting
    from tournament_matches
    where tournament_id = p_tournament_id
      and coalesce(is_bye, false) = false
      and player1_id is not null and player2_id is not null
      and match_id is null and table_number is null;

  if coalesce(array_length(v_waiting, 1), 0) = 0 then return; end if;

  for v_i in 1..least(array_length(v_free, 1), array_length(v_waiting, 1)) loop
    update tournament_matches set table_number = v_free[v_i] where id = v_waiting[v_i];
  end loop;
end;
$function$;

revoke execute on function public.tournament_assign_free_tables(uuid) from public, anon, authenticated;

-- =========================================================================
-- lb_pair()/generate_round_robin()/generate_ko_bracket()/
-- generate_final_playoff_players()/_wired()/_shell(): table_number wird nur
-- noch auf null gesetzt statt per Modulo-Zaehler berechnet. Sonst
-- unveraendert.
-- =========================================================================

create or replace function public.lb_pair(
  p_tournament_id uuid, p_lb_round int,
  p_ids_a uuid[], p_via_a boolean[], p_ids_b uuid[], p_via_b boolean[],
  p_tables int[], inout p_table_idx int,
  out out_ids uuid[], out out_via boolean[]
)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_len_a int := coalesce(array_length(p_ids_a, 1), 0);
  v_len_b int := coalesce(array_length(p_ids_b, 1), 0);
  v_m int := least(v_len_a, v_len_b);
  v_i int;
  v_id uuid;
  v_pos int := 0;
begin
  out_ids := array[]::uuid[];
  out_via := array[]::boolean[];
  for v_i in 1..v_m loop
    v_pos := v_pos + 1;
    insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
      values (p_tournament_id, 'losers', p_lb_round, v_pos, null)
      returning id into v_id;
    perform tm_wire(p_ids_a[v_i], p_via_a[v_i], v_id, 1);
    perform tm_wire(p_ids_b[v_i], p_via_b[v_i], v_id, 2);
    out_ids := out_ids || v_id;
    out_via := out_via || false;
  end loop;
  if v_len_a > v_m then
    for v_i in (v_m + 1)..v_len_a loop
      out_ids := out_ids || p_ids_a[v_i];
      out_via := out_via || p_via_a[v_i];
    end loop;
  end if;
  if v_len_b > v_m then
    for v_i in (v_m + 1)..v_len_b loop
      out_ids := out_ids || p_ids_b[v_i];
      out_via := out_via || p_via_b[v_i];
    end loop;
  end if;
end;
$function$;

create or replace function public.generate_round_robin(
  p_tournament_id uuid, p_players uuid[], p_tables int[], p_double boolean default false
) returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_arr uuid[] := p_players;
  v_arr_start uuid[];
  v_n int := array_length(v_arr, 1);
  v_rounds int;
  v_i int;
  v_r int;
  v_pass int;
  v_home uuid;
  v_away uuid;
  v_pos int;
  v_tmp uuid;
  v_round_offset int := 0;
begin
  if v_n % 2 = 1 then
    v_arr := v_arr || null::uuid;
    v_n := v_n + 1;
  end if;
  v_rounds := v_n - 1;
  v_arr_start := v_arr;

  for v_pass in 1..(case when p_double then 2 else 1 end) loop
    v_arr := v_arr_start;
    for v_r in 1..v_rounds loop
      v_pos := 0;
      for v_i in 1..(v_n / 2) loop
        v_home := v_arr[v_i];
        v_away := v_arr[v_n - v_i + 1];
        if v_home is not null and v_away is not null then
          v_pos := v_pos + 1;
          -- Rueckrunde (v_pass=2): dieselben Paarungen, Heim/Auswaerts getauscht.
          insert into tournament_matches
            (tournament_id, bracket, round, bracket_position, player1_id, player2_id, table_number, ready_at)
          values (
            p_tournament_id, 'main', v_round_offset + v_r, v_pos,
            case when v_pass = 2 then v_away else v_home end,
            case when v_pass = 2 then v_home else v_away end,
            null, now()
          );
        end if;
      end loop;
      v_tmp := v_arr[v_n];
      for v_i in reverse v_n..3 loop
        v_arr[v_i] := v_arr[v_i - 1];
      end loop;
      v_arr[2] := v_tmp;
    end loop;
    v_round_offset := v_round_offset + v_rounds;
  end loop;
end;
$function$;

create or replace function public.generate_ko_bracket(
  p_tournament_id uuid, p_players uuid[], p_tables int[], p_double boolean, p_playoff_size int default 2
) returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_n int := array_length(p_players, 1);
  v_size int := 1;
  v_matches int;
  v_byes int;
  v_bye_slots int[];
  v_cursor int := 1;
  v_round_ids uuid[];
  v_next_ids uuid[];
  v_round int := 1;
  v_i int;
  v_id uuid;
  v_p1 uuid;
  v_p2 uuid;
  v_bracket text := case when p_double then 'winners' else 'main' end;
  v_total_rounds int;
  -- Bei Doppel-K.O. stoppt der Gewinnerbaum sobald playoff_size/2 Boxen
  -- uebrig sind statt bei genau 1 - deren Sieger werden dann zusammen mit den
  -- Verliererbaum-Ueberlebenden ins Playoff verdrahtet (siehe
  -- generate_double_ko_losers). Bei normalem K.O. immer volle Tiefe.
  v_min_matches int := case when p_double then greatest(1, p_playoff_size / 2) else 1 end;
begin
  v_total_rounds := 0;
  while v_size < v_n loop
    v_size := v_size * 2;
    v_total_rounds := v_total_rounds + 1;
  end loop;
  v_matches := v_size / 2;
  v_byes := v_size - v_n;

  select coalesce(array_agg(s), array[]::int[]) into v_bye_slots from (
    select generate_series(1, v_matches) as s order by random() limit v_byes
  ) t;

  v_round_ids := array_fill(null::uuid, array[v_matches]);
  for v_i in 1..v_matches loop
    if v_bye_slots @> array[v_i] then
      v_p1 := p_players[v_cursor]; v_cursor := v_cursor + 1;
      insert into tournament_matches
        (tournament_id, bracket, round, bracket_position, player1_id, is_bye, winner_id)
      values
        (p_tournament_id, v_bracket, 1, v_i, v_p1, true, v_p1)
      returning id into v_id;
    else
      v_p1 := p_players[v_cursor]; v_cursor := v_cursor + 1;
      v_p2 := p_players[v_cursor]; v_cursor := v_cursor + 1;
      insert into tournament_matches
        (tournament_id, bracket, round, bracket_position, player1_id, player2_id, table_number, ready_at)
      values
        (p_tournament_id, v_bracket, 1, v_i, v_p1, v_p2, null, now())
      returning id into v_id;
    end if;
    v_round_ids[v_i] := v_id;
  end loop;

  while v_matches > v_min_matches loop
    v_matches := v_matches / 2;
    v_round := v_round + 1;
    v_next_ids := array_fill(null::uuid, array[v_matches]);
    for v_i in 1..v_matches loop
      insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
      values (p_tournament_id, v_bracket, v_round, v_i, null)
      returning id into v_id;
      v_next_ids[v_i] := v_id;

      update tournament_matches set next_match_id = v_id, next_slot = 1 where id = v_round_ids[2 * v_i - 1];
      update tournament_matches set next_match_id = v_id, next_slot = 2 where id = v_round_ids[2 * v_i];

      select winner_id into v_p1 from tournament_matches where id = v_round_ids[2 * v_i - 1];
      if v_p1 is not null then
        update tournament_matches set player1_id = v_p1 where id = v_id;
      end if;
      select winner_id into v_p2 from tournament_matches where id = v_round_ids[2 * v_i];
      if v_p2 is not null then
        update tournament_matches set player2_id = v_p2 where id = v_id;
      end if;

      update tournament_matches set ready_at = now()
        where id = v_id and ready_at is null and player1_id is not null and player2_id is not null;
    end loop;
    v_round_ids := v_next_ids;
  end loop;

  if p_double then
    perform generate_double_ko_losers(p_tournament_id, v_total_rounds, p_tables, p_playoff_size);
  end if;
end;
$function$;

create or replace function public.generate_final_playoff_players(
  p_tournament_id uuid, p_player_ids_ranked uuid[], p_tables int[]
) returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_n int := array_length(p_player_ids_ranked, 1);
  v_matches int := v_n / 2;
  v_seeded uuid[] := array[]::uuid[];
  v_round_ids uuid[]; v_next_ids uuid[];
  v_round int := 1; v_i int;
  v_id uuid;
begin
  for v_i in 1..v_matches loop
    v_seeded := v_seeded || p_player_ids_ranked[v_i] || p_player_ids_ranked[v_n + 1 - v_i];
  end loop;

  v_round_ids := array_fill(null::uuid, array[v_matches]);
  for v_i in 1..v_matches loop
    insert into tournament_matches
      (tournament_id, bracket, round, bracket_position, player1_id, player2_id, table_number, ready_at)
    values
      (p_tournament_id, 'final', 1, v_i, v_seeded[2 * v_i - 1], v_seeded[2 * v_i], null, now())
    returning id into v_id;
    v_round_ids[v_i] := v_id;
  end loop;

  while v_matches > 1 loop
    v_matches := v_matches / 2;
    v_round := v_round + 1;
    v_next_ids := array_fill(null::uuid, array[v_matches]);
    for v_i in 1..v_matches loop
      insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
      values (p_tournament_id, 'final', v_round, v_i, null)
      returning id into v_id;
      v_next_ids[v_i] := v_id;
      update tournament_matches set next_match_id = v_id, next_slot = 1 where id = v_round_ids[2 * v_i - 1];
      update tournament_matches set next_match_id = v_id, next_slot = 2 where id = v_round_ids[2 * v_i];
    end loop;
    v_round_ids := v_next_ids;
  end loop;
end;
$function$;

create or replace function public.generate_final_playoff_wired(
  p_tournament_id uuid, p_source_match_ids uuid[], p_source_via_loser boolean[], p_tables int[]
) returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_n int := array_length(p_source_match_ids, 1);
  v_matches int := v_n / 2;
  v_round_ids uuid[]; v_next_ids uuid[];
  v_round int := 1; v_i int;
  v_id uuid;
begin
  v_round_ids := array_fill(null::uuid, array[v_matches]);
  for v_i in 1..v_matches loop
    insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
    values (p_tournament_id, 'final', 1, v_i, null)
    returning id into v_id;
    v_round_ids[v_i] := v_id;
    perform tm_wire(p_source_match_ids[2 * v_i - 1], p_source_via_loser[2 * v_i - 1], v_id, 1);
    perform tm_wire(p_source_match_ids[2 * v_i], p_source_via_loser[2 * v_i], v_id, 2);
  end loop;

  while v_matches > 1 loop
    v_matches := v_matches / 2;
    v_round := v_round + 1;
    v_next_ids := array_fill(null::uuid, array[v_matches]);
    for v_i in 1..v_matches loop
      insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
      values (p_tournament_id, 'final', v_round, v_i, null)
      returning id into v_id;
      v_next_ids[v_i] := v_id;
      update tournament_matches set next_match_id = v_id, next_slot = 1 where id = v_round_ids[2 * v_i - 1];
      update tournament_matches set next_match_id = v_id, next_slot = 2 where id = v_round_ids[2 * v_i];
    end loop;
    v_round_ids := v_next_ids;
  end loop;
end;
$function$;

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
  v_id uuid;
begin
  v_round_ids := array_fill(null::uuid, array[v_matches]);
  for v_i in 1..v_matches loop
    insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
    values (p_tournament_id, 'final', 1, v_i, null)
    returning id into v_id;
    v_round_ids[v_i] := v_id;
  end loop;

  while v_matches > 1 loop
    v_matches := v_matches / 2;
    v_round := v_round + 1;
    v_next_ids := array_fill(null::uuid, array[v_matches]);
    for v_i in 1..v_matches loop
      insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
      values (p_tournament_id, 'final', v_round, v_i, null)
      returning id into v_id;
      v_next_ids[v_i] := v_id;
      update tournament_matches set next_match_id = v_id, next_slot = 1 where id = v_round_ids[2 * v_i - 1];
      update tournament_matches set next_match_id = v_id, next_slot = 2 where id = v_round_ids[2 * v_i];
    end loop;
    v_round_ids := v_next_ids;
  end loop;
end;
$function$;

-- =========================================================================
-- create_tournament(): ruft tournament_assign_free_tables() einmal am Ende
-- auf - verteilt die erste Tisch-Welle auf so viele sofort bereite Partien
-- wie Tische vorhanden sind.
-- =========================================================================

create or replace function public.create_tournament(
  p_name text, p_format text, p_discipline text,
  p_player_ids uuid[], p_table_numbers int[],
  p_playoff_size int default null, p_double_round_robin boolean default false
) returns tournaments
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tournament tournaments;
  v_players uuid[];
  v_n int;
  v_tables int[];
  v_table_count int;
  v_playoff_size int;
begin
  if not is_admin() then raise exception 'Turniere anlegen ist aktuell nur für Admins möglich.'; end if;
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Turniername fehlt.'; end if;
  if p_format not in ('ko', 'double_ko', 'round_robin') then raise exception 'Unbekanntes Turnierformat.'; end if;
  if coalesce(trim(p_discipline), '') = '' then raise exception 'Disziplin fehlt.'; end if;

  select array_agg(distinct x) into v_players from unnest(p_player_ids) x;
  v_n := coalesce(array_length(v_players, 1), 0);

  if p_format = 'round_robin' and v_n < 3 then
    raise exception 'Jeder-gegen-jeden braucht mindestens 3 Teilnehmer.';
  end if;
  if p_format in ('ko', 'double_ko') and v_n < 2 then
    raise exception 'Mindestens 2 Teilnehmer nötig.';
  end if;
  if exists (
    select 1 from unnest(v_players) pid
    where not exists (select 1 from players where id = pid)
       or exists (select 1 from players where id = pid and coalesce(is_ghost, false))
  ) then
    raise exception 'Teilnehmerliste enthält einen ungültigen Spieler oder den Ghost.';
  end if;

  select array_agg(distinct x order by x) into v_tables from unnest(p_table_numbers) x;
  v_table_count := coalesce(array_length(v_tables, 1), 0);
  if v_table_count = 0 then raise exception 'Mindestens ein Tisch nötig.'; end if;
  if exists (select 1 from unnest(v_tables) t where t <= 0) then
    raise exception 'Tischnummern müssen positiv sein.';
  end if;

  -- Playoff-Groesse: bei double_ko immer gesetzt (Default 2 = bisheriges
  -- Verhalten), bei round_robin optional (null = nur Tabelle, wie bisher),
  -- bei ko irrelevant/ignoriert.
  if p_format = 'double_ko' then
    v_playoff_size := coalesce(p_playoff_size, 2);
    if v_playoff_size not in (2, 4, 8) then raise exception 'Ungültige Finalrunden-Größe.'; end if;
  elsif p_format = 'round_robin' then
    v_playoff_size := p_playoff_size;
    if v_playoff_size is not null and v_playoff_size not in (2, 4, 8) then
      raise exception 'Ungültige Playoff-Größe.';
    end if;
  else
    v_playoff_size := null;
  end if;
  if v_playoff_size is not null and v_playoff_size > v_n then
    raise exception 'Playoff-Größe darf nicht größer als die Teilnehmerzahl sein.';
  end if;
  if p_format = 'double_ko' and v_playoff_size > 2 and v_n < v_playoff_size * 2 then
    raise exception 'Für diese Playoff-Größe werden mindestens % Teilnehmer benötigt.', v_playoff_size * 2;
  end if;

  insert into tournaments (name, format, discipline, organizer_id, table_numbers, status, started_at, playoff_size)
  values (trim(p_name), p_format, trim(p_discipline), v_me, v_tables, 'running', now(), v_playoff_size)
  returning * into v_tournament;

  insert into tournament_players (tournament_id, player_id)
    select v_tournament.id, x from unnest(v_players) x;

  -- Reihenfolge fuers Auslosen zufaellig mischen
  select array_agg(x) into v_players from (select x from unnest(v_players) x order by random()) t;

  if p_format = 'round_robin' then
    perform generate_round_robin(v_tournament.id, v_players, v_tables, coalesce(p_double_round_robin, false));
  else
    perform generate_ko_bracket(v_tournament.id, v_players, v_tables, p_format = 'double_ko', coalesce(v_playoff_size, 2));
  end if;

  perform tournament_assign_free_tables(v_tournament.id);

  return v_tournament;
end;
$function$;

-- =========================================================================
-- tournament_report_match()/tournament_organizer_report_match(): rufen
-- tournament_assign_free_tables() direkt nach dem Setzen von
-- tournament_matches.match_id auf - der Tisch gilt ab Ergebnismeldung als
-- frei (nicht erst nach Bestaetigung), macht ihn sofort fuer die naechste
-- wartende Partie verfuegbar.
-- =========================================================================

create or replace function public.tournament_report_match(
  p_tournament_match_id uuid, p_my_score integer, p_opp_score integer,
  p_high_run_me integer default null, p_high_run_opp integer default null,
  p_deficit_me integer default null, p_deficit_opp integer default null,
  p_avg_me numeric default null, p_avg_opp numeric default null,
  p_twoball_me integer default null, p_twoball_opp integer default null,
  p_run_log jsonb default null
)
 returns matches
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tm tournament_matches;
  v_tour tournaments;
  v_opponent uuid;
  v_row matches;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tm from tournament_matches where id = p_tournament_match_id;
  if not found then raise exception 'Turnier-Match nicht gefunden.'; end if;
  if v_tm.is_bye then raise exception 'Dieses Match ist ein Freilos.'; end if;
  if v_tm.match_id is not null then raise exception 'Für dieses Match wurde bereits ein Ergebnis gemeldet.'; end if;
  if v_tm.player1_id is null or v_tm.player2_id is null then
    raise exception 'Die Paarung für dieses Match steht noch nicht fest.';
  end if;
  if v_me not in (v_tm.player1_id, v_tm.player2_id) then
    raise exception 'Nur die beiden Spieler dieses Matches können das Ergebnis melden.';
  end if;
  if p_my_score = p_opp_score then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;

  select * into v_tour from tournaments where id = v_tm.tournament_id;
  if v_tour.status <> 'running' then raise exception 'Dieses Turnier ist nicht mehr aktiv.'; end if;
  v_opponent := case when v_me = v_tm.player1_id then v_tm.player2_id else v_tm.player1_id end;

  insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed, tournament_id,
                       high_run1, high_run2, deficit1, deficit2, avg1, avg2, twoball1, twoball2, run_log)
  values (v_me, v_opponent, p_my_score, p_opp_score, v_tour.discipline, v_me, false, v_tour.id,
          p_high_run_me, p_high_run_opp, p_deficit_me, p_deficit_opp, p_avg_me, p_avg_opp, p_twoball_me, p_twoball_opp, p_run_log)
  returning * into v_row;

  update tournament_matches set match_id = v_row.id where id = p_tournament_match_id;
  perform tournament_assign_free_tables(v_tour.id);
  return v_row;
end;
$function$;

create or replace function public.tournament_organizer_report_match(
  p_tournament_match_id uuid, p_score1 integer, p_score2 integer,
  p_high_run_me integer default null, p_high_run_opp integer default null,
  p_deficit_me integer default null, p_deficit_opp integer default null,
  p_avg_me numeric default null, p_avg_opp numeric default null,
  p_twoball_me integer default null, p_twoball_opp integer default null,
  p_run_log jsonb default null
)
 returns matches
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tm tournament_matches;
  v_tour tournaments;
  v_row matches;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tm from tournament_matches where id = p_tournament_match_id;
  if not found then raise exception 'Turnier-Match nicht gefunden.'; end if;
  if v_tm.is_bye then raise exception 'Dieses Match ist ein Freilos.'; end if;
  if v_tm.match_id is not null then raise exception 'Für dieses Match wurde bereits ein Ergebnis gemeldet.'; end if;
  if v_tm.player1_id is null or v_tm.player2_id is null then
    raise exception 'Die Paarung für dieses Match steht noch nicht fest.';
  end if;
  if p_score1 = p_score2 then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;

  select * into v_tour from tournaments where id = v_tm.tournament_id;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur der Turnierleiter oder ein Admin kann hier ein Ergebnis eintragen.';
  end if;
  if v_me in (v_tm.player1_id, v_tm.player2_id) then
    raise exception 'Als Spieler dieses Matches kannst du das Ergebnis nicht selbst als Turnierleitung eintragen.';
  end if;
  if v_tour.status <> 'running' then raise exception 'Dieses Turnier ist nicht mehr aktiv.'; end if;

  -- Erst OHNE confirmed=true einfuegen (der Trigger feuert hier, tut aber
  -- mangels confirmed=true nichts), dann tournament_matches verlinken,
  -- DANACH erst bestaetigen - siehe Kommentar oben.
  insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed, tournament_id,
                       high_run1, high_run2, deficit1, deficit2, avg1, avg2, twoball1, twoball2, run_log)
  values (v_tm.player1_id, v_tm.player2_id, p_score1, p_score2, v_tour.discipline, v_me, false, v_tour.id,
          p_high_run_me, p_high_run_opp, p_deficit_me, p_deficit_opp, p_avg_me, p_avg_opp, p_twoball_me, p_twoball_opp, p_run_log)
  returning * into v_row;

  update tournament_matches set match_id = v_row.id where id = p_tournament_match_id;
  perform tournament_assign_free_tables(v_tour.id);

  update matches set confirmed = true, confirmed_by = v_me where id = v_row.id
    returning * into v_row;

  return v_row;
end;
$function$;

-- =========================================================================
-- advance_tournament_bracket(): ruft tournament_assign_free_tables() einmal
-- ganz am Ende auf (nach der kompletten Fortschritts-/Playoff-Seeding-Logik,
-- direkt vor dem return) - deckt sowohl neu spielbereit gewordene
-- Bracket-Partien als auch frisch gesaete Jeder-gegen-jeden-Playoff-Partien
-- (generate_final_playoff_players wird weiter unten in genau diesem
-- Funktionskoerper aufgerufen) ab. Sonst unveraendert gegenueber
-- 2026-09-06_tournament_playoff_no_rematch.sql.
-- =========================================================================

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

  -- Dynamic pairing of the final round-1 slots for double-KO cutover with playoff_size > 2
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

  perform tournament_assign_free_tables(v_tour.id);

  return new;
end;
$function$;
