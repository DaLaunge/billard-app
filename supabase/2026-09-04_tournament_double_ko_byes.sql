-- Doppel-K.O. war bisher auf Teilnehmerzahlen in exakter 2er-Potenz (4, 8,
-- 16, ...) beschraenkt, weil Freilose im Verliererbaum deutlich komplizierter
-- sind als im Gewinnerbaum (ein Freilos im Gewinnerbaum erzeugt schlicht
-- keinen Verlierer, der Verliererbaum "laeuft" dadurch an dieser Stelle
-- leer). Stefan will das nicht mehr eingeschraenkt haben: auch bei Doppel-
-- K.O. sollen ueberzaehlige Plaetze zufaellig mit Freilosen aufgefuellt
-- werden, genau wie bei normalem K.O.
--
-- Loesung: generate_double_ko_losers() baut den Verliererbaum jetzt nicht
-- mehr mit der Annahme "jede Gewinnerbaum-Runde hat exakt so viele Verlierer
-- wie die naechste Runde erwartet", sondern generisch ueber eine einzige
-- Paarungs-Hilfsfunktion lb_pair(): sie paart zwei Listen von "Ueberlebenden"
-- 1:1 und reicht bei ungleicher Laenge den Ueberschuss unveraendert (= Frei-
-- los im Verliererbaum) an die naechste Stufe weiter. Runde 1 des Verlierer-
-- baums ist damit "paare die echten (nicht per Freilos vorgerueckten) Runde-
-- 1-Verlierer zufaellig untereinander", und jede weitere Runde ist "paare
-- die bisherigen Verliererbaum-Ueberlebenden mit den frisch abgestiegenen
-- Gewinnerbaum-Verlierern" - vor jeder neuen Gewinnerbaum-Runde wird auf die
-- dort erwartete Groesse "herunterkonsolidiert" (wieder ueber lb_pair, diesmal
-- eine Liste mit sich selbst geteilt in zwei Haelften), damit der Verlierer-
-- baum nicht vorauslaeuft. Ergebnis: strukturell immer genau ein Verlierer-
-- baum-Champion am Ende, unabhaengig von der Teilnehmerzahl.
--
-- generate_ko_bracket() (Gewinnerbaum + Freilos-Verteilung) bleibt unveraendert -
-- nur generate_double_ko_losers() wird ersetzt, zwei neue interne Helfer
-- (tm_wire, lb_pair) kommen dazu, und create_tournament() verliert die
-- 2er-Potenz-Pruefung fuer Doppel-K.O. (Admin-Prufung aus
-- 2026-09-04_tournament_admin_only.sql bleibt bestehen).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

-- Setzt die Vorwaerts-Verknuepfung EINES Rasterplatzes: entweder ueber
-- next_match_id/next_slot (Sieger-Pfad) oder ueber loser_next_match_id/
-- loser_next_slot (Verlierer-Pfad aus dem Gewinnerbaum) - p_via_loser
-- entscheidet welcher. So kann derselbe generische Code sowohl "normale"
-- Verliererbaum-Ueberlebende als auch frisch aus dem Gewinnerbaum
-- abgestiegene Verlierer gleich behandeln.
create or replace function public.tm_wire(p_id uuid, p_via_loser boolean, p_target uuid, p_slot smallint)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if p_via_loser then
    update tournament_matches set loser_next_match_id = p_target, loser_next_slot = p_slot where id = p_id;
  else
    update tournament_matches set next_match_id = p_target, next_slot = p_slot where id = p_id;
  end if;
end;
$function$;

-- Paart zwei Listen von Rasterplaetzen ("Ueberlebende", je als Paar aus
-- Match-Id + via_loser-Flag) 1:1 durch neue Verliererbaum-Matches. Ist eine
-- Liste laenger, wird der Ueberschuss unveraendert in die Rueckgabe
-- uebernommen (= automatischer Weiterzug/Freilos an dieser Stelle). Wird
-- sowohl fuers "echte" Zusammentreffen zweier unabhaengiger Listen als auch
-- fuers Selbst-Konsolidieren einer einzelnen Liste (in zwei Haelften
-- geteilt) verwendet - siehe generate_double_ko_losers().
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
  v_table_count int := array_length(p_tables, 1);
  v_i int;
  v_id uuid;
  v_pos int := 0;
begin
  out_ids := array[]::uuid[];
  out_via := array[]::boolean[];
  for v_i in 1..v_m loop
    v_pos := v_pos + 1;
    p_table_idx := p_table_idx + 1;
    insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
      values (p_tournament_id, 'losers', p_lb_round, v_pos, p_tables[((p_table_idx - 1) % v_table_count) + 1])
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

revoke execute on function public.tm_wire(uuid, boolean, uuid, smallint) from public, anon, authenticated;
revoke execute on function public.lb_pair(uuid, int, uuid[], boolean[], uuid[], boolean[], int[], int) from public, anon, authenticated;

create or replace function public.generate_double_ko_losers(
  p_tournament_id uuid, p_wb_rounds int, p_tables int[]
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
  v_wbf_id uuid;
  v_gf_id uuid;
begin
  v_size := power(2, p_wb_rounds)::int;

  for v_r in 1..p_wb_rounds loop
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
      -- Runde 1: die echten (nicht per Freilos vorgerueckten) Verlierer der
      -- ersten Gewinnerbaum-Runde spielen zufaellig gegeneinander; bei
      -- ungerader Anzahl bekommt einer automatisch ein Freilos (Ueberschuss
      -- aus lb_pair).
      v_k := array_length(v_new_ids, 1);
      v_split := ceil(v_k / 2.0)::int;
      v_half1_ids := v_new_ids[1:v_split]; v_half1_via := v_new_via[1:v_split];
      v_half2_ids := v_new_ids[v_split + 1:v_k]; v_half2_via := v_new_via[v_split + 1:v_k];
      select * into v_rec from lb_pair(p_tournament_id, v_lb_round, v_half1_ids, v_half1_via, v_half2_ids, v_half2_via, p_tables, v_table_idx);
    else
      -- weitere Runden: bisherige Verliererbaum-Ueberlebende treffen auf die
      -- frisch abgestiegenen Gewinnerbaum-Verlierer.
      select * into v_rec from lb_pair(p_tournament_id, v_lb_round, v_surv_ids, v_surv_via, v_new_ids, v_new_via, p_tables, v_table_idx);
    end if;
    v_table_idx := v_rec.p_table_idx;
    v_surv_ids := v_rec.out_ids;
    v_surv_via := v_rec.out_via;

    -- vor der naechsten Gewinnerbaum-Runde auf deren erwartete Verlierer-
    -- anzahl herunterkonsolidieren (Freilos-Weiterreichen bei ungerader
    -- Anzahl), damit der Verliererbaum nicht vorauslaeuft. Fuer die letzte
    -- Runde (v_r + 1 = p_wb_rounds, das Gewinnerbaum-Finale mit nur einem
    -- Verlierer) landet v_target automatisch bei 1.
    if v_r < p_wb_rounds then
      v_target := greatest(1, (v_size / power(2, v_r + 1))::int);
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
    end if;
  end loop;

  -- v_surv_ids hat jetzt genau einen Eintrag: der Verliererbaum-Champion
  -- (aus der letzten Schleifen-Iteration, dem Zusammentreffen mit dem
  -- Verlierer des Gewinnerbaum-Finales).
  --
  -- Grosses Finale: Gewinnerbaum-Champion gegen Verliererbaum-Champion.
  -- (Vereinfachung: ein einziges entscheidendes Spiel, kein "Bracket Reset"
  -- falls der Verliererbaum-Champion gewinnt - fuer Vereinsturniere ausreichend.)
  select id into v_wbf_id from tournament_matches
    where tournament_id = p_tournament_id and bracket = 'winners' and round = p_wb_rounds;
  v_table_idx := v_table_idx + 1;
  insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
    values (p_tournament_id, 'final', 1, 1, p_tables[((v_table_idx - 1) % array_length(p_tables, 1)) + 1])
    returning id into v_gf_id;
  update tournament_matches set next_match_id = v_gf_id, next_slot = 1 where id = v_wbf_id;
  perform tm_wire(v_surv_ids[1], v_surv_via[1], v_gf_id, 2);
end;
$function$;

-- create_tournament(): Admin-Pruefung (aus 2026-09-04_tournament_admin_only.sql)
-- bleibt bestehen, die 2er-Potenz-Pruefung fuer Doppel-K.O. faellt weg -
-- generate_ko_bracket()/generate_double_ko_losers() vertragen jetzt jede
-- Teilnehmerzahl >= 2.
create or replace function public.create_tournament(
  p_name text, p_format text, p_discipline text,
  p_player_ids uuid[], p_table_numbers int[]
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

  insert into tournaments (name, format, discipline, organizer_id, table_numbers, status, started_at)
  values (trim(p_name), p_format, trim(p_discipline), v_me, v_tables, 'running', now())
  returning * into v_tournament;

  insert into tournament_players (tournament_id, player_id)
    select v_tournament.id, x from unnest(v_players) x;

  -- Reihenfolge fuers Auslosen zufaellig mischen
  select array_agg(x) into v_players from (select x from unnest(v_players) x order by random()) t;

  if p_format = 'round_robin' then
    perform generate_round_robin(v_tournament.id, v_players, v_tables);
  else
    perform generate_ko_bracket(v_tournament.id, v_players, v_tables, p_format = 'double_ko');
  end if;

  return v_tournament;
end;
$function$;
