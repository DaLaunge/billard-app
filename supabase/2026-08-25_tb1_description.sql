-- Beschreibungstext des Erfolgs "Doppelpack" (badge_key tb1) praezisieren.
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen: zuerst Test, und erst wenn
-- der Text auf main geht, auch in Produktion.

update badge_catalog
set description = '14/1: letzte zwei Kugeln des Racks gleichzeitig versenkt'
where badge_key = 'tb1';
