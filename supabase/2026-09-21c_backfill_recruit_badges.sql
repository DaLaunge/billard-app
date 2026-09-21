-- Einmaliger Daten-Nachtrag, KEINE Schema- oder Funktionsaenderung.
--
-- Vorgeschichte: bis zum Fix vom 2026-09-21 (siehe
-- 2026-09-21_persistent_invites.sql) ging der Einladungs-Code beim
-- Magic-Link-Umweg verloren, deshalb wurde players.invited_by so gut wie nie
-- gesetzt und die Werbe-Erfolge konnten nicht ausloesen. Wer damals jemanden
-- geworben hat, steht nirgends - die einzige Spur ist die invites-Tabelle:
-- dort sieht man, WER einen Code erzeugt hat, aber nicht, wen er damit geholt
-- hat.
--
-- Erschwerend: unter der alten Einmal-Logik wurde ein neuer Code erst nach
-- der Einloesung des vorherigen erzeugt. Da nie eine Einloesung ankam, hat
-- jeder Werber genau eine Zeile - die Anzahl der Codes sagt also nichts
-- ueber die Anzahl der Geworbenen aus.
--
-- Entscheidung des Betreibers (Stefan, 2026-09-21): wer nachweislich einen
-- Einladungscode erzeugt hat, hat auch geworben - diese Leute bekommen die
-- erste Stufe gutgeschrieben. Hoehere Stufen (recruit3/recruit5) bleiben
-- bewusst aussen vor, dafuer gibt die Datenlage nichts her.
--
-- Bewusste Unsauberkeit: players.invited_by bleibt leer (wir wissen ja nicht,
-- wer wen geworben hat). Im Profil steht bei den Betroffenen damit der Erfolg
-- "Gastgeber" als erreicht, der Live-Zaehler daneben aber weiter bei
-- "0 geworbene Spieler" - der kommt aus invited_by, nicht aus den Badges.
-- Wer die Paare kennt, traegt besser invited_by nach und laesst
-- compute_recruit_badges() laufen; dann stimmt beides.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion:
-- wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat laufen.
-- Mehrfaches Ausfuehren ist harmlos (on conflict do nothing).

insert into player_badges (player_id, badge_key)
select distinct i.inviter_id, 'recruit1'
  from invites i
  join players p on p.id = i.inviter_id
 where coalesce(p.is_ghost, false) = false
   and coalesce(p.is_guest, false) = false
on conflict do nothing;
