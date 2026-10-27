-- Ort fuer Turniere und Winner-Stays-Runden (Nutzer-Wunsch 2026-10-27): ein Lokal aus dem Standort-Katalog (locations) ODER ein getippter
-- Ort. Damit ist der Ort in der Turnieruebersicht und im geoeffneten Turnier anklickbar (Route bzw. Karten-Suche).
-- Setzt 2026-10-27b_locations.sql voraus. Test, dann Produktion. Idempotent.
-- Der SQL-Editor des Dashboards hat die erste Fassung mit $function$ mittendrin abgeschnitten: hier $$ und nur ASCII in den Meldungen.

alter table public.tournaments add column if not exists location_id uuid references public.locations(id) on delete set null;
alter table public.tournaments add column if not exists location_text text;
alter table public.winner_stays_sessions add column if not exists location_id uuid references public.locations(id) on delete set null;
alter table public.winner_stays_sessions add column if not exists location_text text;

create or replace function public.set_tournament_location(p_kind text, p_id uuid, p_location_id uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := current_player_id();
  v_org uuid;
  v_text text := nullif(trim(coalesce(p_text, '')), '');
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login.'; end if;
  if v_text is not null and char_length(v_text) > 80 then raise exception 'Der Ort darf hoechstens 80 Zeichen haben.'; end if;
  if p_location_id is not null then v_text := null; end if;

  if p_kind = 'tournament' then
    select organizer_id into v_org from tournaments where id = p_id;
    if not found then raise exception 'Turnier nicht gefunden.'; end if;
    if not (is_admin() or v_org = v_me) then raise exception 'Nur die Turnierleitung kann das aendern.'; end if;
    update tournaments set location_id = p_location_id, location_text = v_text where id = p_id;
  elsif p_kind = 'winner_stays' then
    select organizer_id into v_org from winner_stays_sessions where id = p_id;
    if not found then raise exception 'Runde nicht gefunden.'; end if;
    if not (is_admin() or v_org = v_me) then raise exception 'Nur die Leitung dieser Runde kann das aendern.'; end if;
    update winner_stays_sessions set location_id = p_location_id, location_text = v_text where id = p_id;
  else
    raise exception 'Unbekannte Art.';
  end if;
end;
$$;

revoke all on function public.set_tournament_location(text, uuid, uuid, text) from public;
grant execute on function public.set_tournament_location(text, uuid, uuid, text) to authenticated;

select column_name, table_name from information_schema.columns
 where column_name in ('location_id', 'location_text') and table_name in ('tournaments', 'winner_stays_sessions');
