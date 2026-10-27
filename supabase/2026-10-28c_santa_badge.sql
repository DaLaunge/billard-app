-- Verstecktes Easteregg-Achievement: Weihnachtsmuetze fuers Finden des Weihnachtsmanns am Nordpol (Ping-Radius gross genug).
-- Test, dann Produktion. Idempotent.
--
-- * Der Erfolg "easter_santa" (Kategorie Kurios, secret = true) steht im Katalog, die App zeigt ihn aber NIRGENDS, solange man ihn nicht
--   selbst gefunden hat (HIDDEN_BADGE_KEYS in src/lib/constants.js). Erst nach dem Fund erscheint er (mit dem ueblichen Erfolgs-Popup).
-- * find_santa(): wird von der App aufgerufen, wenn der Ping den Weihnachtsmann zeigt. Vergibt den Erfolg einmalig; Rueckgabe true,
--   wenn er neu vergeben wurde.

insert into public.badge_catalog (badge_key, emoji, name, description, category, tier, sort, secret) values
  ('easter_santa', '🎅', 'Ho Ho Ho', 'Den Weihnachtsmann am Nordpol gefunden', 'Kurios', 1, 9990, true)
on conflict (badge_key) do update set
  emoji = excluded.emoji, name = excluded.name, description = excluded.description, category = excluded.category,
  tier = excluded.tier, sort = excluded.sort, secret = excluded.secret;

create or replace function public.find_santa()
returns boolean
language plpgsql security definer set search_path = public as $function$
declare
  me uuid := current_player_id();
  v_n integer;
begin
  if me is null then raise exception 'Kein Spielerprofil zu diesem Login.'; end if;
  insert into player_badges (player_id, badge_key) values (me, 'easter_santa') on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$function$;

revoke all on function public.find_santa() from public, anon;
grant execute on function public.find_santa() to authenticated;

-- Kontrolle: Emoji-Duplikate im gesamten Katalog (muss leer sein)
select emoji, array_agg(badge_key order by badge_key) as badge_keys, count(*)
from badge_catalog group by emoji having count(*) > 1;
