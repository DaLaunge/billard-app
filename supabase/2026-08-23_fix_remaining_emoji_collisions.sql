-- Behebt die 7 vorbestehenden Emoji-Dopplungen im Katalog (unabhaengig
-- von den Herausforderungs-Badges, siehe 2026-08-23_fix_challenge_
-- emoji_collisions.sql fuer die anderen zwei).
--
-- Mehrere Erfolgs-Familien haben eine erkennbare Emoji-Eskalation
-- (Serien: 👊🎯💥🔥🚀⚡🌋☄️ / Riesentoeter: 🗡️🐉🗿 / Zu-Null: 🧊❄️🌨️🥶🏔️☃️ /
-- Schnitt: 🎱📈📊🧮📐 / Koenig: 👑♛). Um diese Sequenzen nicht zu
-- zerstoeren, bleibt bei jeder Kollision die Familie unangetastet und
-- nur das jeweils zugehoerigkeitsfremde Badge bekommt ein neues Emoji:
--
--   🎯 streak3 (Serien-Familie, bleibt) <-> ghost5 -> 🕸️ (Spinnennetz)
--   🚀 streak7 (Serien-Familie, bleibt) <-> peak600 -> 🛰️ (Satellit, "ueber den Wolken")
--   🧊 shutout (Zu-Null-Familie, bleibt) <-> ghost25 -> 🧟 (Zombie)
--   🎳 tb1 (bessere inhaltliche Passung: zwei Kugeln geraeumt) <-> disc1 -> 🔬 (Spezialist/Fokus)
--   📈 avg3 (Schnitt-Familie, bleibt) <-> comeback -> 🌅 (Wende/Comeback)
--   👑 king4 (Koenig-Familie, bleibt) <-> ghost1000 -> 🧿 (Nazar, "Geistermeister")
--   🎱 avg1 (Schnitt-Familie, bleibt) <-> matches100 -> 🪪 (Ausweis, "Stammspieler")
--
-- Alle sieben neuen Emojis gegen den vollstaendigen Katalog (Stand
-- 2026-08-23, 81 Zeilen) geprueft - keine weiteren Kollisionen.
--
-- In Supabase SQL-Editor ausfuehren (Testprojekt).

update badge_catalog set emoji = '🕸️' where badge_key = 'ghost5';
update badge_catalog set emoji = '🛰️' where badge_key = 'peak600';
update badge_catalog set emoji = '🧟' where badge_key = 'ghost25';
update badge_catalog set emoji = '🔬' where badge_key = 'disc1';
update badge_catalog set emoji = '🌅' where badge_key = 'comeback';
update badge_catalog set emoji = '🧿' where badge_key = 'ghost1000';
update badge_catalog set emoji = '🪪' where badge_key = 'matches100';
