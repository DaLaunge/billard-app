-- Ort fuer Turniere und Winner-Stays-Runden (Nutzer-Wunsch 2026-10-27): ein Lokal aus dem Standort-Katalog (locations) ODER ein getippter
-- Ort. Damit ist der Ort in der Turnieruebersicht und im geoeffneten Turnier anklickbar (Route bzw. Karten-Suche).
-- Setzt 2026-10-27b_locations.sql voraus. Test, dann Produktion. Idempotent.
-- Die Funktion ist bewusst EINE SQL-Anweisung ohne Semikolon im Rumpf: der SQL-Editor des Dashboards hat die plpgsql-Fassung an den
-- Semikolons zerlegt ("relation v_org does not exist"). Wer nicht Turnierleitung/Admin ist, aendert einfach nichts (WHERE-Bedingung).

alter table public.tournaments add column if not exists location_id uuid references public.locations(id) on delete set null;
alter table public.tournaments add column if not exists location_text text;
alter table public.winner_stays_sessions add column if not exists location_id uuid references public.locations(id) on delete set null;
alter table public.winner_stays_sessions add column if not exists location_text text;

create or replace function public.set_tournament_location(p_kind text, p_id uuid, p_location_id uuid, p_text text)
returns void
language sql
security definer
set search_path = public
as $$
  with t as (
    update tournaments set location_id = p_location_id,
           location_text = case when p_location_id is null then left(nullif(trim(coalesce(p_text, '')), ''), 80) end
     where p_kind = 'tournament' and id = p_id and (is_admin() or organizer_id = current_player_id())
    returning id
  )
  update winner_stays_sessions set location_id = p_location_id,
         location_text = case when p_location_id is null then left(nullif(trim(coalesce(p_text, '')), ''), 80) end
   where p_kind = 'winner_stays' and id = p_id and (is_admin() or organizer_id = current_player_id())
$$;

revoke all on function public.set_tournament_location(text, uuid, uuid, text) from public;
grant execute on function public.set_tournament_location(text, uuid, uuid, text) to authenticated;
