-- Lokale von anderen Spielern bestaetigen lassen (Echtheitspruefung) + Pruefer-Erfolge (Familie cf: 1/5/10/25/50).
-- GENERIERT von scripts/genExplorerBadges.mjs aus src/lib/disciplineBadges.js - nicht von Hand aendern.
-- Voraussetzung: 2026-10-27b_locations.sql und 2026-10-27c_explorer_badges.sql. Test, dann Produktion. Idempotent.
--
-- * Ein neues Lokal (status 'pending') ist fuer alle Mitglieder sichtbar und kann von ANDEREN Spielern bestaetigt werden
--   (nicht vom Eintragenden, keine Gaeste, je Spieler einmal). Ab 2 Bestaetigungen wird es automatisch freigegeben; ein Admin
--   kann weiterhin sofort freigeben oder loeschen.
-- * Aendert jemand Name oder Ort eines noch nicht freigegebenen Lokals, verfallen die bisherigen Bestaetigungen.
-- * Zaehler: jede Bestaetigung ist eine Zeile in location_confirmations (App zeigt "Du hast n Lokale bestaetigt"); die
--   Pruefer-Erfolge zaehlen diese Zeilen.

create table if not exists public.location_confirmations (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (location_id, player_id)
);
create index if not exists location_confirmations_player_idx on public.location_confirmations (player_id);

alter table public.location_confirmations enable row level security;
drop policy if exists location_confirmations_lesen on public.location_confirmations;
create policy location_confirmations_lesen on public.location_confirmations for select to authenticated using (true);
grant select on public.location_confirmations to authenticated;
grant select, insert, update, delete on public.location_confirmations to service_role;

-- Noch nicht freigegebene Lokale sehen jetzt alle Mitglieder (zum Bestaetigen); auswaehlbar bleiben sie nur fuer den Eintragenden
drop policy if exists locations_lesen on public.locations;
create policy locations_lesen on public.locations for select to authenticated using (true);

create or replace function public.confirm_location(p_id uuid)
returns integer
language plpgsql security definer set search_path = public as $function$
declare
  me uuid := current_player_id();
  v_loc public.locations;
  v_n integer;
begin
  if me is null then raise exception 'Kein Spielerprofil zu diesem Login.'; end if;
  if exists (select 1 from players where id = me and is_guest) then raise exception 'Gäste können Lokale nicht bestätigen.'; end if;
  select * into v_loc from locations where id = p_id;
  if not found then raise exception 'Lokal nicht gefunden.'; end if;
  if v_loc.created_by = me then raise exception 'Eigene Lokale kannst du nicht selbst bestätigen.'; end if;
  if v_loc.status = 'approved' then return 2; end if;
  insert into location_confirmations (location_id, player_id) values (p_id, me) on conflict do nothing;
  select count(*) into v_n from location_confirmations where location_id = p_id;
  if v_n >= 2 then
    update locations set status = 'approved', updated_at = now() where id = p_id;
  end if;
  return v_n;
end;
$function$;

revoke all on function public.confirm_location(uuid) from public, anon;
grant execute on function public.confirm_location(uuid) to authenticated;

create or replace function public.trg_location_reset_confirms()
returns trigger
language plpgsql security definer set search_path = public as $function$
begin
  if old.status = 'pending' and new.status = 'pending'
     and (new.lat is distinct from old.lat or new.lng is distinct from old.lng or lower(new.name) is distinct from lower(old.name)) then
    delete from location_confirmations where location_id = new.id;
  end if;
  return new;
end;
$function$;
drop trigger if exists locations_reset_confirms on public.locations;
create trigger locations_reset_confirms before update on public.locations for each row execute function public.trg_location_reset_confirms();

-- Pruefer-Erfolge
insert into public.badge_catalog (badge_key, emoji, name, description, category, subcategory, family, threshold, discipline, tier, sort, secret) values
  ('dc_cf1', '✅', 'Gegencheck', 'Ein Lokal eines anderen Spielers bestätigt', 'Disziplinen', 'Erkundung', 'cf', 1, null, 1, 1141, false),
  ('dc_cf5', '🔎', 'Augenzeuge', '5 Lokale anderer Spieler bestätigt', 'Disziplinen', 'Erkundung', 'cf', 5, null, 2, 1142, false),
  ('dc_cf10', '🧐', 'Genau genommen', '10 Lokale anderer Spieler bestätigt', 'Disziplinen', 'Erkundung', 'cf', 10, null, 3, 1143, false),
  ('dc_cf25', '🕵️', 'Ortsprüfer', '25 Lokale anderer Spieler bestätigt', 'Disziplinen', 'Erkundung', 'cf', 25, null, 4, 1144, false),
  ('dc_cf50', '🔏', 'Siegelbewahrer', '50 Lokale anderer Spieler bestätigt', 'Disziplinen', 'Erkundung', 'cf', 50, null, 5, 1145, false)
on conflict (badge_key) do update set
  emoji = excluded.emoji, name = excluded.name, description = excluded.description, category = excluded.category,
  subcategory = excluded.subcategory, family = excluded.family, threshold = excluded.threshold, discipline = excluded.discipline,
  tier = excluded.tier, sort = excluded.sort, secret = excluded.secret;

-- Vergabe: Erkundungs- und Pruefer-Erfolge zusammen (ersetzt die Funktion aus 2026-10-27c)
create or replace function public.compute_explorer_badges()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into player_badges (player_id, badge_key)
  select x.created_by, c.badge_key
    from (select created_by, count(*) as n from locations
           where status = 'approved' and created_by is not null group by created_by) x
    join badge_catalog c on c.category = 'Disziplinen' and c.family = 'ex'
   where x.n >= c.threshold
  on conflict do nothing;

  insert into player_badges (player_id, badge_key)
  select y.player_id, c.badge_key
    from (select player_id, count(*) as n from location_confirmations group by player_id) y
    join badge_catalog c on c.category = 'Disziplinen' and c.family = 'cf'
   where y.n >= c.threshold
  on conflict do nothing;
end;
$function$;

drop trigger if exists location_confirmations_badges on public.location_confirmations;
create trigger location_confirmations_badges
  after insert or delete on public.location_confirmations
  for each statement execute function public.trg_explorer_badges();

select public.compute_explorer_badges();

-- Kontrolle: Emoji-Duplikate im gesamten Katalog (muss leer sein)
select emoji, array_agg(badge_key order by badge_key) as badge_keys, count(*)
from badge_catalog group by emoji having count(*) > 1;
