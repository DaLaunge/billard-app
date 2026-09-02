-- 14/1: das clientseitig gesammelte Aufnahme-Protokoll (Rack/Fehler/Safe/
-- Anstoss-Foul je Aufnahme, inkl. Serie und Punktestand danach) wird beim
-- Melden des Matches mitgespeichert, damit es sich spaeter nachvollziehen
-- laesst.
--
-- report_match() wird per "create or replace" um einen zusaetzlichen
-- Parameter p_run_log erweitert (default null, damit 8/9/10 Ball und
-- Doppel-Aufrufe unveraendert funktionieren) - alles andere in der
-- Funktion bleibt exakt wie zuvor (Definition per
-- "select pg_get_functiondef(oid) from pg_proc where proname = 'report_match'"
-- vom 2026-09-02 uebernommen).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.

alter table public.matches
  add column if not exists run_log jsonb;

create or replace function public.report_match(
  p_opponent_id uuid, p_my_score integer, p_opp_score integer, p_discipline text,
  p_high_run_me integer default null::integer, p_high_run_opp integer default null::integer,
  p_deficit_me integer default null::integer, p_deficit_opp integer default null::integer,
  p_avg_me numeric default null::numeric, p_avg_opp numeric default null::numeric,
  p_twoball_me integer default null::integer, p_twoball_opp integer default null::integer,
  p_run_log jsonb default null
)
 returns matches
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me    uuid := current_player_id();
  v_ghost boolean;
  v_row   matches;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  if p_opponent_id = v_me then raise exception 'Gegen dich selbst kannst du nicht spielen. ;-)'; end if;
  if not exists (select 1 from players where id = p_opponent_id) then
    raise exception 'Gegner nicht gefunden.'; end if;
  if p_my_score = p_opp_score then
    raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;
  if coalesce(trim(p_discipline), '') = '' then raise exception 'Disziplin fehlt.'; end if;

  select is_ghost into v_ghost from players where id = p_opponent_id;

  insert into matches (player1_id, player2_id, score1, score2, discipline,
                       reported_by, confirmed, high_run1, high_run2, deficit1, deficit2,
                       avg1, avg2, twoball1, twoball2, run_log)
  values (v_me, p_opponent_id, p_my_score, p_opp_score, trim(p_discipline),
          v_me, coalesce(v_ghost, false),
          p_high_run_me, p_high_run_opp, p_deficit_me, p_deficit_opp,
          p_avg_me, p_avg_opp, p_twoball_me, p_twoball_opp, p_run_log)
  returning * into v_row;
  return v_row;
end;
$function$;
