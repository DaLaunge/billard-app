-- Bug-Report (aus dem neuen Turnierbericht sichtbar geworden): im Doppel-
-- K.O.-Verliererbaum treffen dieselben zwei Spieler oft DIREKT hintereinander
-- noch einmal aufeinander (z.B. Spieler A verliert Gewinnerbaum-Runde 1
-- gegen B, landet per "Freilos-Ueberschuss" (siehe lb_pair() in
-- 2026-09-06_tournament_dynamic_tables.sql) in Verliererbaum-Runde 2 - und
-- trifft dort sofort wieder auf genau B, der zwischenzeitlich seinerseits in
-- Gewinnerbaum-Runde 2 verloren hat). Eine Pruefung ueber alle bisherigen
-- Doppel-K.O.-Testturniere zeigt: das ist HAEUFIG (fast jedes Turnier),
-- ueberwiegend als "Runde 1 -> Verliererbaum-Runde 2", aber auch in
-- tieferen Runden. Wiederholungen GENAU im grossen Finale (Gewinnerbaum-
-- Finalist trifft dort jemanden, gegen den er/sie frueher im Gewinnerbaum
-- schon spielte) sind dagegen ein gewolltes Merkmal von Doppel-K.O. und
-- bleiben unangetastet - hier geht es nur um Wiederholungen INNERHALB des
-- Verliererbaum-Aufbaus.
--
-- Ursache: lb_pair() paart zwei Listen rein nach der Reihenfolge, in der sie
-- hereinkommen (die vorherige Zufallsmischung passiert nur einmal auf
-- Gewinnerbaum-Ebene), ohne zu pruefen, ob eine Paarung zwei Spieler
-- zusammenbringt, die sich schon im Gewinnerbaum gegenueberstanden. Anders
-- als bei der Playoff-Qualifikanten-Zusammenfuehrung (siehe
-- tournament_no_rematch_pairing() in 2026-09-06_tournament_playoff_no_
-- rematch.sql) ist beim Erzeugen des Verliererbaums noch KEIN Match
-- gespielt - die Pruefung muss daher anhand der Baum-STRUKTUR erfolgen (wer
-- koennte an dieser Stelle theoretisch stehen), nicht anhand bereits
-- bestaetigter Ergebnisse.
--
-- Loesung in drei Teilen:
-- 1) lb_no_rematch_permute(): bringt eine Liste B relativ zu einer (fest
--    bleibenden) Liste A in die Reihenfolge mit den wenigsten "moegliche
--    Spieler ueberschneiden sich"-Konflikten - bis zu 40 Zufallsversuche,
--    wie tournament_no_rematch_pairing(), nur gegen STRUKTURELLE moegliche
--    Konflikte statt gegen bereits bestaetigte Matches.
-- 2) lb_new_match_ancestors(): berechnet fuer neu erzeugte Verliererbaum-
--    Matches deren eigene "moegliche Spieler"-Menge (Vereinigung ihrer
--    beiden Einspeiser), damit spaetere Runden das weiter durchreichen
--    koennen.
-- 3) generate_double_ko_losers(): unveraendert im Ablauf, ruft vor jedem
--    lb_pair()-Aufruf jetzt lb_no_rematch_permute() auf und fuehrt danach
--    Buch ueber die "moegliche Spieler"-Mengen via lb_new_match_ancestors().
--    lb_pair() SELBST bleibt komplett unveraendert (nur die Reihenfolge
--    einer Seite wird vorher optimiert) - haelt das Risiko fuer die
--    bestehende, bereits validierte Kern-Verdrahtung klein.
--
-- Betrifft NUR Doppel-K.O. (K.O. und Jeder-gegen-jeden rufen lb_pair gar
-- nicht auf). advance_tournament_bracket() (der scharfe Trigger bei jeder
-- Match-Bestaetigung) bleibt unveraendert - diese Aenderung wirkt nur
-- EINMALIG bei der Turniererstellung.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

-- Bringt p_ids_b/p_via_b (relativ zu der FEST bleibenden Liste A, gegeben
-- als flache Vorfahren-Relation p_a_anc_owner/p_a_anc_player - owner = Slot-
-- Id aus p_a_ids, player = ein Spieler, der dort theoretisch stehen
-- koennte) in eine Reihenfolge mit moeglichst wenig Konflikten. Konflikt =
-- Slot i von A und der ihm zugeordnete Slot von B haben mindestens einen
-- gemeinsamen moeglichen Spieler (koennten sich also schon im Gewinnerbaum
-- gegenuebergestanden haben). Nur die ersten least(len(a),len(b)) Plaetze
-- werden ueberhaupt gepaart (siehe lb_pair) - ein laengerer Ueberschuss
-- zaehlt fuer die Konfliktpruefung nicht mit.
create or replace function public.lb_no_rematch_permute(
  p_a_ids uuid[],
  p_a_anc_owner uuid[], p_a_anc_player uuid[],
  p_b_ids uuid[], p_via_b boolean[],
  p_b_anc_owner uuid[], p_b_anc_player uuid[],
  out out_ids uuid[], out out_via boolean[]
)
returns record
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_len_b int := coalesce(array_length(p_b_ids, 1), 0);
  v_m int := least(coalesce(array_length(p_a_ids, 1), 0), v_len_b);
  v_attempt int;
  v_perm int[];
  v_conflicts int;
  v_best_perm int[];
  v_best_conflicts int := 2147483647;
begin
  if v_len_b = 0 then
    out_ids := p_b_ids; out_via := p_via_b; return;
  end if;
  v_best_perm := array(select generate_series(1, v_len_b));
  if v_m > 0 then
    for v_attempt in 1..40 loop
      select array_agg(x) into v_perm from (select generate_series(1, v_len_b) x order by random()) t;
      select count(*) into v_conflicts
        from generate_series(1, v_m) i
        where exists (
          select 1
          from unnest(p_a_anc_owner, p_a_anc_player) aa(owner_id, player_id)
          join unnest(p_b_anc_owner, p_b_anc_player) bb(owner_id, player_id) on aa.player_id = bb.player_id
          where aa.owner_id = p_a_ids[i] and bb.owner_id = p_b_ids[v_perm[i]]
        );
      if v_conflicts < v_best_conflicts then
        v_best_conflicts := v_conflicts; v_best_perm := v_perm;
      end if;
      exit when v_best_conflicts = 0;
    end loop;
  end if;
  select array_agg(p_b_ids[v_best_perm[i]] order by i) into out_ids from generate_series(1, v_len_b) i;
  select array_agg(p_via_b[v_best_perm[i]] order by i) into out_via from generate_series(1, v_len_b) i;
end;
$function$;

-- Berechnet fuer die frisch von lb_pair() erzeugten Verliererbaum-Matches
-- (p_new_ids[i] entstand aus p_ids_a[i] + p_ids_b[i], i = 1..array_length(
-- p_new_ids,1) - siehe lb_pair()) deren eigene "moegliche Spieler"-Menge als
-- Vereinigung der Mengen ihrer beiden Einspeiser (aus der bisherigen
-- Relation p_anc_owner/p_anc_player). Gibt nur die ZUSAETZLICHEN Zeilen
-- zurueck, die der Aufrufer an seine laufende Relation anhaengen muss.
create or replace function public.lb_new_match_ancestors(
  p_ids_a uuid[], p_ids_b uuid[], p_new_ids uuid[],
  p_anc_owner uuid[], p_anc_player uuid[],
  out add_owner uuid[], out add_player uuid[]
)
returns record
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_m int := coalesce(array_length(p_new_ids, 1), 0);
  v_i int;
  v_players uuid[];
begin
  add_owner := array[]::uuid[];
  add_player := array[]::uuid[];
  for v_i in 1..v_m loop
    select array_agg(distinct player_id) into v_players
      from (
        select player_id from unnest(p_anc_owner, p_anc_player) t(owner_id, player_id) where owner_id = p_ids_a[v_i]
        union all
        select player_id from unnest(p_anc_owner, p_anc_player) t(owner_id, player_id) where owner_id = p_ids_b[v_i]
      ) x;
    add_owner := add_owner || array_fill(p_new_ids[v_i], array[coalesce(array_length(v_players, 1), 0)]);
    add_player := add_player || coalesce(v_players, array[]::uuid[]);
  end loop;
end;
$function$;

revoke execute on function public.lb_no_rematch_permute(uuid[], uuid[], uuid[], uuid[], boolean[], uuid[], uuid[]) from public, anon, authenticated;
revoke execute on function public.lb_new_match_ancestors(uuid[], uuid[], uuid[], uuid[], uuid[]) from public, anon, authenticated;

create or replace function public.generate_double_ko_losers(p_tournament_id uuid, p_wb_rounds integer, p_tables integer[], p_playoff_size integer DEFAULT 2)
returns void
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
  v_perm record;
  v_add record;
  v_wb_played_rounds int;
  v_wb_final_ids uuid[];
  v_playoff_sources uuid[] := array[]::uuid[];
  v_playoff_via boolean[] := array[]::boolean[];
  v_playoff_target int;
  v_i int;
  -- Flache "moegliche Spieler je Slot"-Relation (owner = Match-Id, player =
  -- ein Spieler, der dort theoretisch stehen koennte) - Basis ist die
  -- rekursive Abfrage ueber den GESAMTEN Gewinnerbaum (Runde-1-Matches
  -- liefern ihre zwei echten Spieler, jede spaetere Runde die Vereinigung
  -- ihrer zwei Einspeiser); waechst danach um jedes neu erzeugte
  -- Verliererbaum-Match (siehe lb_new_match_ancestors() oben).
  v_anc_owner uuid[] := array[]::uuid[];
  v_anc_player uuid[] := array[]::uuid[];
begin
  v_size := power(2, p_wb_rounds)::int;
  v_playoff_target := greatest(1, p_playoff_size / 2);

  with recursive anc(match_id, ancestor) as (
    select id, player1_id from tournament_matches
      where tournament_id = p_tournament_id and bracket = 'winners' and round = 1 and player1_id is not null
    union
    select id, player2_id from tournament_matches
      where tournament_id = p_tournament_id and bracket = 'winners' and round = 1 and player2_id is not null
    union
    select wm.next_match_id, a.ancestor
      from anc a
      join tournament_matches wm on wm.id = a.match_id
      where wm.bracket = 'winners' and wm.next_match_id is not null
  )
  select coalesce(array_agg(match_id), array[]::uuid[]), coalesce(array_agg(ancestor), array[]::uuid[])
    into v_anc_owner, v_anc_player from anc;

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
      select * into v_perm from lb_no_rematch_permute(v_half1_ids, v_anc_owner, v_anc_player, v_half2_ids, v_half2_via, v_anc_owner, v_anc_player);
      v_half2_ids := v_perm.out_ids; v_half2_via := v_perm.out_via;
      select * into v_rec from lb_pair(p_tournament_id, v_lb_round, v_half1_ids, v_half1_via, v_half2_ids, v_half2_via, p_tables, v_table_idx);
      select * into v_add from lb_new_match_ancestors(v_half1_ids, v_half2_ids, v_rec.out_ids[1:least(coalesce(array_length(v_half1_ids,1),0), coalesce(array_length(v_half2_ids,1),0))], v_anc_owner, v_anc_player);
      v_anc_owner := v_anc_owner || v_add.add_owner; v_anc_player := v_anc_player || v_add.add_player;
    else
      select * into v_perm from lb_no_rematch_permute(v_surv_ids, v_anc_owner, v_anc_player, v_new_ids, v_new_via, v_anc_owner, v_anc_player);
      v_new_ids := v_perm.out_ids; v_new_via := v_perm.out_via;
      select * into v_rec from lb_pair(p_tournament_id, v_lb_round, v_surv_ids, v_surv_via, v_new_ids, v_new_via, p_tables, v_table_idx);
      select * into v_add from lb_new_match_ancestors(v_surv_ids, v_new_ids, v_rec.out_ids[1:least(coalesce(array_length(v_surv_ids,1),0), coalesce(array_length(v_new_ids,1),0))], v_anc_owner, v_anc_player);
      v_anc_owner := v_anc_owner || v_add.add_owner; v_anc_player := v_anc_player || v_add.add_player;
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
      select * into v_perm from lb_no_rematch_permute(v_half1_ids, v_anc_owner, v_anc_player, v_half2_ids, v_half2_via, v_anc_owner, v_anc_player);
      v_half2_ids := v_perm.out_ids; v_half2_via := v_perm.out_via;
      select * into v_rec from lb_pair(p_tournament_id, v_lb_round, v_half1_ids, v_half1_via, v_half2_ids, v_half2_via, p_tables, v_table_idx);
      select * into v_add from lb_new_match_ancestors(v_half1_ids, v_half2_ids, v_rec.out_ids[1:least(coalesce(array_length(v_half1_ids,1),0), coalesce(array_length(v_half2_ids,1),0))], v_anc_owner, v_anc_player);
      v_anc_owner := v_anc_owner || v_add.add_owner; v_anc_player := v_anc_player || v_add.add_player;
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
