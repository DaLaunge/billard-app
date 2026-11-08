-- Lokale: neue Eintraege sofort freigeben, Plausibilitaetspruefung mit Meldung an die Admins, Zusammenfuehren naher Lokale, Ausnahmen.
-- Voraussetzung: 2026-10-27b_locations.sql (und 2026-10-27d_location_confirmations.sql). Test, dann Produktion. Idempotent.
--
-- * Neue Lokale sind SOFORT fuer alle freigegeben (status 'approved'); die Bestaetigung durch andere Spieler (27d) wird nicht mehr gebraucht,
--   die Tabelle und die Pruefer-Erfolge bleiben bestehen. Bisher noch nicht freigegebene Lokale werden mit freigegeben.
-- * loc_check() prueft ein neu eingetragenes (oder geaendertes) Lokal auf Eingabefehler: sehr nah an einem bekannten Lokal (< 150 m),
--   Hunderte km vom naechsten bekannten Lokal entfernt (Koordinaten vertippt oder vertauscht?), aehnlicher Name, keine Adresse, Name wirkt
--   unvollstaendig. Auffaelliges steht in locations.check_note und geht als Meldung an alle Admins - freigeben muss der Admin nichts,
--   er kann es mit "In Ordnung" abhaken (check_ok_at), korrigieren, loeschen oder mit einem Nachbarn zusammenfuehren.
-- * Ausnahmen: Lokale, die wirklich eng beieinander liegen (z. B. zwei Filialen am Schwedenplatz und in der Dorotheergasse), markiert ein Admin als
--   "bewusst getrennt" (location_distinct, Paare). Solche Paare tauchen weder in der Zusammenfuehren-Liste noch bei der Pruefung wieder auf.
--   "In Ordnung" bei einer Meldung "liegt nur x m von ... entfernt" legt die Ausnahme fuer alle Lokale im Umkreis von 150 m gleich mit an.
-- * merge_locations(keep, drop[]) (nur Admins): haengt Planungen, Herausforderungen, Turniere und Winner-Stays-Runden der doppelten Lokale an das
--   behaltene um; die App loescht die doppelten danach mit delete_location.
-- WICHTIG: Der SQL-Editor des Dashboards zerlegt plpgsql-Rumpf an den Semikolons ("relation v_row does not exist"). Deshalb ist JEDE Funktion hier
-- EINE SQL-Anweisung (language sql, Verzweigungen ueber WITH-Klauseln, kein Semikolon im Rumpf). Ungueltige Eingaben werden still ignoriert
-- (Rueckgabe null) statt eine Ausnahme zu werfen; die App prueft vorher und zeigt eine Meldung.

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
  select nullif(concat_ws(chr(59) || ' ',
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

-- Anlegen (p_id null) oder Aendern. Neue Lokale sind sofort 'approved'. Gibt die id zurueck, bei ungueltiger Eingabe/fehlender Berechtigung null.
create or replace function public.save_location(
  p_id uuid, p_name text, p_address text, p_lat double precision, p_lng double precision
) returns uuid
language sql security definer set search_path = public as $function$
  with ok as (
    select current_player_id() as me, trim(coalesce(p_name, '')) as nm, nullif(trim(coalesce(p_address, '')), '') as ad
     where current_player_id() is not null
       and char_length(trim(coalesce(p_name, ''))) between 2 and 60
       and p_lat between -90 and 90 and p_lng between -180 and 180
       and char_length(coalesce(p_address, '')) <= 200
       and not exists (select 1 from locations where lower(name) = lower(trim(coalesce(p_name, ''))) and id is distinct from p_id)
  ), note as (
    select ok.me, ok.nm, ok.ad, loc_check(ok.nm, ok.ad, p_lat, p_lng, p_id) as n from ok
  ), old as (
    select * from locations where id = p_id
  ), changed as (
    select (p_id is null or exists (select 1 from old where lower(old.name) is distinct from lower((select nm from note))
                                      or old.lat is distinct from p_lat or old.lng is distinct from p_lng)) as c
  ), ins as (
    insert into locations (name, address, lat, lng, status, created_by, updated_by, check_note, check_ok_at)
    select nm, ad, p_lat, p_lng, 'approved', me, me, case when is_admin() then null else n end, case when is_admin() then now() end
      from note where p_id is null
    returning id
  ), upd as (
    update locations l
       set name = note.nm, address = note.ad, lat = p_lat, lng = p_lng, updated_by = note.me, updated_at = now(),
           check_note = case when is_admin() then null when (select c from changed) and note.n is not null then note.n else l.check_note end,
           check_ok_at = case when is_admin() then now() when (select c from changed) and note.n is not null then null else l.check_ok_at end
      from note
     where l.id = p_id and (is_admin() or l.status = 'approved' or l.created_by = note.me)
    returning l.id
  ), ntf as (
    select notify_players(
             array(select id from players where role = 'admin'), 'location_check',
             case when p_id is null then 'Neues Lokal prüfen' else 'Lokal geändert – bitte prüfen' end, note.nm || ': ' || note.n,
             case when p_id is null then 'Check new venue' else 'Venue changed – please check' end, note.nm || ': ' || note.n,
             jsonb_build_object('tab', 'admin'), note.me)
      from note
     where note.n is not null and not is_admin() and (select c from changed)
       and (exists (select 1 from ins) or exists (select 1 from upd))
  )
  select coalesce((select id from ins), (select id from upd))
   where (select count(*) from ntf) >= 0
$function$;

-- Admin: "In Ordnung" - die Meldung ist erledigt; liegen Lokale im Umkreis von 150 m, gelten sie als bewusst getrennt (kommen nicht wieder)
create or replace function public.review_location(p_id uuid)
returns void language sql security definer set search_path = public as $function$
  with r as (
    update locations set check_ok_at = now() where id = p_id and is_admin() returning id, lat, lng
  )
  insert into location_distinct (a, b, created_by)
  select least(r.id, o.id), greatest(r.id, o.id), current_player_id()
    from r join locations o on o.id <> r.id and loc_dist(r.lat, r.lng, o.lat, o.lng) < 150
  on conflict do nothing
$function$;

-- Admin: Lokale (alle Paare untereinander) als bewusst getrennt markieren bzw. wieder aufheben
create or replace function public.mark_locations_distinct(p_ids uuid[])
returns void language sql security definer set search_path = public as $function$
  insert into location_distinct (a, b, created_by)
  select least(x.id, y.id), greatest(x.id, y.id), current_player_id()
    from unnest(p_ids) as x(id) join unnest(p_ids) as y(id) on x.id < y.id
   where is_admin()
  on conflict do nothing
$function$;

create or replace function public.unmark_locations_distinct(p_a uuid, p_b uuid)
returns void language sql security definer set search_path = public as $function$
  delete from location_distinct where a = least(p_a, p_b) and b = greatest(p_a, p_b) and is_admin()
$function$;

-- Admin: alles, was auf ein doppeltes Lokal zeigt, zeigt danach auf das behaltene. Rueckgabe = Zahl der umgehaengten Zeilen + 1 (0 = nicht erlaubt).
-- Die doppelten Lokale loescht die App danach einzeln mit delete_location.
create or replace function public.merge_locations(p_keep uuid, p_drop uuid[])
returns integer
language sql security definer set search_path = public as $function$
  with ok as (
    select 1 as x where is_admin() and exists (select 1 from locations where id = p_keep)
  ), u1 as (
    update plannings set location_id = p_keep where location_id = any(array_remove(p_drop, p_keep)) and exists (select 1 from ok) returning 1
  ), u2 as (
    update challenges set location_id = p_keep where location_id = any(array_remove(p_drop, p_keep)) and exists (select 1 from ok) returning 1
  ), u3 as (
    update tournaments set location_id = p_keep where location_id = any(array_remove(p_drop, p_keep)) and exists (select 1 from ok) returning 1
  ), u4 as (
    update winner_stays_sessions set location_id = p_keep where location_id = any(array_remove(p_drop, p_keep)) and exists (select 1 from ok) returning 1
  ), u5 as (
    update locations set check_ok_at = now() where id = p_keep and exists (select 1 from ok) returning 1
  )
  select ((select count(*) from u1) + (select count(*) from u2) + (select count(*) from u3) + (select count(*) from u4) + (select count(*) from u5))::integer
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
