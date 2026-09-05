-- Turniermodus ist in der Erprobung: Stefan will das Anlegen von Turnieren
-- vorerst auf Admins beschraenken, um Missbrauch auszuschliessen, solange
-- der Modus noch nicht so laeuft wie gewuenscht. Diese Einschraenkung gilt
-- bis er sie ausdruecklich widerruft (dann reicht es, diese eine
-- is_admin()-Pruefung wieder zu entfernen) - siehe supabase/2026-09-04_tournament_mode.sql
-- fuer den Rest des Turniermodus (unveraendert).
--
-- create_tournament() wird per "create or replace" um die Admin-Pruefung
-- erweitert, alles andere bleibt exakt wie in 2026-09-04_tournament_mode.sql.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

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
