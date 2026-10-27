-- Standorte: gemeinsamer Katalog (Name, Adresse, Koordinaten) fuer "Ich bin am Tisch" und Planung.
-- Auswahl statt Freitext (keine Tippfehler), Koordinaten fuer die Google-Maps-Route. Test, dann Produktion. Idempotent.
-- Setzt 2026-10-27_update_planning.sql nicht voraus (update_planning wird hier mit Standort neu angelegt).
--
-- * Jedes Mitglied kann einen Standort vorschlagen (status 'pending'; fuer den Vorschlagenden sofort nutzbar, fuer alle
--   anderen erst nach Freigabe durch einen App-Admin). Admins legen direkt freigegebene an.
-- * Freigegebene Standorte darf jedes Mitglied korrigieren (updated_by/updated_at halten fest, wer zuletzt); Admins
--   koennen ausserdem freigeben und loeschen.
-- * Pings speichern weiterhin den Namen als Text (pings.location, Push-Texte bleiben unveraendert); Plannings bekommen
--   location_id.

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_by uuid references public.players(id) on delete set null,
  updated_by uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists locations_name_uq on public.locations (lower(name));

alter table public.locations enable row level security;
drop policy if exists locations_lesen on public.locations;
create policy locations_lesen on public.locations for select to authenticated
  using (status = 'approved' or created_by = current_player_id() or is_admin());

grant select on public.locations to authenticated;
grant select, insert, update, delete on public.locations to service_role;

create or replace function public.save_location(
  p_id uuid, p_name text, p_address text, p_lat double precision, p_lng double precision
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := current_player_id();
  v_name text := trim(coalesce(p_name, ''));
  v_row public.locations;
begin
  if me is null then raise exception 'Kein Spielerprofil zu diesem Login.'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 60 then raise exception 'Der Name braucht 2 bis 60 Zeichen.'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Ungültige Koordinaten.';
  end if;
  if char_length(coalesce(p_address, '')) > 200 then raise exception 'Die Adresse darf höchstens 200 Zeichen haben.'; end if;
  if exists (select 1 from locations where lower(name) = lower(v_name) and id is distinct from p_id) then
    raise exception 'Einen Standort mit diesem Namen gibt es schon.';
  end if;

  if p_id is null then
    insert into locations (name, address, lat, lng, status, created_by, updated_by)
    values (v_name, nullif(trim(coalesce(p_address, '')), ''), p_lat, p_lng,
            case when is_admin() then 'approved' else 'pending' end, me, me)
    returning * into v_row;
    return v_row.id;
  end if;

  select * into v_row from locations where id = p_id;
  if not found then raise exception 'Standort nicht gefunden.'; end if;
  if not (is_admin() or v_row.status = 'approved' or v_row.created_by = me) then
    raise exception 'Diesen Standort darfst du nicht ändern.';
  end if;
  update locations
     set name = v_name, address = nullif(trim(coalesce(p_address, '')), ''), lat = p_lat, lng = p_lng,
         updated_by = me, updated_at = now()
   where id = p_id;
  return p_id;
end;
$$;

create or replace function public.approve_location(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  update locations set status = 'approved', updated_at = now() where id = p_id;
end;
$$;

create or replace function public.delete_location(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or exists (select 1 from locations where id = p_id and status = 'pending' and created_by = current_player_id())) then
    raise exception 'Nur für Admins.';
  end if;
  delete from locations where id = p_id;
end;
$$;

revoke all on function public.save_location(uuid, text, text, double precision, double precision) from public, anon;
revoke all on function public.approve_location(uuid) from public, anon;
revoke all on function public.delete_location(uuid) from public, anon;
grant execute on function public.save_location(uuid, text, text, double precision, double precision) to authenticated;
grant execute on function public.approve_location(uuid) to authenticated;
grant execute on function public.delete_location(uuid) to authenticated;

-- Plannings: optionaler Standort
alter table public.plannings add column if not exists location_id uuid references public.locations(id) on delete set null;

drop function if exists public.create_planning(date, text);
create or replace function public.create_planning(p_planned_date date, p_message text default null, p_location_id uuid default null)
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
  if p_location_id is not null and not exists (select 1 from locations where id = p_location_id) then
    raise exception 'Standort nicht gefunden.';
  end if;
  insert into plannings (player_id, planned_date, message, expires_at, location_id)
  values (v_me, p_planned_date, nullif(trim(coalesce(p_message, '')), ''), (p_planned_date + 1)::timestamptz, p_location_id)
  returning * into v_row;
  return v_row;
end;
$$;

drop function if exists public.update_planning(uuid, date, text);
create or replace function public.update_planning(p_planning_id uuid, p_planned_date date, p_message text default null, p_location_id uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_player_id();
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login.'; end if;
  if p_planned_date < current_date then raise exception 'Das Datum darf nicht in der Vergangenheit liegen.'; end if;
  if p_planned_date > current_date + 120 then raise exception 'Das Datum darf hoechstens 120 Tage in der Zukunft liegen.'; end if;
  if char_length(coalesce(p_message, '')) > 120 then raise exception 'Nachricht darf hoechstens 120 Zeichen haben.'; end if;
  if p_location_id is not null and not exists (select 1 from locations where id = p_location_id) then
    raise exception 'Standort nicht gefunden.';
  end if;
  update plannings
     set planned_date = p_planned_date, message = nullif(trim(coalesce(p_message, '')), ''),
         expires_at = (p_planned_date + 1)::timestamptz, location_id = p_location_id
   where id = p_planning_id and player_id = v_me;
  if not found then raise exception 'Planung nicht gefunden.'; end if;
end;
$$;

revoke all on function public.create_planning(date, text, uuid) from public, anon;
revoke all on function public.update_planning(uuid, date, text, uuid) from public, anon;
grant execute on function public.create_planning(date, text, uuid) to authenticated;
grant execute on function public.update_planning(uuid, date, text, uuid) to authenticated;
