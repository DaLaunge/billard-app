-- Werbe-Erfolge ("geworbene Mitglieder") bis 20 (Nutzer-Wunsch 2026-10-19): bisher 1 / 3 / 5, neu dazu 10 / 15 / 20.
-- Neue Erfolge recruit10 "Magnet", recruit15 "Gemeinschaft", recruit20 "Grossfamilie" in der Kategorie "Treue", direkt hinter recruit5;
-- die danach folgenden Treue-Eintraege (challenge_accepted_*) rutschen in der Sortierung um 3 nach hinten. Die Emoji sind gegen den
-- kompletten Katalog (Stand Test 2026-10-19) auf Eindeutigkeit geprueft. compute_recruit_badges() kennt die neuen Stufen; wer schon
-- 10+ Spieler geworben hat, bekommt sie beim Nachrechnen unten sofort.
--
-- Test, dann Produktion. Idempotent.

update public.badge_catalog set sort = sort + 3
 where category = 'Treue' and badge_key like 'challenge_accepted_%' and sort between 16 and 18;

insert into public.badge_catalog (badge_key, emoji, name, description, category, tier, sort, secret) values
  ('recruit10', '🧲', 'Magnet',        '10 Spieler geworben', 'Treue', 4, 16, false),
  ('recruit15', '🫂', 'Gemeinschaft',  '15 Spieler geworben', 'Treue', 0, 17, false),
  ('recruit20', '👨‍👩‍👧‍👦', 'Großfamilie',  '20 Spieler geworben', 'Treue', 0, 18, false)
on conflict (badge_key) do update set
  emoji = excluded.emoji, name = excluded.name, description = excluded.description,
  category = excluded.category, tier = excluded.tier, sort = excluded.sort, secret = excluded.secret;

create or replace function public.compute_recruit_badges()
returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into player_badges (player_id, badge_key)
  select r.invited_by, t.key
  from (select invited_by, count(*) as n from players
        where invited_by is not null group by invited_by) r
  cross join (values ('recruit1',1),('recruit3',3),('recruit5',5),('recruit10',10),('recruit15',15),('recruit20',20)) as t(key, thr)
  where r.n >= t.thr
  on conflict do nothing;
end;
$function$;

select compute_recruit_badges();

-- Kontrolle 1: Emoji doppelt vergeben? (soll 0 Zeilen liefern)
select emoji, count(*), string_agg(badge_key, ', ') from badge_catalog group by emoji having count(*) > 1;
-- Kontrolle 2: Treue-Reihenfolge
select badge_key, emoji, name, tier, sort from badge_catalog where category = 'Treue' order by sort;
