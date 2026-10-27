-- Erfolge "Erkundung" (Kategorie "Disziplinen", Unterblock "Erkundung"): 5 Stufen (1/5/10/25/50) fuer eingetragene Lokale.
-- GENERIERT von scripts/genExplorerBadges.mjs aus src/lib/disciplineBadges.js - nicht von Hand aendern.
-- Voraussetzung: 2026-10-27b_locations.sql (Tabelle locations) und 2026-10-18c_activity_badges.sql (Katalog-Spalten).
--
-- Gezaehlt werden FREIGEGEBENE Lokale (locations.status = 'approved'), die der Spieler selbst eingetragen hat - ein Vorschlag
-- zaehlt also erst, wenn er freigegeben ist (Missbrauchsschutz). Vergabe in compute_explorer_badges(), ausgeloest durch einen
-- Statement-Trigger auf locations (Eintragen, Freigeben, Aendern, Loeschen). Erfolge werden nur eingefuegt, nie geloescht.
-- Test, dann Produktion. Idempotent.

insert into public.badge_catalog (badge_key, emoji, name, description, category, subcategory, family, threshold, discipline, tier, sort, secret) values
  ('de_ex1', '🔦', 'Erkunder', 'Ein Lokal eingetragen (freigegeben)', 'Disziplinen', 'Erkundung', 'ex', 1, null, 1, 1136, false),
  ('de_ex5', '🔭', 'Späher', '5 Lokale eingetragen (freigegeben)', 'Disziplinen', 'Erkundung', 'ex', 5, null, 2, 1137, false),
  ('de_ex10', '📌', 'Pin-Setzer', '10 Lokale eingetragen (freigegeben)', 'Disziplinen', 'Erkundung', 'ex', 10, null, 3, 1138, false),
  ('de_ex25', '🪧', 'Wegweiser', '25 Lokale eingetragen (freigegeben)', 'Disziplinen', 'Erkundung', 'ex', 25, null, 4, 1139, false),
  ('de_ex50', '🏙️', 'Stadtführer', '50 Lokale eingetragen (freigegeben)', 'Disziplinen', 'Erkundung', 'ex', 50, null, 5, 1140, false)
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
    join badge_catalog c on c.category = 'Disziplinen' and c.family = 'ex'
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
