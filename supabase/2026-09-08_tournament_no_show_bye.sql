-- Nutzer-Feedback: beim doppelten Nichterscheinen musste die Turnierleitung
-- bisher einen der beiden abwesenden Spieler als "technischen Aufsteiger"
-- auswaehlen, der dann normal im Baum weiterkommt - unfair fuer dessen
-- naechsten Gegner, da keiner der beiden Abwesenden das eigentlich verdient
-- hat. Neues Verhalten: kommen BEIDE nicht, kommt niemand von ihnen weiter -
-- die Stelle im Baum wird stattdessen zum Freilos fuer die Gegenseite der
-- naechsten Runde (Glueck fuer den, der dort hinkommt, aber fair gegenueber
-- den Abwesenden, die nichts "gewonnen" haben).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

alter table tournament_matches add column if not exists void boolean not null default false;

-- =========================================================================
-- tournament_resolve_void_slot(): loest eine leere Baum-Stelle auf, sobald
-- feststeht, dass die andere Seite nie mehr gefuellt wird (weil ihr
-- Zubringer-Match ein doppeltes Nichterscheinen war, siehe unten). Die volle
-- Seite bekommt dann ein Freilos - genau wie ein Freilos bei der
-- Baum-Erzeugung (generate_ko_bracket()), nur nachtraeglich entdeckt.
-- Rekursiv (plpgsql-Rekursion ist bei der geringen Baumtiefe unbedenklich),
-- damit auch mehrere Freilose in Folge (seltener Sonderfall: zwei
-- aufeinanderfolgende Runden mit doppeltem Nichterscheinen) korrekt
-- durchgereicht werden. Wird sowohl direkt nach dem Voiden eines Matches
-- aufgerufen (falls die Gegenseite schon feststeht) als auch aus
-- advance_tournament_bracket() heraus (falls die Gegenseite erst danach
-- feststeht).
-- =========================================================================
create or replace function public.tournament_resolve_void_slot(p_match_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_m tournament_matches;
  v_feeder1 tournament_matches;
  v_feeder2 tournament_matches;
  v_survivor uuid;
begin
  select * into v_m from tournament_matches where id = p_match_id;
  if not found or v_m.match_id is not null or v_m.is_bye or coalesce(v_m.void, false) then return; end if;
  if v_m.player1_id is not null and v_m.player2_id is not null then return; end if;

  select * into v_feeder1 from tournament_matches
    where (next_match_id = p_match_id and next_slot = 1) or (loser_next_match_id = p_match_id and loser_next_slot = 1)
    limit 1;
  select * into v_feeder2 from tournament_matches
    where (next_match_id = p_match_id and next_slot = 2) or (loser_next_match_id = p_match_id and loser_next_slot = 2)
    limit 1;

  if v_m.player1_id is null and coalesce(v_feeder1.void, false) and v_m.player2_id is null and coalesce(v_feeder2.void, false) then
    -- Beide Zubringer-Matches waren ein doppeltes Nichterscheinen - hier
    -- kommt niemand mehr weiter, dieses Match wird ebenfalls void.
    update tournament_matches set void = true, table_number = null where id = p_match_id;
    if v_m.next_match_id is not null then perform tournament_resolve_void_slot(v_m.next_match_id); end if;
    return;
  elsif v_m.player1_id is null and coalesce(v_feeder1.void, false) and v_m.player2_id is not null then
    v_survivor := v_m.player2_id;
  elsif v_m.player2_id is null and coalesce(v_feeder2.void, false) and v_m.player1_id is not null then
    v_survivor := v_m.player1_id;
  else
    return; -- noch nichts zu tun, wartet auf einen echten Zubringer
  end if;

  -- Ueberlebende(r) immer nach player1_id normalisieren, player2_id leeren -
  -- dieselbe Form, die generate_ko_bracket() fuer ganz normale Freilose bei
  -- der Baum-Erzeugung verwendet. Ohne das wuerde eine Ueberlebende Seite,
  -- die zufaellig in Slot 2 sass, in dieser Zeile in player2_id verbleiben -
  -- die Freilos-Anzeige (renderMatch()/renderBoxInner()) geht aber IMMER
  -- von player1_id als der Freilos-Seite aus und haette dort "TBD" gezeigt.
  update tournament_matches set is_bye = true, winner_id = v_survivor, player1_id = v_survivor, player2_id = null
    where id = p_match_id;

  if v_m.next_match_id is not null then
    if v_m.next_slot = 1 then
      update tournament_matches set player1_id = v_survivor where id = v_m.next_match_id;
    else
      update tournament_matches set player2_id = v_survivor where id = v_m.next_match_id;
    end if;
    update tournament_matches set ready_at = now()
      where id = v_m.next_match_id and ready_at is null and player1_id is not null and player2_id is not null;
    perform tournament_resolve_void_slot(v_m.next_match_id);
  end if;

  perform tournament_assign_free_tables(v_m.tournament_id);
  if not exists (
    select 1 from tournament_matches
    where tournament_id = v_m.tournament_id and next_match_id is null and loser_next_match_id is null and winner_id is null
  ) then
    update tournaments set status = 'finished', finished_at = now() where id = v_m.tournament_id;
  end if;
end;
$function$;

-- =========================================================================
-- tournament_mark_no_show(): Signatur geaendert (kein p_technical_winner_id
-- mehr noetig) - Postgres ersetzt eine Funktion nur bei EXAKT gleicher
-- Signatur, daher expliziter Drop der alten 3-Parameter-Version.
-- =========================================================================
drop function if exists public.tournament_mark_no_show(uuid, uuid[], uuid);

create or replace function public.tournament_mark_no_show(p_tournament_match_id uuid, p_absent_player_ids uuid[])
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tm tournament_matches;
  v_tour tournaments;
  v_absent_count int;
  v_present uuid;
  v_loser uuid;
  v_row matches;
  v_next tournament_matches;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tm from tournament_matches where id = p_tournament_match_id;
  if not found then raise exception 'Turnier-Match nicht gefunden.'; end if;
  if v_tm.is_bye then raise exception 'Dieses Match ist ein Freilos.'; end if;
  if coalesce(v_tm.void, false) then raise exception 'Für dieses Match wurde bereits ein Nichterscheinen gemeldet.'; end if;
  if v_tm.match_id is not null then raise exception 'Für dieses Match wurde bereits ein Ergebnis gemeldet.'; end if;
  if v_tm.player1_id is null or v_tm.player2_id is null then
    raise exception 'Die Paarung für dieses Match steht noch nicht fest.';
  end if;

  select * into v_tour from tournaments where id = v_tm.tournament_id;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur der Turnierleiter oder ein Admin kann ein Nichterscheinen melden.';
  end if;
  if v_tour.status <> 'running' then raise exception 'Dieses Turnier ist nicht aktiv.'; end if;

  v_absent_count := coalesce(array_length(p_absent_player_ids, 1), 0);
  if v_absent_count < 1 or v_absent_count > 2 then
    raise exception 'Bitte einen oder beide Spieler als abwesend markieren.';
  end if;
  if exists (select 1 from unnest(p_absent_player_ids) pid where pid not in (v_tm.player1_id, v_tm.player2_id)) then
    raise exception 'Ungültige Spielerauswahl für dieses Match.';
  end if;

  if v_absent_count = 1 then
    v_loser := p_absent_player_ids[1];
    v_present := case when v_loser = v_tm.player1_id then v_tm.player2_id else v_tm.player1_id end;

    insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed, tournament_id, walkover)
    values (
      v_tm.player1_id, v_tm.player2_id,
      case when v_tm.player1_id = v_present then 1 else 0 end,
      case when v_tm.player2_id = v_present then 1 else 0 end,
      v_tour.discipline, v_me, false, v_tour.id, false
    )
    returning * into v_row;

    update tournament_matches set match_id = v_row.id where id = p_tournament_match_id;
    perform tournament_assign_free_tables(v_tour.id);
    update matches set confirmed = true, confirmed_by = v_me where id = v_row.id;

    -- Kaskade wie bisher: der Verlierer/Ausgeschiedene verliert automatisch
    -- auch alle weiteren, dadurch bereits bekannten offenen Partien.
    loop
      select * into v_next from tournament_matches
        where tournament_id = v_tour.id and match_id is null and coalesce(is_bye, false) = false and coalesce(void, false) = false
          and player1_id is not null and player2_id is not null
          and (player1_id = v_loser or player2_id = v_loser)
        limit 1;
      exit when not found;

      v_present := case when v_next.player1_id = v_loser then v_next.player2_id else v_next.player1_id end;
      insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed, tournament_id, walkover)
      values (
        v_next.player1_id, v_next.player2_id,
        case when v_next.player1_id = v_present then 1 else 0 end,
        case when v_next.player2_id = v_present then 1 else 0 end,
        v_tour.discipline, v_me, false, v_tour.id, false
      )
      returning * into v_row;

      update tournament_matches set match_id = v_row.id where id = v_next.id;
      perform tournament_assign_free_tables(v_tour.id);
      update matches set confirmed = true, confirmed_by = v_me where id = v_row.id;
    end loop;
  else
    -- Beide nicht erschienen: niemand von beiden kommt weiter (Nutzer-
    -- Feedback) - kein Match-Datensatz, kein "technischer Aufsteiger" mehr.
    -- Die Stelle im Baum wird stattdessen zum Freilos fuer die naechste
    -- Runde, sobald die Gegenseite feststeht (tournament_resolve_void_slot()).
    -- table_number = null gibt den zugewiesenen Tisch wieder frei (siehe
    -- tournament_assign_free_tables() - ein Tisch gilt sonst als belegt,
    -- solange match_id null ist, was fuer ein void-Match fuer immer gilt).
    update tournament_matches set void = true, table_number = null where id = p_tournament_match_id;
    perform tournament_assign_free_tables(v_tour.id);
    if v_tm.next_match_id is not null then
      perform tournament_resolve_void_slot(v_tm.next_match_id);
    end if;
  end if;
end;
$function$;

-- =========================================================================
-- advance_tournament_bracket(): nach dem normalen Weiterreichen des
-- Siegers zusaetzlich pruefen, ob die ANDERE Seite des Ziel-Matches von
-- einem doppelten Nichterscheinen (void) kommt - dann sofort zum Freilos
-- aufloesen, statt endlos auf einen Gegner zu warten, der nie kommt.
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
    perform tournament_resolve_void_slot(v_tm.next_match_id);
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

-- =========================================================================
-- tournament_final_standings(): zwei zusaetzliche Zweige in "eliminated" -
-- bei einem void-Match (doppeltes Nichterscheinen) gelten BEIDE Abwesenden
-- als hier ausgeschieden (geteilter Platz), da keiner von ihnen einen Sieg
-- vorweisen kann. Bekannte Einschraenkung: ist ausgerechnet das Finale
-- selbst void, bleibt "champion" leer (kein Sieger ermittelbar) - dieser
-- Sonderfall braucht manuelle Nachbearbeitung, genau wie die aehnlich
-- seltenen Randfaelle der Nichterscheinen-Kaskade.
-- =========================================================================
create or replace function public.tournament_final_standings(p_tournament_id uuid)
 returns TABLE(player_id uuid, placement integer, tied_count integer)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tour tournaments;
  v_has_final boolean;
begin
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then return; end if;

  select exists (
    select 1 from tournament_matches where tournament_id = p_tournament_id and bracket = 'final'
  ) into v_has_final;

  -- Bracket-Teil: deckt K.O./Doppel-K.O. komplett ab, bei Jeder-gegen-jeden
  -- nur den Playoff-Finalbaum (falls vorhanden).
  if v_tour.format in ('ko', 'double_ko') or v_has_final then
    return query
    with recursive scope as (
      select * from tournament_matches
      where tournament_id = p_tournament_id
        and (v_tour.format in ('ko', 'double_ko') or bracket = 'final')
    ),
    champion as (
      select id from scope where next_match_id is null and winner_id is not null limit 1
    ),
    depths as (
      select id, 0 as depth from scope where id = (select id from champion)
      union all
      select s.id, d.depth + 1
      from scope s
      join depths d on s.next_match_id = d.id
    ),
    eliminated as (
      -- Sieger: Platz 1 (Marker-Tiefe -1, garantiert die kleinste Gruppe)
      select s.winner_id as elim_player_id, -1 as elim_depth
      from scope s join depths d on d.id = s.id and d.depth = 0
      where s.winner_id is not null
      union all
      -- Finalist: Platz 2 (Verlierer des Championship-Matches, Tiefe 0)
      select (case when s.winner_id = s.player1_id then s.player2_id else s.player1_id end), 0
      from scope s join depths d on d.id = s.id and d.depth = 0
      where s.winner_id is not null
      union all
      -- Alle anderen: wirklich ausgeschieden, wenn kein loser_next_match_id
      select (case when s.winner_id = s.player1_id then s.player2_id else s.player1_id end), d.depth
      from scope s join depths d on d.id = s.id
      where s.winner_id is not null and coalesce(s.is_bye, false) = false
        and d.depth >= 1 and s.loser_next_match_id is null
      union all
      -- Doppeltes Nichterscheinen: BEIDE Abwesenden gelten als hier
      -- ausgeschieden (geteilter Platz statt eines "technischen" Siegers).
      select s.player1_id, d.depth from scope s join depths d on d.id = s.id
      where coalesce(s.void, false) and d.depth >= 1 and s.player1_id is not null
      union all
      select s.player2_id, d.depth from scope s join depths d on d.id = s.id
      where coalesce(s.void, false) and d.depth >= 1 and s.player2_id is not null
    ),
    grp as (
      select elim_player_id, elim_depth, dense_rank() over (order by elim_depth) as grp_no
      from eliminated
    ),
    grp_sizes as (
      select grp_no, count(*) as cnt from grp group by grp_no
    ),
    placements as (
      select g.elim_player_id as out_player_id,
        (1 + coalesce((select sum(gs2.cnt) from grp_sizes gs2 where gs2.grp_no < g.grp_no), 0))::int as out_placement
      from grp g
    )
    select p.out_player_id, p.out_placement,
      (select count(*) from placements p2 where p2.out_placement = p.out_placement)::int
    from placements p;
  end if;

  -- Record-Teil: Jeder-gegen-jeden - volles Feld ohne Playoff, sonst nur die
  -- nicht qualifizierten Spieler unterhalb des Playoffs (echte Ties statt
  -- des Zufalls-Tiebreaks aus tournament_round_robin_ranking()).
  if v_tour.format = 'round_robin' then
    return query
    with qualifiers as (
      select player1_id as pid from tournament_matches where tournament_id = p_tournament_id and bracket = 'final' and player1_id is not null
      union
      select player2_id from tournament_matches where tournament_id = p_tournament_id and bracket = 'final' and player2_id is not null
    ),
    recs as (
      select tp.player_id as rec_player_id,
        count(*) filter (where tm.winner_id = tp.player_id) as wins,
        count(*) filter (where tm.winner_id is not null and tm.winner_id <> tp.player_id
                          and (tm.player1_id = tp.player_id or tm.player2_id = tp.player_id)) as losses
      from tournament_players tp
      left join tournament_matches tm
        on tm.tournament_id = p_tournament_id and tm.bracket = 'main'
        and (tm.player1_id = tp.player_id or tm.player2_id = tp.player_id)
      where tp.tournament_id = p_tournament_id
        and tp.player_id not in (select pid from qualifiers)
      group by tp.player_id
    ),
    ranked as (
      select rec_player_id, dense_rank() over (order by wins desc, losses asc) as r
      from recs
    )
    select ranked.rec_player_id, (ranked.r + coalesce(v_tour.playoff_size, 0))::int,
      (select count(*) from ranked r2 where r2.r = ranked.r)::int
    from ranked;
  end if;

  return;
end;
$function$;

-- Void-Schutz auch bei den beiden Ergebnis-Erfassungs-RPCs (bisher nur der
-- is_bye-Fall abgefangen) - ohne diese Sperre koennte fuer ein bereits
-- gevoidetes Match trotzdem noch ein Ergebnis eingetragen werden.
create or replace function public.tournament_report_match(
  p_tournament_match_id uuid, p_my_score integer, p_opp_score integer,
  p_high_run_me integer default null::integer, p_high_run_opp integer default null::integer,
  p_deficit_me integer default null::integer, p_deficit_opp integer default null::integer,
  p_avg_me numeric default null::numeric, p_avg_opp numeric default null::numeric,
  p_twoball_me integer default null::integer, p_twoball_opp integer default null::integer,
  p_run_log jsonb default null::jsonb
) returns matches
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
  if coalesce(v_tm.void, false) then raise exception 'Für dieses Match wurde ein Nichterscheinen beider Spieler gemeldet.'; end if;
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
  p_high_run_me integer default null::integer, p_high_run_opp integer default null::integer,
  p_deficit_me integer default null::integer, p_deficit_opp integer default null::integer,
  p_avg_me numeric default null::numeric, p_avg_opp numeric default null::numeric,
  p_twoball_me integer default null::integer, p_twoball_opp integer default null::integer,
  p_run_log jsonb default null::jsonb
) returns matches
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
  if coalesce(v_tm.void, false) then raise exception 'Für dieses Match wurde ein Nichterscheinen beider Spieler gemeldet.'; end if;
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

-- tournament_assign_free_tables(): void-Matches (siehe oben) zusaetzlich zu
-- Freilosen von der Warteliste ausschliessen - table_number wird beim
-- Voiden zwar bereits auf null gesetzt (siehe tournament_mark_no_show()),
-- diese Zeile ist nur eine zusaetzliche Absicherung, falls ein void-Match
-- aus irgendeinem Grund doch noch ohne Tisch dasteht.
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
      and coalesce(is_bye, false) = false and coalesce(void, false) = false
      and player1_id is not null and player2_id is not null
      and match_id is null and table_number is null;

  if coalesce(array_length(v_waiting, 1), 0) = 0 then return; end if;

  for v_i in 1..least(array_length(v_free, 1), array_length(v_waiting, 1)) loop
    update tournament_matches set table_number = v_free[v_i] where id = v_waiting[v_i];
  end loop;
end;
$function$;
