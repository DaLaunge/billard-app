-- Fix: die vorige Migration nutzte status='registration' fuer die neue
-- Anmeldephase - es existiert aber bereits eine CHECK-Constraint auf
-- tournaments.status (tournaments_status_check), die nur 'setup', 'running',
-- 'finished', 'cancelled' erlaubt ('registration' war nie erlaubt). Jeder
-- Aufruf von create_tournament()/tournament_start()/tournament_cancel_
-- start() schlug dadurch fehl (Constraint-Verletzung), gefunden beim ersten
-- Live-Test mit dem neuen Test-Admin-Account. 'setup' passt inhaltlich exakt
-- (entspricht schon dem Spalten-Standardwert) - hier nur eine Umbenennung,
-- keine Verhaltensaenderung: ueberall dort, wo die vorige Migration
-- 'registration' gesetzt/geprueft hat, jetzt 'setup'.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

create or replace function public.tournament_register(p_tournament_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tour tournaments;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnier nicht gefunden.'; end if;
  if v_tour.status <> 'setup' then raise exception 'Die Anmeldung für dieses Turnier ist nicht mehr offen.'; end if;
  if exists (select 1 from players where id = v_me and coalesce(is_ghost, false)) then
    raise exception 'Der Ghost kann sich nicht für Turniere anmelden.';
  end if;
  insert into tournament_players (tournament_id, player_id) values (p_tournament_id, v_me)
    on conflict do nothing;
end;
$function$;

create or replace function public.tournament_unregister(p_tournament_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tour tournaments;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnier nicht gefunden.'; end if;
  if v_tour.status <> 'setup' then raise exception 'Abmelden ist nach Turnierstart nicht mehr möglich.'; end if;
  delete from tournament_players where tournament_id = p_tournament_id and player_id = v_me;
end;
$function$;

create or replace function public.tournament_start(p_tournament_id uuid)
returns tournaments
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tour tournaments;
  v_players uuid[];
  v_n int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnier nicht gefunden.'; end if;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur der Turnierleiter oder ein Admin kann dieses Turnier starten.';
  end if;
  if v_tour.status <> 'setup' then raise exception 'Dieses Turnier ist nicht (mehr) in der Anmeldephase.'; end if;

  select array_agg(player_id) into v_players from tournament_players where tournament_id = p_tournament_id;
  v_n := coalesce(array_length(v_players, 1), 0);

  if v_tour.format = 'round_robin' and v_n < 3 then
    raise exception 'Jeder-gegen-jeden braucht mindestens 3 Teilnehmer.';
  end if;
  if v_tour.format in ('ko', 'double_ko') and v_n < 2 then
    raise exception 'Mindestens 2 Teilnehmer nötig.';
  end if;
  if v_tour.playoff_size is not null and v_tour.playoff_size > v_n then
    raise exception 'Playoff-Größe darf nicht größer als die Teilnehmerzahl sein.';
  end if;
  if v_tour.format = 'double_ko' and v_tour.playoff_size > 2 and v_n < v_tour.playoff_size * 2 then
    raise exception 'Für diese Playoff-Größe werden mindestens % Teilnehmer benötigt.', v_tour.playoff_size * 2;
  end if;

  -- Reihenfolge fuers Auslosen zufaellig mischen
  select array_agg(x) into v_players from (select x from unnest(v_players) x order by random()) t;

  if v_tour.format = 'round_robin' then
    perform generate_round_robin(p_tournament_id, v_players, v_tour.table_numbers, v_tour.double_round_robin);
  else
    perform generate_ko_bracket(p_tournament_id, v_players, v_tour.table_numbers, v_tour.format = 'double_ko', coalesce(v_tour.playoff_size, 2));
  end if;

  perform tournament_assign_free_tables(p_tournament_id);

  update tournaments set status = 'running', started_at = now() where id = p_tournament_id
    returning * into v_tour;

  return v_tour;
end;
$function$;

create or replace function public.tournament_cancel_start(p_tournament_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tour tournaments;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnier nicht gefunden.'; end if;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur der Turnierleiter oder ein Admin kann den Start rückgängig machen.';
  end if;
  if v_tour.status <> 'running' then raise exception 'Dieses Turnier läuft nicht (mehr).'; end if;
  if exists (select 1 from tournament_matches where tournament_id = p_tournament_id and match_id is not null) then
    raise exception 'Der Start kann nicht mehr rückgängig gemacht werden - es wurde bereits mindestens ein Spiel gemeldet.';
  end if;
  delete from tournament_matches where tournament_id = p_tournament_id;
  update tournaments set status = 'setup', started_at = null where id = p_tournament_id;
end;
$function$;

create or replace function public.create_tournament(
  p_name text, p_format text, p_discipline text, p_table_numbers integer[],
  p_playoff_size integer default null::integer, p_double_round_robin boolean default false
) returns tournaments
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tournament tournaments;
  v_tables int[];
  v_table_count int;
  v_playoff_size int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Turniername fehlt.'; end if;
  if p_format not in ('ko', 'double_ko', 'round_robin') then raise exception 'Unbekanntes Turnierformat.'; end if;
  if coalesce(trim(p_discipline), '') = '' then raise exception 'Disziplin fehlt.'; end if;

  select array_agg(distinct x order by x) into v_tables from unnest(p_table_numbers) x;
  v_table_count := coalesce(array_length(v_tables, 1), 0);
  if v_table_count = 0 then raise exception 'Mindestens ein Tisch nötig.'; end if;
  if exists (select 1 from unnest(v_tables) t where t <= 0) then
    raise exception 'Tischnummern müssen positiv sein.';
  end if;

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

  insert into tournaments (name, format, discipline, organizer_id, table_numbers, status, playoff_size, double_round_robin)
  values (trim(p_name), p_format, trim(p_discipline), v_me, v_tables, 'setup', v_playoff_size, coalesce(p_double_round_robin, false))
  returning * into v_tournament;

  return v_tournament;
end;
$function$;
