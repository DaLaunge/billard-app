# Testkatalog Break & Rank

Stand: 2026-11-01, Version 428, Testprojekt (`hadamdvpnwslztsxmwdr`), Login `test@test.at` (Admin).
Ziel: Alles läuft **vollautomatisch** (Browser-Pane, JavaScript im Seitenkontext, keine Handgriffe).
**Ausgenommen (braucht Nutzerhandlung):** Speichern/Teilen von PDFs und CSV in eine Datei, System-Teilen-Menü, Push-Berechtigung, Kamera/QR-Scan. Der PDF-Bau selbst wird nur als Blob (Typ + Größe) geprüft.

Ergebnis: ✅ bestanden · ⚠️ Beobachtung (kein Fehler) · 🔧 Fehler gefunden und behoben · ⏭️ bewusst nicht automatisiert

## 0. Vorbereitung und Messwerkzeuge
- Dev-Server `billard-app` (Port 5173), Fenster per `resize_window`.
- Animationen für Messungen abschalten (`*{animation:none!important;transition:none!important}`): das Browser-Pane spielt Animationen nicht ab, ein Seitenübergang bleibt sonst bei +56 px stehen und täuscht Überstand vor.
- Fetch-Hook für Antworten ungleich 2xx (`__bad`), Konsole auf Fehler lesen.
- Menü: am PC fest links, am Handy über `.burger-btn`. Eingabe-Screens (Match, Zähler) blenden das Menü aus, Rückweg nur über „Zurück/Zur Rangliste/Zurück zum Turnier“.
- Größen: 1280×800, 1024×768, 768×1024, 375×812, 812×375, 667×375.

## 1. Layout-Rundlauf (jedes Menü × jede Größe)
Prüfung je Menü: kein horizontaler Überstand (`scrollWidth - clientWidth = 0`), Karten gleich breit und bündig (Handy hoch: x=12, Breite 351), keine Konsolenfehler.
Menüs: Statistik, Turniere, Live, Identität, Meine Erfolge, Meine Zahlen, Einstellungen, Clubs, Spieler einladen, Verwaltung, Regelkunde, Neues Match.

| ID | Größe | Ergebnis |
|---|---|---|
| L-01 | 1024×768 (alle 11 Menüs) | ✅ |
| L-02 | 375×812 (alle 12) | ✅ Karten x=12/351 |
| L-03 | 812×375 (alle 11) | ✅ Karten x=12/778 |
| L-04 | 1280×800 | ✅ |
| L-05 | 768×1024, 667×375 | ✅ (Turnierscreens, frühere Läufe) |
| L-06 | Segmentleisten (>4 Einträge) | ⚠️ scrollen waagrecht, gewollt |

## 2. Neues Match
| ID | Test | Ergebnis |
|---|---|---|
| M-01 | Einzel 8 Ball: Gegner wählen, Match starten, 4:2, Beenden, Prüfen, Speichern | ✅ „Wartet auf Bestätigung“ |
| M-02 | Protokoll ansehen (Stände, Zeiten, Dauer) | ✅ ⚠️ „Spielzeit 9 Sek“ > „Gesamtdauer 8 Sek“ (Rundung, harmlos) |
| M-03 | Doppel: Partner + 2 Gegner, 3:5, speichern | ✅ „wartet auf drei andere“ |
| M-04 | 14/1: Ziel 50, Anstoß, Rack ausgeschossen, Fehler (Dialog Kugelzahl), Safe, Foul, Rückgängig, vorzeitig beenden | ✅ Serien/Fouls/Durchschnitt stimmen |
| M-05 | Disziplinwechsel mit Zählstand → Rückfrage „Disziplin wechseln?“ | ✅ |
| M-06 | Zusatzzähler (Fluke, Foul) zählen und speichern | 🔧 siehe 12.1 |
| M-07 | Siegchance im Zähler vs. Erwartung im Prüfschritt (60 % / 65 %) | ⚠️ zwei verschiedene Rechnungen (Disziplin- vs. Gesamt-Rating), erklärbar |
| M-08 | Turnier-Match über „Melden“ (feste Disziplin), speichern, „Jetzt direkt bestätigen“ | ✅ „Bestätigt!“ |
| M-10 | Anstoß-Queue im Zähler: nur bei der Seite mit Anstoß sichtbar, die andere Seite leer; solange tauschbar ist die Queue ein Knopf (Antippen gibt den Anstoß der anderen Seite); Winner Stays ebenso | ✅ 427.62 |
| M-11 | Zähler (Winner Stays, Neues Match): die Plus/Minus-Kapseln sitzen mittig unter dem Avatar ihrer Person (Mittelpunkte gleich bei 1280, 812×375, 375), Tasten mindestens 44 px hoch/breit, Haken bleibt in der Mitte, kein Überstand | ✅ 427.63 |
| M-09 | Ghost-Match, Gast anlegen, QR-Panel, Sortierung/Anzahl, Ballanimation | ⏭️ nicht in diesem Lauf (Kamera/Handgriffe) bzw. früher geprüft |

## 3. Turniere
| ID | Test | Ergebnis |
|---|---|---|
| T-01 | Anlegen K.o. mit Tischen von–bis | ✅ |
| T-02 | Anmeldung: Vorschläge antippen, „n Spieler hinzufügen“, Vorschlagsliste füllt nach | ✅ |
| T-03 | Selbst anmelden/abmelden (Anmelden ↔ Abmelden) | ✅ |
| T-04 | Starten mit Bestätigungsdialog | ✅ |
| T-05 | Jeder gegen jeden (4 Spieler): Tabelle, Ergebnis eintragen, Nichterscheinen (Spieler scheidet für alle Partien aus), Rundenabschluss, „Korrekturen noch möglich“, „Turnier bestätigen“ | ✅ ⚠️ Walkover erscheinen in „Längste Wartezeiten“ |
| T-06 | Doppel-K.o. (Gewinner-/Verliererbaum, Finale, Rückspiel) bis zum Ende | ✅ 6 Spiele, Sieger Odko |
| T-07 | K.o. mit eigener Teilnahme: „Melden“ → Match-Screen → zurück | ✅ |
| T-08 | Turnierbericht (kompakt, vollständig), PDF-Blob (application/pdf, 6,5 KB) | ✅ |
| T-09 | PDF/CSV auf Datenträger speichern | ⏭️ braucht Nutzerhandlung |
| T-10 | Winner Stays Einzel und Doppel (laufend/beendet), Pause, Hinzufügen, QR-Panel | ✅ (Lauf vor 427.48) |
| T-13 | Winner Stays Doppel: Spieler hinzufügen → Avatar-Kacheln, zwei antippen bilden das Team (Paar-Vorschau, dritte Wahl ersetzt die älteste, Button erst bei genau 2 aktiv), „Team hinzufügen“, Warteschlange zeigt „Adrian & Din“ | ✅ 427.50 |
| T-14 | Turniergrafik: passt sich beim Öffnen automatisch in Breite und Höhe ein (kein Scrollen), Knopf „An Bildschirm anpassen“ nach manuellem Zoom/100 %, auch nach Maximieren und Größenänderung (1280, 1024, 375) | ✅ 427.52 |
| T-15 | Turnier mit Baum startet immer in der Grafik (auch wenn es in der Anmeldung noch keinen Baum gab); eigene Wahl „Liste“/„Teilnehmer“ bleibt | ✅ 427.52 |
| T-16 | Turnier beenden (Raster-Formate): EIN Flaggen-Knopf, EIN Klick: Rückfrage mit Hinweis „keine Änderungen und Korrekturen mehr möglich“, beendet und sperrt in einem Zug; Knopf danach weg (Turnier das von selbst endet: derselbe Knopf sperrt nur noch); Zoomgruppe ohne „Zurücksetzen“ | ✅ 427.54 |
| T-17 | Turniergrafik: Kopfzeile mit Knöpfen hat 12 px Abstand zum Baum; Tisch-Labels liegen vollständig im Rahmen (auch oberste Box im einfachen K.o.) und überdecken keine Box | ✅ 427.55 |
| T-18 | Zoom-Knöpfe der Turniergrafik erscheinen am PC auch auf Geräten, die „coarse pointer“ melden (Touch-Laptop); nur ≤ 640 px Breite ersetzt der Einpassen-Knopf rechts die Gruppe | ✅ 427.56 |
| T-19 | Kopfzeilen-Konsistenz über alle Modi und Zustände (K.o., Doppel-K.o., Jeder gegen jeden, Winner Stays Einzel/Doppel × Anmeldung/laufend/beendet/gesperrt) in 4 Größen (1280, 1024, 375, 812×375): feste Reihenfolge Bildschirm-an → QR → Spieler hinzufügen → Start/Start rückgängig/Beenden → Bericht → Löschen; Bildschirm-an-Knopf in jedem Screen an derselben Stelle; Info-Zeile nur aus Symbolen (Format, Disziplin, Modus, Status, Schloss/Stift, Turnierleitung) und einzeilig; kein Überstand | ✅ 427.59 |
| T-20 | Panels QR und Spieler hinzufügen: gleiche Reihenfolge, unabhängig auf-/zuklappbar, in Anmeldung und Winner Stays | ✅ 427.59 |
| T-21 | Winner Stays beendet: Bericht-Knopf in der Kopfzeile springt zum Protokoll; Turnierliste: Turnierleitung als Pfeifen-Symbol | ✅ 427.59 |
| T-22 | Turniergrafik: Abschnittsnamen (Gewinnerbaum, Verliererbaum, Finale) und Tisch-Labels überlappen sich nicht untereinander und keine Box (gemessen an K.o., Doppel-K.o. mit 4 und 8 Spielern) | ✅ 427.60 |
| T-11 | Kopfzeile: Info + Turnierleitung eine Zeile, Umbruch nur bei Platzmangel, Glühbirne | ✅ |
| T-12 | Gast über Turnier-QR (`?turnier=`), Gast-Screens | ⏭️ Fremd-Login/QR nötig |

## 4. Statistik
| ID | Test | Ergebnis |
|---|---|---|
| S-01 | Alle Reiter: Verlauf, Matches, Siege, Tempo, Rating, Aufsteiger, Rekorde | ✅ |
| S-02 | Filter Alle/8/9/10/14-1/Heyball × Einzel/Doppel | ✅ keine Fehler |
| S-03 | Spielerprofil aus der Rangliste öffnen (Erfolge, Zahlen, Angstgegner) | ✅ |
| S-04 | Hinweis „4 gemeldete Matches warten auf Bestätigung“ | ✅ |

## 5. Weitere Menüs
| ID | Test | Ergebnis |
|---|---|---|
| X-01 | Meine Zahlen: Ratings, Rekorde, Gegner, Historie, Fun | ✅ |
| X-02 | Meine Erfolge: 10 Kategorien (inkl. Disziplinen, Ghost, Regelkunde) | ✅ |
| X-03 | Einstellungen: 5 Kapitel, Sprache DE↔EN und zurück | ✅ |
| X-04 | Verwaltung: Matches, Feedback, Mitglieder, Clubs, Standorte, System | ✅ |
| X-05 | Live: Ping-Karte, Duelle, Planung sichtbar | ✅ ⚠️ Herausforderung „Duell am 29.10.“ liegt in der Vergangenheit, zeigt „noch ca. 9 Tage“ (Ablauf, kein Fehler) |
| X-06 | Regelkunde: Suche „Anstoß“, Kapitel | ✅ |
| X-07 | Tutorial „Ganze Tour“ (11 Schritte) | ✅ |
| X-08 | „Du bist dran!“-Popup blockiert Tutorial, bis „Später“ | ✅ gewollt |
| X-09 | Clubs gründen/beitreten, Avatar-Sheet, Menü neu anordnen (Ziehen), Start-Seite | ⏭️ Drag & Drop/Foto brauchen Zeigerereignisse, bisher manuell |

## 6. Technik
| ID | Test | Ergebnis |
|---|---|---|
| Z-01 | Netzwerk: keine Antworten ≠ 2xx in allen obigen Abläufen | ✅ |
| Z-02 | Konsole: keine Fehler außer 12.1 | ✅ |
| Z-03 | Seitenübergänge | ⚠️ nicht prüfbar, Pane spielt keine Animationen |
| Z-04 | Update-Mechanik, Service Worker, Push, Wake Lock | ⏭️ Produktionsbuild/Gerät nötig |

## 12. Gefundene Fehler
1. 🔧 **Zusatzzähler gingen verloren** (behoben in 427.49): `saveMatchCounters` schickte alle neun Schlüssel, auch auf 0. Eine Datenbank ohne `supabase/2026-10-25_ghost_counters.sql` kennt `bank` nicht und lehnte die ganze Anfrage ab („Unbekannter Zusatzzähler: bank“, HTTP 400). Jetzt gehen nur Zähler > 0 raus; auf dem Testsystem verifiziert (`{"fluke":[1,0]}` gespeichert).
   **Offen für Stefan:** Migration `2026-10-25_ghost_counters.sql` auf Test und Prod einspielen, falls noch nicht geschehen (Ghost-Zähler).

## 13. Wiederholen
Messskripte siehe Abschnitt 0; Reihenfolge: Layout-Rundlauf → Match (3 Disziplinen) → Turniere (K.o., Doppel-K.o., Raster, WS) → Statistik/Menüs → Konsole/Netzwerk. Testdaten heißen „ZZ Claude …“ und lassen sich im Turnier-Screen über das Papierkorb-Symbol löschen.
