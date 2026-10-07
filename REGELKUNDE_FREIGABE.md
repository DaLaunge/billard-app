# Regelkunde: Freigabe-Übersicht

Alle Fälle: `released: false` (nur Admins). Geprüft mit `scripts/checkRules.mjs` (Physik, Erstkontakt/Bande, Kollisionen, Übersetzungen), `scripts/checkSearch.mjs` und einem Durchlauf aller Schritte im Browser (keine Konsolenfehler). Zum Freigeben: `released: true` im Fall setzen und die Admin-Bedingung in `LiveScreen` lockern.

| Fall | Titel | Disziplinen | Hinweis |
|---|---|---|---|
| `erste-beruehrung` | Erste Berührung | 8 Ball, 9 Ball, 10 Ball |  |
| `weisse-versenkt` | Weiße in der Tasche (Scratch) | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `nach-treffer-bande` | Nach dem Treffer: Bande oder Tasche | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `gleichzeitiger-treffer` | Zwei Kugeln gleichzeitig getroffen | 8 Ball, 9 Ball, 10 Ball |  |
| `bande-vor-dem-treffer` | Bande vor dem Treffer zählt nicht | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `kugel-vom-tisch` | Kugel springt vom Tisch | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `bewegende-kugeln` | Stoß bei rollender Kugel | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `push-out` | Push Out | 9 Ball, 10 Ball |  |
| `anstoss-vier-kugeln` | Anstoß: vier Kugeln an die Bande | 8 Ball, 9 Ball, 10 Ball |  |
| `offener-tisch-acht` | Offener Tisch: die 8 zuerst | 8 Ball |  |
| `drei-fouls` | Drei Fouls in Folge | 9 Ball, 10 Ball, 14/1 Endlos |  |
| `anstoss-vierzehn-eins` | 14/1: Eröffnungsstoß | 14/1 Endlos |  |
| `kopflinie` | Anstoß: Weiße auf der Kopflinie | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `spiel-aus-dem-kopffeld` | Spiel aus dem Kopffeld | 8 Ball, 14/1 Endlos |  |
| `taschenrand` | Kugel hängt am Taschenrand | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `neuaufbau-fuenfzehnte` | 14/1: Neuaufbau, 15. Kugel mit der 14. versenkt | 14/1 Endlos |  |
| `neuaufbau-kugel-behindert` | 14/1: 15. Kugel behindert den Neuaufbau | 14/1 Endlos |  |
| `neuaufbau-weisse-behindert` | 14/1: Weiße behindert den Neuaufbau | 14/1 Endlos |  |
| `neuaufbau-beide` | 14/1: 15. Kugel und Weiße behindern beide | 14/1 Endlos |  |
| `ausspielen` | Ausspielen um den Anstoß | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `kugel-faellt-von-selbst` | Kugel fällt von selbst | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `stoerung-von-aussen` | Störung von außen | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `foul-zu-spaet` | Foul zu spät erkannt | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `doppelstoss` | Doppelstoß: Weiße läuft nach | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `press-bande` | Kugel liegt press an der Bande | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `rack-aufbau` | Rack korrekt aufbauen | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `sicherheit` | Sicherheit ansagen | 8 Ball, 14/1 Endlos |  |
| `falsche-tasche` | Kugel fällt in die falsche Tasche | 8 Ball, 10 Ball, 14/1 Endlos |  |
| `acht-verloren` | Die 8: gewonnen oder verloren | 8 Ball |  |
| `acht-anstoss` | 8-Ball-Anstoß: Kugel oder Weiße fällt | 8 Ball |  |
| `roll-up` | Roll-up: nur zweimal erlaubt | 14/1 Endlos |  |
| `fuss-am-boden` | Mindestens ein Fuß am Boden | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `schieben` | Schieben der Weißen | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `kugel-beruehrt` | Berühren einer Kugel (Hand, Ärmel) | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `kitchen-rule` | Kitchen Rule: drei Kugeln ins Kopffeld | 9 Ball |  |
| `patt` | Patt: kein Fortschritt im Spiel | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `gruppen-verwechselt` | Gruppen verwechselt | 8 Ball |  |
| `doppel-reihenfolge` | Doppel: Reihenfolge der Spieler | 8 Ball, 9 Ball, 10 Ball |  |
| `ausserhalb-aufnahme` | Stoß außerhalb der Aufnahme | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `kugel-gefangen` | Eine rollende Kugel fangen | 14/1 Endlos |  |
| `aufbauhilfe-foul` | Hilfsmittel auf der Bande berührt | 8 Ball, 9 Ball, 10 Ball |  |
| `zeitspiel` | Zeitspiel: das Zeitlimit | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `unsportlich` | Unsportliches Verhalten | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `weisse-press` | Weiße liegt press an einer Kugel | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `weisse-versenkte-kugel` | Volle Tasche: Kugel in der Tasche berührt | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `tuch-markieren` | Tuch oder Bande markieren | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `kugel-am-taschenrand` | Taschenrand: von oben prüfen | 8 Ball, 9 Ball, 10 Ball, 14/1 Endlos |  |
| `acht-faellt-anstoss` | Die 8 fällt beim Anstoß | 8 Ball | vereinfachte Physik beim Aufstieben des Racks |
