# Regelkunde: das Regelwerk (strukturiert) und seine Animationen

Dieses Dokument ist die **inhaltliche Grundlage** für `src/lib/rules/` (die Animationsfälle). Es fasst alle Regeln aus den Unterlagen zusammen, **in eigenen Worten**, mit Fundstelle. Was hier nicht steht, soll es auch nicht als Animation geben; was als Animation existiert, steht hier mit Fall-ID.

## 0. Quellen, Vorrang, Lesehilfe

| Kürzel | Dokument | Stand | Rolle |
|---|---|---|---|
| **S26** | ÖPBV/WPA „Offizielle Poolbillard Regeln“ (Spielregeln) | gültig ab 12.02.2026 | **maßgeblich** für alles Spielerische |
| **OS19** | ÖPBV Lehr- & Prüfunterlagen für Oberschiedsrichter (Normenkatalog, Turnierregeln, Schiedsrichteranweisungen, Spielregeln, Tätigkeiten) | Okt. 2019 | ältere Regelfassung; **Spezialfälle** und Turnierpraxis, wo S26 schweigt |
| **WR16** | WPA „Die Regularien“ (Kleiderordnung, Aufbauhilfe, Zeit, Proteste, Schiedsrichter) | 29.07.2016 | ergänzend, das ÖPBV-Sportreglement hat Vorrang |
| **NK** | ÖPBV Normenkatalog (nach EPBF-Standard 11/2009, Version 08.10) | – | Tisch, Kugeln, Beleuchtung, Zubehör |
| **REG** | ÖPBV „Regularien für Schiedsrichter und Oberschiedsrichter“ (Version 02.12) | – | Prüfung, Disziplinarmaßnahmen, Tisch-/Area-Schiedsrichter |
| **DP** | „Doppel – Stoßwechsel-Regeln“ | – | Doppel |
| **S16** | WPA/ÖPBV Spielregeln (deutsche Übersetzung) | 29.07.2016 | nur zum Vergleich (z. B. 9-Ball-Rack) |

Vorrang bei Widerspruch: ÖPBV-Sportreglement (nationale Bewerbe) vor Spielregeln vor Regularien; die englische WPA-Fassung gilt im Zweifel vor der deutschen. **Widersprüche zwischen den Dokumenten stehen gesammelt in Abschnitt 10** und sind in den Regeln mit ⚠ markiert. Fundstellen in Klammern, z. B. (S26 3.2) = Spielregeln 2026 Regel 3.2, (OS19 3.37) = Lehrunterlagen 2019 Abschnitt 3.37.

---

## 1. Begriffe und Tisch

### 1.1 Teile des Tisches und Linien (S26 2.1, OS19 1.5, 3.15)
- Der Tisch hat Außenbanden, Innenbanden, Spielfläche und sechs Taschen. **Fußende** = dort, wo normalerweise aufgebaut wird; **Kopfende** = von dort wird angestoßen.
- Vier gedachte Achsen: **Längsachse** (mittig durch den Tisch), **Kopflinie** (ein Viertel der Länge vom Kopfende), **Fußachse** (ein Viertel vom Fußende), **Mittelachse** (zwischen den Mitteltaschen).
- Punkte: **Fußpunkt** (Längsachse × Fußachse), **Kopfpunkt** (Längsachse × Kopflinie), **Mittelpunkt** (Längsachse × Mittelachse).
- **Kopffeld** = Bereich zwischen Kopfbande und Kopflinie; **die Kopflinie selbst gehört nicht dazu**. Eine Kugel mit dem Mittelpunkt genau auf der Kopflinie ist spielbar; die Weiße darf bei Ball in Hand im Kopffeld nicht mit dem Mittelpunkt auf der Linie liegen (OS19 3.15).
- **Zurücksetzungslinie** = Längsachse zwischen Fußpunkt und Fußbande (zum Wiedereinsetzen). Die Banden tragen 18 **Diamanten** (ein Viertel der Breite, ein Achtel der Länge).
- Auf dem Tisch müssen eingezeichnet sein (OS19 1.5): eine dünne Linie um die äußeren Ecken des Dreiecks (zum genauen Aufbau und zur Beurteilung, ob eine Kugel im Dreieck liegt), die Linie Fußpunkt–Fußbande, die Kopflinie sowie Kopfpunkt, Mittelpunkt und Fußpunkt (Kopf- und Mittelpunkt nur, wenn die Disziplin sie braucht).

### 1.2 Definitionen (S26 2.2–2.20)
- **Versenkte Kugel** (2.2): sie kommt in der Tasche unterhalb der Spielfläche zur Ruhe oder fällt in den Ballrücklauf. Eine am Taschenrand hängende Kugel, die nur von einer anderen Kugel gestützt wird, gilt als versenkt, wenn sie fiele, sobald man die stützende Kugel wegnimmt (der Schiedsrichter sieht von oben, OS19 3.32). Eine Kugel, die am Taschenrand **fünf Sekunden oder länger** scheinbar still liegt, gilt **nicht** als versenkt, auch wenn sie später fällt; in dieser Zeit darf kein Stoß erfolgen. Eine Objektkugel, die aus der Tasche zurück auf den Tisch springt, ist nicht versenkt; **berührt die Weiße eine schon versenkte Kugel, gilt die Weiße als versenkt.** Volle Taschen leert der Schiedsrichter, die Verantwortung bleibt beim Spieler.
- **Anstoß** (2.3): Eröffnungsstoß eines Spiels oder Racks, mit der Weißen von hinter der Kopflinie in die aufgebauten Kugeln.
- **Weiße** (2.4): beide Spieler benutzen dieselbe Weiße (auch sie kann Logo oder Punkte tragen).
- **Vom Tisch gesprungen** (2.6, OS19 3.27): eine Kugel, die irgendwo außer auf der Spielfläche zur Ruhe kommt (Bande, Tischkante, Boden, auch wenn ein Gegenstand wie Lampe, Kreide oder Spieler sie zurückgelenkt hat). Läuft eine Kugel nur auf der Oberkante der Bande entlang oder springt auf die Bande und kehrt aus eigener Kraft zurück, ist sie nicht gesprungen.
- **Bande anlaufen** (2.7): Eine Bandenberührung zählt, wenn die Kugel die Bande vor dem Stoß nicht berührt hat und im Stoß berührt. Liegt sie zu Beginn **press** an einer Bande, muss sie diese zuerst verlassen und dann diese oder eine andere Bande erneut anlaufen. Eine versenkte oder vom Tisch gesprungene Kugel gilt als hätte sie eine Bande berührt. Eine Kugel gilt erst als press liegend, wenn der Schiedsrichter, der Gegner oder der Spieler es **angesagt** hat (WR16 28: der Schiedsrichter prüft Bandennähe sorgfältig, der Spieler darf die Prüfung verlangen).
- **Aufnahme** (2.8): der Zeitraum, in dem ein Spieler an der Reihe ist; sie endet nach einem Stoß, wenn er nicht mehr weiterspielen darf. Lehnt ein Spieler die Aufnahme ab (z. B. nach Push Out), muss der Gegner spielen.
- **Jump Shot** (2.9, OS19 3.26): erlaubt ist, das Queue hinten anzuheben und die Weiße nach unten gegen die Spielfläche zu stoßen, sodass sie abspringt. Verboten ist ein absichtliches Anheben durch Treffen unterhalb der Mitte (OS19 3.25, in der Praxis fast immer Foul).
- **Abrutschen** (2.11): die Pomeranze rutscht von der Weißen ab. Foul nur, wenn dabei ein klarer seitlicher Kontakt der Ferrule erkennbar ist. Ein unabsichtliches Abrutschen, das die Weiße abheben lässt (auch über eine Kugel), gilt als regulärer Jump Shot; absichtlich ist es unsportlich (3.16 c).
- **Position einer Kugel** (2.13, OS19 3.11): bestimmt ihr **Mittelpunkt** von oben gesehen.
- **Stoß** (2.19): beginnt, wenn die Pomeranze die Weiße bei einer Vorwärtsbewegung berührt; endet, wenn sich keine Kugel mehr bewegt oder dreht. Regelgerecht, wenn dabei kein Foul begangen wurde.
- **Sicherheitsstoß** (2.16): bei Ansagespielen kündigt der Spieler vor dem Stoß „Sicherheit“ an; danach wechselt die Aufnahme.
- **Rack**, **Wiedereinsetzen**, **Wiederherstellen einer Position**, **Satz**, **Match**, **Disziplin**: siehe Abschnitte 3 und 5.

---

## 2. Ausrüstung und Tisch (NK, OS19 0.x, WR16 4)

**Tisch** (NK): Spielfläche 9-Fuß 2,54 × 1,27 m, 8-Fuß 2,34 × 1,17 m (Toleranz je + 3,175 mm), gemessen von Bandenkante zu Bandenkante und mittig. Höhe Spielfläche 74,3–78,7 cm (⚠ OS19: 75–85 cm). Schieferplatte mindestens 2,54 cm dick, Stoß zwischen den Platten höchstens 0,13 mm, waagrecht (Toleranz 0,51 mm längs, 0,25 mm quer). Rahmen inkl. Bande 10,16–19,05 cm breit; 18 Diamanten (oder 17 plus Typenschild), Abstand 31,75 cm (9-Fuß) bzw. 29,20 cm (8-Fuß), 9,37 cm von der Bandenkante. Bandenhöhe 35,75–36,89 mm (OS19: 36 ± 1 mm); der Gummi muss einen kontrollierten Stoß ohne Effet viermal über die Tischlänge laufen lassen, ohne dass der Ball springt. Taschen: Facings 1,59–6,35 mm dick, Öffnung 12,7–13,02 cm (Ecktaschen, OS19 innen 105–115 mm), Einfalltaschen müssen mindestens 6 Kugeln aufnehmen; Ballrücklauf ist zulässig.
**Tuch**: fusselfrei, mindestens 70 % Wolle, unter 30 % Nylon; anerkannt Simonis 760/860, Zobrekis Z9; erwünscht Powder-/Slate-/Tournamentblue.
**Kugeln**: Phenolharz, 57,15 mm (+ 0,127 mm), 156–170 g, weder poliert noch gewachst; Satz = weiße Spielkugel + 15 Objektkugeln. Farben: 1 gelb, 2 blau, 3 rot, 4 violett, 5 orange, 6 grün, 7 bordeaux, 8 schwarz; 9–15 weiß mit farbigem Band in denselben Farben; 6 und 9 unterstrichen. TV-Sätze (4/12 rosa, 7/15 braun) erlaubt. Anerkannt: Aramith (Super Tournament, Premium, Premier), Brunswick (Centennial, Heritage).
**Dreieck**: bevorzugt Holz (Plastik biegt sich). Der ÖPBV erlaubt Tappen der Ballauflage und Magic Ball Racks.
**Aufbauhilfe** (WR16 4): darf bei 8-, 9- und 10-Ball verwendet werden, **nicht bei 14/1**; aus Kunststoff, höchstens 0,14 mm dick, nicht aufgeklebt; eine senkrechte Positionslinie muss eingezeichnet sein. Nach dem Anstoß entfernt der Schiedsrichter sie möglichst schnell, ohne eine Kugel zu berühren; sie darf nur entfernt werden, wenn sie von höchstens zwei Kugeln blockiert ist (Ausnahme: press liegende Kugeln); Ballmarker oder Kreide markieren die Kugeln, danach wieder an die alte Position legen.
**Queue**: mindestens 1,016 m, höchstens 25 oz (708,75 g), Tip höchstens 14 mm, Leder oder Phenolic; Metallferrulen höchstens 2,54 cm. Ein Jump-Queue mindestens 104 cm (OS19). **Hilfsqueue** (Brücke): pro Tisch ein normales (Kerbenhöhe 45–55 mm) und ein hohes (75–90 mm), mindestens 3 Führungskerben; höchstens zwei gleichzeitig, nur zur Queueführung (S26 1.4, OS19 1.3).
**Kreide**: passend zur Tuchfarbe (blau/grün). **Puder** in vernünftigem Maß; Handschuh erlaubt.
**Beleuchtung**: Spielfläche inkl. Banden an jedem Punkt mindestens 520 Lux (OS19: 500), blendfrei (ab 5000 Lux direkter Einstrahlung geblendet), außerhalb mindestens 50 Lux; starre Lampen mindestens 1,65 m, Pendelleuchten mindestens 1,02 m über der Spielfläche.
**Raum**: Temperatur im Spielbereich mindestens 19 °C; Abstand der Tischkante zu Gegenständen unter 70 cm Höhe mindestens 125 cm (erwünscht 150), zu höheren Hindernissen mindestens 150 cm (erwünscht 170), zu Sitzgelegenheiten mindestens 110 cm (erwünscht 130); WPA/EPBF verlangen 1,83 m zwischen Tischen.
**Pflichten**: Die Ausrüstung muss vor dem Spiel geprüft werden; danach darf sie nicht mehr infrage gestellt werden (außer Gegner und Turnierleitung sind sich über Beanstandung und Abhilfe einig; S26 1.4, OS19 1.2, WR16 12). Ausrüstung darf nicht zweckentfremdet werden (z. B. Kreide zum Erhöhen der Hand), Kugeln dürfen nicht als Messhilfe dienen (Ausnahme: Ausspielen).

---

## 3. Spielablauf (allgemein)

### 3.1 Verantwortung und Zeit
- Der Spieler kennt alle Regeln, Regularien und Zeitpläne seines Wettbewerbs; die Verantwortung liegt zuletzt bei ihm (S26 1.1, OS19 1.1).
- **Verspäteter Beginn** (OS19 1.7, WR16 22): wer 15 Minuten nach Beginn (oder dem dritten Aufruf) nicht bereit ist, verliert das Match; Aufrufe nach 5, 10, 14 Minuten (letzter mit Hinweis auf Disqualifikation binnen einer Minute).
- **Zeitspiel / Shot Clock** (S26 3.14, OS19 1.11, WR16 20): Spielt jemand zu langsam, darf der Schiedsrichter zur Eile anweisen und dann ein Zeitlimit für beide verhängen. Empfohlen 35 s pro Stoß plus einmal 25 s Verlängerung pro Spiel, 10 Sekunden vor Ablauf „Time“; OS19: höchstens 50 s je Stoß, nach dem Anstoß 60 s. Die Zeit läuft ab Stillstand aller Kugeln (bei Ball in Hand ab Besitz der Weißen und fertigem Aufbau) bis zur Berührung der Weißen. Überschreiten = Standardfoul, bei absichtlicher Verzögerung 3.16.
- **Time-out** (OS19 1.13, WR16 14): ⚠ OS19: bis zu 5 Minuten pro Match zwischen den Racks (im Entscheidungssatz erneut); WR16: nur bei Partien über 9 (8-Ball) bzw. 13 (9-Ball) Gewinnspiele. Der Tisch wird als angehalten gekennzeichnet (Queue quer über den Tisch), üben ist verboten. Beim 14/1 darf der Spieler am Tisch seine Aufnahme fortsetzen, wenn der Gegner sein Time-out nimmt (mit Schiedsrichter am Tisch).
- **Kein Üben** während des Matches, auch nicht an einem anderen Tisch; ein Stoß, der nicht zum Match gehört, ist Foul (OS19 1.8; S26 3.16 e).
- **Keine Hilfe / Coaching** (OS19 1.9, 2.23; WR16 24): ⚠ OS19: Zuschauer um Rat fragen verliert das Game (beim 14/1 minus 15), Coaching auch im Time-out nicht erlaubt; WR16: begrenztes Coaching vom Trainer möglich, im Time-out erlaubt, der Trainer darf sich dem Tisch nicht nähern. Es gilt, was der Veranstalter festlegt.
- **Sitzenbleiben** (OS19 1.10, 2.22; WR16 26): Nach der Aufnahme setzt sich der Spieler auf seinen Sitz; Verlassen nur mit Erlaubnis des Schiedsrichters.
- **Kleiderordnung** (WR16 3): gepflegt, Hemd/Polo in der Hose, Anzugschuhe; keine Jeans, T-Shirts, Turnschuhe, Sandalen; Damen Schultern bedeckt, Rock über die Knie. Der Turnierleiter entscheidet.

### 3.2 Ausspielen und Anstoßrecht (S26 1.2, 1.3; OS19 3.5, 3.6, 3.35; WR16 15)
→ Animation `ausspielen`.
- Der Schiedsrichter legt je eine Kugel auf jede Seite des Kopffeldes nahe der Kopflinie (ein Spieler links, einer rechts vom Kopfpunkt). Beide stoßen ungefähr gleichzeitig gegen die Fußbande zurück; wessen Kugel nach Stillstand näher an der Kopfbande liegt, gewinnt und bestimmt, wer anstößt.
- **Verloren** ist das Ausspielen, wenn die eigene Kugel über die Längsachse rollt, die Fußbande mehr als einmal berührt, in eine Tasche fällt oder vom Tisch springt, eine Seitenbande berührt oder in der Ecktasche hinter der Kante der Kopfbande liegt; auch ein Foul auf die Weiße verliert (Ausnahme 3.9 „sich bewegende Kugeln“).
- **Wiederholen**, wenn ein Spieler stößt, nachdem die Kugel des anderen schon die Fußbande berührt hat, wenn der Schiedsrichter nicht entscheiden kann, welche näher liegt, oder wenn beide einen Fehler machen.
- In Spielen mit Punkten pro Rack (z. B. 9-Ball) wechselt der Anstoß (S26 1.3); der Veranstalter darf abweichen: Sieger stößt an, Verlierer stößt an, Anstoßserien (WR16 15, OS19 3.35). Beim 8-Ball stößt grundsätzlich der Sieger des letzten Spiels an.

### 3.3 Ball in Hand, Lageverbesserung (S26 1.6, OS19 3.9, 3.39, 4.9)
- Der Spieler darf die Weiße **überall** auf der Spielfläche platzieren und so lange verlegen, bis er stößt; er darf jeden Teil des Queues einschließlich der Pomeranze benutzen, aber keine nach vorn gerichtete Stoßbewegung machen. Liegt die Weiße „in Position“, ist danach jede Stoßbewegung, bei der sie berührt wird, ein Foul, wenn der Stoß nicht korrekt ist (OS19 3.39, 5.15).
- Bei Lageverbesserung **aus dem Kopffeld** (Anstoß, 8-Ball nach Anstoßfoul, 14/1 nach Scratch) siehe Fouls 3.10 und 3.11. Liegen alle für den Spieler zulässigen Kugeln hinter der Kopflinie, darf er verlangen, dass die der Kopflinie nächste Kugel auf den Fußpunkt gesetzt wird; bei Gleichstand wählt er (S26 1.6, OS19 6.7 Nr. 7).
- Platziert der Spieler die Weiße unabsichtlich außerhalb des Kopffeldes, muss ihn der Schiedsrichter warnen; stößt er trotz Warnung, ist es ein Foul (OS19 2.21, 3.9). Ohne Warnung gilt der Stoß als korrekt.

### 3.4 Ansagespiele (S26 1.7, OS19 2.8)
- Bei Ansagespielen (8-Ball, 10-Ball, 14/1) sagt der Spieler **Kugel und Tasche** an, es sei denn, beides ist offensichtlich; Bandenzahl oder Kombinationen müssen nicht angesagt werden, **pro Stoß nur eine Kugel**. Damit ein angesagter Stoß zählt, muss der Schiedsrichter überzeugt sein, dass er so ausgeführt wurde, wie er gedacht war. Bei Unklarheit (Banden, Kombinationen) sollte der Spieler ansagen; Gegner und Schiedsrichter dürfen nachfragen. Sagt der Schiedsrichter falsch an, muss der Spieler ihn vor dem Stoß korrigieren.
- **Sicherheit** statt Kugel und Tasche: der Gegner übernimmt nach dem Stoß den Tisch; was mit versenkten Kugeln geschieht, regelt die Disziplin (8-Ball: bleiben unten, 14/1: wieder aufbauen, 10-Ball: keine Sicherheitsansage). Wird eine Sicherheit nicht angesagt und fällt eine Kugel des Spielers, muss er weiterspielen (OS19 5.13).
→ Animationen `sicherheit`, `falsche-tasche`.

### 3.5 Zur Ruhe kommende, bewegte und gefallene Kugeln (S26 1.8, OS19 3.30)
- Kleine Restbewegungen scheinbar stehender Kugeln gehören zum Spiel; die Kugel bleibt, wo sie zur Ruhe kommt. Fällt sie dabei in eine Tasche, wird sie so nah wie möglich an ihrer letzten Position zurückgelegt (OS19: wenn sie zuvor mindestens 5 Sekunden ruhte).
- Fällt eine Kugel während oder kurz vor einem Stoß von selbst und das hat Auswirkung auf den Stoß (die Weiße kann sie nicht mehr treffen), stellt der Schiedsrichter die Position vor dem Stoß wieder her, der Stoß wird wiederholt, **ohne Strafe** (auch nicht für das Spielen bei noch bewegten Kugeln).
→ Animationen `kugel-faellt-von-selbst`, `taschenrand`.

### 3.6 Wiederherstellen, Störungen, höhere Gewalt (S26 1.9, 1.10; OS19 2.17, 2.18, 3.34; WR16 11, 23, 25)
- Das Zurücklegen von Kugeln ist ausschließlich Sache des Schiedsrichters; er darf Hilfsmittel nutzen und Spieler befragen, entscheidet aber allein; jeder Spieler darf die Entscheidung **einmal** hinterfragen.
- **Störung von außen** während des Stoßes mit Wirkung auf den Stoß: Position wie vor dem Stoß, Stoß wiederholen. Ohne Wirkung: nur die betroffenen Kugeln zurücklegen, weiterspielen. Lässt sich nicht mehr zurücklegen: wie Patt; beim 14/1 stoßen beide neu aus, neu aufbauen, Punktestand bleibt (OS19 3.34).
- **Höhere Gewalt** (Lampe fällt, Stromausfall, Umzug auf anderen Tisch): der Schiedsrichter entscheidet nach bestem Wissen, ggf. Patt (WR16 25).
→ Animation `stoerung-von-aussen`.

### 3.7 Entscheidungen, Proteste (S26 1.11; OS19 2.2–2.4, 2.26; WR16 7)
- Eine Schiedsrichterentscheidung über **Tatsachen** ist endgültig. Glaubt ein Spieler, die **Regel** sei falsch angewendet, kann er Protest einlegen (nächst höheres Organ: Hauptschiedsrichter, dann Turnierleitung); der Schiedsrichter unterbricht das Spiel solange. Ein Spieler darf dieselbe Entscheidung nur einmal hinterfragen (zweimal = unsportlich, WR16 7).
- **Fouls müssen sofort benannt werden**; Protest und Regelanfrage müssen **vor dem nächsten Stoß** erfolgen (S26 Kap. 3, OS19 2.26).
→ Animation `foul-zu-spaet`.

### 3.8 Aufgabe, Patt (S26 1.12, 1.13; OS19 1.14, 5.21, 1.15)
- **Aufgabe** = Matchverlust (z. B. Queue auseinanderschrauben, solange der Gegner mit dem aktuellen Rack gewinnen kann; nicht beim Umschrauben für einen Jump).
- **Patt**: Sieht der Schiedsrichter keinen Fortschritt, kündigt er Patt an. Stimmen beide zu, gilt es sofort, sonst hat jeder noch drei Aufnahmen. Folge je Disziplin: 8-, 9-, 10-Ball: neu beginnen, der ursprüngliche Anstoßer stößt wieder an; 14/1: neuer Eröffnungsstoß, beide stoßen neu aus. OS19 5.21 (8-Ball): nur wenn noch zwei Farbige und die 8 liegen; der Schiedsrichter gibt die Absicht sechs Stöße vorher bekannt.
- Abgebrochene Matches werden nicht statistisch gewertet; hohe Serien zählen für Prämien (OS19 1.15).

### 3.9 Spielen ohne Schiedsrichter (OS19 1.16, WR16 5, 21)
- Der Spieler, der nicht am Tisch ist, übernimmt die Aufgaben des Schiedsrichters; vor einem strittigen Stoß kann er einen Dritten (Turnierleitung, Regelkundigen) rufen (Ablehnung durch den Spieler am Tisch möglich, außer Turnierleitung). Streit entscheidet Schiedsrichter oder Turnierleitung; gibt es **keinen Beweis** außer der Behauptung, wird angenommen, dass kein Foul vorlag (WR16 5).
- Vereinbarbar: „nur Fouls mit der Weißen“: Berühren anderer Kugeln ist dann nur Foul, wenn der Stoß beeinflusst wird (WR16 21); bei Jumps, Bogen- und Kopfstößen ist es Foul, wenn sich dabei eine nicht anspielbare Kugel bewegt (OS19 4.11, 5.5).
- Beim Aufbau ohne Schiedsrichter dürfen Spieler das Dreieck benutzen, um zu prüfen, ob eine Kugel im Dreieck liegt (OS19 1.3).

### 3.10 Wiedereinsetzen von Kugeln (S26 1.5, 2.20; OS19 2.13, 3.31)
- Eine einzelne Kugel kommt auf die Längsachse **so nah wie möglich am Fußpunkt Richtung Fußbande**, ohne andere Kugeln zu bewegen. Geht das nicht, wird sie (wenn möglich) press an im Weg liegende Kugeln gesetzt; ist die **Weiße** im Weg, nicht press, ein kleiner Abstand bleibt. Ist der ganze Raum hinter dem Fußpunkt belegt, wird oberhalb des Fußpunktes so nah wie möglich aufgebaut. ⚠ OS19 3.31: mehrere Kugeln in aufsteigender Nummernfolge, die erste auf den Fußpunkt, nicht press aneinander; reicht der Platz nicht, Richtung Mittelpunkt, die niedrigste Nummer am nächsten. Der Schiedsrichter legt Kugeln mit der Zahl nach oben ein (OS19 2.13).

### 3.11 Parasport (S26 1.14)
- Regeln in Entwicklung; aktuelle Details in Regel 30 der WPA-Regularien.

---

## 4. Fouls

### 4.1 Grundsätze
- Mehrere Fouls in einem Stoß: nur das **schwerste** zählt (S26 3, OS19 3.29). Pro Aufnahme zählt nur ein Foul.
- Wird ein Foul **nicht erkannt, bevor der nächste Stoß ausgeführt ist, gilt es als nicht begangen** (S26 3). → `foul-zu-spaet`
- Allgemeine Folgen eines Fouls (OS19 3.16): die Aufnahme endet; versenkte Kugeln werden nicht gewertet; sie werden nur aufgebaut, wenn die Disziplin es verlangt.
- Der Schiedsrichter sagt Fouls sofort, laut und deutlich an und weist darauf hin, dass der Gegner die Weiße frei platzieren darf, wenn das zutrifft (OS19 2.9). Er darf einen Spieler **nicht** auf einen möglicherweise unkorrekten Stoß aufmerksam machen (OS19 8.3 Nr. 7), **muss aber warnen**, bevor jemand ein schwerwiegendes Foul begeht (drittes Foul, Rat vom Publikum, Weiterspielen nach Fouldurchsage); sonst gilt das Foul als normales (OS19 2.16).

### 4.2 Der Foulkatalog (S26 3.1–3.16)
| Nr. | Foul | Inhalt | Animation |
|---|---|---|---|
| 3.1 | Weiße in der Tasche / vom Tisch | Fällt die Weiße oder springt sie vom Tisch: Foul, auch wenn im selben Stoß eine Kugel regulär fällt. | `weisse-versenkt` |
| 3.2 | Falsche Kugel | Wo eine bestimmte Kugel oder Gruppe zuerst getroffen werden muss, ist jede andere zuerst berührte Kugel Foul. Trifft die Weiße ungefähr gleichzeitig eine zulässige und eine unzulässige Kugel und lässt sich nicht feststellen, welche zuerst, gilt die **zulässige** (OS19 1.16.4, WR16 27: im Zweifel für den Spieler). | `erste-beruehrung`, `gleichzeitiger-treffer` |
| 3.3 | Keine Bande nach der Karambolage | Wird keine Kugel versenkt, muss die Weiße eine Objektkugel berühren und danach mindestens eine Kugel (Weiße oder Objektkugel) eine Bande anlaufen; sonst Foul. Berührt die Weiße ungefähr gleichzeitig eine gültige Kugel und eine Bande, gilt die Kugel zuerst. | `nach-treffer-bande`, `bande-vor-dem-treffer`, `press-bande` |
| 3.4 | Kein Fuß auf dem Boden | Im Moment des Kontakts muss mindestens ein Fuß den Boden berühren. | offen (Figur) |
| 3.5 | Kugel springt vom Tisch | Foul; ob wieder aufgebaut wird, regelt die Disziplin. | `kugel-vom-tisch` |
| 3.6 | Berühren der Kugeln | Jede Berührung, Bewegung oder Lauf-Änderung einer Kugel außer dem normalen Kugelkontakt im Stoß ist Foul; bei der Weißen auch außer dem Verlegen bei Ball in Hand und dem normalen Tip-Kontakt. Der Spieler haftet für Kreide, Brücken, Kleidung, Haare, Körper, Weiße beim Verlegen. Unabsichtlich = Standardfoul, absichtlich = 3.16. | offen (Hand) |
| 3.7 | Durchstoß / press liegende Kugeln | Berührt das Queue die Weiße mehr als einmal: Foul. Liegt die Weiße nahe an einer Kugel (nicht press): Foul, wenn die Pomeranze noch Kontakt hat, während die Weiße die Kugel schon berührt; streift sie die Kugel nur leicht, gilt der Stoß als korrekt. Press liegende Weiße darf in Richtung einer zulässigen Kugel gespielt werden (die Kugel gilt als getroffen); sie gilt aber erst als press liegend, wenn angesagt (der Spieler muss die Ansage einfordern). Spielt er von der Kugel weg, gilt sie als nicht getroffen. | `doppelstoss` |
| 3.8 | Schieben | Länger als beim normalen Stoß Kontakt zwischen Pomeranze und Weißer. | offen (Queue) |
| 3.9 | Sich noch bewegende Kugeln | Stoß, während sich noch Kugeln bewegen oder drehen. | `bewegende-kugeln` |
| 3.10 | Falsches Positionieren der Weißen | Muss die Weiße aus dem Kopffeld gespielt werden: Foul, sie genau auf der Kopflinie oder davor zu spielen. | `kopflinie` |
| 3.11 | Unkorrektes Spiel aus dem Kopffeld | Liegt die erste angespielte Kugel ebenfalls im Kopffeld, ist es Foul, außer die Weiße hat das Kopffeld vorher verlassen. Die Weiße muss die Kopflinie überqueren oder eine Kugel außerhalb des Kopffeldes treffen. Absichtlich = 3.16. | `spiel-aus-dem-kopffeld` |
| 3.12 | Stoßen außerhalb der Aufnahme | Unabsichtlich: Standardfoul, es wird gespielt, wie die Kugeln liegen; absichtlich = 3.16. | offen |
| 3.13 | Drei Fouls in Folge | Drei Fouls ohne dazwischen regelgerechten Stoß = schwerwiegendes Foul. Bei rackweise gespielten Disziplinen (9-Ball) müssen sie im selben Spiel fallen; **nicht beim 8-Ball**. Der Schiedsrichter muss nach dem zweiten Foul warnen, sonst zählt ein drittes nur als zweites. | `drei-fouls` |
| 3.14 | Zeitspiel | Überschreiten des Zeitlimits = Standardfoul (siehe 3.1). | offen (Uhr) |
| 3.15 | Foul mit der Aufbauhilfe | Eine auf der Bande liegende, entfernte Aufbauhilfe wird von einer Kugel berührt. | offen |
| 3.16 | Unsportliches Verhalten | Normalstrafe wie schwerwiegendes Foul; der Schiedsrichter darf frei strafen: Verwarnung, Standardfoul (zählt zur Drei-Foul-Strafe), schwerwiegendes Foul, Verlust von Spiel/Satz/Match, Disqualifikation samt Preisgeld und Punkten. Unsportlich ist: (a) Ablenken des Gegners, (b) Kugeln anders als durch einen Stoß verändern, (c) absichtliches Abrutschen, (d) Weiterspielen nach Foul oder Unterbrechung, (e) Übungsstöße, (f) den Tisch markieren, (g) Verzögern, (h) unpassendes Zubehör. | offen |

**Welche Fouls gelten wo** (aus den Listen der Disziplinen): **8 Ball** 3.1–3.12, 3.14, 3.15 (3.13 nein); **9 Ball und 10 Ball** 3.1–3.10, 3.12, 3.14, 3.15 und 3.13 (3.11 entfällt, es gibt Ball in Hand auf dem ganzen Tisch); **14/1** 3.1, 3.3–3.12, 3.14, 3.15 (3.2 gibt es nicht) und 3.13 mit eigener Strafe.

### 4.3 Zusätzliche Foulregeln aus den Lehrunterlagen (OS19, bei Konflikt gilt S26)
- **Nur Pomeranze** (3.3, 3.20): die Weiße darf nur von der Pomeranze berührt werden; alles andere (Körper, Kleidung, Kreide, Brücke, Ferrule) ist Foul; unkorrekt bewegte Kugeln bleiben, wo sie liegen. Absichtliches Berühren der Weißen: Schiedsrichter ermahnt, ein zweites Mal = Spielverlust (3.28).
- **Kein Kontakt** (3.17): kein korrekter Erstkontakt = Foul; **Wegspielen von einer press liegenden Kugel ist kein Treffen**.
- **Weiße berührt versenkte Kugel** (3.19) = Foul (volle Tasche).
- **Berühren eines farbigen Balls bei Lageverbesserung** (3.21) = Foul.
- **Doppelstoß** (2.20, 3.22): ist der Abstand zwischen Weißer und Kugel kleiner als eine Kreidestärke, besondere Aufmerksamkeit; **läuft die Weiße der Kugel mehr als eine halbe Kugelbreite nach, ist es Foul**, außer der Schiedsrichter kann sicher sagen, dass der Stoß korrekt war. Press liegende Weiße/Kugel: Stoßen ja, Schieben nein; liegt eine weitere Kugel in Stoßrichtung, genau hinsehen.
- **Unachtsamkeit** (3.24): fallende Kreide, abbrechender Brückenkopf – berührt der Gegenstand eine Kugel, ist es Foul.
- **Jump / Anheben** (3.25, 3.26): Jump Shot erlaubt; absichtliches Anheben durch Treffen unter der Mitte Foul; kein Foul, wenn die Kugel von der Bande kommend springt.
- **Plötzlich bewegte Kugeln** (3.30) und **eingeklemmte Kugeln** (3.32): siehe 1.2 und 3.5.
- **Press liegende Kugel an der Bande** (3.37): nach dem Treffer muss (1) eine Kugel versenkt werden, (2) die Weiße eine Bande anlaufen, (3) die getroffene Kugel eine **andere** Bande anlaufen (nicht nur von ihrer abprallen) oder (4) eine andere Kugel eine Bande anlaufen, an der sie nicht press lag. Eine Kugel zählt erst als press liegend, wenn angesagt. → `press-bande`
- **Spielen aus dem Kopffeld** (3.38): die Weiße muss das Kopffeld verlassen, bevor sie eine Kugel oder Bande berührt; Ausnahme: eine spielbare Kugel (Mittelpunkt auf oder jenseits der Kopflinie) liegt so nah, dass die Weiße sie berührt, bevor sie das Kopffeld verlässt – korrekt.
- **Störung** (3.40): Ablenken oder Stören des Gegners durch den nicht aufnahmeberechtigten Spieler ist Foul, wenn es erkennbar unsportlich ist. **Messen** (3.41) mit Brücke, Dreieck, Kugel ist verboten. **Markieren** (3.42) des Tuches/Kreide auf der Bande ist Foul, wenn die Markierung nicht vor dem Stoß entfernt wird. **Absichtlich bewegte Kugeln** (2.19: Reißen am Tisch, Drücken) verlieren Game oder Match, ggf. Disqualifikation.
- **Anstoß, Weiße abgelenkt** (3.8, WR16 19): Aufhalten der Weißen mit dem Queue nach dem Abrutschen ist absolut verboten (3.16 b).

---

## 5. Rack, Aufbau und Neuaufbau

### 5.1 Allgemeine Regeln (S26 1.5, 4.2, 5.2, 6.2, 7.2; OS19 1.16.5, 2.7, 3.2; WR16 4, 16)
→ Animation `rack-aufbau`.
- Die Kugeln liegen **so eng wie möglich, am besten press**; man klopft sie nicht mehr als nötig, das Tuch kurz zu glätten ist besser (OS19 1.16.5). Der **vorderste Ball liegt genau auf dem Fußpunkt** (außer 9-Ball, siehe unten), alle anderen dahinter.
- **Zufällige Reihenfolge, kein absichtliches Muster.** Vermutet ein Spieler absichtlich platzierte Kugeln im Dreieck (Aufbau nicht durch den Schiedsrichter), informiert er den Schiedsrichter; bestätigt sich das, gibt es eine offizielle Verwarnung, bei Wiederholung Strafe wegen unsportlichen Verhaltens (WR16 16).
- Baut der Schiedsrichter auf, darf der Spieler dabei nicht kontrollieren; danach darf er das Rack prüfen und **einmal** eine Nachkorrektur verlangen (OS19 2.7). Der Schiedsrichter bereitet das Rack für die Spieler vor (OS19 8.3).
- Das gezeichnete Dreieck bestimmt, ob eine Kugel im Dreieck liegt (S26 7.2). Eine Kugel behindert den Aufbau, wenn sie innerhalb der Dreiecksmarkierung liegt oder diese überragt (S26 7.8).

### 5.2 Je Disziplin
| Disziplin | Form | Pflicht | Rest |
|---|---|---|---|
| **8 Ball** (S26 4.2) | Dreieck, 15 Kugeln | vorderste Kugel auf dem Fußpunkt; **8 in der Mitte** (erste Kugel in gerader Linie hinter der vordersten); in den beiden hinteren Ecken **je eine Volle und eine Halbe** | zufällig; OS19 5.3: nicht mehr als vier Kugeln derselben Gruppe in einer Linie |
| **9 Ball** (S26 5.2) | Raute, 9 Kugeln | **1 an der vorderen Spitze, 9 in der Mitte, die 9 liegt auf dem Fußpunkt** ⚠ (OS19/S16: die 1 auf dem Fußpunkt; die Variante mit der 9 auf dem Fußpunkt wurde 2016 zur Erprobung eingeführt und gilt nach S26) | alle anderen zufällig |
| **10 Ball** (S26 6.2) | Dreieck, 10 Kugeln | **1 an der vorderen Spitze auf dem Fußpunkt, 10 in der Mitte** | alle anderen zufällig |
| **14/1** (S26 7.2) | Dreieck, 15 Kugeln | vorderste Kugel auf dem Fußpunkt | zufällig; **keine Aufbauhilfe**; bei jedem Neuaufbau mit 14 Kugeln bleibt die Spitze frei; die Dreiecksmarkierung bleibt auch bei getapptem Tisch maßgeblich |

### 5.3 Aufbauhilfe und Wiedereinsetzen
Aufbauhilfe: siehe Abschnitt 2 (nur 8-, 9-, 10-Ball; nicht 14/1). Wiedereinsetzen einzelner Kugeln: siehe 3.10.

### 5.4 14/1: Neuaufbau nach der 14. Kugel (S26 7.4, 7.6, 7.8; OS19 6.7 Nr. 3, 6, Grafiken 1–7)
→ Animationen `neuaufbau-fuenfzehnte`, `neuaufbau-kugel-behindert`, `neuaufbau-weisse-behindert`, `neuaufbau-beide`.
- Sind 14 Kugeln regelgerecht versenkt, wird das Spiel angehalten; die 14 Kugeln werden aufgebaut, **die Spitze bleibt frei**, der Spieler setzt seine Aufnahme fort. Er muss nicht auf die 15. Kugel spielen, jede Kugel darf zuerst angespielt werden. Idealerweise spielt er die 15. Kugel so, dass die Weiße das Dreieck löst.
- Behindert niemand den Aufbau (weder die Weiße noch die 15. Kugel liegt innerhalb der Dreiecksmarkierung oder ragt hinein), bleiben beide, wo sie liegen. Andernfalls (S26 7.8, OS19 Bsp. 1–7):
  - **(a)** Die 15. Kugel wurde **zusammen mit der 14. versenkt**: alle 15 Kugeln werden aufgebaut (die 15. an der Spitze auf dem Fußpunkt). Die Weiße bleibt liegen; liegt sie im Dreieck, spielt der Spieler sie mit Ball in Hand aus dem Kopffeld.
  - **(b)** Die 15. Kugel **und** die Weiße behindern den Aufbau: alle 15 Kugeln werden aufgebaut, die Weiße wird mit **Ball in Hand aus dem Kopffeld** gespielt.
  - **(c)** Nur die **15. Kugel** behindert: sie kommt auf den **Kopfpunkt**; blockiert die Weiße den Kopfpunkt, auf den **Mittelpunkt**. Die Weiße bleibt.
  - **(d)** Nur die **Weiße** behindert: liegt die 15. Kugel **außerhalb des Kopffeldes oder auf der Kopflinie**, spielt der Spieler die Weiße mit Ball in Hand aus dem Kopffeld; liegt die 15. Kugel **im Kopffeld**, kommt die Weiße auf den **Kopfpunkt**, ist der Kopfpunkt belegt (z. B. von der 15. Kugel), auf den **Mittelpunkt**. Die 15. Kugel bleibt. **Folge für 3.11:** Steht die Weiße so auf dem Kopfpunkt, hat der Spieler keine Lageverbesserung *aus dem Kopffeld*; die 15. Kugel im Kopffeld darf er daher **direkt anspielen** (auch nach hinten, OS19 Beispiel 6), die Weiße muss das Kopffeld nicht erst verlassen. Nur bei echtem Ball in Hand aus dem Kopffeld (z. B. nach Scratch) gilt 3.11.
- Muss die 15. Kugel neu eingesetzt werden und die 14 anderen sind nach dem Aufbau unberührt, kommt sie auf den Fußpunkt (7.6). Liegt die Weiße oder die letzte Kugel knapp außerhalb der Markierung, markiert der Schiedsrichter die Position; wird sie beim Aufbau versehentlich bewegt, legt er sie zurück, ohne Foul.
- Es gibt **keine Einschränkung**, welche Kugel des neuen Dreiecks der Spieler zuerst anspielt.

---

## 6. Die Disziplinen

### 6.1 8 Ball (S26 Kap. 4; OS19 Kap. 5, WR16 10)
- **Ziel**: 15 Kugeln und die Weiße, **Ansagespiel**. Eine Gruppe (1–7 Volle, 9–15 Halbe) muss komplett versenkt sein, bevor man die 8 spielen darf; wer die 8 regelgerecht versenkt, gewinnt.
- **Anstoß**: Sieger des Ausspielens bestimmt, wer stößt (4.1). Weiße aus dem Kopffeld, keine Ansage, keine Pflichtkugel. Fällt eine Kugel ohne Foul, bleibt der Spieler am Tisch, der Tisch ist **offen**. Fällt keine Kugel, müssen **mindestens vier Objektkugeln eine Bande anlaufen**; sonst ist der Anstoß unzulässig: der Gegner kann (1) die Lage übernehmen, (2) neu aufbauen lassen und selbst anstoßen oder (3) neu aufbauen und den Gegner erneut anstoßen lassen (4.3 d). → `anstoss-vier-kugeln`
  - 8 fällt beim korrekten Anstoß: kein Foul; der Spieler darf (1) die 8 wieder einsetzen und weiterspielen oder (2) neu anstoßen (4.3 e). Fällt die 8 mit einem Foul-Stoß: der Gegner (1) setzt die 8 wieder ein und spielt mit Ball in Hand aus dem Kopffeld oder (2) stößt selbst neu an (4.3 f).
  - Springt eine Objektkugel beim Anstoß vom Tisch: Foul, die Kugel bleibt draußen (die 8 wird wieder aufgebaut); der Gegner übernimmt die Lage oder spielt mit Ball in Hand aus dem Kopffeld (4.3 g). Jedes andere Foul beim Anstoß (z. B. Weiße fällt): dieselben zwei Optionen (4.3 h); der Tisch bleibt offen (OS19 5.7: kein Neuaufbau, wenn nur die Weiße fällt).
- **Offener Tisch / Gruppenwahl** (4.4, OS19 5.10, 5.11): Vor der Zuordnung muss jede Absicht angesagt werden. Fällt die angesagte Kugel korrekt, bekommt der Spieler deren Gruppe, der Gegner die andere; sonst bleibt der Tisch offen und die Aufnahme wechselt. Bei offenem Tisch darf jede Objektkugel zuerst gespielt werden **außer der 8**, die zuerst zu berühren ist ein Foul (außer eine Gruppe ist schon komplett versenkt: dann darf der Spieler diese Gruppe vorübergehend für sich beanspruchen und die 8 spielen). Das Anstoß-Ergebnis legt die Gruppe nie fest. → `offener-tisch-acht`
- **Fortführung** (4.5, 4.6): Der Spieler bleibt am Tisch, solange er angesagte Kugeln korrekt versenkt. Bei jedem Stoß außer dem Anstoß werden Kugel und Tasche angesagt; jede gespielte Kugel muss aus der eigenen Gruppe sein (danach die 8). **Sicherheit** darf angesagt werden: Aufnahme endet, versenkte Kugeln bleiben aus dem Spiel. Kombinationsstöße sind erlaubt (die 8 nie als erste Kugel, außer bei offenem Tisch; OS19 5.16, 5.19: die 8 kann nie durch einen Kombistoß korrekt versenkt werden). Eigene Kugel über Bande anspielen ist erlaubt (OS19 5.12).
- **Wiedereinsetzen** (4.7): nur die 8 (beim Anstoß); keine andere Kugel. Mit Foul oder unangesagt versenkte Kugeln bleiben in der Tasche (OS19 5.2, 5.17), auch die des Gegners.
- **Spielverlust** (4.8): (a) Foul beim Versenken der 8, (b) 8 versenken, solange noch Kugeln der eigenen Gruppe liegen, (c) 8 in eine nicht angesagte Tasche, (d) die 8 vom Tisch springen lassen; gilt nicht für den Anstoß. ⚠ OS19 5.20 nennt zusätzlich: die 8 im selben Stoß wie die letzte Farbige; Spielverluste müssen vor dem nächsten Stoß angesagt werden. → `acht-verloren`
- **Standardfouls** (4.9): siehe 4.2; 3.2 bedeutet hier: erste berührte Kugel aus der eigenen Gruppe (offener Tisch: jede außer der 8); 3.5: einzig die 8 wird (nur beim Anstoß) wieder aufgebaut. **Strafe: der Gegner bekommt die Weiße in die Hand, überall auf dem Tisch.** Die Drei-Foul-Regel gilt hier **nicht**. Beim Spiel auf die 8 bedeutet ein Foul oder das Versenken der Weißen keinen Spielverlust, solange die 8 nicht fällt/springt (OS19 5.19).
- **Verwechseln der Gruppen** (WR16 10): Wird aus Versehen eine Kugel der gegnerischen Gruppe versenkt, muss das Foul vor dem nächsten Stoß gegeben werden; erkennt man die Verwechslung später, wird das Spiel angehalten und vom ursprünglichen Anstoßer neu angestoßen.
- **Patt** (4.11): Spiel neu beginnen, der ursprüngliche Anstoßer stößt.

### 6.2 9 Ball (S26 Kap. 5; OS19 Kap. 4)
- **Ziel**: 9 Kugeln und die Weiße. Gespielt wird in **aufsteigender Reihenfolge** (die niedrigste Kugel zuerst treffen), versenkt werden darf in beliebiger Reihenfolge; wer die 9 korrekt versenkt, gewinnt. **Nichts wird angesagt.**
- **Anstoß** (5.3): Ball in Hand hinter der Kopflinie, aus dem Kopffeld. Fällt keine Kugel, müssen **mindestens vier Objektkugeln eine Bande anlaufen**, sonst Foul (Gegner: Ball in Hand auf dem ganzen Tisch). Die 1 muss beim Anstoß korrekt getroffen werden (OS19 4.3). → `anstoss-vier-kugeln`
  - **⚠ ÖPBV-Abweichung** (5.3 c, WR16 18): Nur wenn mit der **Drei-Punkte-Regel („Kitchen Rule“)** gespielt wird, müssen beim Anstoß mindestens 3 Objektkugeln das Kopffeld erreichen (Mittelpunkt jenseits der Kopflinie, ÖPBV; WR16: die Kopflinie berühren) oder versenkt werden; jede versenkte Kugel verringert die Anforderung. Nichterfüllung („Dry Break“): Gegner übernimmt die Lage (kein Push Out erlaubt) oder gibt sie zurück (Push Out erlaubt). Eine mit Dry Break versenkte 9 wird wieder aufgebaut.
- **Push Out** (5.4): Wurde beim Anstoß kein Foul begangen, darf der aufnahmeberechtigte Spieler den **zweiten Stoß** als Push Out spielen, **muss ihn dem Schiedsrichter vorher ansagen** (sonst normaler Stoß). Beim Push Out entfallen 3.2 (falsche Kugel) und 3.3 (keine Bande), alle anderen Foulgründe bleiben. Kein Foul: der Gegner wählt, wer als nächstes stößt. Eine beim Push Out versenkte Kugel zählt nicht (außer die 9 wird wieder aufgebaut). Nach einem Foul beim Anstoß gibt es kein Push Out. → `push-out`
- **Fortführung** (5.5): solange der Spieler regelgerecht Kugeln versenkt, spielt er weiter; versenkt er die 9 regelkonform (außer beim Push Out), gewinnt er. Keine Kugel oder Foul: Aufnahme endet; ohne Foul spielt der Gegner von dort, wo die Weiße liegt.
- **Wiedereinsetzen** (5.6): nur die 9, wenn sie mit Foul, beim Push Out oder beim Dry Break versenkt wird oder vom Tisch springt. Alle anderen Kugeln bleiben draußen.
- **Standardfouls** (5.7): siehe 4.2; 3.2 = niedrigste Kugel zuerst; 3.5: nur die 9 wird wieder aufgebaut. **Strafe: Ball in Hand auf dem ganzen Tisch** (nicht press an eine Kugel, OS19 4.9). **Schwerwiegend** (5.8): drei Fouls in Folge im selben Spiel = Spielverlust; zwischen dem zweiten und dritten Foul muss gewarnt werden (OS19 4.12). → `drei-fouls`
- Das Spiel beginnt, sobald die Weiße beim Anstoß das Kopffeld verlässt (OS19 4.13). **Patt** (5.9): neu beginnen, ursprünglicher Anstoßer stößt.

### 6.3 10 Ball (S26 Kap. 6; OS19 Kap. 7)
- **Ziel**: 10 Kugeln und die Weiße, **Ansagespiel**, aufsteigende Reihenfolge; wer die 10 legal versenkt, **wenn sie die einzige Objektkugel auf dem Tisch ist**, gewinnt. Wird die 10 angesagt und korrekt versenkt, bevor sie die letzte Kugel ist, wird sie wieder aufgebaut und der Spieler bleibt an der Aufnahme (OS19 7.4).
- **Anstoß** (6.3): Weiße aus dem Kopffeld, nichts angesagt; fällt keine Kugel, mindestens vier Objektkugeln an die Bande, sonst Foul.
- **Push Out** (6.4): wie beim 9-Ball; bei Foul-freiem Push Out wählt der Gegner, ob er den Tisch übernimmt oder zurückgibt; wird die 10 beim Push Out versenkt, wird sie wieder aufgebaut.
- **Ansage, unkorrekt versenkte Kugeln** (6.5, 6.6): Bei jedem Stoß außer dem Anstoß werden Kugel und Tasche angesagt, **keine Sicherheitsansage**. Fällt die angesagte Kugel nicht in die angesagte Tasche, wählt der Gegner, wer als nächstes stößt. → `falsche-tasche`
- **Fortführung** (6.7): solange eine angesagte Kugel korrekt fällt, bleiben zusätzlich versenkte Kugeln aus dem Spiel (außer der 10) und der Spieler stößt weiter.
- **Wiedereinsetzen** (6.8): die 10, wenn sie mit Foul, beim Push Out, beim Anstoß oder vorzeitig versenkt wird, unabsichtlich in eine falsche Tasche fällt oder springt. **Standardfouls** wie beim 9-Ball (6.9), **Drei-Foul-Strafe = Spielverlust** (6.10). **Patt**: neu beginnen (6.11).

### 6.4 14/1 Endlos (S26 Kap. 7; OS19 Kap. 6)
- **Ziel**: Ansagespiel mit 15 Kugeln und der Weißen. Jede regelgerecht angesagte und versenkte Kugel zählt einen Punkt; wer zuerst die vereinbarte Punktzahl erreicht (oder bei Aufnahmenbegrenzung mehr Punkte hat), gewinnt. Nach 14 Kugeln wird neu aufgebaut (Abschnitt 5.4).
- **Ausstoßen** (7.1) wie 3.2; **Aufbau** siehe 5.2.
- **Eröffnungsstoß** (7.3, OS19 6.6): Ball in Hand hinter der Kopflinie. Wird keine angesagte Kugel versenkt, müssen **die Weiße und zwei Objektkugeln nach dem Kontakt mit dem Rack je eine Bande anlaufen**, sonst **Anstoßfoul: 2 Punkte Abzug**; der Gegner übernimmt die Lage oder lässt den Spieler erneut anstoßen (beliebig oft, bis die Bedingungen erfüllt sind oder er übernimmt; es bleibt dieselbe Aufnahme). Ein Anstoßfoul zählt **nicht** zur Drei-Foul-Regel; fallen Anstoßfoul und Standardfoul zusammen, gilt das Anstoßfoul (7.10). Fällt die Weiße beim sonst korrekten Anstoß: Standardfoul (−1, zählt zur Drei-Foul-Strafe), Gegner mit Ball in Hand aus dem Kopffeld, Kugeln bleiben. Eine versenkte Kugel gilt als hätte sie eine Bande berührt. → `anstoss-vierzehn-eins`
- **Fortführung und Ansage** (7.4, 7.5): Der Spieler bleibt, solange er angesagte Kugeln versenkt; jede im selben Stoß zusätzlich versenkte Kugel zählt ebenfalls. Bei **Sicherheit** endet die Aufnahme, **versenkte Kugeln werden wieder aufgebaut**. → `sicherheit`
- **Wiedereinsetzen** (7.6): Kugeln, die mit Foul, in einer Sicherheit oder ohne dass eine angesagte Kugel fiel versenkt wurden, werden aufgebaut. Vom Tisch gesprungene Objektkugeln werden aufgebaut (3.5). Unkorrekt versenkte Kugeln werden aufgebaut, **ohne Strafe** (OS19 6.8).
- **Wertung** (7.7, OS19 6.13): Fouls werden vom Punktestand abgezogen, auch ins Minus (z. B. 60 : −2). Versenkt jemand im selben Stoß eine Kugel und begeht ein Foul, wird die Kugel wieder aufgebaut und ein Punkt vom Stand **vor** dem Stoß abgezogen (er kann nie punkten, wenn er mit Foul versenkt).
- **Standardfouls** (7.9): siehe 4.2; **Strafe: 1 Punkt Abzug, Aufnahme wechselt, die Weiße bleibt liegen**, außer bei Scratch (3.1) und beim zweiten Absatz von 3.11: dann **Ball in Hand aus dem Kopffeld** für den Gegner. → `weisse-versenkt`, `spiel-aus-dem-kopffeld`
- **Drei Fouls in Folge** (7.11): zählt nur bei **Standardfouls**. Beim dritten Foul: 1 Punkt wie üblich **plus 15 Punkte**, die Fouls sind danach aufgehoben, alle 15 Kugeln werden aufgebaut und der Spieler stößt unter den Eröffnungsbedingungen neu an. ⚠ OS19 6.12: insgesamt −17 (−1, −1, −15). Das Foul bleibt bis zur nächsten Aufnahme bestehen und wird aufgehoben, wenn der Spieler dort regelgerecht einen Ball versenkt oder die Sicherheitsbedingungen erfüllt; gezählt werden aufeinanderfolgende **Stöße**, nicht Aufnahmen (OS19 6.12 Hinweis). → `drei-fouls`
- **Nur im Lehrmaterial (OS19)**: (6.7 Nr. 2) Liegt eine Farbige nicht press, aber innerhalb einer Kugelstärke an der Bande, darf der Spieler darauf nur **zweimal** Sicherheit/„Roll-up“ spielen; beim dritten Mal gilt es als drittes aufeinanderfolgendes Foul. (6.7 Nr. 5) Wer eine auf das Dreieck oder ein Loch zulaufende Kugel fängt oder behindert (auch Hand ins Loch), begeht ein **absichtliches Foul: 1 + 15 = 16 Punkte**; der Gegner übernimmt mit Ball in Hand aus dem Kopffeld oder lässt neu aufbauen und den Gegner neu anstoßen.
- **Patt** (7.12): neuer Eröffnungsstoß, beide stoßen neu aus.

### 6.5 Andere Disziplinen (S26 8–14)
- Blackball, Heyball, Pyramid, Artistic Pool, One-Pocket, Bank Pool, IEPF „International Rules“: siehe WPA Rules of Play (wpapool.com/rules). Nicht Teil dieser App.

---

## 7. Doppel (DP)
- Spielt der falsche Spieler, ist das **immer ein Foul** (der Gegner muss es ausrufen; fällt es nicht auf, gilt der Stoß als überspielt).
- Das **Ausspielen** zählt nicht als „Stoß“ für den Stoßwechsel; wer es gewinnt, macht auch den ersten Anstoß, wenn er das Break haben will.
- **Breakwechsel** zwischen den Teams (Alternate Break) **und** innerhalb eines Teams: jeder Spieler kommt alle vier Spiele zum Break.
- Das nicht anstoßende Team wählt, **welcher Spieler** den ersten Stoß im Spiel macht.
- **Absprachen** im Team sind erlaubt, aber kurz (Time). Anzeigen mit Fingern, Queue oder Ähnlichem kurz vor oder während des Stoßes sind Foul.
- Die **Rückgabe eines Push Outs** ist kein Stoß im Sinne des Stoßwechsels (der Push-Out-Spieler ist wieder dran).

---

## 8. Schiedsrichter (REG, OS19 Kap. 2 und 8, WR16 5, 8, 9)
- **Befugnis** (OS19 2.2–2.4): Der Schiedsrichter sorgt für Ordnung und Einhaltung der Regeln; Entscheidungen über Tatsachen sind endgültig; die letzte Interpretationsbefugnis hat die Turnierleitung (erste Instanz bleibt der Schiedsrichter).
- **Antwortverhalten** (OS19 2.3, WR16 9): Er beantwortet objektive Fragen (Kugel im Dreieck? im Kopffeld? Spielstand? Fouls auf dem Konto? welche Regel würde gelten?), **nie eine subjektive Meinung** (ob ein Stoß machbar ist). Eine Fehlaussage schützt den Spieler nicht vor der richtigen Regel.
- **Warnpflichten** (OS19 2.16, WR16 8): vor dem schwerwiegenden Foul (drittes Foul, Publikumsrat, Weiterspielen nach Foul), press liegende Kugeln ansagen, beim Spielen aus dem Kopffeld hinweisen. Bei der Drei-Foul-Regel das zweite Foul beim Passieren ansagen und nochmals, wenn der Spieler an den Tisch zurückkehrt (mit Zähltafel entfällt das).
- **Aufgaben am Tisch** (OS19 2.6, 8.3; REG 5): Tisch und Kugeln reinigen, Kreide/Hilfsqueue/Dreieck bereitstellen, Markierungen prüfen, **Rack aufbauen**, die Weiße vor dem Anstoß reinigen und neutral übergeben, Ausspielen entscheiden, Fouls so ansagen, dass beide Spieler es hören, Stoppuhr, Ballmarker und Handschuhe mitführen, nicht im Sichtfeld stehen, Spielstand auf Zähltafel und Protokoll (8-/9-/10-Ball nach jedem Game, 14/1 nach jedem Dreieck), die Spieler begrüßen und per Handschlag verabschieden, auf den Sitz achten, Tafel nicht verdecken lassen. Nach Spielende Tisch für das nächste Match vorbereiten.
- **Area-Schiedsrichter** (OS19 8.1, REG 6, WR16 5): höchstens 6 Tische, höherer Stuhl, **passiv**: er greift im Normalfall erst auf Anforderung eines Spielers ein, sagt Fouls nicht von sich aus an, schreitet aber bei groben Problemen oder grob unsportlichem Verhalten sofort ein. Bei Streit ohne eigene Beobachtung klärt er sorgfältig (Zeugen, Video, Nachstellen); ohne Beweis gilt: kein Foul (WR16 5). ⚠ OS19 8.1 sagt, er dürfe nie selbstständig Entscheidungen treffen.
- **Shot-Clock-Schiedsrichter** (OS19 8.3 Nr. 8): kein Tisch- oder Area-Referee, achtet nur auf die Zeit, ruft 10 Sekunden vor Ablauf „Time“ und bei Überschreiten „Foul“.
- **Disziplinarmaßnahmen** (REG 3): (a) **Ermahnung** – ohne Einfluss auf den Spielstand, wenn das Verhalten den Spielverlauf nicht beeinflusst (z. B. wiederholtes Aufstehen); (b) **Verwarnung** und die nach den Spielregeln vorgesehene Strafe für unsportliches Verhalten – bei schwerem Vergehen oder fortgesetztem Verhalten (Markierungen am Tisch, absichtliche Veränderung der Spielsituation, Verlassen des Sitzes trotz Ermahnung); (c) **Disqualifikation** = Matchverlust, die schwerste Maßnahme, wenn möglich nur im Einvernehmen mit dem Wettkampfleiter (z. B. fortgesetzte Beleidigung). Bei der Beurteilung zählen frühere Verwarnungen, Schwere und Wettkampfebene (WR16 6).
- **Wetten**: Wetten auf Matches sind Schiedsrichtern und Turnierleitung streng untersagt (OS19 2.5).
- **Prüfung** (REG 1, 2): Wer die Regelkenntnisprüfung besteht, ist berechtigt (je nach Organisation auch verpflichtet), als Schiedsrichter zu arbeiten; Vermerk auf der Lizenz; nur ein Oberschiedsrichter des zuständigen Landesverbands nimmt sie ab. Der Oberschiedsrichter-Status gilt 5 Jahre (verlängert durch Regelkongress oder Auffrischungskurs), erlischt bei umfassender Regeländerung bis zur neuen Prüfung. Der ÖPBV-Regelreferent nimmt die Oberschiedsrichterprüfung ab.
- **Grundsätzliche Regeln** (REG 4): körperlich und geistig fit, Kleidung wie die Teilnehmer, das Reglement des Bewerbs (Dress-Code, Shot-Clock, Time-out, Ausspielziele, Break-Regeln, Einspielzeit, Protokoll im 14/1) genau kennen.

---

## 9. Auf einen Blick: Fouls und Strafen je Disziplin
| | 8 Ball | 9 Ball | 10 Ball | 14/1 |
|---|---|---|---|---|
| Ansagespiel | ja | nein | ja (keine Sicherheit) | ja |
| 3.2 Falsche Kugel | eigene Gruppe (offen: außer 8) | niedrigste | niedrigste | – |
| 3.3 Bande nach Karambolage | ✓ | ✓ | ✓ | ✓ |
| Standardstrafe | Ball in Hand (ganzer Tisch) | Ball in Hand | Ball in Hand | −1 Punkt, Weiße bleibt (Scratch: Kopffeld) |
| Drei Fouls in Folge | nein | Spielverlust | Spielverlust | −1 und −15, neu aufbauen |
| Anstoß: Mindestbedingung | 4 Kugeln an die Bande | 4 Kugeln an die Bande (+ Kitchen Rule optional) | 4 Kugeln an die Bande | Weiße + 2 Kugeln an die Bande |
| Anstoß nicht erfüllt | Wahl des Gegners | Foul | Foul | −2, Gegner wählt |
| Sicherheit | ja (Kugel bleibt unten) | – | nein | ja (Kugel wird aufgebaut) |
| Push Out | – | ja | ja | – |
| Wieder aufbauen | nur die 8 (beim Anstoß) | nur die 9 | nur die 10 | siehe 7.6 |
| Spielende | 8 regelgerecht | 9 regelgerecht | 10 regelgerecht (einzige Kugel) | Punktziel |

---

## 10. Abweichungen und offene Fragen (⚠)
| Thema | S26 (2026) | OS19 / WR16 / NK | Umgang |
|---|---|---|---|
| 9-Ball-Rack | 9 liegt auf dem Fußpunkt | OS19/S16: 1 auf dem Fußpunkt (die 9-auf-dem-Fußpunkt-Variante kam 2016 zur Erprobung) | S26 gilt; Animation zeigt S26 |
| 14/1 drittes Foul | −1 (wie üblich) und zusätzlich −15 | −15 (insgesamt −17) | S26; Fall-Label „−16 Punkte“ für das dritte Foul |
| 8-Ball: 8 als erste Kugel bei offenem Tisch | Foul | „Aufnahme abgeben“, versenkte Kugeln bleiben | S26 |
| 8-Ball: 8 im selben Stoß wie letzte Kugel | nicht genannt | Spielverlust (5.20.2) | in 6.1 vermerkt; im Zweifel Schiedsrichter/Veranstalter |
| Kugel springt beim 8-Ball-Anstoß | bleibt draußen (8 wird aufgebaut) | zählt als versenkt (5.8) | S26 |
| Wiedereinsetzen mehrerer Kugeln | wenn möglich press, nicht press an die Weiße | in Nummernfolge, nicht press (3.31) | S26 (einzelne Kugel), Hinweis |
| Press liegende Kugel | 2.7, 3.7 | 3.37 mit vier Bedingungen, Roll-up-Regel (14/1) | beides in Abschnitt 4; Animation nach 2.7 und 3.37 |
| Doppelstoß | 3.7 (Pomeranze berührt noch / mehrfach) | 2.20: mehr als halbe Kugelbreite nachlaufen | beides genannt; Animation `doppelstoss` nach OS19 2.20 |
| Kitchen Rule | ÖPBV 5.3 c: Mittelpunkt jenseits der Kopflinie | WR16 18: Kopflinie berühren | beides genannt |
| Time-out | – | OS19: 5 min je Match; WR16: nur bei langen Partien | Veranstalter |
| Shot Clock | 3.14 allgemein | OS19: max. 50 s, nach Break 60 s; WR16: 35 s + 25 s, nach Break bis 60 s | Veranstalter |
| Coaching | – | OS19: nie; WR16: begrenzt erlaubt | Veranstalter/ÖPBV-Sportreglement |
| Aufbauhilfe/Rack bei 14/1 | keine Aufbauhilfe (Template), Dreieck wird benutzt | OS19 6.4: „kein Ball-Rack“ (gemeint wohl Aufbauhilfe) | keine Aufbauhilfe |
| Area-Schiedsrichter | passiv bei Anforderung (WR16, REG) | OS19 8.1: darf nicht selbstständig entscheiden | passiv |
| Tischhöhe, Beleuchtung | NK: 74,3–78,7 cm, 520 Lux | OS19: 75–85 cm, 500 Lux | NK |
| Absichtliches Berühren der Weißen | 3.6: unabsichtlich Standard, absichtlich 3.16 | OS19 3.28: Ermahnung, zweites Mal Spielverlust | S26 |
| Foul-Zähler beim 14/1 | 7.11 | OS19 6.12: gezählt werden aufeinanderfolgende **Stöße**, Foul besteht bis zur nächsten Aufnahme | in 6.4 vermerkt |

---

## 11. Abdeckung durch Animationen
Legende: ✅ umgesetzt (Fall-ID in `src/lib/rules/cases/`) · 🟨 geplant, braucht neue Zeichenelemente (Queue, Hand, Fuß) · ⬜ geplant, nur Kugeln.

| Regel | Fall |
|---|---|
| 1.2 Ausspielen | ✅ `ausspielen` |
| 1.5, 4.2, 5.2, 6.2, 7.2 Rack aufbauen | ✅ `rack-aufbau` |
| 1.7 Ansage, Sicherheit | ✅ `sicherheit`, `falsche-tasche` |
| 1.8 Kugel fällt von selbst, 3.30 | ✅ `kugel-faellt-von-selbst` |
| 1.10 Störung von außen | ✅ `stoerung-von-aussen` |
| 1.13 Patt | ✅ `patt` |
| 2.2 Kugel am Taschenrand (5 s, mit Uhr) | ✅ `taschenrand` |
| 2.2 Weiße berührt versenkte Kugel (volle Tasche) | ✅ `weisse-versenkte-kugel` |
| 3.7 Weiße press an einer Kugel | ✅ `weisse-press` |
| 3.32 eingeklemmte Kugeln | 🟨 |
| 2.7 Bande anlaufen, press liegende Kugel | ✅ `press-bande`, `bande-vor-dem-treffer` |
| 3.1 Weiße in der Tasche | ✅ `weisse-versenkt` |
| 3.2 Falsche Kugel, gleichzeitiger Treffer | ✅ `erste-beruehrung`, `gleichzeitiger-treffer` |
| 3.3 Keine Bande nach der Karambolage | ✅ `nach-treffer-bande`, `bande-vor-dem-treffer` |
| 3.4 Fuß am Boden | ✅ `fuss-am-boden` |
| 3.6 Kugel berührt (Hand) | ✅ `kugel-beruehrt` |
| 3.8 Schieben | ✅ `schieben` |
| 3.12 außerhalb der Aufnahme | ✅ `ausserhalb-aufnahme` |
| 3.15 Aufbauhilfe-Foul | ✅ `aufbauhilfe-foul` |
| 3.16 Unsportliches Verhalten (Ablenken) | ✅ `unsportlich` |
| 3.5 Kugel springt vom Tisch | ✅ `kugel-vom-tisch` |
| 3.7 Doppelstoß | ✅ `doppelstoss` |
| 3.9 Stoß bei rollender Kugel | ✅ `bewegende-kugeln` |
| 3.10 / 3.11 Kopflinie, Spiel aus dem Kopffeld | ✅ `kopflinie`, `spiel-aus-dem-kopffeld` |
| 3.13 Drei Fouls in Folge | ✅ `drei-fouls` |
| 3.14 Zeitspiel (Shot Clock) | ✅ `zeitspiel` |
| Foul zu spät erkannt | ✅ `foul-zu-spaet` |
| 4.3 8-Ball-Anstoß (Kugel fällt, Weiße fällt, Kugel springt; die 8 fällt noch offen) | ✅ `acht-anstoss` |
| 4.4 Offener Tisch | ✅ `offener-tisch-acht` |
| 4.8 Spielverlust beim 8-Ball | ✅ `acht-verloren` |
| 5.3 9-Ball-Anstoß; Kitchen Rule / Dry Break | ✅ `anstoss-vier-kugeln`; Kitchen Rule ✅ `kitchen-rule` |
| 5.4 / 6.4 Push Out | ✅ `push-out` |
| 7.3 14/1-Eröffnungsstoß | ✅ `anstoss-vierzehn-eins` |
| 7.6 / 7.8 Neuaufbau nach der 14. Kugel, jeweils mit dem Folgestoß (jede Kugel darf zuerst angespielt werden; Kugel im Kopffeld nur bei Ball in Hand zu meiden) | ✅ `neuaufbau-fuenfzehnte`, `neuaufbau-kugel-behindert`, `neuaufbau-weisse-behindert`, `neuaufbau-beide` |
| OS19 6.7 Roll-up an der Bande (14/1) | ✅ `roll-up` |
| OS19 6.7 absichtliches Fangen einer Kugel (14/1) | ✅ `kugel-gefangen` |
| WR16 10 Verwechseln der Gruppen | ✅ `gruppen-verwechselt` |
| Doppel (DP): richtiger Spieler stößt | ✅ `doppel-reihenfolge` |

**Pflichten für jede Animation** (vom Prüfskript `scripts/checkRules.mjs` erzwungen): Jeder gezeigte Stoß trifft zuerst eine **zulässige** Kugel und danach läuft eine Kugel an die Bande oder fällt – außer die Szene zeigt genau das Gegenteil als Thema (`wrongFirst`, `expectRail: false`) oder es ist ein Push Out. Die Kugeln laufen physikalisch plausibel (Rollreibung, Mittelpunktslinie, Weiße setzt nach Schnitt tangential fort, keine Kollisionen während der Bewegung). Die Situation passt zur Disziplin (Etikett „Du spielst Volle“, „Niedrigste Kugel: n“, Rack je Disziplin). Eine Sprechblase oder ein Siegel darf nie die betroffene Kugel verdecken. Neue Fälle: eine Datei in `src/lib/rules/cases/`, Suchanfragen in `scripts/checkSearch.mjs`, danach beide Skripte laufen lassen.
