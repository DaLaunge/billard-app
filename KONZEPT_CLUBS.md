# Konzept: Clubs, Club-Filter und clubübergreifendes Rating

Stand: 2026-10-18 (Version 412.4 auf `test`). Grundlage ist der Ist-Stand im Testprojekt (43 Spieler, davon 16 Mitglieder und 27 Gäste; 730 Matches, 56 Turniere). Das Produktionsprojekt habe ich nicht eingesehen, dort sind Zahlen und Zusammensetzung anders.

Ziel: Die App soll mehrere Clubs tragen. Spieler anderer Clubs benutzen sie bereits heute, landen aber im selben Topf wie der Stammclub. Gewünscht sind ein Club-Filter und langfristig ein Rating, das sich an Fargo orientiert.

---

## 1. Ist-Stand (was heute gilt)

| Bereich | Heute |
|---|---|
| Spieler | `players`: ein Konto, **keine** Club-Angabe. Gäste (`is_guest`) sind Platzhalter ohne Login. |
| Matches / Turniere | Keine `club_id`. Ein Match gehört nur den Spielern. |
| Rating | Ein globaler Topf: `rebuild_elo()` rechnet **alle** Matches neu, bei jeder Änderung (~1 s bei 700 Matches). Start 500, K=4 (8 in den ersten 10 Spielen), Verfall nur über 500. |
| Lesezugriff (RLS) | Alle `SELECT`-Regeln für `matches`, `players`, `ratings`, `rating_snapshots`, `player_badges`, `pings`, `match_counters`, `tournaments` lauten `true` für jeden Angemeldeten. **Wer ein Konto hat, kann alles lesen.** |
| App-Laden | `loadData()` holt Rangliste, Spieler, Pings, Badges, Challenges, Planungen auf einmal. Matches und Snapshots kommen aus lokalen Delta-Caches (wegen des 5-GB-Egress-Limits). |
| Einladung | QR/Link `/?ref=<Code>&vs=<Spieler>` ordnet nur den Werber zu, keinen Club. |

Folgerung: Mit mehreren Clubs trägt weder das Laden („alles für alle“) noch die Rechte-Regel („alles lesbar“) und auch die Neuberechnung (alles für alle neu) nicht beliebig weit.

---

## 2. Entscheidungen, die vorab gebraucht werden

Jede Frage hat meine Empfehlung. Ohne Antwort baue ich nach der Empfehlung.

1. **Rating global oder je Club?** Empfehlung: **ein globales Rating pro Spieler**, der Club ist nur ein Filter. Nur so sind Clubs vergleichbar, sobald jemand clubübergreifend spielt.
2. **Wer sieht wen?** Empfehlung: Rating, Nickname und Platzierung sind **für alle Angemeldeten** sichtbar (damit die globale Rangliste Sinn hat). Matchlisten, Pings, Planungen und Herausforderungen sind **auf gemeinsame Clubs begrenzt**. Ein Match sehen immer seine Beteiligten.
3. **Darf ein Spieler in mehreren Clubs sein?** Empfehlung: ja (`club_members` n:m), dazu ein Hauptclub.
4. **Wer legt Clubs an?** **ENTSCHIEDEN (2026-10-19): jeder angemeldete Spieler (kein Gast)** und wird dadurch Club-Leiter („owner“). Die Leitung lässt sich erweitern (weitere „admin“) und übergeben. Missbrauchsbremse: höchstens 3 geleitete Clubs je Spieler, App-Admins können jeden Club löschen.
5. **Wie kommen Spieler in einen Club?** **ENTSCHIEDEN (2026-10-19), drei Wege, niemand wird ohne eigenes Zutun getaggt:** (a) Einladungs-Code/-Link/QR (`/?club=CODE`, sofort; der Code ist nur für die Leitung lesbar), (b) **Einladung** durch die Leitung, der Spieler bestätigt, (c) **Anfrage** des Spielers, die Leitung bestätigt. Treffen Einladung und Anfrage aufeinander, ist der Spieler sofort drin; eine Absage sperrt dasselbe Paar 30 Tage (`club_requests`).
6. **Spieler ohne Club?** **ENTSCHIEDEN: ausdrücklich normal.** Kein Pflichtfeld, keine Meldung, im Filter „Alle“ wie bisher enthalten; Phase 2 bekommt dafür die Filter-Option „Ohne Club“. Der Bestand wird zum Club „Stammclub“ (Tag HOME) nur mit einem Leiter angelegt, alle anderen treten per Code bei.
7. **Der Club als Tag im Profil:** Kürzel (2–5 Zeichen, eindeutig) + optionale Farbe, erscheint als Pille auf der Identitätskarte (Hauptclub zuerst), später auch neben Namen in Listen.

---

## 3. Datenmodell (Stufe 1)

Neue Tabellen (jede Migration, die eine Tabelle in `public` anlegt, braucht im selben File die `GRANT`s, siehe CLAUDE.md):

```
clubs            id uuid pk, name text (unique, 2-40), tag text (unique, A-Z0-9, 2-5), color text null (#RRGGBB),
                 join_code text unique (nur Leitung lesbar, Spalten-Rechte), created_by, created_at
club_members     club_id fk, player_id fk, role text ('owner'|'admin'|'member'), joined_at   -- pk (club_id, player_id), genau ein owner je Club
```

Neue Spalten:

| Tabelle | Spalte | Bedeutung |
|---|---|---|
| `players` | `home_club_id uuid null` | Hauptclub (für Anzeige und Vorbelegung) |
| `matches` | `club_id uuid null` | Wo gespielt/erfasst wurde. Backfill: Hauptclub des Melders |
| `tournaments` | `club_id uuid null` | Club des Turniers (Pflicht für neue) |
| `pings`, `plannings` | `club_id uuid null` | Sichtbarkeit der Mitspielersuche |

Wichtig: `matches.club_id` ist **kein** Rating-Merkmal. Das Rating rechnet weiter über alle Matches.

Einladung: der Link bekommt einen Club (`/?ref=<Code>&club=<slug>`); bei Registrierung wird das Mitglied in den Club aufgenommen. Wer sich ohne Link registriert, wählt den Club beim Onboarding (oder bleibt ohne Club).

Hilfsfunktionen (alle `STABLE SECURITY DEFINER`, `set search_path`):
- `my_club_ids()` – Clubs des angemeldeten Spielers
- `shares_club(p_player uuid)` – gibt es mindestens einen gemeinsamen Club
- `rangliste_for(p_club uuid default null)` – Rangliste, optional auf Mitglieder eines Clubs gefiltert

---

## 4. Rating

### Stufe 1: globales Elo bleibt
- `elo_anchor_rows()` ändert sich nicht. Der Club-Filter wirkt nur bei der Anzeige: „Rangliste von Club X“ = Rating der Mitglieder von X, **nicht** neu gerechnet.
- Hinweis in der Oberfläche: Ratings aus Clubs ohne gemeinsame Spieler oder Matches sind nur eingeschränkt vergleichbar (jeder Club kreist um 500). Sobald ein Spieler in zwei Clubs spielt, verbindet er sie.
- **Skalierung:** `rebuild_elo()` ist ein Voll-Neuaufbau. Bei vielen Clubs (z. B. 10 000 Matches) wird das zu langsam. Gegenmittel: pro **zusammenhängender Gruppe** (Spieler, die direkt oder indirekt gegeneinander gespielt haben) neu rechnen. Ein neues Match in Club A stößt dann nur die Gruppe von A an.

### Stufe 2: Fargo-artige Berechnung
Wie FargoRate arbeitet, im Kern: Die Skala (100 Punkte = 2:1 bei gewonnenen Spielen) ist bei uns schon identisch (`2^(Δ/100)`). Anders ist die **Rechenart**: FargoRate bestimmt alle Ratings gemeinsam so, dass sie die Ergebnisse **insgesamt** am besten vorhersagen (Maximum-Likelihood), ohne Startwert und ohne Reihenfolge.

Skizze für uns:
1. **Modell:** Wahrscheinlichkeit für einen Gewinn einzelner Spiele `p = 1 / (1 + 2^((Rb − Ra)/100))`. Gewertet werden Spiele (bei uns: Punkte bzw. Racks, begrenzt wie heute durch `nf = min(n, 16)`).
2. **Optimierung:** iteratives Verfahren (Newton oder Gradient) über alle Spiele einer zusammenhängenden Gruppe. Kein Startwert, nur eine Verankerung (Mittelwert der Gruppe = 500).
3. **Verlässlichkeit** („Robustheit“): aus der Krümmung der Likelihood (Fisher-Information) je Spieler, aus der Menge und Aussagekraft der Spiele (Spiele gegen Gleichstarke zählen mehr). Das **ersetzt** die feste Grenze „unter 10 Spielen = vorläufig“, und der Anfänger-K wird überflüssig.
4. **Grenzfälle:** Wer nur gewinnt oder nur verliert, hätte ein unendliches Rating. Gegenmittel: wenige Pseudo-Spiele gegen den Durchschnitt (Rückzug zur Mitte).
5. **Betrieb:** nächtlicher Lauf als Edge Function (Postgres ist für Iteration ungeeignet), dazwischen das jetzige Elo als **Live-Vorschau**, damit man nach einem Match sofort etwas sieht.
6. **Offen:** Verfall bei Inaktivität (Fargo-Verhalten nicht geprüft), Gewichtung neuerer Spiele, Doppel.

Bedingung für Stufe 2: genug Clubs **mit gemeinsamen Spielern**. Davor liefert sie nichts Besseres als Elo, nur mehr Aufwand. Die Simulation für Entscheidungen (Anfänger-K usw.) lässt sich mit Daten mehrerer Clubs wiederholen.

---

## 5. Sichtbarkeit und Rechte (Stufe 3)

Heute: alles lesbar. Vorschlag, sobald Clubs real getrennt sein sollen:

| Daten | Wer liest |
|---|---|
| `players` (Nickname, Farbe, Motto, Avatar) | alle Angemeldeten |
| `ratings`, `rating_snapshots`, `player_badges` | alle Angemeldeten (globale Rangliste) |
| `matches`, `match_counters`, `match_confirmations` | die Beteiligten und Mitglieder gemeinsamer Clubs von `matches.club_id` |
| `tournaments` und Teilnehmer | Mitglieder des Turnierclubs |
| `pings`, `plannings`, `challenges` | Mitglieder gemeinsamer Clubs (Challenges: Beteiligte) |
| Verwaltung (Admin) | App-Admins global, Club-Admins nur für ihren Club |

Umsetzung: neue `SELECT`-Regeln mit `my_club_ids()`; die bisherigen `true`-Regeln fallen weg. **Das ist der riskanteste Schritt** (eine falsche Regel sperrt die App oder gibt zu viel preis). Deshalb: erst auf Test mit mehreren Testkonten aus verschiedenen Clubs, dann Prod. Admin-Funktionen (`SECURITY DEFINER`) bleiben unberührt.

---

## 6. App-Änderungen

1. **Club-Auswahl:** im Menü oben „Alle · Stammclub · …“ (Voreinstellung = Hauptclub), pro Gerät in `localStorage`.
2. **Statistik:** die bestehende Filter-Karte (`StatFilterContent`) bekommt eine Zeile „Club“; Rangliste, Bestenlisten, Aufsteiger und Verlauf folgen ihr.
3. **Neues Match:** Gegnerliste = Mitglieder der gewählten Clubs; Suche findet auch andere Clubs („Auch aus anderen Clubs“). Beim Speichern wird `club_id` gesetzt.
4. **Turniere / Winner Stays / Mitspielersuche:** an den Club gebunden.
5. **Profil:** Club-Chips auf der Identitätskarte (die Zeile in „Auf einen Blick“ ist schon vorgesehen), Clubwechsel in den Einstellungen.
6. **Einladung/QR:** trägt den Club mit.
7. **Laden:** `loadData()` fragt nur noch die gewählten Clubs ab (RPCs wie `rangliste_for`, `matches_sync` mit Club-Parameter). Die Delta-Caches (`matchCache`, `snapshotCache`, `counterCache`) bekommen den Club im Schlüssel, `CACHE_VERSION` erhöhen.
8. **Erfolge:** „Vereinsheld“ & Co. bleiben global; neue Club-Erfolge (Mitglied, Club-Turnier gewonnen) als Gruppe.
9. **Texte:** jede neue Zeichenfolge bekommt ihre englische Übersetzung (`i18n.js`).

---

## 7. Phasenplan

| Phase | Inhalt | Migration | Risiko |
|---|---|---|---|
| **0** | Entscheidungen aus Abschnitt 2 | – | – |
| **1** | **gebaut (412.5):** Datenmodell `clubs`/`club_members`, Spalten, RPCs (gründen, beitreten per Code, Rollen, Leitung übergeben, entfernen, löschen), Karte „Clubs“ unter Profil bearbeiten, Tag auf der Identitätskarte, App-Admin-Moderation, `/?club=CODE` | `2026-10-19b_clubs.sql` | niedrig (additiv, nichts bricht) |
| **2** | Club-Filter in Statistik, Club-Auswahl im Menü, Gegnerliste, `club_id` beim Speichern, Profil-Chips | – (App) | niedrig |
| **3** | Begrenztes Laden und Rechte (RLS), Caches pro Club | `…_clubs_rls.sql` | **hoch**, eigener Test mit mehreren Konten |
| **4** | Rating pro zusammenhängender Gruppe berechnen (Skalierung) | `…_rebuild_per_group.sql` | mittel |
| **5** | Fargo-artige Berechnung + Verlässlichkeitsmaß | Edge Function + Tabellen | mittel, nur mit genug Verbindungen |

Phase 1 und 2 sind mit jeder Antwort aus Abschnitt 2 vereinbar und können sofort beginnen. Ab Phase 3 hängt der Bau an den Entscheidungen 2 und 4.

Jede Migration: Test, danach Prod, mit Rückfall-Hinweis im Kopf des Files. Neue Tabellen mit `GRANT`s und RLS im selben File.

---

## 8. Risiken

- **Bestehende Fremdclub-Spieler** (Produktion): Wer wo spielt, steht nirgends in den Daten. Die Zuordnung muss von Hand oder per Selbstauswahl erfolgen. Bis dahin bleiben sie „ohne Club“.
- **Datenschutz:** Heute sieht jeder alles. Mit der Öffnung für Fremdclubs sollte bewusst entschieden werden, was sichtbar bleibt (Abschnitt 5), und die Datenschutzerklärung/das Impressum angepasst werden.
- **Egress:** Sobald viele Clubs laden, sprengt „alles für alle“ das Gratis-Limit schnell. Phase 3 ist deshalb mehr als nur Sicherheit.
- **Rating-Vergleichbarkeit:** Ohne Verbindung zwischen Clubs sind Zahlen verschiedener Clubs nicht gleichwertig; die Oberfläche muss das ehrlich sagen.
- **Anfängerbonus:** gilt global je Spieler und Disziplin; ein Spieler, der in einen neuen Club wechselt, ist kein „Anfänger“ (er hat seine Spiele schon).

---

## 9. Quellen zu FargoRate

- https://fargorate.com/
- https://drdavepoolinfo.com/faq/rating/fargorate/
- https://billiards.colostate.edu/resource_files/Mike_Page_FargoRate_description.pdf
