/* Erzeugt supabase/2026-10-27c_explorer_badges.sql (Erkundungs-Erfolge, Familie ex) aus src/lib/disciplineBadges.js:  node scripts/genExplorerBadges.mjs
   Die Datei NICHT von Hand aendern - Texte, Stufen und Emoji stehen nur in disciplineBadges.js. Braucht supabase/2026-10-27b_locations.sql. */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BADGES, CATEGORY } from "../src/lib/disciplineBadges.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const q = (s) => (s == null ? "null" : "'" + String(s).replace(/'/g, "''") + "'");
const ex = BADGES.filter((b) => b.family === "ex");
const cf = BADGES.filter((b) => b.family === "cf");
const rowOf = (b) => `  (${q(b.key)}, ${q(b.emoji)}, ${q(b.name)}, ${q(b.descDe)}, ${q(CATEGORY)}, ${q(b.sub)}, ${q(b.family)}, ${b.threshold}, null, ${b.tier}, ${b.sort}, false)`;
const rows = ex.map((b) =>
  `  (${q(b.key)}, ${q(b.emoji)}, ${q(b.name)}, ${q(b.descDe)}, ${q(CATEGORY)}, ${q(b.sub)}, ${q(b.family)}, ${b.threshold}, null, ${b.tier}, ${b.sort}, false)`
).join(",\n");

const sql = `-- Erfolge "Erkundung" (Kategorie "${CATEGORY}", Unterblock "${ex[0].sub}"): ${ex.length} Stufen (${ex.map((b) => b.threshold).join("/")}) fuer eingetragene Lokale.
-- GENERIERT von scripts/genExplorerBadges.mjs aus src/lib/disciplineBadges.js - nicht von Hand aendern.
-- Voraussetzung: 2026-10-27b_locations.sql (Tabelle locations) und 2026-10-18c_activity_badges.sql (Katalog-Spalten).
--
-- Gezaehlt werden FREIGEGEBENE Lokale (locations.status = 'approved'), die der Spieler selbst eingetragen hat - ein Vorschlag
-- zaehlt also erst, wenn er freigegeben ist (Missbrauchsschutz). Vergabe in compute_explorer_badges(), ausgeloest durch einen
-- Statement-Trigger auf locations (Eintragen, Freigeben, Aendern, Loeschen). Erfolge werden nur eingefuegt, nie geloescht.
-- Test, dann Produktion. Idempotent.

insert into public.badge_catalog (badge_key, emoji, name, description, category, subcategory, family, threshold, discipline, tier, sort, secret) values
${rows}
on conflict (badge_key) do update set
  emoji = excluded.emoji, name = excluded.name, description = excluded.description, category = excluded.category,
  subcategory = excluded.subcategory, family = excluded.family, threshold = excluded.threshold, discipline = excluded.discipline,
  tier = excluded.tier, sort = excluded.sort, secret = excluded.secret;

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
    join badge_catalog c on c.category = '${CATEGORY}' and c.family = 'ex'
   where x.n >= c.threshold
  on conflict do nothing;
end;
$function$;

create or replace function public.trg_explorer_badges()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform compute_explorer_badges();
  return null;
end;
$function$;

drop trigger if exists locations_explorer_badges on public.locations;
create trigger locations_explorer_badges
  after insert or update or delete on public.locations
  for each statement execute function public.trg_explorer_badges();

select public.compute_explorer_badges();

-- Kontrolle: Emoji-Duplikate im gesamten Katalog (muss leer sein)
select emoji, array_agg(badge_key order by badge_key) as badge_keys, count(*)
from badge_catalog group by emoji having count(*) > 1;
`;
writeFileSync(resolve(root, "supabase", "2026-10-27c_explorer_badges.sql"), sql);
console.log(`geschrieben: ${ex.length} Erfolge`);

// ---- 2026-10-27d: Bestaetigung durch andere Spieler + Pruefer-Erfolge
const cfRows = cf.map(rowOf).join(",\n");
const sqlD = `-- Lokale von anderen Spielern bestaetigen lassen (Echtheitspruefung) + Pruefer-Erfolge (Familie cf: ${cf.map((b) => b.threshold).join("/")}).
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
${cfRows}
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
    join badge_catalog c on c.category = '${CATEGORY}' and c.family = 'ex'
   where x.n >= c.threshold
  on conflict do nothing;

  insert into player_badges (player_id, badge_key)
  select y.player_id, c.badge_key
    from (select player_id, count(*) as n from location_confirmations group by player_id) y
    join badge_catalog c on c.category = '${CATEGORY}' and c.family = 'cf'
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
`;
writeFileSync(resolve(root, "supabase", "2026-10-27d_location_confirmations.sql"), sqlD);
console.log(`geschrieben: ${cf.length} Pruefer-Erfolge`);
