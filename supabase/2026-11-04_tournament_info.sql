-- Allgemeine Angaben fuer ALLE Turniermodi einheitlich (Nutzer-Wunsch 2026-11-04): Name, Ort, Disziplin, Anstoss (break_rule), Zeitpunkt.
-- Neu ist nur der ZEITPUNKT (planned_at) an Turnieren und Winner-Stays-Runden und eine Funktion, mit der die Leitung Disziplin und Zeitpunkt
-- aendert. Name und Ort bleiben nach dem Anlegen fest (set_tournament_location bleibt fuer das Anlegen). Die Disziplin laesst sich nur
-- aendern, solange noch kein Ergebnis gemeldet wurde und das Turnier nicht beendet ist (sonst passten die Ergebnisse nicht mehr zur Disziplin).
-- Die Funktion ist EINE SQL-Anweisung ohne Semikolon im Rumpf (der SQL-Editor des Dashboards zerlegt plpgsql an den Semikolons); wer nicht
-- Leitung/Admin ist, aendert einfach nichts.
--
-- Test, dann Produktion. Idempotent. Als GANZE Datei ausfuehren.

alter table public.tournaments add column if not exists planned_at timestamptz;
alter table public.winner_stays_sessions add column if not exists planned_at timestamptz;

create or replace function public.set_tournament_info(p_kind text, p_id uuid, p_discipline text, p_planned_at timestamptz, p_clear_time boolean default false)
returns void
language sql
security definer
set search_path = public
as $$
  with t as (
    update tournaments set
      discipline = case when nullif(trim(coalesce(p_discipline, '')), '') is not null and status <> 'finished'
                          and not exists (select 1 from tournament_matches m where m.tournament_id = tournaments.id and m.match_id is not null)
                        then trim(p_discipline) else discipline end,
      planned_at = case when p_clear_time then null when p_planned_at is not null then p_planned_at else planned_at end
     where p_kind = 'tournament' and id = p_id and (is_admin() or organizer_id = current_player_id())
    returning id
  )
  update winner_stays_sessions set
    discipline = case when nullif(trim(coalesce(p_discipline, '')), '') is not null and status <> 'finished'
                        and not exists (select 1 from winner_stays_games g where g.session_id = winner_stays_sessions.id)
                      then trim(p_discipline) else discipline end,
    planned_at = case when p_clear_time then null when p_planned_at is not null then p_planned_at else planned_at end
   where p_kind = 'winner_stays' and id = p_id and (is_admin() or organizer_id = current_player_id())
$$;

revoke all on function public.set_tournament_info(text, uuid, text, timestamptz, boolean) from public;
grant execute on function public.set_tournament_info(text, uuid, text, timestamptz, boolean) to authenticated;
