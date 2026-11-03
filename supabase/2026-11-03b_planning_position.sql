-- Planung mit eigenem Ort ohne Lokal aus dem Katalog (429.12): wie bei Live-Eintraegen (2026-10-28d_ping_position.sql) kann eine Planung
-- einen Ortstext (z. B. Adresse) und optional eine Position tragen. Alle Felder sind optional; ohne diese Datei fehlt nur dieser Ort,
-- die App liest ihn getrennt vom Rest der Planung.

alter table public.plannings add column if not exists place_text text;
alter table public.plannings add column if not exists lat double precision;
alter table public.plannings add column if not exists lng double precision;

drop function if exists public.create_planning(date, text, uuid, time);
create or replace function public.create_planning(p_planned_date date, p_message text default null, p_location_id uuid default null, p_planned_time time default null,
                                                  p_place_text text default null, p_lat double precision default null, p_lng double precision default null)
returns public.plannings
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_player_id();
  v_row public.plannings;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login.'; end if;
  if p_planned_date < current_date then raise exception 'Das Datum darf nicht in der Vergangenheit liegen.'; end if;
  if p_planned_date > current_date + 120 then raise exception 'Das Datum darf hoechstens 120 Tage in der Zukunft liegen.'; end if;
  if char_length(coalesce(p_message, '')) > 120 then raise exception 'Nachricht darf hoechstens 120 Zeichen haben.'; end if;
  if char_length(coalesce(p_place_text, '')) > 80 then raise exception 'Ort darf hoechstens 80 Zeichen haben.'; end if;
  if (p_lat is null) <> (p_lng is null) or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Ungueltige Position.'; end if;
  if p_location_id is not null and not exists (select 1 from locations where id = p_location_id) then
    raise exception 'Standort nicht gefunden.';
  end if;
  insert into plannings (player_id, planned_date, planned_time, message, expires_at, location_id, place_text, lat, lng)
  values (v_me, p_planned_date, p_planned_time, nullif(trim(coalesce(p_message, '')), ''), (p_planned_date + 1)::timestamptz, p_location_id,
          case when p_location_id is null then nullif(trim(coalesce(p_place_text, '')), '') end,
          case when p_location_id is null then p_lat end, case when p_location_id is null then p_lng end)
  returning * into v_row;
  return v_row;
end;
$$;

drop function if exists public.update_planning(uuid, date, text, uuid, time);
create or replace function public.update_planning(p_planning_id uuid, p_planned_date date, p_message text default null, p_location_id uuid default null, p_planned_time time default null,
                                                  p_place_text text default null, p_lat double precision default null, p_lng double precision default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_player_id();
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login.'; end if;
  if p_planned_date < current_date then raise exception 'Das Datum darf nicht in der Vergangenheit liegen.'; end if;
  if p_planned_date > current_date + 120 then raise exception 'Das Datum darf hoechstens 120 Tage in der Zukunft liegen.'; end if;
  if char_length(coalesce(p_message, '')) > 120 then raise exception 'Nachricht darf hoechstens 120 Zeichen haben.'; end if;
  if char_length(coalesce(p_place_text, '')) > 80 then raise exception 'Ort darf hoechstens 80 Zeichen haben.'; end if;
  if (p_lat is null) <> (p_lng is null) or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Ungueltige Position.'; end if;
  if p_location_id is not null and not exists (select 1 from locations where id = p_location_id) then
    raise exception 'Standort nicht gefunden.';
  end if;
  update plannings
     set planned_date = p_planned_date, planned_time = p_planned_time, message = nullif(trim(coalesce(p_message, '')), ''),
         expires_at = (p_planned_date + 1)::timestamptz, location_id = p_location_id,
         place_text = case when p_location_id is null then nullif(trim(coalesce(p_place_text, '')), '') end,
         lat = case when p_location_id is null then p_lat end, lng = case when p_location_id is null then p_lng end
   where id = p_planning_id and player_id = v_me;
  if not found then raise exception 'Planung nicht gefunden.'; end if;
end;
$$;

revoke all on function public.create_planning(date, text, uuid, time, text, double precision, double precision) from public, anon;
revoke all on function public.update_planning(uuid, date, text, uuid, time, text, double precision, double precision) from public, anon;
grant execute on function public.create_planning(date, text, uuid, time, text, double precision, double precision) to authenticated;
grant execute on function public.update_planning(uuid, date, text, uuid, time, text, double precision, double precision) to authenticated;
