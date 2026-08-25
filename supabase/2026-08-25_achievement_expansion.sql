-- Erfolgs-Katalog erweitern: 14/1-Serien in "Serien" verschieben + feiner
-- gestaffelt, Siegesserien gegen einen Gegner (neu), mehr Duell-Stufen in
-- "Treue", mehr Erfolge in "Kurios", plus saubere Sortierung je Kategorie.
--
-- In Supabase SQL-Editor ausfuehren (Test zuerst, Produktion separat -
-- siehe project-Notizen: zwei getrennte Supabase-Projekte).
--
-- Alle neuen Emojis wurden gegen den kompletten Katalogstand vom
-- 2026-08-25 (81 Zeilen) UND untereinander auf Eindeutigkeit geprueft -
-- siehe Kontrollabfrage ganz unten, die nach dem Einspielen 0 Zeilen
-- zurueckgeben sollte.

begin;

-- ============================================================
-- 1) "Serien": bestehende 14/1-Hoechstserie-Erfolge (bisher in "Skill")
--    hierher verschieben, dabei bestehende badge_key/emoji/name behalten -
--    nur Kategorie und Sortierung aendern sich, damit niemand, der sie
--    schon freigeschaltet hat, etwas verliert.
-- ============================================================

update badge_catalog set category = 'Serien', sort = 16 where badge_key = 'run10';
update badge_catalog set category = 'Serien', sort = 19 where badge_key = 'run25';
update badge_catalog set category = 'Serien', sort = 24 where badge_key = 'run50';
update badge_catalog set category = 'Serien', sort = 34 where badge_key = 'run100';

-- Bestehende Sieges-Serien (streak2..20) sauber durchnummerieren (1-8)
update badge_catalog set sort = 1 where badge_key = 'streak2';
update badge_catalog set sort = 2 where badge_key = 'streak3';
update badge_catalog set sort = 3 where badge_key = 'streak4';
update badge_catalog set sort = 4 where badge_key = 'streak5';
update badge_catalog set sort = 5 where badge_key = 'streak7';
update badge_catalog set sort = 6 where badge_key = 'streak10';
update badge_catalog set sort = 7 where badge_key = 'streak15';
update badge_catalog set sort = 8 where badge_key = 'streak20';

-- Neue, feinere 14/1-Hoechstserie-Stufen: 3-9 einzeln (Anfaenger-Meilensteine),
-- danach in 5er-Schritten bis 100 (25/50/100 existieren schon, siehe oben).
insert into badge_catalog (badge_key, category, sort, emoji, name, description) values
  ('run3',  'Serien', 9,  '3️⃣', 'Dreier-Lauf',              '14/1: Höchstserie von 3'),
  ('run4',  'Serien', 10, '4️⃣', 'Vierer-Serie',             '14/1: Höchstserie von 4'),
  ('run5',  'Serien', 11, '5️⃣', 'Fünfer-Lauf',              '14/1: Höchstserie von 5'),
  ('run6',  'Serien', 12, '6️⃣', 'Sechser-Lauf',             '14/1: Höchstserie von 6'),
  ('run7',  'Serien', 13, '7️⃣', 'Siebener-Lauf',            '14/1: Höchstserie von 7'),
  ('run8',  'Serien', 14, '8️⃣', 'Achter-Lauf',              '14/1: Höchstserie von 8'),
  ('run9',  'Serien', 15, '9️⃣', 'Neuner-Lauf',              '14/1: Höchstserie von 9'),
  ('run15', 'Serien', 17, '🌠', 'Fünfzehner-Lauf',          '14/1: Höchstserie von 15'),
  ('run20', 'Serien', 18, '🎋', 'Zwanziger-Lauf',           '14/1: Höchstserie von 20'),
  ('run30', 'Serien', 20, '🎐', 'Dreißiger-Lauf',           '14/1: Höchstserie von 30'),
  ('run35', 'Serien', 21, '🎉', 'Fünfunddreißiger-Lauf',    '14/1: Höchstserie von 35'),
  ('run40', 'Serien', 22, '🎊', 'Vierziger-Lauf',           '14/1: Höchstserie von 40'),
  ('run45', 'Serien', 23, '🥂', 'Fünfundvierziger-Lauf',    '14/1: Höchstserie von 45'),
  ('run55', 'Serien', 25, '🏵️', 'Fünfundfünfziger-Lauf',   '14/1: Höchstserie von 55'),
  ('run60', 'Serien', 26, '🎗️', 'Sechziger-Lauf',          '14/1: Höchstserie von 60'),
  ('run65', 'Serien', 27, '🔱', 'Fünfundsechziger-Lauf',    '14/1: Höchstserie von 65'),
  ('run70', 'Serien', 28, '🛡️', 'Siebziger-Lauf',          '14/1: Höchstserie von 70'),
  ('run75', 'Serien', 29, '💠', 'Fünfundsiebziger-Lauf',    '14/1: Höchstserie von 75'),
  ('run80', 'Serien', 30, '🔆', 'Achtziger-Lauf',           '14/1: Höchstserie von 80'),
  ('run85', 'Serien', 31, '🌞', 'Fünfundachtziger-Lauf',    '14/1: Höchstserie von 85'),
  ('run90', 'Serien', 32, '🌤️', 'Neunziger-Lauf',          '14/1: Höchstserie von 90'),
  ('run95', 'Serien', 33, '🪐', 'Fünfundneunziger-Lauf',    '14/1: Höchstserie von 95')
on conflict (badge_key) do nothing;

-- Neu: Siegesserien gegen denselben Gegner. Zaehlt nur ununterbrochen -
-- ein Sieg des Gegners setzt die Serie zurueck (siehe Trigger/Funktion,
-- die eure Erfolge berechnet - dort muss diese Logik noch ergaenzt
-- werden, ich kenne diese Funktion nicht, siehe Hinweis im Chat).
insert into badge_catalog (badge_key, category, sort, emoji, name, description) values
  ('oppstreak2',  'Serien', 35, '🚩', 'Dauerdruck',      '2 Siege in Folge gegen denselben Gegner'),
  ('oppstreak3',  'Serien', 36, '🎌', 'Blockade',        '3 Siege in Folge gegen denselben Gegner'),
  ('oppstreak4',  'Serien', 37, '🏴', 'Belagerung',      '4 Siege in Folge gegen denselben Gegner'),
  ('oppstreak5',  'Serien', 38, '🏰', 'Eroberung',       '5 Siege in Folge gegen denselben Gegner'),
  ('oppstreak7',  'Serien', 39, '⚜️', 'Unterwerfung',    '7 Siege in Folge gegen denselben Gegner'),
  ('oppstreak10', 'Serien', 40, '🗝️', 'Besatzung',       '10 Siege in Folge gegen denselben Gegner'),
  ('oppstreak15', 'Serien', 41, '🏴‍☠️', 'Vorherrschaft', '15 Siege in Folge gegen denselben Gegner'),
  ('oppstreak20', 'Serien', 42, '🦁', 'Imperium',        '20 Siege in Folge gegen denselben Gegner')
on conflict (badge_key) do nothing;

-- ============================================================
-- 2) "Skill": nach dem Verschieben der run*-Erfolge sauber durchnummerieren
-- ============================================================

update badge_catalog set sort = 1  where badge_key = 'giant50';
update badge_catalog set sort = 2  where badge_key = 'giant100';
update badge_catalog set sort = 3  where badge_key = 'giant150';
update badge_catalog set sort = 4  where badge_key = 'shutout';
update badge_catalog set sort = 5  where badge_key = 'shutout5';
update badge_catalog set sort = 6  where badge_key = 'shutout10';
update badge_catalog set sort = 7  where badge_key = 'shutout25';
update badge_catalog set sort = 8  where badge_key = 'shutout50';
update badge_catalog set sort = 9  where badge_key = 'shutout100';
update badge_catalog set sort = 10 where badge_key = 'disc1';
update badge_catalog set sort = 11 where badge_key = 'disc2';
update badge_catalog set sort = 12 where badge_key = 'disc3';
update badge_catalog set sort = 13 where badge_key = 'disc4';
update badge_catalog set sort = 14 where badge_key = 'comeback';
update badge_catalog set sort = 15 where badge_key = 'king4';
update badge_catalog set sort = 16 where badge_key = 'king12';
update badge_catalog set sort = 17 where badge_key = 'over500_4';
update badge_catalog set sort = 18 where badge_key = 'over500_12';
update badge_catalog set sort = 19 where badge_key = 'peak600';
update badge_catalog set sort = 20 where badge_key = 'cb30';
update badge_catalog set sort = 21 where badge_key = 'cb50';
update badge_catalog set sort = 22 where badge_key = 'avg1';
update badge_catalog set sort = 23 where badge_key = 'avg3';
update badge_catalog set sort = 24 where badge_key = 'avg5';
update badge_catalog set sort = 25 where badge_key = 'avg8';
update badge_catalog set sort = 26 where badge_key = 'avg12';

-- ============================================================
-- 3) "Treue": Duell-Staffel um 100/150/200 ergaenzen + sauber sortieren
-- ============================================================

update badge_catalog set sort = 1  where badge_key = 'matches10';
update badge_catalog set sort = 2  where badge_key = 'matches50';
update badge_catalog set sort = 3  where badge_key = 'matches100';
update badge_catalog set sort = 4  where badge_key = 'matches250';
update badge_catalog set sort = 5  where badge_key = 'opponents5';
update badge_catalog set sort = 6  where badge_key = 'opponents10';
update badge_catalog set sort = 7  where badge_key = 'rival';
update badge_catalog set sort = 8  where badge_key = 'rival25';
update badge_catalog set sort = 9  where badge_key = 'rival50';
update badge_catalog set sort = 13 where badge_key = 'recruit1';
update badge_catalog set sort = 14 where badge_key = 'recruit3';
update badge_catalog set sort = 15 where badge_key = 'recruit5';
update badge_catalog set sort = 16 where badge_key = 'challenge_accepted_1';
update badge_catalog set sort = 17 where badge_key = 'challenge_accepted_5';
update badge_catalog set sort = 18 where badge_key = 'challenge_accepted_15';

insert into badge_catalog (badge_key, category, sort, emoji, name, description) values
  ('rival100', 'Treue', 10, '🧵', 'Wegbegleiter',    '100+ Matches gegen denselben Gegner'),
  ('rival150', 'Treue', 11, '🪢', 'Zwillingsseele',  '150+ Matches gegen denselben Gegner'),
  ('rival200', 'Treue', 12, '🔒', 'Untrennbar',      '200+ Matches gegen denselben Gegner')
on conflict (badge_key) do nothing;

-- ============================================================
-- 4) "Kurios": mehr Matches-pro-Tag-Stufen, mehr Gegner-bezogene Erfolge,
--    ein paar weitere Ideen + sauber sortieren
-- ============================================================

update badge_catalog set sort = 1  where badge_key = 'nightowl';
update badge_catalog set sort = 2  where badge_key = 'earlybird';
update badge_catalog set sort = 3  where badge_key = 'weekend';
update badge_catalog set sort = 4  where badge_key = 'marathon';
update badge_catalog set sort = 7  where badge_key = 'nemesis';
update badge_catalog set sort = 11 where badge_key = 'tb1';
update badge_catalog set sort = 12 where badge_key = 'hardfought';
update badge_catalog set sort = 13 where badge_key = 'heartbreak';
update badge_catalog set sort = 14 where badge_key = 'david';
update badge_catalog set sort = 15 where badge_key = 'phoenix';

insert into badge_catalog (badge_key, category, sort, emoji, name, description) values
  ('matches_day10', 'Kurios', 5,  '🚴', 'Ultramarathon', '10 Matches an einem Tag'),
  ('matches_day15', 'Kurios', 6,  '🧗', 'Nimmermüde',    '15 Matches an einem Tag'),
  ('firststrike',   'Kurios', 8,  '🥷', 'Erstschlag',    'Einen neuen Gegner beim ersten Aufeinandertreffen besiegt'),
  ('revenge',       'Kurios', 9,  '🔁', 'Revanche',      'Nach einer Niederlage direkt die Revanche gegen denselben Gegner gewonnen'),
  ('triplewin',     'Kurios', 10, '🔨', 'Dreifachschlag','Denselben Gegner an einem Tag 3x besiegt'),
  ('bothmodes',     'Kurios', 16, '🧩', 'Doppelt hält besser', 'Am selben Tag Einzel und Doppel gespielt')
on conflict (badge_key) do nothing;

commit;

-- Kontrollabfrage - sollte NACH dem Einspielen leer zurueckkommen:
-- select emoji, array_agg(badge_key order by badge_key) as badge_keys, count(*)
--   from badge_catalog group by emoji having count(*) > 1;
