-- Turniermodus: K.O., Doppel-K.O. (= Doppel-Ausscheidungssystem, NICHT zu
-- verwechseln mit "Doppel" = 2v2-Partnerspiele, das bleibt unberuehrt) und
-- Jeder-gegen-jeden. Ein Turnier wird von einem beliebigen eingeloggten
-- Spieler angelegt (kein neue Rolle noetig) und die Person wird automatisch
-- "Organisator" dieses einen Turniers. Das Raster (K.O./Doppel-K.O. als
-- Baum, Jeder-gegen-jeden als Tabelle) wird beim Anlegen komplett serverseitig
-- ausgewuerfelt und generiert - der Client zeigt nur an und meldet Ergebnisse.
--
-- Turniermatches landen ganz normal in "matches" (zaehlen zur Elo/Rangliste),
-- bekommen aber matches.tournament_id gesetzt, damit sie gekennzeichnet und
-- filterbar sind.
--
-- Sicherheitsmodell fuer die Organisator-Rechte: es gibt bewusst KEINE neue
-- globale Rolle. Der Organisator darf per tournament_force_confirm_match()
-- nur Matches INNERHALB SEINES EIGENEN Turniers erzwungen bestaetigen (Check
-- via tournaments.organizer_id), und auch das nicht, wenn er selbst einer
-- der beiden Spieler ist (Interessenkonflikt). Admins koennen das zusaetzlich
-- ueberall, wie ueberall sonst auch (is_admin()).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

-- =========================================================================
-- 1) Tabellen
-- =========================================================================

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  format text not null check (format in ('ko', 'double_ko', 'round_robin')),
  discipline text not null,
  status text not null default 'setup' check (status in ('setup', 'running', 'finished', 'cancelled')),
  organizer_id uuid not null references public.players(id),
  table_numbers integer[] not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists public.tournament_players (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.players(id),
  seed int,
  eliminated boolean not null default false,
  primary key (tournament_id, player_id)
);

-- Rasterplaetze: existieren unabhaengig davon ob schon gespielt wurde, damit
-- das komplette Raster von Anfang an sichtbar ist ("noch offen" = player1/2_id null).
create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  -- 'main' = K.O./Jeder-gegen-jeden, 'winners'/'losers'/'final' = Doppel-K.O.-Baeume
  bracket text not null default 'main' check (bracket in ('main', 'winners', 'losers', 'final')),
  round int not null,
  bracket_position int not null,
  player1_id uuid references public.players(id),
  player2_id uuid references public.players(id),
  is_bye boolean not null default false,
  table_number int,
  match_id uuid references public.matches(id),
  winner_id uuid references public.players(id),
  next_match_id uuid references public.tournament_matches(id),
  next_slot smallint check (next_slot in (1, 2)),
  loser_next_match_id uuid references public.tournament_matches(id),
  loser_next_slot smallint check (loser_next_slot in (1, 2)),
  created_at timestamptz not null default now(),
  unique (tournament_id, bracket, round, bracket_position)
);

create index if not exists tournament_matches_tournament_idx on public.tournament_matches(tournament_id);
create index if not exists tournament_players_tournament_idx on public.tournament_players(tournament_id);

-- Kennzeichnung + Audit auf der bestehenden matches-Tabelle. Beides nullable,
-- bestehende Insert-Pfade (report_match, report_doubles, admin_add_match)
-- funktionieren unveraendert weiter.
alter table public.matches
  add column if not exists tournament_id uuid references public.tournaments(id),
  add column if not exists confirmed_by uuid references public.players(id);

create index if not exists matches_tournament_id_idx on public.matches(tournament_id) where tournament_id is not null;

-- RLS: wie bei matches/players - alle Mitglieder duerfen lesen, kein Insert/
-- Update/Delete per RLS, laeuft ausschliesslich ueber die SECURITY DEFINER-
-- Funktionen unten.
alter table public.tournaments enable row level security;
alter table public.tournament_players enable row level security;
alter table public.tournament_matches enable row level security;

drop policy if exists mitglieder_lesen_turniere on public.tournaments;
create policy mitglieder_lesen_turniere on public.tournaments for select using (true);

drop policy if exists mitglieder_lesen_turnierspieler on public.tournament_players;
create policy mitglieder_lesen_turnierspieler on public.tournament_players for select using (true);

drop policy if exists mitglieder_lesen_turniermatches on public.tournament_matches;
create policy mitglieder_lesen_turniermatches on public.tournament_matches for select using (true);

-- =========================================================================
-- 2) Bestehende Funktionen um confirmed_by erweitern (sonst unveraendert)
-- =========================================================================

create or replace function public.confirm_match(p_match_id uuid, p_ok boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me       uuid := current_player_id();
  v_match    matches;
  v_opponent uuid;
begin
  select * into v_match from matches where id = p_match_id;
  if not found then raise exception 'Match nicht gefunden.'; end if;
  if v_match.confirmed then raise exception 'Match ist bereits bestätigt.'; end if;

  -- ---------- DOPPEL ----------
  if v_match.player1b_id is not null then
    if is_admin() then
      if p_ok then
        update match_confirmations set status = 'ok', updated_at = now() where match_id = p_match_id;
        update matches set confirmed = true, confirmed_by = v_me where id = p_match_id;
      else
        delete from matches where id = p_match_id;
      end if;
      return;
    end if;
    if not exists (select 1 from match_confirmations where match_id = p_match_id and player_id = v_me) then
      raise exception 'Du bist an diesem Match nicht als Bestätiger vorgesehen.';
    end if;
    if p_ok then
      update match_confirmations set status = 'ok', updated_at = now()
        where match_id = p_match_id and player_id = v_me;
      -- alle bestätigt? -> Match gilt
      if not exists (select 1 from match_confirmations where match_id = p_match_id and status <> 'ok') then
        update matches set confirmed = true, confirmed_by = v_me where id = p_match_id;
      end if;
    else
      delete from matches where id = p_match_id;   -- eine Ablehnung beendet das Doppel
    end if;
    return;
  end if;

  -- ---------- EINZEL (unverändert) ----------
  v_opponent := case when v_match.reported_by = v_match.player1_id
                     then v_match.player2_id else v_match.player1_id end;
  if v_me is distinct from v_opponent and not is_admin() then
    raise exception 'Nur der Gegner (oder ein Admin) kann dieses Match bestätigen.';
  end if;
  if p_ok then
    update matches set confirmed = true, confirmed_by = v_me where id = p_match_id;
  else
    delete from matches where id = p_match_id;
  end if;
end;
$function$;

create or replace function public.admin_add_match(
  p_player1 uuid, p_player2 uuid, p_score1 integer, p_score2 integer,
  p_discipline text, p_played_at timestamp with time zone default now()
)
 returns matches
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_row matches;
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  if p_player1 = p_player2 then raise exception 'Zwei verschiedene Spieler nötig.'; end if;
  if exists (select 1 from players where id in (p_player1, p_player2) and coalesce(is_ghost, false)) then
    raise exception 'Der Ghost kann hier nicht eingetragen werden.';
  end if;
  if exists (select 1 from unnest(array[p_player1, p_player2]) x
             where not exists (select 1 from players where id = x)) then
    raise exception 'Ein Spieler wurde nicht gefunden.';
  end if;
  if p_score1 = p_score2 then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;
  if coalesce(trim(p_discipline), '') = '' then raise exception 'Disziplin fehlt.'; end if;

  insert into matches (player1_id, player2_id, score1, score2, discipline,
                       reported_by, confirmed, confirmed_by, played_at)
  values (p_player1, p_player2, p_score1, p_score2, trim(p_discipline),
          current_player_id(), true, current_player_id(), coalesce(p_played_at, now()))
  returning * into v_row;
  return v_row;
end;
$function$;

-- =========================================================================
-- 3) Rastergenerierung (interne Helfer, nicht direkt von Clients aufrufbar -
--    siehe REVOKE am Ende dieses Abschnitts)
-- =========================================================================

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
          (tournament_id, bracket, round, bracket_position, player1_id, player2_id, table_number)
        values
          (p_tournament_id, 'main', v_r, v_pos, v_home, v_away,
           p_tables[((v_table_idx - 1) % v_table_count) + 1]);
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
        (tournament_id, bracket, round, bracket_position, player1_id, player2_id, table_number)
      values
        (p_tournament_id, v_bracket, 1, v_i, v_p1, v_p2, p_tables[((v_table_idx - 1) % v_table_count) + 1])
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
    end loop;
    v_round_ids := v_next_ids;
  end loop;

  if p_double then
    perform generate_double_ko_losers(p_tournament_id, v_total_rounds, p_tables);
  end if;
end;
$function$;

-- Verliererbaum fuer Doppel-K.O. Setzt voraus, dass der Gewinnerbaum (Runden
-- 1..p_wb_rounds, bracket='winners') bereits vollstaendig angelegt ist.
-- Nur fuer Teilnehmerzahlen die exakt einer 2er-Potenz entsprechen aufgerufen
-- (siehe Validierung in create_tournament) - dadurch hat JEDES Gewinnerbaum-
-- Match einen echten Verlierer (keine Freilose), was die klassische
-- Verliererbaum-Struktur (abwechselnd "neue Verlierer einspeisen" und
-- "Verliererbaum-Sieger untereinander konsolidieren") sauber generisch macht.
create or replace function public.generate_double_ko_losers(
  p_tournament_id uuid, p_wb_rounds int, p_tables int[]
) returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_wb_ids uuid[];
  v_lb_survivors uuid[];
  v_new uuid[];
  v_r int;
  v_i int;
  v_lb_round int := 0;
  v_table_idx int := 0;
  v_table_count int := array_length(p_tables, 1);
  v_id uuid;
  v_wbf_id uuid;
  v_gf_id uuid;
begin
  for v_r in 1..p_wb_rounds loop
    select array_agg(id order by bracket_position) into v_wb_ids
      from tournament_matches
      where tournament_id = p_tournament_id and bracket = 'winners' and round = v_r;

    if v_r = 1 then
      -- Runde 1: die Verlierer der ersten WB-Runde spielen direkt gegeneinander
      v_lb_round := v_lb_round + 1;
      v_new := array[]::uuid[];
      for v_i in 1..(array_length(v_wb_ids, 1) / 2) loop
        v_table_idx := v_table_idx + 1;
        insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
          values (p_tournament_id, 'losers', v_lb_round, v_i, p_tables[((v_table_idx - 1) % v_table_count) + 1])
          returning id into v_id;
        update tournament_matches set loser_next_match_id = v_id, loser_next_slot = 1 where id = v_wb_ids[2 * v_i - 1];
        update tournament_matches set loser_next_match_id = v_id, loser_next_slot = 2 where id = v_wb_ids[2 * v_i];
        v_new := v_new || v_id;
      end loop;
      v_lb_survivors := v_new;

    elsif v_r < p_wb_rounds then
      -- Einspeise-Runde: bisherige Verlierbaum-Sieger treffen 1:1 auf die
      -- frisch aus dem Gewinnerbaum abgestiegenen Verlierer
      v_lb_round := v_lb_round + 1;
      v_new := array[]::uuid[];
      for v_i in 1..array_length(v_wb_ids, 1) loop
        v_table_idx := v_table_idx + 1;
        insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
          values (p_tournament_id, 'losers', v_lb_round, v_i, p_tables[((v_table_idx - 1) % v_table_count) + 1])
          returning id into v_id;
        update tournament_matches set next_match_id = v_id, next_slot = 1 where id = v_lb_survivors[v_i];
        update tournament_matches set loser_next_match_id = v_id, loser_next_slot = 2 where id = v_wb_ids[v_i];
        v_new := v_new || v_id;
      end loop;
      v_lb_survivors := v_new;

      if array_length(v_lb_survivors, 1) > 1 then
        -- Konsolidierungsrunde: Verliererbaum-Sieger untereinander, bis nur
        -- noch einer uebrig ist fuer die naechste Einspeise-Runde
        v_lb_round := v_lb_round + 1;
        v_new := array[]::uuid[];
        for v_i in 1..(array_length(v_lb_survivors, 1) / 2) loop
          v_table_idx := v_table_idx + 1;
          insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
            values (p_tournament_id, 'losers', v_lb_round, v_i, p_tables[((v_table_idx - 1) % v_table_count) + 1])
            returning id into v_id;
          update tournament_matches set next_match_id = v_id, next_slot = 1 where id = v_lb_survivors[2 * v_i - 1];
          update tournament_matches set next_match_id = v_id, next_slot = 2 where id = v_lb_survivors[2 * v_i];
          v_new := v_new || v_id;
        end loop;
        v_lb_survivors := v_new;
      end if;

    else
      -- letzte WB-Runde (das Gewinnerbaum-Finale): dessen Verlierer trifft im
      -- Verliererbaum-Finale auf den letzten verbliebenen Verliererbaum-Sieger
      v_lb_round := v_lb_round + 1;
      v_table_idx := v_table_idx + 1;
      v_wbf_id := v_wb_ids[1];
      insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
        values (p_tournament_id, 'losers', v_lb_round, 1, p_tables[((v_table_idx - 1) % v_table_count) + 1])
        returning id into v_id;
      update tournament_matches set next_match_id = v_id, next_slot = 1 where id = v_lb_survivors[1];
      update tournament_matches set loser_next_match_id = v_id, loser_next_slot = 2 where id = v_wbf_id;
      v_lb_survivors := array[v_id];
    end if;
  end loop;

  -- Grosses Finale: Gewinnerbaum-Champion gegen Verliererbaum-Champion.
  -- (Vereinfachung: ein einziges entscheidendes Spiel, kein "Bracket Reset"
  -- falls der Verliererbaum-Champion gewinnt - fuer Vereinsturniere ausreichend.)
  v_table_idx := v_table_idx + 1;
  insert into tournament_matches (tournament_id, bracket, round, bracket_position, table_number)
    values (p_tournament_id, 'final', 1, 1, p_tables[((v_table_idx - 1) % v_table_count) + 1])
    returning id into v_gf_id;
  update tournament_matches set next_match_id = v_gf_id, next_slot = 1 where id = v_wbf_id;
  update tournament_matches set next_match_id = v_gf_id, next_slot = 2 where id = v_lb_survivors[1];
end;
$function$;

revoke execute on function public.generate_round_robin(uuid, uuid[], integer[]) from public, anon, authenticated;
revoke execute on function public.generate_ko_bracket(uuid, uuid[], integer[], boolean) from public, anon, authenticated;
revoke execute on function public.generate_double_ko_losers(uuid, integer, integer[]) from public, anon, authenticated;

-- =========================================================================
-- 4) Oeffentliche RPCs
-- =========================================================================

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
  if p_format = 'double_ko' and (v_n < 4 or (v_n & (v_n - 1)) <> 0) then
    raise exception 'Doppel-K.O. wird aktuell nur für eine Teilnehmerzahl in 2er-Potenz unterstützt (4, 8, 16, ...). Bitte K.O. oder Jeder-gegen-jeden wählen, oder die Teilnehmerzahl anpassen.';
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

create or replace function public.tournament_report_match(
  p_tournament_match_id uuid, p_my_score integer, p_opp_score integer
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
  if v_tm.match_id is not null then raise exception 'Für dieses Match wurde bereits ein Ergebnis gemeldet.'; end if;
  if v_tm.player1_id is null or v_tm.player2_id is null then
    raise exception 'Die Paarung für dieses Match steht noch nicht fest.';
  end if;
  if v_me not in (v_tm.player1_id, v_tm.player2_id) then
    raise exception 'Nur die beiden Spieler dieses Matches können das Ergebnis melden.';
  end if;
  if p_my_score = p_opp_score then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;

  select * into v_tour from tournaments where id = v_tm.tournament_id;
  v_opponent := case when v_me = v_tm.player1_id then v_tm.player2_id else v_tm.player1_id end;

  insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed, tournament_id)
  values (v_me, v_opponent, p_my_score, p_opp_score, v_tour.discipline, v_me, false, v_tour.id)
  returning * into v_row;

  update tournament_matches set match_id = v_row.id where id = p_tournament_match_id;
  return v_row;
end;
$function$;

create or replace function public.tournament_force_confirm_match(p_tournament_match_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tm tournament_matches;
  v_tour tournaments;
  v_match matches;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tm from tournament_matches where id = p_tournament_match_id;
  if not found then raise exception 'Turnier-Match nicht gefunden.'; end if;
  if v_tm.match_id is null then raise exception 'Für dieses Match wurde noch kein Ergebnis gemeldet.'; end if;

  select * into v_tour from tournaments where id = v_tm.tournament_id;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur der Turnierleiter oder ein Admin kann ein Match erzwungen bestätigen.';
  end if;
  if v_me in (v_tm.player1_id, v_tm.player2_id) then
    raise exception 'Als Spieler dieses Matches kannst du es nicht selbst erzwungen bestätigen.';
  end if;

  select * into v_match from matches where id = v_tm.match_id;
  if v_match.confirmed then raise exception 'Match ist bereits bestätigt.'; end if;

  update matches set confirmed = true, confirmed_by = v_me where id = v_tm.match_id;
end;
$function$;

-- =========================================================================
-- 5) Automatisches Vorruecken im Raster sobald ein Turniermatch bestaetigt wird
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
  end if;

  if v_tm.loser_next_match_id is not null then
    if v_tm.loser_next_slot = 1 then
      update tournament_matches set player1_id = v_loser where id = v_tm.loser_next_match_id;
    else
      update tournament_matches set player2_id = v_loser where id = v_tm.loser_next_match_id;
    end if;
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

drop trigger if exists trg_advance_tournament on public.matches;
create trigger trg_advance_tournament
  after insert or update of confirmed on public.matches
  for each row execute function public.advance_tournament_bracket();
