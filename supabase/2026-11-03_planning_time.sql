-- Planung mit optionaler Uhrzeit (428.1): die App erinnert, wenn der geplante Zeitpunkt aktuell wird ("Live gehen?").
-- Ohne Uhrzeit gilt die in den Einstellungen gewaehlte Standard-Uhrzeit (pro Geraet). Die Spalte ist optional,
-- fehlt die Migration, laeuft alles wie bisher (die App liest die Uhrzeit separat und ignoriert Fehler).

alter table public.plannings add column if not exists planned_time time;

grant select, insert, update, delete on public.plannings to authenticated;
grant select, insert, update, delete on public.plannings to service_role;

drop function if exists public.create_planning(date, text, uuid);
create or replace function public.create_planning(p_planned_date date, p_message text default null, p_location_id uuid default null, p_planned_time time default null)
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
  insert into plannings (player_id, planned_date, planned_time, message, expires_at, location_id)
  values (v_me, p_planned_date, p_planned_time, nullif(trim(coalesce(p_message, '')), ''), (p_planned_date + 1)::timestamptz, p_location_id)
  returning * into v_row;
  return v_row;
end;
$$;

drop function if exists public.update_planning(uuid, date, text, uuid);
create or replace function public.update_planning(p_planning_id uuid, p_planned_date date, p_message text default null, p_location_id uuid default null, p_planned_time time default null)
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
     set planned_date = p_planned_date, planned_time = p_planned_time, message = nullif(trim(coalesce(p_message, '')), ''),
         expires_at = (p_planned_date + 1)::timestamptz, location_id = p_location_id
   where id = p_planning_id and player_id = v_me;
  if not found then raise exception 'Planung nicht gefunden.'; end if;
end;
$$;

revoke all on function public.create_planning(date, text, uuid, time) from public, anon;
revoke all on function public.update_planning(uuid, date, text, uuid, time) from public, anon;
grant execute on function public.create_planning(date, text, uuid, time) to authenticated;
grant execute on function public.update_planning(uuid, date, text, uuid, time) to authenticated;
