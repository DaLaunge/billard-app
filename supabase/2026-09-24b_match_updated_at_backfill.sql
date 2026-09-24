-- Nachtrag zu 2026-09-24_match_delta_sync.sql.
--
-- Problem: beim Hinzufuegen von matches.updated_at haben ALLE bestehenden
-- Matches denselben Zeitstempel bekommen (Zeitpunkt der Migration). Die App
-- gleicht mit 10 Minuten Ueberlappung zum juengsten bekannten updated_at ab
-- (siehe src/lib/matchCache.js) - solange sich danach kein Match aendert,
-- liegen damit ALLE Matches in diesem Fenster und jeder Abgleich holt wieder
-- die komplette Liste.
--
-- Fix: Matches, die seit der Migration unveraendert sind (erkennbar daran,
-- dass sie sich genau diesen einen Zeitstempel teilen), bekommen ihr
-- played_at als updated_at - verteilt ueber die ganze Vergangenheit. Zeilen,
-- die seither wirklich geaendert wurden, behalten ihren echten Zeitstempel.
-- Alle Trigger auf matches sind dabei kurz aus: am Inhalt aendert sich nichts,
-- also keine Rating-/Erfolgs-Neuberechnung und keine Benachrichtigungen.
--
-- In Test UND Produktion ausfuehren, direkt nach 2026-09-24_match_delta_sync.sql
-- und BEVOR die App-Version mit dem Match-Cache in Produktion geht. Idempotent:
-- ein zweiter Lauf findet keinen gemeinsamen Zeitstempel mehr (Schwelle 20).

begin;

alter table public.matches disable trigger user;

with bulk as (
  select updated_at as t
  from public.matches
  group by updated_at
  having count(*) >= 20
  order by count(*) desc
  limit 1
)
update public.matches m
   set updated_at = m.played_at
  from bulk
 where m.updated_at = bulk.t
   and m.played_at is not null;

alter table public.matches enable trigger user;

commit;
