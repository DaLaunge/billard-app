-- Neue Spalte tournament_matches.ready_at: Zeitpunkt, ab dem BEIDE Spieler
-- eines Rasterplatzes feststehen (Paarung "spielbereit"). Zusammen mit
-- matches.played_at (= Zeitpunkt der Meldung, siehe report_match()/
-- tournament_report_match()) ergibt das die Wartezeit einer Paarung -
-- wie lange zwischen Feststehen der Paarung und tatsaechlicher Meldung des
-- Ergebnisses vergangen ist. Wird clientseitig genutzt, um die am laengsten
-- wartenden Paarungen zu ermitteln/anzuzeigen.
--
-- Gesetzt wird ready_at an zwei Stellen:
-- 1) Bei der Rastererzeugung selbst, wenn ein Match von Anfang an beide
--    Spieler kennt (Jeder-gegen-jeden: immer; K.O./Doppel-K.O. Runde 1:
--    echte, nicht per Freilos entschiedene Matches).
-- 2) Im Trigger advance_tournament_bracket(), sobald das Vorruecken eines
--    Ergebnisses einen Rasterplatz komplettiert (beide Spielerspalten jetzt
--    nicht mehr leer) - nur beim allerersten Mal (ready_at war noch leer),
--    ein spaeteres erneutes Bestaetigen darf den Zeitpunkt nicht verschieben.
--
-- Einmaliges Backfill fuer bereits laufende/beendete Turniere: ready_at auf
-- created_at gesetzt, wo beide Spieler schon feststehen - nur eine Annaeherung
-- (der tatsaechliche Zeitpunkt, an dem der zweite Spieler feststand, wurde
-- nicht mitgeloggt), aber besser als eine leere Wartezeit-Auswertung fuer
-- bereits bestehende Turniere.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

alter table public.tournament_matches
  add column if not exists ready_at timestamptz;

update public.tournament_matches
  set ready_at = created_at
  where ready_at is null and player1_id is not null and player2_id is not null;

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
  if v_tour.format = 'round_robin' then
    if not exists (select 1 from tournament_matches where tournament_id = v_tour.id and winner_id is null) then
      update tournaments set status = 'finished', finished_at = now() where id = v_tour.id;
    end if;
  else
    -- Turnier ist zu Ende sobald der eine "Endknoten" (kein next_match_id
    -- UND kein loser_next_match_id - K.O.-Finale bzw. Doppel-K.O.-Grossfinale)
    -- einen Sieger hat.
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

create or replace function public.generate_round_robin(
  p_tournament_id uuid, p_players uuid[], p_tables int[]
) returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_arr uuid[] := p_players;
  v_n int := array_length(v_arr, 1);
  v_rounds int;
  v_i int;
  v_r int;
  v_home uuid;
  v_away uuid;
  v_pos int;
  v_table_idx int;
  v_table_count int := array_length(p_tables, 1);
  v_tmp uuid;
begin
  if v_n % 2 = 1 then
    v_arr := v_arr || null::uuid;  -- ungerade Teilnehmerzahl -> ein Freilos-Platzhalter pro Runde
    v_n := v_n + 1;
  end if;
  v_rounds := v_n - 1;

  for v_r in 1..v_rounds loop
    v_pos := 0;
    v_table_idx := 0;
    for v_i in 1..(v_n / 2) loop
      v_home := v_arr[v_i];
      v_away := v_arr[v_n - v_i + 1];
      if v_home is not null and v_away is not null then
        v_pos := v_pos + 1;
        v_table_idx := v_table_idx + 1;
        insert into tournament_matches
          (tournament_id, bracket, round, bracket_position, player1_id, player2_id, table_number, ready_at)
        values
          (p_tournament_id, 'main', v_r, v_pos, v_home, v_away,
           p_tables[((v_table_idx - 1) % v_table_count) + 1], now());
      end if;
    end loop;
    -- Circle Method: Position 1 bleibt fix, der Rest rotiert um eins weiter
    v_tmp := v_arr[v_n];
    for v_i in reverse v_n..3 loop
      v_arr[v_i] := v_arr[v_i - 1];
    end loop;
    v_arr[2] := v_tmp;
  end loop;
end;
$function$;

create or replace function public.generate_ko_bracket(
  p_tournament_id uuid, p_players uuid[], p_tables int[], p_double boolean
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
  v_table_idx int := 0;
  v_table_count int := array_length(p_tables, 1);
  v_id uuid;
  v_p1 uuid;
  v_p2 uuid;
  v_bracket text := case when p_double then 'winners' else 'main' end;
  v_total_rounds int;
begin
  v_total_rounds := 0;
  while v_size < v_n loop
    v_size := v_size * 2;
    v_total_rounds := v_total_rounds + 1;
  end loop;
  v_matches := v_size / 2;
  v_byes := v_size - v_n;

  -- v_byes zufaellige Slots aus den v_matches Erstrunden-Slots als Freilos markieren
  -- (v_byes ist immer < v_matches, siehe Wahl von v_size als kleinste 2er-Potenz >= v_n,
  -- daher landen nie zwei Freilose im selben Match)
  select coalesce(array_agg(s), array[]::int[]) into v_bye_slots from (
    select generate_series(1, v_matches) as s order by random() limit v_byes
  ) t;

  v_round_ids := array_fill(null::uuid, array[v_matches]);
  for v_i in 1..v_matches loop
    v_table_idx := v_table_idx + 1;
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
        (p_tournament_id, v_bracket, 1, v_i, v_p1, v_p2, p_tables[((v_table_idx - 1) % v_table_count) + 1], now())
      returning id into v_id;
    end if;
    v_round_ids[v_i] := v_id;
  end loop;

  -- weitere Runden als Platzhalter anlegen, mit der Vorrunde verlinken und
  -- Freilos-Sieger direkt in den neuen Slot vortragen
  while v_matches > 1 loop
    v_matches := v_matches / 2;
    v_round := v_round + 1;
    v_next_ids := array_fill(null::uuid, array[v_matches]);
    for v_i in 1..v_matches loop
      v_table_idx := v_table_idx + 1;
      insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
      values (p_tournament_id, v_bracket, v_round, v_i, p_tables[((v_table_idx - 1) % v_table_count) + 1])
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
    perform generate_double_ko_losers(p_tournament_id, v_total_rounds, p_tables);
  end if;
end;
$function$;
