-- Stellt per DB-Check ausdruecklich sicher, was die Verdrahtungslogik in
-- generate_double_ko_losers()/lb_pair()/tm_wire() (siehe
-- 2026-09-04_tournament_double_ko_byes.sql) ohnehin schon strukturell
-- garantiert: eine Partie im Verliererbaum bekommt NIE ein
-- loser_next_match_id - ein zweiter Verlust dort bedeutet immer sofortiges
-- Ausscheiden, nie eine dritte Chance. lb_pair() setzt fuer eine neu
-- erzeugte Verliererbaum-Partie, die spaeter selbst als Zubringer dient,
-- immer out_via = false, also next_match_id statt loser_next_match_id -
-- ein Verstoss ist mit dem aktuellen Code gar nicht moeglich.
--
-- Rein defensiv: 0 Verstoesse in allen bestehenden Turnieren (Test-Projekt
-- geprueft). Faengt kuenftige Aenderungen an der Verdrahtungs-Logik (z.B.
-- ein spaeter nachgeruestetes "Bracket-Reset"-Finale) sofort mit einem
-- lauten Fehler ab, statt still ein kaputtes Bracket zu erzeugen, in dem
-- jemand ein drittes Mal verlieren koennte.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

alter table public.tournament_matches
  add constraint tournament_matches_losers_no_further_drop
  check (bracket <> 'losers' or loser_next_match_id is null);
