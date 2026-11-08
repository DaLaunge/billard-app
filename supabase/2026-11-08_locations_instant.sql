-- Lokale: neue Eintraege sofort freigeben, Plausibilitaetspruefung mit Meldung an die Admins, Zusammenfuehren naher Lokale.
-- Voraussetzung: 2026-10-27b_locations.sql (und 2026-10-27d_location_confirmations.sql). Test, dann Produktion. Idempotent.
--
-- * Neue Lokale sind SOFORT fuer alle freigegeben (status 'approved'); die Bestaetigung durch andere Spieler (27d) wird nicht mehr gebraucht,
--   die Tabelle und die Pruefer-Erfolge bleiben bestehen. Bisher noch nicht freigegebene Lokale werden mit freigegeben.
-- * loc_check() prueft ein neu eingetragenes (oder geaendertes) Lokal auf Eingabefehler: sehr nah an einem bekannten Lokal (< 150 m),
--   Hunderte km vom naechsten bekannten Lokal entfernt (Koordinaten vertippt oder vertauscht?), aehnlicher Name, keine Adresse, Name wirkt
--   unvollstaendig. Auffaelliges steht in locations.check_note und geht als Meldung an alle Admins - freigeben muss der Admin nichts,
--   er kann es mit "In Ordnung" abhaken (check_ok_at), korrigieren, loeschen oder mit einem Nachbarn zusammenfuehren.
-- * merge_locations(keep, drop[]) (nur Admins): haengt Planungen, Herausforderungen, Turniere und Winner-Stays-Runden der doppelten Lokale
--   an das behaltene um und loescht die doppelten.
-- * Ausnahmen: Lokale, die wirklich eng beieinander liegen (z. B. zwei Filialen am Schwedenplatz und in der Dorotheergasse), markiert ein Admin als
--   "bewusst getrennt" (location_distinct, Paare). Solche Paare tauchen weder in der Zusammenfuehren-Liste noch bei der Pruefung wieder auf.
--   "In Ordnung" bei einer Meldung "liegt nur x m von ... entfernt" legt die Ausnahme fuer alle Lokale im Umkreis von 150 m gleich mit an.
-- Die plpgsql-Funktionen sind mit $function$ begrenzt (wie 27d), damit der SQL-Editor des Dashboards sie nicht an Semikolons zerlegt.

alter table public.locations add column if not exists check_note text;
alter table public.locations add column if not exists check_ok_at timestamptz;

create table if not exists public.location_distinct (
  a uuid not null references public.locations(id) on delete cascade,
  b uuid not null references public.locations(id) on delete cascade,
  created_by uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
alter table public.location_distinct enable row level security;
drop policy if exists location_distinct_lesen on public.location_distinct;
create policy location_distinct_lesen on public.location_distinct for select to authenticated using (true);
grant select on public.location_distinct to authenticated;
grant select, insert, update, delete on public.location_distinct to service_role;

-- Abstand in Metern (Haversine)
create or replace function public.loc_dist(p_lat1 double precision, p_lng1 double precision, p_lat2 double precision, p_lng2 double precision)
returns double precision
language sql immutable as $function$
  select 2 * 6371000 * asin(least(1, sqrt(power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2))))
$function$;

create or replace function public.loc_check(p_name text, p_address text, p_lat double precision, p_lng double precision, p_self uuid)
returns text
language sql stable security definer set search_path = public as $function$
  with d as (
    select o.name, loc_dist(p_lat, p_lng, o.lat, o.lng) as m
      from locations o
     where o.id is distinct from p_self
       and not exists (select 1 from location_distinct x where x.a = least(o.id, p_self) and x.b = greatest(o.id, p_self))
  ), nearest as (
    select name, m from d order by m limit 1
  )
  select nullif(concat_ws('; ',
    (select 'liegt nur ' || round(m)::int || ' m von „' || name || '“ entfernt (doppelt?)' from nearest where m < 150),
    (select 'liegt ' || round(m / 1000)::int || ' km vom nächsten bekannten Lokal entfernt (Koordinaten vertippt oder vertauscht?)' from nearest where m > 150000),
    (select 'Name ähnlich wie „' || o.name || '“' from locations o
      where o.id is distinct from p_self and char_length(trim(coalesce(p_name, ''))) >= 4
        and not exists (select 1 from location_distinct x where x.a = least(o.id, p_self) and x.b = greatest(o.id, p_self))
        and (lower(o.name) like '%' || lower(trim(p_name)) || '%' or lower(trim(p_name)) like '%' || lower(o.name) || '%') limit 1),
    case when coalesce(trim(p_address), '') = '' then 'keine Adresse angegeben' end,
    case when trim(coalesce(p_name, '')) !~ '[[:alpha:]]' or char_length(trim(coalesce(p_name, ''))) < 3 then 'Name wirkt unvollständig' end
  ), '')
$function$;

revoke all on function public.loc_check(text, text, double precision, double precision, uuid) from public, anon, authenticated;

create or replace function public.save_location(
  p_id uuid, p_name text, p_address text, p_lat double precision, p_lng double precision
) returns uuid
language plpgsql security definer set search_path = public as $function$
declare
  me uuid := current_player_id();
  v_name text := trim(coalesce(p_name, ''));
  v_row public.locations;
  v_note text;
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
    v_note := loc_check(v_name, p_address, p_lat, p_lng, null);
    insert into locations (name, address, lat, lng, status, created_by, updated_by, check_note, check_ok_at)
    values (v_name, nullif(trim(coalesce(p_address, '')), ''), p_lat, p_lng, 'approved', me, me,
            case when is_admin() then null else v_note end, case when is_admin() then now() end)
    returning * into v_row;
    if v_note is not null and not is_admin() then
      perform notify_players(
        array(select id from players where role = 'admin'), 'location_check',
        'Neues Lokal prüfen', v_name || ': ' || v_note,
        'Check new venue', v_name || ': ' || v_note,
        jsonb_build_object('tab', 'admin'), me);
    end if;
    return v_row.id;
  end if;

  select * into v_row from locations where id = p_id;
  if not found then raise exception 'Standort nicht gefunden.'; end if;
  if not (is_admin() or v_row.status = 'approved' or v_row.created_by = me) then
    raise exception 'Diesen Standort darfst du nicht ändern.';
  end if;
  -- geaendert wird nur bei Namens-/Ortswechsel neu geprueft (reine Adresskorrekturen bleiben ruhig)
  if lower(v_name) is distinct from lower(v_row.name) or p_lat is distinct from v_row.lat or p_lng is distinct from v_row.lng then
    v_note := loc_check(v_name, p_address, p_lat, p_lng, p_id);
  end if;
  update locations
     set name = v_name, address = nullif(trim(coalesce(p_address, '')), ''), lat = p_lat, lng = p_lng,
         updated_by = me, updated_at = now(),
         check_note = case when is_admin() then null when v_note is not null then v_note else check_note end,
         check_ok_at = case when is_admin() then now() when v_note is not null then null else check_ok_at end
   where id = p_id;
  if v_note is not null and not is_admin() then
    perform notify_players(
      array(select id from players where role = 'admin'), 'location_check',
      'Lokal geändert – bitte prüfen', v_name || ': ' || v_note,
      'Venue changed – please check', v_name || ': ' || v_note,
      jsonb_build_object('tab', 'admin'), me);
  end if;
  return p_id;
end;
$function$;

-- Admin: "In Ordnung" - die Meldung ist erledigt; liegen Lokale im Umkreis von 150 m, gelten sie als bewusst getrennt (kommen nicht wieder)
create or replace function public.review_location(p_id uuid)
returns void language plpgsql security definer set search_path = public as $function$
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  update locations set check_ok_at = now() where id = p_id;
  insert into location_distinct (a, b, created_by)
  select least(l.id, o.id), greatest(l.id, o.id), current_player_id()
    from locations l join locations o on o.id <> l.id and loc_dist(l.lat, l.lng, o.lat, o.lng) < 150
   where l.id = p_id
  on conflict do nothing;
end;
$function$;

-- Admin: Lokale (alle Paare untereinander) als bewusst getrennt markieren bzw. wieder aufheben
create or replace function public.mark_locations_distinct(p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $function$
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  insert into location_distinct (a, b, created_by)
  select least(x.id, y.id), greatest(x.id, y.id), current_player_id()
    from unnest(p_ids) as x(id) join unnest(p_ids) as y(id) on x.id < y.id
  on conflict do nothing;
end;
$function$;

create or replace function public.unmark_locations_distinct(p_a uuid, p_b uuid)
returns void language plpgsql security definer set search_path = public as $function$
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  delete from location_distinct where a = least(p_a, p_b) and b = greatest(p_a, p_b);
end;
$function$;

-- Admin: doppelte Lokale zusammenfuehren (alles, was auf ein doppeltes Lokal zeigt, zeigt danach auf das behaltene)
create or replace function public.merge_locations(p_keep uuid, p_drop uuid[])
returns integer
language plpgsql security definer set search_path = public as $function$
declare
  v_ids uuid[] := array_remove(p_drop, p_keep);
  v_n integer;
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  if not exists (select 1 from locations where id = p_keep) then raise exception 'Das zu behaltende Lokal gibt es nicht.'; end if;
  if coalesce(array_length(v_ids, 1), 0) = 0 then return 0; end if;
  update plannings set location_id = p_keep where location_id = any(v_ids);
  update challenges set location_id = p_keep where location_id = any(v_ids);
  update tournaments set location_id = p_keep where location_id = any(v_ids);
  update winner_stays_sessions set location_id = p_keep where location_id = any(v_ids);
  delete from locations where id = any(v_ids);
  get diagnostics v_n = row_count;
  update locations set check_ok_at = now() where id = p_keep;
  return v_n;
end;
$function$;

revoke all on function public.save_location(uuid, text, text, double precision, double precision) from public, anon;
revoke all on function public.review_location(uuid) from public, anon;
revoke all on function public.merge_locations(uuid, uuid[]) from public, anon;
revoke all on function public.mark_locations_distinct(uuid[]) from public, anon;
revoke all on function public.unmark_locations_distinct(uuid, uuid) from public, anon;
grant execute on function public.save_location(uuid, text, text, double precision, double precision) to authenticated;
grant execute on function public.review_location(uuid) to authenticated;
grant execute on function public.merge_locations(uuid, uuid[]) to authenticated;
grant execute on function public.mark_locations_distinct(uuid[]) to authenticated;
grant execute on function public.unmark_locations_distinct(uuid, uuid) to authenticated;

-- Bisher noch nicht freigegebene Lokale werden freigegeben; auffaellige davon landen in der Pruefliste der Admins
update public.locations l
   set status = 'approved', updated_at = now(),
       check_note = coalesce(l.check_note, loc_check(l.name, l.address, l.lat, l.lng, l.id))
 where l.status = 'pending';
