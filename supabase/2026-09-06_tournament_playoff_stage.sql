-- Optionale Playoff-Stufe fuer Jeder-gegen-jeden UND fruehzeitiger Abbruch
-- der Doppel-K.O.-Phase zugunsten eines abschliessenden reinen K.O.-Rasters -
-- wie bei groesseren Vereins-/Verbandsturnieren ueblich (siehe echtes Beispiel-
-- Raster eines OePBV Grand Prix, das den Ansatz hier bestaetigt hat: dort
-- liefern Gewinner- UND Verliererbaum je zur Haelfte die Finalisten, KEIN
-- "1 Gewinnerbaum-Champion + Rest Verliererbaum" -Modell).
--
-- Neu:
-- - tournaments.playoff_size (2/4/8, nullable): bei round_robin optional
--   ("null" = wie bisher nur Tabelle), bei double_ko immer gesetzt (Default 2
--   = bisheriges Verhalten unveraendert - Gewinner- und Verliererbaum laufen
--   dann wie gehabt bis zu je 1 Ueberlebendem durch).
-- - generate_final_playoff_players()/generate_final_playoff_wired(): bauen
--   ein reines K.O.-Bracket unter bracket='final' (1-3 Runden statt bisher
--   immer genau 1 Match) - einmal mit schon bekannten Spielern (Jeder-gegen-
--   jeden, nach Rangliste geseedet), einmal mit noch offenen Quell-Matches
--   (Doppel-K.O.-Cutover, Sieger kommen erst per tm_wire()).
-- - tournament_round_robin_ranking(): Rangliste (Siege/Niederlagen, Zufall
--   bei Gleichstand) fuers Playoff-Seeding.
-- - generate_ko_bracket()/generate_double_ko_losers(): stoppen bei Doppel-K.O.
--   mit playoff_size<voller Tiefe beide Baeume frueher (je playoff_size/2
--   Ueberlebende statt 1) und verdrahten das Ergebnis in generate_final_playoff_wired()
--   statt direkt ein einzelnes Finalmatch anzulegen.
-- - generate_round_robin(): optionale Hin-/Rueckrunde (p_double), zweiter
--   Durchlauf mit vertauschtem Heim/Auswärts, gleiche Paarungen gespiegelt.
-- - create_tournament(): nimmt p_playoff_size/p_double_round_robin entgegen,
--   validiert und reicht durch.
-- - advance_tournament_bracket(): seedet bei round_robin+playoff_size das
--   Playoff automatisch, sobald alle Gruppenspiele entschieden sind, statt
--   das Turnier sofort zu beenden.
--
-- Bestehende Turniere: playoff_size ist fuer sie NULL (kein Backfill noetig) -
-- alle Generierungs-Funktionen laufen nur einmalig bei der Erstellung, an
-- bereits laufenden/beendeten Turnieren aendert sich rueckwirkend nichts.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

alter table public.tournaments
  add column if not exists playoff_size integer check (playoff_size in (2, 4, 8));

-- =========================================================================
-- Neue Bausteine: K.O.-Bracket unter bracket='final' bauen
-- =========================================================================

-- Variante 1: Teilnehmer stehen schon fest (Jeder-gegen-jeden, nach
-- Rangliste). p_player_ids_ranked ist bestplatziert-zuerst sortiert; geseedet
-- wird Bester-gegen-Schlechtesten (1 gegen letzter, 2 gegen vorletzter, ...),
-- damit die beiden besten Spieler nicht schon in Runde 1 aufeinandertreffen.
-- Laenge ist immer eine 2er-Potenz (2/4/8), also nie Freilose noetig.
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
  v_table_idx int := 0; v_table_count int := array_length(p_tables, 1);
  v_id uuid;
begin
  for v_i in 1..v_matches loop
    v_seeded := v_seeded || p_player_ids_ranked[v_i] || p_player_ids_ranked[v_n + 1 - v_i];
  end loop;

  v_round_ids := array_fill(null::uuid, array[v_matches]);
  for v_i in 1..v_matches loop
    v_table_idx := v_table_idx + 1;
    insert into tournament_matches
      (tournament_id, bracket, round, bracket_position, player1_id, player2_id, table_number, ready_at)
    values
      (p_tournament_id, 'final', 1, v_i, v_seeded[2 * v_i - 1], v_seeded[2 * v_i],
       p_tables[((v_table_idx - 1) % v_table_count) + 1], now())
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

-- Variante 2: Teilnehmer stehen noch NICHT fest, nur die Quell-Matches, deren
-- Sieger (oder bei einem durchgereichten Freilos-Platzhalter: Verlierer -
-- siehe p_source_via_loser) jeweils einen Startplatz einnehmen (Doppel-K.O.-
-- Cutover: letzte gespielte Gewinnerbaum-Runde + finale Verliererbaum-
-- Konsolidierung). Runde 1 sind Platzhalter, jeder Quell-Match wird per
-- tm_wire() auf seinen Startplatz verdrahtet - p_source_via_loser MUSS die
-- via-Flags aus lb_pair()/generate_double_ko_losers() 1:1 uebernehmen, sonst
-- geht bei durchgereichten Freilosen (z.B. sehr kleine Turniere) die falsche
-- Person (Sieger statt eigentlich vorgesehener Verlierer) weiter.
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
    perform tm_wire(p_source_match_ids[2 * v_i - 1], p_source_via_loser[2 * v_i - 1], v_id, 1);
    perform tm_wire(p_source_match_ids[2 * v_i], p_source_via_loser[2 * v_i], v_id, 2);
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

-- Rangliste aus den bracket='main'-Ergebnissen eines Jeder-gegen-jeden-
-- Turniers (Siege absteigend, Niederlagen aufsteigend, Zufall bei
-- Gleichstand - konsistent mit der Freilos-Philosophie sonst im Turniermodus).
-- Nur fuers Playoff-Seeding gedacht, nicht fuer die Anzeige (die berechnet
-- der Client selbst, siehe TurnierRasterScreen.jsx standings).
create or replace function public.tournament_round_robin_ranking(p_tournament_id uuid)
returns uuid[]
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_result uuid[];
begin
  select array_agg(t.player_id order by t.wins desc, t.losses asc, random()) into v_result
  from (
    select tp.player_id,
      count(*) filter (where tm.winner_id = tp.player_id) as wins,
      count(*) filter (
        where tm.winner_id is not null and tm.winner_id <> tp.player_id
          and (tm.player1_id = tp.player_id or tm.player2_id = tp.player_id)
      ) as losses
    from tournament_players tp
    left join tournament_matches tm
      on tm.tournament_id = p_tournament_id and tm.bracket = 'main'
      and (tm.player1_id = tp.player_id or tm.player2_id = tp.player_id)
    where tp.tournament_id = p_tournament_id
    group by tp.player_id
  ) t;
  return v_result;
end;
$function$;

revoke execute on function public.generate_final_playoff_players(uuid, uuid[], int[]) from public, anon, authenticated;
revoke execute on function public.generate_final_playoff_wired(uuid, uuid[], boolean[], int[]) from public, anon, authenticated;
revoke execute on function public.tournament_round_robin_ranking(uuid) from public, anon, authenticated;

-- =========================================================================
-- generate_round_robin(): optionale Hin-/Rueckrunde
-- =========================================================================

drop function if exists public.generate_round_robin(uuid, uuid[], int[]);

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
  v_table_idx int;
  v_table_count int := array_length(p_tables, 1);
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
      v_table_idx := 0;
      for v_i in 1..(v_n / 2) loop
        v_home := v_arr[v_i];
        v_away := v_arr[v_n - v_i + 1];
        if v_home is not null and v_away is not null then
          v_pos := v_pos + 1;
          v_table_idx := v_table_idx + 1;
          -- Rueckrunde (v_pass=2): dieselben Paarungen, Heim/Auswaerts getauscht.
          insert into tournament_matches
            (tournament_id, bracket, round, bracket_position, player1_id, player2_id, table_number, ready_at)
          values (
            p_tournament_id, 'main', v_round_offset + v_r, v_pos,
            case when v_pass = 2 then v_away else v_home end,
            case when v_pass = 2 then v_home else v_away end,
            p_tables[((v_table_idx - 1) % v_table_count) + 1], now()
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

revoke execute on function public.generate_round_robin(uuid, uuid[], int[], boolean) from public, anon, authenticated;

-- =========================================================================
-- generate_ko_bracket(): fruehzeitiger Stopp des Gewinnerbaums bei Doppel-K.O.
-- mit playoff_size < voller Tiefe (playoff_size/2 statt 1 Ueberlebender)
-- =========================================================================

drop function if exists public.generate_ko_bracket(uuid, uuid[], int[], boolean);

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
  v_table_idx int := 0;
  v_table_count int := array_length(p_tables, 1);
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

  while v_matches > v_min_matches loop
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
    perform generate_double_ko_losers(p_tournament_id, v_total_rounds, p_tables, p_playoff_size);
  end if;
end;
$function$;

revoke execute on function public.generate_ko_bracket(uuid, uuid[], int[], boolean, int) from public, anon, authenticated;

-- =========================================================================
-- generate_double_ko_losers(): Konsolidierungsziel playoff_size/2 statt 1,
-- am Ende Verdrahtung ins Playoff statt direkt ein einzelnes Finalmatch
-- =========================================================================

drop function if exists public.generate_double_ko_losers(uuid, int, int[]);

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
  -- Tatsaechlich generierte Gewinnerbaum-Rundenzahl (kann kleiner als
  -- p_wb_rounds sein, wenn generate_ko_bracket wegen playoff_size fruehzeitig
  -- gestoppt hat) statt der theoretischen vollen Tiefe.
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

    -- Vor der naechsten TATSAECHLICH gespielten Gewinnerbaum-Runde auf deren
    -- erwartete Verliereranzahl herunterkonsolidieren; ab der letzten
    -- gespielten Runde gilt die Playoff-Zielgroesse als Untergrenze statt
    -- (wie bisher) hartcodiert 1 - bei playoff_size=2 ist das identisch zum
    -- bisherigen Verhalten.
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

  -- v_surv_ids/v_surv_via haben jetzt (im gewoehnlichen Fall) genau
  -- playoff_size/2 Eintraege - die Gewinnerbaum-Qualifikanten sind die
  -- playoff_size/2 Matches der letzten tatsaechlich gespielten Gewinnerbaum-
  -- Runde (immer via_loser=false, das sind echte gespielte Matches, wir
  -- wollen deren Sieger). Beide Zweige liefern also gleich viele Finalisten
  -- (50/50-Split, siehe Migrations-Kommentar oben). Fuer playoff_size=2 ist
  -- das exakt das bisherige Verhalten: 1 Gewinnerbaum-Champion + 1
  -- Verliererbaum-Champion in einem einzelnen Finalmatch.
  --
  -- v_surv_via wird 1:1 uebernommen (NICHT auf false gesetzt) - bei sehr
  -- kleinen Turnieren kann ein "Ueberlebender" ein reiner Freilos-
  -- Durchreicheposten aus lb_pair() sein (via_loser=true = "der VERLIERER
  -- dieses Matches ruecktvor", z.B. wenn der Verliererbaum an dieser Stelle
  -- noch gar nicht wirklich gespielt hat), das darf beim Verdrahten nicht
  -- verlorengehen.
  select array_agg(id order by bracket_position) into v_wb_final_ids
    from tournament_matches
    where tournament_id = p_tournament_id and bracket = 'winners' and round = v_wb_played_rounds;

  -- Verteidigung gegen zu kleine Teilnehmerzahlen fuer die gewaehlte
  -- Playoff-Groesse: der Verliererbaum kann bei wenigen Teilnehmern/vielen
  -- Freilosen strukturell nicht genug Ueberlebende liefern (die
  -- Konsolidierungs-Schleife oben REDUZIERT nur, sie kann keine zusaetzlichen
  -- Ueberlebenden erzeugen). create_tournament() prueft das grob vorab, aber
  -- bei Freilosen an ungluecklichen Stellen kann das trotzdem noch
  -- vorkommen - dann lieber die ganze Turniererstellung mit einer klaren
  -- Fehlermeldung abbrechen (Transaktion rollt zurueck) als ein Bracket mit
  -- einem leeren Playoff-Startplatz anzulegen.
  if array_length(v_wb_final_ids, 1) is distinct from array_length(v_surv_ids, 1) then
    raise exception 'Nicht genug Teilnehmer für diese Playoff-Größe bei dieser Formatkombination - bitte kleinere Playoff-Größe oder mehr Teilnehmer wählen.';
  end if;

  for v_i in 1..array_length(v_wb_final_ids, 1) loop
    v_playoff_sources := v_playoff_sources || v_wb_final_ids[v_i] || v_surv_ids[v_i];
    v_playoff_via := v_playoff_via || false || v_surv_via[v_i];
  end loop;

  perform generate_final_playoff_wired(p_tournament_id, v_playoff_sources, v_playoff_via, p_tables);
end;
$function$;

revoke execute on function public.generate_double_ko_losers(uuid, int, int[], int) from public, anon, authenticated;

-- =========================================================================
-- create_tournament(): playoff_size/double_round_robin entgegennehmen,
-- validieren, durchreichen
-- =========================================================================

drop function if exists public.create_tournament(text, text, text, uuid[], int[]);

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
  -- Grobe Vorab-Pruefung fuers Doppel-K.O.-Cutover: der Verliererbaum kann
  -- nur REDUZIEREN, nie zusaetzliche Ueberlebende erzeugen - fuer
  -- playoff_size/2 Verliererbaum-Ueberlebende braucht es strukturell
  -- mindestens playoff_size Teilnehmer insgesamt (bei playoff_size=2, dem
  -- heutigen Standardverhalten, gilt diese Einschraenkung nicht - das
  -- funktioniert wie bisher schon ab 2 Teilnehmern). Nur eine grobe
  -- Untergrenze, siehe zusaetzliche Laufzeitpruefung in
  -- generate_double_ko_losers() fuer den tatsaechlich verlässlichen Schutz.
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

  return v_tournament;
end;
$function$;

-- =========================================================================
-- advance_tournament_bracket(): round_robin+playoff_size seedet das Playoff
-- automatisch, sobald die Gruppenphase komplett ist
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

  if v_tour.format = 'round_robin' and v_tour.playoff_size is not null then
    if not exists (select 1 from tournament_matches where tournament_id = v_tour.id and bracket = 'main' and winner_id is null)
       and not exists (select 1 from tournament_matches where tournament_id = v_tour.id and bracket = 'final')
    then
      -- Gruppenphase komplett, Playoff noch nicht erzeugt: jetzt seeden.
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
    -- Turnier ist zu Ende sobald der eine "Endknoten" (kein next_match_id
    -- UND kein loser_next_match_id - K.O.-Finale bzw. Doppel-K.O.-Playoff-
    -- Finale) einen Sieger hat.
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
