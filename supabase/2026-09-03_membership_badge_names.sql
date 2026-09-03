-- Lustigere Namen fuer die "Mitgliedschaft"-Erfolge (wie lange ist wer
-- schon dabei) - bisher stur "1 Woche dabei", "1 Monat dabei" usw. Die
-- description bleibt unveraendert (steht als Tooltip/Untertitel bei den
-- Erfolgen und nennt weiterhin die genaue Zeitspanne), nur der name
-- (die fett angezeigte Ueberschrift) wird ausgetauscht - Steigerung von
-- "Billard-Neuling" bis "Legende"/"Urgestein".
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.

update public.badge_catalog set name = v.name
from (values
  ('member_1w',  'Billard-Neuling'),
  ('member_1m',  'Frischling'),
  ('member_1q',  'Kreidejunkie'),
  ('member_6m',  'Stammgast'),
  ('member_1y',  'Bandenläufer'),
  ('member_2y',  'Kreide-Connoisseur'),
  ('member_3y',  'Dauerbrenner'),
  ('member_4y',  'Vereinsveteran'),
  ('member_5y',  'Urgestein'),
  ('member_6y',  'Tischlegende im Werden'),
  ('member_7y',  'Kult-Figur'),
  ('member_8y',  'Lebende Legende'),
  ('member_9y',  'Vereins-Mythos'),
  ('member_10y', 'Legende')
) as v(badge_key, name)
where badge_catalog.badge_key = v.badge_key;
