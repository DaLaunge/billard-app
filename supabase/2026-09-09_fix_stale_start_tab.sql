-- Bugfix: Spieler mit "rang" als gespeicherter Startseite (Wert von vor dem
-- Uebersicht/Statistik-Menue-Umbau) landen beim App-Start auf einer leeren
-- Seite, weil kein Screen mehr diesen tab-Wert rendert - die Startseiten-
-- Auswahl in ProfilScreen.jsx bietet "rang" schon lange nicht mehr an, aber
-- bereits gespeicherte Werte in der DB blieben unveraendert. Client-seitig
-- faengt App.jsx das jetzt zusaetzlich ab (Fallback auf "stats"), dieses
-- Skript bereinigt nur die schon gespeicherten Altwerte. In Supabase
-- SQL-Editor ausfuehren. Test und Produktion sind getrennte Supabase-
-- Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma) -
-- dieses Skript muss in BEIDEN separat laufen.

update public.players set start_tab = 'stats' where start_tab = 'rang';
