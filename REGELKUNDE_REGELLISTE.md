# Regelkunde: Regelliste für die Animationen

Arbeitsgrundlage für `src/lib/ruleScenes.js`. Quelle: **ÖPBV/WPA-Spielregeln, gültig ab 12.02.2026** („Offizielle Poolbillard Regeln“, Kapitel 3 Fouls und 4–7 Disziplinen). Alle Regeln hier in eigenen Worten, die Nummern sind die des Regelwerks (3.x = Foul-Katalog, 4.x = 8-Ball, 5.x = 9-Ball, 6.x = 10-Ball, 7.x = 14/1 Endlos). Im Zweifel gilt die englische WPA-Fassung.

Nicht verwendet: `Oberschiedsrichter_Lehrunterlagen.pdf` (Stand Okt. 2019, ältere Regelfassung), `normenkatalog.pdf` (Tischmaße/Ausrüstung), `regularien-fuer-schiri-und-oberschiri.pdf` (Prüfungs- und Disziplinarwesen). `Doppel_Matchregeln.pdf` ist eine eigene Ergänzung für Doppel, siehe unten.

## 1. Welche Fouls gelten in welcher Disziplin

| Foul | 8 Ball | 9 Ball | 10 Ball | 14/1 |
|---|---|---|---|---|
| 3.1 Weiße in der Tasche / vom Tisch | ✓ | ✓ | ✓ | ✓ |
| 3.2 Falsche Kugel | ✓ eigene Gruppe | ✓ niedrigste | ✓ niedrigste | – |
| 3.3 Keine Bande nach dem Erstkontakt | ✓ | ✓ | ✓ | ✓ |
| 3.4 Kein Fuß auf dem Boden | ✓ | ✓ | ✓ | ✓ |
| 3.5 Objektkugel springt vom Tisch | ✓ | ✓ | ✓ | ✓ |
| 3.6 Kugeln berühren / Lauf verändern | ✓ | ✓ | ✓ | ✓ |
| 3.7 Durchstoß / press liegende Kugel | ✓ | ✓ | ✓ | ✓ |
| 3.8 Schieben der Weißen | ✓ | ✓ | ✓ | ✓ |
| 3.9 Stoß, während sich Kugeln bewegen | ✓ | ✓ | ✓ | ✓ |
| 3.10 Falsches Positionieren (Kopflinie) | ✓ | ✓ | ✓ | ✓ |
| 3.11 Unkorrektes Spiel aus dem Kopffeld | ✓ | – | – | ✓ |
| 3.12 Stoßen außerhalb der eigenen Aufnahme | ✓ | ✓ | ✓ | ✓ |
| 3.13 Drei Fouls in Folge | **nein** | ✓ | ✓ | ✓ (Sonderstrafe) |
| 3.14 Zeitspiel | ✓ | ✓ | ✓ | ✓ |
| 3.15 Aufbauhilfe stört | ✓ | ✓ | ✓ | ✓ |
| 3.16 Unsportliches Verhalten | Strafe nach Ermessen des Schiedsrichters (alle) |

**Wichtig:** Die Drei-Foul-Regel gibt es nicht nur bei 9 Ball und 10 Ball, sondern auch bei 14/1 (dort mit Sonderstrafe, siehe 3). Nur der 8-Ball hat sie nicht.

Allgemein (Kap. 3): Mehrere Fouls in einem Stoß zählen nur mit dem schwersten. Ein Foul, das vor dem nächsten Stoß nicht bemerkt wird, gilt als nicht begangen.

## 2. Folgen eines Standardfouls

| Disziplin | Folge |
|---|---|
| 8 / 9 / 10 Ball | Aufnahme wechselt, der Gegner bekommt die Weiße in die Hand (überall auf dem Tisch). |
| 14/1 Endlos | 1 Punkt Abzug, Aufnahme wechselt. Weiße bleibt liegen, außer bei Scratch (3.1) und dem zweiten Absatz von 3.11: dann Weiße aus dem Kopffeld. |

Schwerwiegende Fouls / Spielverlust:
- **8 Ball (4.8):** Spielverlust, wenn man beim Versenken der 8 ein Foul macht, die 8 zu früh versenkt, in eine nicht angesagte Tasche spielt oder sie vom Tisch springt.
- **9 / 10 Ball (5.8, 6.10):** drei Fouls in Folge = Spielverlust.
- **14/1 (7.11):** drittes Foul in Folge: 1 Punkt (wie üblich) plus 15 Punkte Abzug, alle 15 Kugeln neu aufgebaut, der Spieler stößt neu an. Anstoßfouls zählen nicht mit.

## 3. Regeln, die für Animationen besonders taugen

Mit „Foul / kein Foul“-Gegenüberstellung (A/B). Status: ✅ im Prototyp, 🟦 Kugeln allein genügen, 🟨 braucht neue Zeichen-Elemente (Queue, Hand, Fuß, Tischlinien).

| # | Fall | Disziplinen | Regel | Status |
|---|---|---|---|---|
| 1 | Erste Berührung | 9, 10 (8: eigene Gruppe) | 3.2, 5.7, 6.9, 4.9 | ✅ |
| 2 | Kugel und Weiße in der Tasche | alle | 3.1 | ✅ |
| 3 | Nach dem Erstkontakt: Bande oder Tasche | alle | 3.3, 2.7 | ✅ |
| 4 | Weiße trifft ungefähr gleichzeitig zulässige und unzulässige Kugel | alle mit 3.2 | 3.2 (im Zweifel zulässige zuerst) | ✅ |
| 5 | Bande vor dem Treffer zählt nicht (Weiße prallt erst an die Bande) | alle | 3.3, 2.7 | ✅ |
| 5b | Weiße trifft ungefähr gleichzeitig Kugel und Bande | alle | 3.3 (im Zweifel Kugel zuerst) | 🟦 |
| 6 | Objektkugel springt vom Tisch | alle | 3.5, 2.6 | ✅ |
| 7 | Stoß, während sich noch eine Kugel bewegt | alle | 3.9 | ✅ |
| 8 | Weiße berührt versenkte Kugel in der Tasche | alle | 2.2 | 🟦 |
| 9 | Press liegende Kugel an der Bande: muss erst weg und wieder hin | alle | 2.7, 3.3 | 🟦 |
| 10 | Kugel hängt am Taschenrand: nach 5 Sekunden nicht versenkt | alle | 2.2 | 🟨 |
| 11 | Push Out: 3.2 und 3.3 entfallen | 9, 10 | 5.4, 6.4 | ✅ |
| 12 | Anstoß: mindestens vier Kugeln an die Bande, sonst Foul | 8, 9, 10 | 4.3d, 5.3b, 6.3b | ✅ |
| 13 | 14/1-Anstoß: Weiße und zwei Kugeln je an eine Bande, sonst Anstoßfoul (−2) | 14/1 | 7.3b | 🟦 |
| 14 | Dry Break bei 3-Punkte-Regel (ÖPBV-Abweichung) | 9 | 5.3c | 🟨 |
| 15 | Offener Tisch: erst die 8 spielen ist Foul | 8 | 4.4 | ✅ |
| 16 | Spielen aus dem Kopffeld: Kopflinie und erste Kugel im Kopffeld | 8, 14/1 | 3.10, 3.11 | 🟨 |
| 17 | Drei Fouls in Folge (Ablauf in Schritten) | 9, 10, 14/1 | 3.13 | 🟨 (Zähler) |
| 18 | Durchstoß / Schieben / Weiße press an Kugel | alle | 3.7, 3.8 | 🟨 (Queue) |
| 19 | Fuß nicht am Boden | alle | 3.4 | 🟨 (Figur) |
| 20 | Kugel berühren / Lauf verändern | alle | 3.6 | 🟨 (Hand) |

## 4. Doppel (Doppel_Matchregeln.pdf, Club-/Verbandsregel)

- Spielt der falsche Spieler, ist das immer ein Foul (der Gegner muss es ausrufen, sonst gilt es als überspielt).
- Das Ausspielen ist kein „Stoß“ für den Stoßwechsel. Wer es gewinnt, macht auch den ersten Anstoß, wenn er das Break haben will.
- Breakwechsel zwischen den Teams und innerhalb eines Teams: jeder Spieler kommt alle 4 Spiele zum Break.
- Das nicht anstoßende Team wählt, wer im Spiel den ersten Stoß macht.
- Absprachen im Team sind erlaubt (kurz). Zeichen mit Fingern oder Queue kurz vor/während des Stoßes sind Foul.
- Die Rückgabe eines Push Outs ist kein Stoß im Sinne des Stoßwechsels.

## 5. Offene Punkte und Hinweise

- **Quellenbasis:** Das Regelwerk ist die ÖPBV/WPA-Fassung. Die Regelungen der Vereinsliga können davon abweichen (z. B. 3-Punkte-Regel beim 9-Ball nur, wenn so gespielt wird).
- **Maßstab:** Normenkatalog: Spielfläche 9-Fuß-Tisch 2,54 × 1,27 m, Kugeln 57,15 mm. Die Animation zeichnet die Kugeln absichtlich etwa 2,4-mal größer, damit sie am Handy lesbar sind.
- **Nicht in den Dokumenten:** Blackball, Heyball, Pyramid, One-Pocket, Bank Pool, IEPF: das ÖPBV-Dokument verweist nur auf die englischen WPA-Regeln.
- Die Zuordnung `discs` in `ruleScenes.js` entspricht jetzt dieser Tabelle.
