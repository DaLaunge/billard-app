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
-- Die plpgsql-Funktionen sind mit $function$ begrenzt (wie 27d), damit der SQL-Editor des Dashboards sie nicht an Semikolons zerlegt.

alter table public.locations add column if not exists check_note text;
alter table public.locations add column if not exists check_ok_at timestamptz;

create or replace function public.loc_check(p_name text, p_address text, p_lat double precision, p_lng double precision, p_self uuid)
returns text
language sql stable security definer set search_path = public as $function$
  with d as (
    select o.name,
           2 * 6371000 * asin(least(1, sqrt(power(sin(radians(o.lat - p_lat) / 2), 2)
             + cos(radians(p_lat)) * cos(radians(o.lat)) * power(sin(radians(o.lng - p_lng) / 2), 2)))) as m
      from locations o
     where o.id is distinct from p_self
  ), nearest as (
    select name, m from d order by m limit 1
  )
  select nullif(concat_ws('; ',
    (select 'liegt nur ' || round(m)::int || ' m von „' || name || '“ entfernt (doppelt?)' from nearest where m < 150),
    (select 'liegt ' || round(m / 1000)::int || ' km vom nächsten bekannten Lokal entfernt (Koordinaten vertippt oder vertauscht?)' from nearest where m > 150000),
    (select 'Name ähnlich wie „' || o.name || '“' from locations o
      where o.id is distinct from p_self and char_length(trim(coalesce(p_name, ''))) >= 4
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

-- Admin: "In Ordnung" - die Meldung ist erledigt
create or replace function public.review_location(p_id uuid)
returns void language plpgsql security definer set search_path = public as $function$
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  update locations set check_ok_at = now() where id = p_id;
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
grant execute on function public.save_location(uuid, text, text, double precision, double precision) to authenticated;
grant execute on function public.review_location(uuid) to authenticated;
grant execute on function public.merge_locations(uuid, uuid[]) to authenticated;

-- Bisher noch nicht freigegebene Lokale werden freigegeben; auffaellige davon landen in der Pruefliste der Admins
update public.locations l
   set status = 'approved', updated_at = now(),
       check_note = coalesce(l.check_note, loc_check(l.name, l.address, l.lat, l.lng, l.id))
 where l.status = 'pending';
