-- Erfolge je Disziplin (Kategorie "Disziplinen"), "Alle Disziplinen" und "Doppel": 124 neue Erfolge.
-- GENERIERT von scripts/genDisciplineBadges.mjs aus src/lib/disciplineBadges.js - nicht von Hand aendern.
--
-- Je Disziplin (8 Ball, 9 Ball, 10 Ball, 14/1 Endlos, Heyball) dieselbe Familie:
--   m Matches gespielt (1/10/50/100/200/500) | w Siege (1/10/25/50/100) | n zu null gewonnen (1/5/10)
--   s Siege in Folge in dieser Disziplin (3/5)  | g verschiedene Gegner (5/10)
-- "Alle Disziplinen": xw Siege in JEDER Disziplin (1/5/10/25/50), xm Matches in jeder (10/50/100), xn zu null in jeder (1/5)
-- "Hill-Hill" (Einzel, ohne 14/1, Endstand W:W-1 ab W=3): hm gespielt (1/5/10/25), hw gewonnen (1/5/10/25),
--   hc gewonnen nach 2 Punkten Rueckstand (1/3; braucht das Punkte-Protokoll run_log)
-- "Doppel": dm Doppel gespielt, dw Doppel-Siege, ds Doppel-Siege in Folge, dp verschiedene Partner
-- Gezaehlt wird wie bei allen Erfolgen: bestaetigte Matches ohne Gast-Beteiligung; je Disziplin und "Alle" nur Einzel,
-- "Doppel" nur Doppel (ein Doppel zaehlt fuer alle vier Spieler mit dem Ergebnis der eigenen Seite).
--
-- Die alten Gesamt-Erfolge (Siege insgesamt, Serien, Matches insgesamt, zu null, verschiedene Gegner) bleiben unveraendert
-- und zaehlen weiter ueber alle Disziplinen; ihre Beschreibung bekommt den Zusatz "(alle Disziplinen)".
-- Die zwoelf frueheren Heyball-Erfolge (2026-10-10b) wandern auf die neuen Schluessel, bereits vergebene bleiben erhalten.
-- Vergabe: compute_discipline_badges(), haengt an einem eigenen Statement-Trigger auf matches (wie zuvor bei Heyball),
-- nicht an trg_rebuild_ratings(). Erfolge werden nur eingefuegt, nie geloescht.
--
-- Emoji-Eindeutigkeit: alle 124 Symbole und Namen wurden vorab gegen den vollstaendigen Katalog geprueft; die
-- Kontrollabfrage am Ende muss leer sein. In Test UND Produktion ausfuehren, zuerst Test. Idempotent.

-- 1) Neue Katalog-Spalten: Unterblock, Familie, Schwelle, Disziplin (fuer Profil-Liste und Fortschrittsanzeige)
alter table public.badge_catalog
  add column if not exists subcategory text,
  add column if not exists family text,
  add column if not exists threshold integer,
  add column if not exists discipline text;

-- 2) Katalog: neue Erfolge (bei erneutem Ausfuehren werden Texte/Symbole nachgezogen)
insert into public.badge_catalog (badge_key, emoji, name, description, category, subcategory, family, threshold, discipline, tier, sort, secret) values
  ('d_8ball_m1', '🤠', 'Greenhorn', '1 Match in 8 Ball gespielt', 'Disziplinen', '8 Ball', 'm', 1, '8 Ball', 1, 1000, false),
  ('d_8ball_m10', '🥾', 'Stiefelträger', '10 Matches in 8 Ball gespielt', 'Disziplinen', '8 Ball', 'm', 10, '8 Ball', 2, 1001, false),
  ('d_8ball_m50', '🪕', 'Saloon-Stammgast', '50 Matches in 8 Ball gespielt', 'Disziplinen', '8 Ball', 'm', 50, '8 Ball', 3, 1002, false),
  ('d_8ball_m100', '🌄', 'Weitreiter', '100 Matches in 8 Ball gespielt', 'Disziplinen', '8 Ball', 'm', 100, '8 Ball', 4, 1003, false),
  ('d_8ball_m200', '🚂', 'Eisenbahnbaron', '200 Matches in 8 Ball gespielt', 'Disziplinen', '8 Ball', 'm', 200, '8 Ball', 5, 1004, false),
  ('d_8ball_m500', '🛤️', 'Pionier des Westens', '500 Matches in 8 Ball gespielt', 'Disziplinen', '8 Ball', 'm', 500, '8 Ball', 6, 1005, false),
  ('d_8ball_w1', '🌵', 'Steppenläufer', 'Erstes Match in 8 Ball gewonnen', 'Disziplinen', '8 Ball', 'w', 1, '8 Ball', 1, 1006, false),
  ('d_8ball_w10', '🐎', 'Mustang-Reiter', '10 Siege in 8 Ball', 'Disziplinen', '8 Ball', 'w', 10, '8 Ball', 2, 1007, false),
  ('d_8ball_w25', '🦬', 'Büffeljäger', '25 Siege in 8 Ball', 'Disziplinen', '8 Ball', 'w', 25, '8 Ball', 3, 1008, false),
  ('d_8ball_w50', '🏜️', 'Herr der Prärie', '50 Siege in 8 Ball', 'Disziplinen', '8 Ball', 'w', 50, '8 Ball', 4, 1009, false),
  ('d_8ball_w100', '🐂', 'Rinderbaron', '100 Siege in 8 Ball', 'Disziplinen', '8 Ball', 'w', 100, '8 Ball', 5, 1010, false),
  ('d_8ball_n1', '🐍', 'Klapperschlange', 'Ein Match in 8 Ball zu null gewonnen', 'Disziplinen', '8 Ball', 'n', 1, '8 Ball', 1, 1011, false),
  ('d_8ball_n5', '🕷️', 'Schwarze Witwe', '5 Matches in 8 Ball zu null gewonnen', 'Disziplinen', '8 Ball', 'n', 5, '8 Ball', 2, 1012, false),
  ('d_8ball_n10', '🐺', 'Einsamer Wolf', '10 Matches in 8 Ball zu null gewonnen', 'Disziplinen', '8 Ball', 'n', 10, '8 Ball', 3, 1013, false),
  ('d_8ball_s3', '🐪', 'Karawane', '3 Siege in Folge in 8 Ball', 'Disziplinen', '8 Ball', 's', 3, '8 Ball', 1, 1014, false),
  ('d_8ball_s5', '🦂', 'Skorpionstich', '5 Siege in Folge in 8 Ball', 'Disziplinen', '8 Ball', 's', 5, '8 Ball', 2, 1015, false),
  ('d_8ball_g5', '🍺', 'Saloon-Gesellschaft', 'Gegen 5 verschiedene Gegner in 8 Ball gespielt', 'Disziplinen', '8 Ball', 'g', 5, '8 Ball', 1, 1016, false),
  ('d_8ball_g10', '🏇', 'Pony-Express', 'Gegen 10 verschiedene Gegner in 8 Ball gespielt', 'Disziplinen', '8 Ball', 'g', 10, '8 Ball', 2, 1017, false),
  ('d_9ball_m1', '🐚', 'Muschelsucher', '1 Match in 9 Ball gespielt', 'Disziplinen', '9 Ball', 'm', 1, '9 Ball', 1, 1018, false),
  ('d_9ball_m10', '⚓', 'Anker geworfen', '10 Matches in 9 Ball gespielt', 'Disziplinen', '9 Ball', 'm', 10, '9 Ball', 2, 1019, false),
  ('d_9ball_m50', '🦑', 'Tiefseetaucher', '50 Matches in 9 Ball gespielt', 'Disziplinen', '9 Ball', 'm', 50, '9 Ball', 3, 1020, false),
  ('d_9ball_m100', '🚢', 'Kapitän', '100 Matches in 9 Ball gespielt', 'Disziplinen', '9 Ball', 'm', 100, '9 Ball', 4, 1021, false),
  ('d_9ball_m200', '⛵', 'Weltumsegler', '200 Matches in 9 Ball gespielt', 'Disziplinen', '9 Ball', 'm', 200, '9 Ball', 5, 1022, false),
  ('d_9ball_m500', '🏝️', 'Inselkönig', '500 Matches in 9 Ball gespielt', 'Disziplinen', '9 Ball', 'm', 500, '9 Ball', 6, 1023, false),
  ('d_9ball_w1', '🦀', 'Strandkrabbe', 'Erstes Match in 9 Ball gewonnen', 'Disziplinen', '9 Ball', 'w', 1, '9 Ball', 1, 1024, false),
  ('d_9ball_w10', '🐠', 'Korallenfisch', '10 Siege in 9 Ball', 'Disziplinen', '9 Ball', 'w', 10, '9 Ball', 2, 1025, false),
  ('d_9ball_w25', '🐬', 'Delfinreiter', '25 Siege in 9 Ball', 'Disziplinen', '9 Ball', 'w', 25, '9 Ball', 3, 1026, false),
  ('d_9ball_w50', '🐳', 'Großwal', '50 Siege in 9 Ball', 'Disziplinen', '9 Ball', 'w', 50, '9 Ball', 4, 1027, false),
  ('d_9ball_w100', '🌊', 'Tsunami', '100 Siege in 9 Ball', 'Disziplinen', '9 Ball', 'w', 100, '9 Ball', 5, 1028, false),
  ('d_9ball_n1', '🦈', 'Haifischbiss', 'Ein Match in 9 Ball zu null gewonnen', 'Disziplinen', '9 Ball', 'n', 1, '9 Ball', 1, 1029, false),
  ('d_9ball_n5', '🐡', 'Kugelfisch', '5 Matches in 9 Ball zu null gewonnen', 'Disziplinen', '9 Ball', 'n', 5, '9 Ball', 2, 1030, false),
  ('d_9ball_n10', '🦭', 'Eisscholle', '10 Matches in 9 Ball zu null gewonnen', 'Disziplinen', '9 Ball', 'n', 10, '9 Ball', 3, 1031, false),
  ('d_9ball_s3', '🐟', 'Fischschwarm', '3 Siege in Folge in 9 Ball', 'Disziplinen', '9 Ball', 's', 3, '9 Ball', 1, 1032, false),
  ('d_9ball_s5', '🐙', 'Krakenarme', '5 Siege in Folge in 9 Ball', 'Disziplinen', '9 Ball', 's', 5, '9 Ball', 2, 1033, false),
  ('d_9ball_g5', '🦞', 'Hafenbekanntschaft', 'Gegen 5 verschiedene Gegner in 9 Ball gespielt', 'Disziplinen', '9 Ball', 'g', 5, '9 Ball', 1, 1034, false),
  ('d_9ball_g10', '🛥️', 'Hafenmeister', 'Gegen 10 verschiedene Gegner in 9 Ball gespielt', 'Disziplinen', '9 Ball', 'g', 10, '9 Ball', 2, 1035, false),
  ('d_10ball_m1', '🌴', 'Palmenschatten', '1 Match in 10 Ball gespielt', 'Disziplinen', '10 Ball', 'm', 1, '10 Ball', 1, 1036, false),
  ('d_10ball_m10', '🍌', 'Bananenpflücker', '10 Matches in 10 Ball gespielt', 'Disziplinen', '10 Ball', 'm', 10, '10 Ball', 2, 1037, false),
  ('d_10ball_m50', '🥥', 'Kokosknacker', '50 Matches in 10 Ball gespielt', 'Disziplinen', '10 Ball', 'm', 50, '10 Ball', 3, 1038, false),
  ('d_10ball_m100', '🌺', 'Dschungelblüte', '100 Matches in 10 Ball gespielt', 'Disziplinen', '10 Ball', 'm', 100, '10 Ball', 4, 1039, false),
  ('d_10ball_m200', '🍃', 'Blätterdach', '200 Matches in 10 Ball gespielt', 'Disziplinen', '10 Ball', 'm', 200, '10 Ball', 5, 1040, false),
  ('d_10ball_m500', '🪵', 'Urwaldriese', '500 Matches in 10 Ball gespielt', 'Disziplinen', '10 Ball', 'm', 500, '10 Ball', 6, 1041, false),
  ('d_10ball_w1', '🦜', 'Papageienruf', 'Erstes Match in 10 Ball gewonnen', 'Disziplinen', '10 Ball', 'w', 1, '10 Ball', 1, 1042, false),
  ('d_10ball_w10', '🐒', 'Lianenschwinger', '10 Siege in 10 Ball', 'Disziplinen', '10 Ball', 'w', 10, '10 Ball', 2, 1043, false),
  ('d_10ball_w25', '🦥', 'Faultier-Taktik', '25 Siege in 10 Ball', 'Disziplinen', '10 Ball', 'w', 25, '10 Ball', 3, 1044, false),
  ('d_10ball_w50', '🐆', 'Jaguar', '50 Siege in 10 Ball', 'Disziplinen', '10 Ball', 'w', 50, '10 Ball', 4, 1045, false),
  ('d_10ball_w100', '🦍', 'Herr des Urwalds', '100 Siege in 10 Ball', 'Disziplinen', '10 Ball', 'w', 100, '10 Ball', 5, 1046, false),
  ('d_10ball_n1', '🐊', 'Krokodilsbiss', 'Ein Match in 10 Ball zu null gewonnen', 'Disziplinen', '10 Ball', 'n', 1, '10 Ball', 1, 1047, false),
  ('d_10ball_n5', '🐸', 'Giftfrosch', '5 Matches in 10 Ball zu null gewonnen', 'Disziplinen', '10 Ball', 'n', 5, '10 Ball', 2, 1048, false),
  ('d_10ball_n10', '🦟', 'Moskitoschwarm', '10 Matches in 10 Ball zu null gewonnen', 'Disziplinen', '10 Ball', 'n', 10, '10 Ball', 3, 1049, false),
  ('d_10ball_s3', '🦧', 'Baumwipfelsprung', '3 Siege in Folge in 10 Ball', 'Disziplinen', '10 Ball', 's', 3, '10 Ball', 1, 1050, false),
  ('d_10ball_s5', '🦎', 'Chamäleon', '5 Siege in Folge in 10 Ball', 'Disziplinen', '10 Ball', 's', 5, '10 Ball', 2, 1051, false),
  ('d_10ball_g5', '🦩', 'Flamingoschwarm', 'Gegen 5 verschiedene Gegner in 10 Ball gespielt', 'Disziplinen', '10 Ball', 'g', 5, '10 Ball', 1, 1052, false),
  ('d_10ball_g10', '🦒', 'Weitblick', 'Gegen 10 verschiedene Gegner in 10 Ball gespielt', 'Disziplinen', '10 Ball', 'g', 10, '10 Ball', 2, 1053, false),
  ('d_141_m1', '🎵', 'Erster Ton', '1 Match in 14/1 Endlos gespielt', 'Disziplinen', '14/1 Endlos', 'm', 1, '14/1 Endlos', 1, 1054, false),
  ('d_141_m10', '🎶', 'Melodie', '10 Matches in 14/1 Endlos gespielt', 'Disziplinen', '14/1 Endlos', 'm', 10, '14/1 Endlos', 2, 1055, false),
  ('d_141_m50', '🎼', 'Notenblatt', '50 Matches in 14/1 Endlos gespielt', 'Disziplinen', '14/1 Endlos', 'm', 50, '14/1 Endlos', 3, 1056, false),
  ('d_141_m100', '🎧', 'Studiotag', '100 Matches in 14/1 Endlos gespielt', 'Disziplinen', '14/1 Endlos', 'm', 100, '14/1 Endlos', 4, 1057, false),
  ('d_141_m200', '📻', 'Radiohit', '200 Matches in 14/1 Endlos gespielt', 'Disziplinen', '14/1 Endlos', 'm', 200, '14/1 Endlos', 5, 1058, false),
  ('d_141_m500', '🎙️', 'Live-Legende', '500 Matches in 14/1 Endlos gespielt', 'Disziplinen', '14/1 Endlos', 'm', 500, '14/1 Endlos', 6, 1059, false),
  ('d_141_w1', '🎸', 'Erster Akkord', 'Erstes Match in 14/1 Endlos gewonnen', 'Disziplinen', '14/1 Endlos', 'w', 1, '14/1 Endlos', 1, 1060, false),
  ('d_141_w10', '🎷', 'Jazz-Sieger', '10 Siege in 14/1 Endlos', 'Disziplinen', '14/1 Endlos', 'w', 10, '14/1 Endlos', 2, 1061, false),
  ('d_141_w25', '🎺', 'Fanfare', '25 Siege in 14/1 Endlos', 'Disziplinen', '14/1 Endlos', 'w', 25, '14/1 Endlos', 3, 1062, false),
  ('d_141_w50', '🎻', 'Konzertmeister', '50 Siege in 14/1 Endlos', 'Disziplinen', '14/1 Endlos', 'w', 50, '14/1 Endlos', 4, 1063, false),
  ('d_141_w100', '🎹', 'Maestro', '100 Siege in 14/1 Endlos', 'Disziplinen', '14/1 Endlos', 'w', 100, '14/1 Endlos', 5, 1064, false),
  ('d_141_n1', '🪗', 'Generalpause', 'Ein Match in 14/1 Endlos zu null gewonnen', 'Disziplinen', '14/1 Endlos', 'n', 1, '14/1 Endlos', 1, 1065, false),
  ('d_141_n5', '🪘', 'Trommelwirbel', '5 Matches in 14/1 Endlos zu null gewonnen', 'Disziplinen', '14/1 Endlos', 'n', 5, '14/1 Endlos', 2, 1066, false),
  ('d_141_n10', '🎚️', 'Mute-Taste', '10 Matches in 14/1 Endlos zu null gewonnen', 'Disziplinen', '14/1 Endlos', 'n', 10, '14/1 Endlos', 3, 1067, false),
  ('d_141_s3', '🔔', 'Dreiklang', '3 Siege in Folge in 14/1 Endlos', 'Disziplinen', '14/1 Endlos', 's', 3, '14/1 Endlos', 1, 1068, false),
  ('d_141_s5', '🎤', 'Zugabe!', '5 Siege in Folge in 14/1 Endlos', 'Disziplinen', '14/1 Endlos', 's', 5, '14/1 Endlos', 2, 1069, false),
  ('d_141_g5', '📯', 'Jam-Session', 'Gegen 5 verschiedene Gegner in 14/1 Endlos gespielt', 'Disziplinen', '14/1 Endlos', 'g', 5, '14/1 Endlos', 1, 1070, false),
  ('d_141_g10', '💿', 'Sampler', 'Gegen 10 verschiedene Gegner in 14/1 Endlos gespielt', 'Disziplinen', '14/1 Endlos', 'g', 10, '14/1 Endlos', 2, 1071, false),
  ('d_heyball_m1', '🀄', 'Heyball-Debüt', '1 Match in Heyball gespielt', 'Disziplinen', 'Heyball', 'm', 1, 'Heyball', 1, 1072, false),
  ('d_heyball_m10', '🏮', 'Laternenträger', '10 Matches in Heyball gespielt', 'Disziplinen', 'Heyball', 'm', 10, 'Heyball', 2, 1073, false),
  ('d_heyball_m50', '🐼', 'Heyball-Stammgast', '50 Matches in Heyball gespielt', 'Disziplinen', 'Heyball', 'm', 50, 'Heyball', 3, 1074, false),
  ('d_heyball_m100', '🎎', 'Puppenspieler', '100 Matches in Heyball gespielt', 'Disziplinen', 'Heyball', 'm', 100, 'Heyball', 4, 1075, false),
  ('d_heyball_m200', '🎑', 'Mondfest', '200 Matches in Heyball gespielt', 'Disziplinen', 'Heyball', 'm', 200, 'Heyball', 5, 1076, false),
  ('d_heyball_m500', '🎍', 'Bambuswald', '500 Matches in Heyball gespielt', 'Disziplinen', 'Heyball', 'm', 500, 'Heyball', 6, 1077, false),
  ('d_heyball_w1', '🧧', 'Glücksbringer', 'Erstes Match in Heyball gewonnen', 'Disziplinen', 'Heyball', 'w', 1, 'Heyball', 1, 1078, false),
  ('d_heyball_w10', '🥢', 'Feine Klinge', '10 Siege in Heyball', 'Disziplinen', 'Heyball', 'w', 10, 'Heyball', 2, 1079, false),
  ('d_heyball_w25', '🐘', 'Dickes Fell', '25 Siege in Heyball', 'Disziplinen', 'Heyball', 'w', 25, 'Heyball', 3, 1080, false),
  ('d_heyball_w50', '🏯', 'Festungsherr', '50 Siege in Heyball', 'Disziplinen', 'Heyball', 'w', 50, 'Heyball', 4, 1081, false),
  ('d_heyball_w100', '🍵', 'Teemeister', '100 Siege in Heyball', 'Disziplinen', 'Heyball', 'w', 100, 'Heyball', 5, 1082, false),
  ('d_heyball_n1', '🥋', 'Weiße Weste', 'Ein Match in Heyball zu null gewonnen', 'Disziplinen', 'Heyball', 'n', 1, 'Heyball', 1, 1083, false),
  ('d_heyball_n5', '🍜', 'Kein Tropfen Suppe', '5 Matches in Heyball zu null gewonnen', 'Disziplinen', 'Heyball', 'n', 5, 'Heyball', 2, 1084, false),
  ('d_heyball_n10', '🥟', 'Leere Schüssel', '10 Matches in Heyball zu null gewonnen', 'Disziplinen', 'Heyball', 'n', 10, 'Heyball', 3, 1085, false),
  ('d_heyball_s3', '🐅', 'Tigersprung', '3 Siege in Folge in Heyball', 'Disziplinen', 'Heyball', 's', 3, 'Heyball', 1, 1086, false),
  ('d_heyball_s5', '🦚', 'Pfauenrad', '5 Siege in Folge in Heyball', 'Disziplinen', 'Heyball', 's', 5, 'Heyball', 2, 1087, false),
  ('d_heyball_g5', '🎏', 'Karpfenschwarm', 'Gegen 5 verschiedene Gegner in Heyball gespielt', 'Disziplinen', 'Heyball', 'g', 5, 'Heyball', 1, 1088, false),
  ('d_heyball_g10', '🥮', 'Mondkuchen-Runde', 'Gegen 10 verschiedene Gegner in Heyball gespielt', 'Disziplinen', 'Heyball', 'g', 10, 'Heyball', 2, 1089, false),
  ('dx_xw1', '🎪', 'Zirkusdirektor', 'In jeder Disziplin mindestens 1 Sieg (in allen 5 Disziplinen gesiegt)', 'Disziplinen', 'Alle Disziplinen', 'xw', 1, null, 1, 1090, false),
  ('dx_xw5', '🗺️', 'Weltenbummler', 'In jeder Disziplin mindestens 5 Siege', 'Disziplinen', 'Alle Disziplinen', 'xw', 5, null, 2, 1091, false),
  ('dx_xw10', '🧳', 'Globetrotter', 'In jeder Disziplin mindestens 10 Siege', 'Disziplinen', 'Alle Disziplinen', 'xw', 10, null, 3, 1092, false),
  ('dx_xw25', '🛕', 'Jahrmarktskönig', 'In jeder Disziplin mindestens 25 Siege', 'Disziplinen', 'Alle Disziplinen', 'xw', 25, null, 4, 1093, false),
  ('dx_xw50', '🌐', 'Universalgenie', 'In jeder Disziplin mindestens 50 Siege', 'Disziplinen', 'Alle Disziplinen', 'xw', 50, null, 5, 1094, false),
  ('dx_xm10', '🎡', 'Riesenrad', 'In jeder Disziplin mindestens 10 Matches gespielt', 'Disziplinen', 'Alle Disziplinen', 'xm', 10, null, 1, 1095, false),
  ('dx_xm50', '🎢', 'Achterbahn', 'In jeder Disziplin mindestens 50 Matches gespielt', 'Disziplinen', 'Alle Disziplinen', 'xm', 50, null, 2, 1096, false),
  ('dx_xm100', '🎀', 'Goldene Schleife', 'In jeder Disziplin mindestens 100 Matches gespielt', 'Disziplinen', 'Alle Disziplinen', 'xm', 100, null, 3, 1097, false),
  ('dx_xn1', '🤹', 'Jongleur', 'In jeder Disziplin mindestens 1 Match zu null gewonnen', 'Disziplinen', 'Alle Disziplinen', 'xn', 1, null, 1, 1098, false),
  ('dx_xn5', '🤡', 'Clown mit Biss', 'In jeder Disziplin mindestens 5 Matches zu null gewonnen', 'Disziplinen', 'Alle Disziplinen', 'xn', 5, null, 2, 1099, false),
  ('dd_dm1', '👯', 'Erstes Duo', '1 Doppel gespielt', 'Disziplinen', 'Doppel', 'dm', 1, null, 1, 1100, false),
  ('dd_dm10', '👫', 'Stammduo', '10 Doppel gespielt', 'Disziplinen', 'Doppel', 'dm', 10, null, 2, 1101, false),
  ('dd_dm50', '👭', 'Dreamteam', '50 Doppel gespielt', 'Disziplinen', 'Doppel', 'dm', 50, null, 3, 1102, false),
  ('dd_dm100', '👬', 'Eingespielt', '100 Doppel gespielt', 'Disziplinen', 'Doppel', 'dm', 100, null, 4, 1103, false),
  ('dd_dm200', '🤼', 'Tag-Team-Veteran', '200 Doppel gespielt', 'Disziplinen', 'Doppel', 'dm', 200, null, 5, 1104, false),
  ('dd_dw1', '🙌', 'Hand drauf', 'Erstes Doppel gewonnen', 'Disziplinen', 'Doppel', 'dw', 1, null, 1, 1105, false),
  ('dd_dw10', '👏', 'Applaus im Doppel', '10 Doppel-Siege', 'Disziplinen', 'Doppel', 'dw', 10, null, 2, 1106, false),
  ('dd_dw25', '💪', 'Starkes Team', '25 Doppel-Siege', 'Disziplinen', 'Doppel', 'dw', 25, null, 3, 1107, false),
  ('dd_dw50', '🛶', 'Im selben Boot', '50 Doppel-Siege', 'Disziplinen', 'Doppel', 'dw', 50, null, 4, 1108, false),
  ('dd_dw100', '🚲', 'Tandem-Meister', '100 Doppel-Siege', 'Disziplinen', 'Doppel', 'dw', 100, null, 5, 1109, false),
  ('dd_ds3', '🤾', 'Pass-Spiel', '3 Doppel-Siege in Folge', 'Disziplinen', 'Doppel', 'ds', 3, null, 1, 1110, false),
  ('dd_ds5', '🏓', 'Ballwechsel', '5 Doppel-Siege in Folge', 'Disziplinen', 'Doppel', 'ds', 5, null, 2, 1111, false),
  ('dd_dp5', '💃', 'Tanzpartner', 'Doppel mit 5 verschiedenen Partnern gespielt', 'Disziplinen', 'Doppel', 'dp', 5, null, 1, 1112, false),
  ('dd_dp10', '💑', 'Die ganze Tanzschule', 'Doppel mit 10 verschiedenen Partnern gespielt', 'Disziplinen', 'Doppel', 'dp', 10, null, 2, 1113, false),
  ('dh_hm1', '🏕️', 'Basislager', '1 Hill-Hill-Match gespielt (beide einen Punkt vor dem Ziel)', 'Disziplinen', 'Hill-Hill', 'hm', 1, null, 1, 1114, false),
  ('dh_hm5', '🪜', 'Aufstieg', '5 Hill-Hill-Matches gespielt', 'Disziplinen', 'Hill-Hill', 'hm', 5, null, 2, 1115, false),
  ('dh_hm10', '🪨', 'Nervenfels', '10 Hill-Hill-Matches gespielt', 'Disziplinen', 'Hill-Hill', 'hm', 10, null, 3, 1116, false),
  ('dh_hm25', '⛑️', 'Bergführer', '25 Hill-Hill-Matches gespielt', 'Disziplinen', 'Hill-Hill', 'hm', 25, null, 4, 1117, false),
  ('dh_hw1', '⛳', 'Letzter Punkt', 'Ein Hill-Hill-Match gewonnen', 'Disziplinen', 'Hill-Hill', 'hw', 1, null, 1, 1118, false),
  ('dh_hw5', '🏁', 'Zielfoto', '5 Hill-Hill-Matches gewonnen', 'Disziplinen', 'Hill-Hill', 'hw', 5, null, 2, 1119, false),
  ('dh_hw10', '🪂', 'Absprung gewagt', '10 Hill-Hill-Matches gewonnen', 'Disziplinen', 'Hill-Hill', 'hw', 10, null, 3, 1120, false),
  ('dh_hw25', '🏂', 'Gipfelstürmer', '25 Hill-Hill-Matches gewonnen', 'Disziplinen', 'Hill-Hill', 'hw', 25, null, 4, 1121, false),
  ('dh_hc1', '🫀', 'Puls auf 180', 'Ein Hill-Hill-Match nach Rückstand von 2 Punkten gewonnen', 'Disziplinen', 'Hill-Hill', 'hc', 1, null, 1, 1122, false),
  ('dh_hc3', '🛟', 'Rettungsring', '3 Hill-Hill-Matches nach Rückstand von 2 Punkten gewonnen', 'Disziplinen', 'Hill-Hill', 'hc', 3, null, 2, 1123, false)
on conflict (badge_key) do update set
  emoji = excluded.emoji, name = excluded.name, description = excluded.description, category = excluded.category,
  subcategory = excluded.subcategory, family = excluded.family, threshold = excluded.threshold, discipline = excluded.discipline,
  tier = excluded.tier, sort = excluded.sort, secret = excluded.secret;

-- 3) Alte Heyball-Erfolge auf die neuen Schluessel umhaengen (vergebene Erfolge und gewaehlter Avatar bleiben erhalten)
-- (ein einziger Block ohne temporaere Tabelle: die SQL-Oberflaeche fuehrt Statements nicht zwingend in derselben Sitzung aus)
do $migrate$
declare
  r record;
begin
  for r in select * from (values ('heyball_1', 'd_heyball_m1'), ('heyball_10', 'd_heyball_m10'), ('heyball_50', 'd_heyball_m50'), ('heyball_win1', 'd_heyball_w1'), ('heyball_win10', 'd_heyball_w10'), ('heyball_win25', 'd_heyball_w25'), ('heyball_win50', 'd_heyball_w50'), ('heyball_win100', 'd_heyball_w100'), ('heyball_shutout', 'd_heyball_n1'), ('heyball_streak3', 'd_heyball_s3'), ('heyball_streak5', 'd_heyball_s5'), ('heyball_opp5', 'd_heyball_g5')) as m(old_key, new_key) loop
    update public.player_badges pb set badge_key = r.new_key
     where pb.badge_key = r.old_key
       and not exists (select 1 from public.player_badges x where x.player_id = pb.player_id and x.badge_key = r.new_key);
    delete from public.player_badges where badge_key = r.old_key;
    update public.players set selected_badge = r.new_key where selected_badge = r.old_key;
    delete from public.badge_catalog where badge_key = r.old_key;
  end loop;
end
$migrate$;

-- 4) Alte Gesamt-Erfolge: Beschreibung nennt jetzt, dass sie ueber alle Disziplinen zaehlen
update public.badge_catalog
   set description = description || ' (alle Disziplinen)'
 where badge_key in ('wins1', 'wins10', 'wins25', 'wins50', 'wins100', 'wins250', 'wins500', 'streak2', 'streak3', 'streak4', 'streak5', 'streak7', 'streak10', 'streak15', 'streak20', 'matches10', 'matches50', 'matches100', 'matches250', 'shutout', 'shutout5', 'shutout10', 'shutout25', 'shutout50', 'shutout100', 'opponents5', 'opponents10')
   and description not like '% (alle Disziplinen)';

-- 5) Berechnung
create or replace function public.compute_discipline_badges()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- Einzel je Spieler und Disziplin (jedes Match zweimal: aus Sicht beider Spieler), ohne Gaeste
  drop table if exists dsc_singles;
  create temp table dsc_singles as
    select m.player1_id as player_id, m.player2_id as opp_id, m.discipline, m.played_at, m.id as mid,
           (m.score1 > m.score2) as won, m.score2 as opp_score
      from matches m
     where m.confirmed and m.player1b_id is null and m.discipline in ('8 Ball', '9 Ball', '10 Ball', '14/1 Endlos', 'Heyball')
       and not exists (select 1 from players p where p.id in (m.player1_id, m.player2_id) and p.is_guest)
    union all
    select m.player2_id, m.player1_id, m.discipline, m.played_at, m.id,
           (m.score2 > m.score1), m.score1
      from matches m
     where m.confirmed and m.player1b_id is null and m.discipline in ('8 Ball', '9 Ball', '10 Ball', '14/1 Endlos', 'Heyball')
       and not exists (select 1 from players p where p.id in (m.player1_id, m.player2_id) and p.is_guest);

  drop table if exists dsc_stats;
  create temp table dsc_stats as
    select player_id, discipline,
           count(*) as m,
           count(*) filter (where won) as w,
           count(*) filter (where won and opp_score = 0) as n,
           count(distinct opp_id) as g
      from dsc_singles group by player_id, discipline;

  -- laengste Siegesserie je Spieler und Disziplin (Reihenfolge nach Zeit; Unentschieden beenden die Serie)
  drop table if exists dsc_streaks;
  create temp table dsc_streaks as
    select player_id, discipline, max(streak) as s from (
      select player_id, discipline, count(*) as streak from (
        select player_id, discipline, won,
               row_number() over (partition by player_id, discipline order by played_at, mid)
               - row_number() over (partition by player_id, discipline, won order by played_at, mid) as grp
          from dsc_singles
      ) x
      where won
      group by player_id, discipline, grp
    ) y
    group by player_id, discipline;

  -- je Disziplin: Matches, Siege, zu null, Gegner
  insert into player_badges (player_id, badge_key)
  select s.player_id, c.badge_key
    from dsc_stats s
    join badge_catalog c on c.category = 'Disziplinen' and c.discipline = s.discipline and c.family in ('m', 'w', 'n', 'g')
   where case c.family when 'm' then s.m when 'w' then s.w when 'n' then s.n else s.g end >= c.threshold
  on conflict do nothing;

  -- je Disziplin: Siege in Folge
  insert into player_badges (player_id, badge_key)
  select s.player_id, c.badge_key
    from dsc_streaks s
    join badge_catalog c on c.category = 'Disziplinen' and c.discipline = s.discipline and c.family = 's'
   where s.s >= c.threshold
  on conflict do nothing;

  -- in JEDER Disziplin (alle 5 muessen mindestens ein Match haben; der kleinste Wert zaehlt)
  insert into player_badges (player_id, badge_key)
  select x.player_id, c.badge_key
    from (select player_id, min(w) as w, min(m) as m, min(n) as n
            from dsc_stats group by player_id having count(*) = 5) x
    join badge_catalog c on c.category = 'Disziplinen' and c.family in ('xw', 'xm', 'xn')
   where case c.family when 'xw' then x.w when 'xm' then x.m else x.n end >= c.threshold
  on conflict do nothing;

  -- Doppel: eine Zeile je Spieler und Doppelmatch, ohne Gaeste
  drop table if exists dsc_doubles;
  create temp table dsc_doubles as
    select v.player_id, v.partner_id, m.played_at, m.id as mid, v.won
      from matches m
     cross join lateral (values
       (m.player1_id,  m.player1b_id, m.score1 > m.score2),
       (m.player1b_id, m.player1_id,  m.score1 > m.score2),
       (m.player2_id,  m.player2b_id, m.score2 > m.score1),
       (m.player2b_id, m.player2_id,  m.score2 > m.score1)) as v(player_id, partner_id, won)
     where m.confirmed and m.player1b_id is not null and m.player2b_id is not null
       and not exists (select 1 from players p
                        where p.id in (m.player1_id, m.player1b_id, m.player2_id, m.player2b_id) and p.is_guest);

  insert into player_badges (player_id, badge_key)
  select d.player_id, c.badge_key
    from (select player_id, count(*) as m, count(*) filter (where won) as w, count(distinct partner_id) as p
            from dsc_doubles group by player_id) d
    join badge_catalog c on c.category = 'Disziplinen' and c.family in ('dm', 'dw', 'dp')
   where case c.family when 'dm' then d.m when 'dw' then d.w else d.p end >= c.threshold
  on conflict do nothing;

  insert into player_badges (player_id, badge_key)
  select s.player_id, c.badge_key
    from (select player_id, max(streak) as s from (
            select player_id, count(*) as streak from (
              select player_id, won,
                     row_number() over (partition by player_id order by played_at, mid)
                     - row_number() over (partition by player_id, won order by played_at, mid) as grp
                from dsc_doubles
            ) x
            where won
            group by player_id, grp
          ) y group by player_id) s
    join badge_catalog c on c.category = 'Disziplinen' and c.family = 'ds'
   where s.s >= c.threshold
  on conflict do nothing;

  -- Hill-Hill: Einzel (ohne 14/1, Gaeste ausgeschlossen), Endstand W:W-1 mit W >= 3, d.h. beide standen einen Punkt vor dem Ziel.
  -- hc: der Sieger lag laut Punkte-Protokoll (run_log = [[s1, s2, ts], ...]) zeitweise mit 2 oder mehr Punkten hinten.
  drop table if exists dsc_hill;
  create temp table dsc_hill as
    select v.player_id, v.won,
           v.won and jsonb_typeof(m.run_log) = 'array' and jsonb_typeof(m.run_log -> 0) = 'array'
             and exists (select 1 from jsonb_array_elements(m.run_log) e
                          where case when m.score1 > m.score2 then (e ->> 1)::int - (e ->> 0)::int
                                     else (e ->> 0)::int - (e ->> 1)::int end >= 2) as came_back
      from matches m
     cross join lateral (values (m.player1_id, m.score1 > m.score2), (m.player2_id, m.score2 > m.score1)) as v(player_id, won)
     where m.confirmed and m.player1b_id is null and m.discipline <> '14/1 Endlos'
       and abs(m.score1 - m.score2) = 1 and greatest(m.score1, m.score2) >= 3
       and not exists (select 1 from players p where p.id in (m.player1_id, m.player2_id) and p.is_guest);

  insert into player_badges (player_id, badge_key)
  select h.player_id, c.badge_key
    from (select player_id, count(*) as m, count(*) filter (where won) as w, count(*) filter (where came_back) as c
            from dsc_hill group by player_id) h
    join badge_catalog c on c.category = 'Disziplinen' and c.family in ('hm', 'hw', 'hc')
   where case c.family when 'hm' then h.m when 'hw' then h.w else h.c end >= c.threshold
  on conflict do nothing;

  drop table if exists dsc_singles, dsc_stats, dsc_streaks, dsc_doubles, dsc_hill;
end;
$function$;

create or replace function public.trg_discipline_badges()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform compute_discipline_badges();
  return null;
end;
$function$;

-- 6) Trigger: der fruehere Heyball-Trigger (2026-10-10b) wird durch den allgemeinen ersetzt
drop trigger if exists matches_heyball_badges on public.matches;
drop function if exists public.trg_heyball_badges();
drop function if exists public.compute_heyball_badges();
drop trigger if exists matches_discipline_badges on public.matches;
create trigger matches_discipline_badges
  after insert or update or delete on public.matches
  for each statement execute function public.trg_discipline_badges();

-- 7) Bestehende Matches einmal nachrechnen
select public.compute_discipline_badges();

-- Kontrolle 1: Emoji-Duplikate im gesamten Katalog (muss leer sein)
select emoji, array_agg(badge_key order by badge_key) as badge_keys, count(*)
from badge_catalog group by emoji having count(*) > 1;

-- Kontrolle 2: Zahl der neuen Erfolge (muss 124 sein)
select count(*) as neue_erfolge from badge_catalog where category = 'Disziplinen';
