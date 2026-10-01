-- Einmalig, nur Test-Projekt: Raphis gemeldete Version auf 389 setzen.
--
-- Er meldete 412 (alte Zaehlung, als test noch ganze Nummern hochzaehlte).
-- Seit 2026-09-30 zaehlt test "<Prod-Nummer>.<Minor>" (aktuell 391.x). Die App
-- schreibt die Version nur, wenn sie sich AENDERT - bei 412 in der Datenbank und
-- 391 im Code waere das auch der Fall, aber 412 > 391 sieht aus wie "neuer
-- als alles". Mit 389 steht er klar UNTER dem aktuellen Stand: sobald sein
-- Geraet das Update zieht und die App startet, springt sein Eintrag im
-- Admin ("App-Versionen") auf 391 (mit app_version_full: 391.xx, falls
-- 2026-10-01_app_version_full.sql eingespielt ist) - das ist der Beleg, dass das
-- Update bei ihm angekommen ist.
--
-- Hat kein Update-Zwang: min_app_version steht im Test-Projekt auf 0.

update public.players
   set app_version = 389,
       app_version_at = now()
 where nickname = 'Raphi';

-- Kontrolle (zeigt genau 1 Zeile mit 389):
select nickname, app_version, app_version_at from public.players where nickname = 'Raphi';
