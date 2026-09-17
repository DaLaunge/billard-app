-- Emoji-Kollisionen im gesamten Erfolgs-Katalog beheben.
--
-- Bei einer Vollpruefung (group by emoji having count(*) > 1) kamen 12
-- doppelt vergebene Emojis mit insgesamt 27 betroffenen Erfolgen zutage -
-- die meisten stammen aus 2026-09-02_membership_badges.sql (Mitgliedschaft-
-- Familie, gegen den bestehenden Katalog nie auf Kollisionen geprueft) und
-- 2026-09-06_tournament_standings_and_badges.sql (Turnier-Platzierungen),
-- dazu ein Fall aus 2026-09-12_top3_ranking_badges.sql (top3_1 vs.
-- member_3y). Der fruehere In-Script-Guard aus 2026-08-23 pruefte offenbar
-- nur die jeweils NEU eingefuegten Zeilen gegen den damaligen Katalogstand,
-- nicht wiederkehrend gegen spaetere Ergaenzungen.
--
-- Politik: bei jeder Kollision behaelt der AELTESTE Erfolg (laut Einfuehrungs-
-- Migration) sein Emoji, die juengeren werden auf ein neues, im gesamten
-- Katalog bislang unbenutztes Emoji umgestellt.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion:
-- wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat laufen.

update badge_catalog set emoji = case badge_key
  -- Mitgliedschaft (kollidierte mit Siege/Serien/Skill/Turniere)
  when 'member_1w'  then '🐣'
  when 'member_2y'  then '🎈'
  when 'member_4y'  then '🧭'
  when 'member_5y'  then '🗻'
  when 'member_6y'  then '🔷'
  when 'member_7y'  then '🧙'
  when 'member_8y'  then '✨'
  when 'member_9y'  then '🧨'
  when 'member_10y' then '🛸'
  -- Turnierplatzierungen (kollidierten mit Siege/Mitgliedschaft)
  when 'tournament_win1'  then '🦄'
  when 'tournament_win3'  then '🐲'
  when 'tournament_win5'  then '🦅'
  when 'tournament_2nd3'  then '🥁'
  when 'tournament_2nd5'  then '🎭'
  when 'tournament_3rd5'  then '🪁'
  -- Top-3-Ranking (kollidierte mit Mitgliedschaft)
  when 'top3_1' then '📍'
  else emoji
end
where badge_key in (
  'member_1w','member_2y','member_4y','member_5y','member_6y','member_7y','member_8y','member_9y','member_10y',
  'tournament_win1','tournament_win3','tournament_win5','tournament_2nd3','tournament_2nd5','tournament_3rd5',
  'top3_1'
);

-- Kontrolle: sollte leer zurueckkommen.
select emoji, array_agg(badge_key order by badge_key) as badge_keys, count(*)
from badge_catalog group by emoji having count(*) > 1;
