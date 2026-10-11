-- "Dauer-König" (king12) hatte als Symbol ♛ (Schachfigur, kein Emoji): ohne Vektorgrafik und je nach Gerät anders gezeichnet.
-- Neu: 🤴 (katalogweit eindeutig geprueft, 2026-10-11). In Test UND Produktion ausfuehren. Idempotent.
update public.badge_catalog set emoji = '🤴' where badge_key = 'king12';

-- Kontrolle: Emoji-Duplikate im gesamten Katalog (muss leer sein)
select emoji, array_agg(badge_key order by badge_key) as badge_keys, count(*)
from badge_catalog group by emoji having count(*) > 1;
