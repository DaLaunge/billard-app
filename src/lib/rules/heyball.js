/* Heyball-Regelwerk (WPA "Rules of Heyball", gültig ab 16.08.2025, Kapitel II "Rules of Heyball",
   `ref` = Regelnummer dort). Anders als die Fälle in ./cases/ sind das reine Textregeln ohne
   Animation: Heyball folgt weitgehend dem 8 Ball, die Besonderheiten (Anstoß, offener Tisch,
   kein Ansagen, Rackverlust) stehen hier. Gezeigt von RuleHelp, wenn die Disziplin Heyball
   gewählt ist (und der Admin sie eingeschaltet hat). Neue Regel = neuer Eintrag hier, mit
   englischem Titel/Text in `en`; index.js meldet die Übersetzungen selbst an (Schlüssel = deutscher Text). */

export const HEYBALL_SOURCE = "WPA Rules of Heyball, gültig ab 16.08.2025";
export const HEYBALL_SOURCE_EN = "WPA Rules of Heyball, effective 16 Aug 2025";

export const HEYBALL_RULES = [
  {
    id: "ziel", ref: "2", title: "Ziel des Spiels",
    text: "Gespielt wird mit dem WPA-Unity-Satz (7 volle, 7 halbe Kugeln, die 8 und die Weiße). Ein Rack gewinnt, wer zuerst alle Kugeln seiner Gruppe und danach regelgerecht die 8 versenkt.",
    en: { title: "Object of the game", text: "Heyball is played with the WPA Unity ball set (7 solids, 7 stripes, the 8 and the cue ball). You win a rack by pocketing all balls of your group first and then legally pocketing the 8." },
  },
  {
    id: "tisch", ref: "3", title: "Tisch & Ausrüstung",
    text: "Der Tisch misst innen 2.540 × 1.260 mm (± 9 mm), die Bandenhöhe liegt bei 800 bis 850 mm. Die Kugeln haben 57,15 mm Durchmesser, das Queue ist mindestens 101,6 cm lang. Fußpunkt: auf der Längsmittellinie, 635 mm von der oberen Bande. Kopflinie: 635 mm von der unteren Bande, quer über den Tisch.",
    en: { title: "Table & equipment", text: "The table measures 2,540 × 1,260 mm inside (± 9 mm), cushion height is 800 to 850 mm. Balls are 57.15 mm in diameter, the cue is at least 101.6 cm long. Foot spot: on the long axis, 635 mm from the top cushion. Head string: 635 mm from the bottom cushion, across the table." },
  },
  {
    id: "aufbau", ref: "4", title: "Aufbau (Rack)",
    text: "Die Kugeln stehen im Dreieck, die Spitzenkugel auf dem Fußpunkt, die 8 in der Mitte. In den beiden Ecken der Grundreihe liegt je eine volle und eine halbe Kugel, die übrigen vollen und halben Kugeln werden möglichst verteilt. Die ersten beiden Reihen (drei Kugeln an der Spitze) müssen fest anliegen. Beide Spieler dürfen den Aufbau prüfen und Korrekturen verlangen.",
    en: { title: "Racking", text: "The balls are racked in a triangle, the apex ball on the foot spot, the 8 in the center. One solid and one stripe sit at the two corners of the base row, the other solids and stripes are spread as far apart as possible. The first two rows (the three balls at the apex) must be tight. Both players may check the rack and ask for corrections." },
  },
  {
    id: "auslagen", ref: "5", title: "Auslagen (Lag)",
    text: "Der erste Stoß des Matches bestimmt, wer anstößt: Beide Spieler spielen gleichzeitig hinter der Kopflinie eine Kugel an die obere kurze Bande zurück. Wessen Kugel näher an der unteren Bande liegt, gewinnt und bestimmt, wer anstößt. Ungültig ist es u. a., wenn die Kugel die Längsmittellinie überquert, die obere Bande nicht oder mehrfach berührt, versenkt wird oder die Seitenbande berührt. Bei Gleichstand oder zwei ungültigen Versuchen wird neu ausgelagt. Danach wird abwechselnd angestoßen.",
    en: { title: "Lag", text: "The first shot of the match decides who breaks: both players shoot a ball from behind the head string to the top short cushion and back at the same time. The ball that stops closer to the bottom cushion wins and chooses who breaks. A lag is invalid if, among other things, the ball crosses the long axis, misses the top cushion or hits it more than once, is pocketed, or touches a side cushion. After a tie or two bad lags, lag again. After that the break alternates." },
  },
  {
    id: "anstoss", ref: "6", title: "Anstoß",
    text: "Der Anstoß muss kräftig sein, weiche Anstöße sind verboten (Verwarnung, dann Rackverlust, dann Matchverlust). Die Weiße steht hinter der Kopflinie. Nach dem Anstoß müssen mindestens vier Objektkugeln eine Bande berühren oder mindestens eine Kugel versenkt sein. Sonst ist es ein ungültiger Anstoß: Der Gegner darf das Bild annehmen und weiterspielen oder neu aufbauen lassen und selbst oder der Anstoßende stößt an – ohne Weiße in der Hand hinter der Kopflinie. Ein absichtlich ausgelassener Anstoß oder Fehlstoß zählt als absichtliches Foul (Rackverlust). Liegt mehr als die halbe Weiße über der Kopflinie, gibt es beim ersten Mal einen Hinweis, beim zweiten Mal ein Foul.",
    en: { title: "Break", text: "The break must be forceful; soft breaks are prohibited (warning, then loss of rack, then loss of match). The cue ball starts behind the head string. After the break at least four object balls must touch a cushion or at least one ball must be pocketed. Otherwise the break is illegal: the opponent may accept the position and play on, or have the balls re-racked and either break himself or have the breaker break again – without ball in hand behind the head string. Intentionally not breaking or miscuing counts as an intentional foul (loss of rack). If more than half of the cue ball is over the head string, the first time is a reminder, the second time a foul." },
  },
  {
    id: "anstoss-foul", ref: "6 (e), 6 (g)", title: "Foul beim Anstoß",
    text: "Bei einem Foul im Anstoß wählt der Gegner: die Weiße in der Hand hinter der Kopflinie, neu aufbauen und selbst anstoßen oder neu aufbauen und den Gegner anstoßen lassen. Misslingt der Anstoß ungewollt (Fehlstoß, die Weiße trifft das Dreieck nicht), darf der Gegner nur selbst anstoßen oder den Anstoßenden erneut anstoßen lassen, ohne Weiße in der Hand.",
    en: { title: "Foul on the break", text: "After a foul on the break the opponent chooses: ball in hand behind the head string, re-rack and break himself, or re-rack and have the opponent break. If the break fails unintentionally (miscue, cue ball misses the rack), the opponent may only break himself or have the breaker break again, with no ball in hand." },
  },
  {
    id: "acht-anstoss", ref: "6 (f)", title: "Die 8 fällt beim Anstoß",
    text: "Fällt die 8 beim Anstoß ohne Foul, darf der Anstoßende sie auf den Fußpunkt zurücklegen und weiterspielen oder neu anstoßen. Bei einem Foul wählt der Gegner: die 8 auf den Fußpunkt, die Weiße in der Hand hinter der Kopflinie, neu aufbauen und selbst anstoßen oder neu aufbauen und den Gegner anstoßen lassen.",
    en: { title: "The 8 drops on the break", text: "If the 8 is pocketed on the break without a foul, the breaker may re-spot it on the foot spot and play on, or break again. After a foul the opponent chooses: the 8 re-spotted on the foot spot, ball in hand behind the head string, re-rack and break himself, or re-rack and have the opponent break." },
  },
  {
    id: "offener-tisch", ref: "10", title: "Offener Tisch",
    text: "Nach dem Anstoß ist der Tisch IMMER offen – auch wenn dabei Kugeln gefallen sind. Bei offenem Tisch darf jede Kugel außer der 8 zuerst angespielt werden (Berührung der 8 zuerst ist ein Foul). Die Gruppen werden erst verteilt, wenn ein Spieler nach dem Anstoß regelgerecht eine Kugel versenkt: Seine Gruppe ist die der versenkten Kugel, und der Tisch ist geschlossen. Unrechtmäßig versenkte Kugeln (außer der 8) bleiben bei offenem Tisch unten. Sind nach dem Anstoß alle vollen oder alle halben Kugeln gefallen, bleibt der Tisch offen, und es kann nur die verbliebene Gruppe gespielt werden.",
    en: { title: "Open table", text: "After the break the table is ALWAYS open – even if balls dropped. On an open table any ball except the 8 may be hit first (hitting the 8 first is a foul). Groups are only assigned when a player legally pockets a ball after the break: his group is the group of that ball and the table is closed. Illegally pocketed balls (except the 8) stay down on an open table. If all solids or all stripes dropped on the break, the table stays open and only the remaining group can be played." },
  },
  {
    id: "kein-ansagen", ref: "11", title: "Kein Ansagen",
    text: "Beim Heyball muss weder Kugel noch Tasche angesagt werden – auch nicht für die 8 oder im Shootout. Zufällig versenkte Kugeln zählen (Fluke erlaubt).",
    en: { title: "No calling", text: "In Heyball you do not have to call ball or pocket – not even for the 8 or in the shootout. Lucky pockets count (flukes are allowed)." },
  },
  {
    id: "stoss", ref: "12", title: "Der Stoß",
    text: "Bei geschlossenem Tisch muss die Weiße zuerst eine Kugel der eigenen Gruppe berühren, nach dem Leerräumen der Gruppe zuerst die 8. Fällt keine Kugel, muss nach dem ersten Kontakt mindestens eine Kugel (auch die Weiße) eine Bande berühren. Die Weiße darf pro Stoß nur einmal vom Queue-Leder berührt werden; Körper, Kleidung und Hilfsmittel (außer der Queue-Spitze) dürfen keine Kugel berühren. Läuft eine Kugel auf die Bande und kehrt ohne Berührung zurück, ist der Stoß gültig; bleibt sie auf der Bande liegen, ist er ungültig.",
    en: { title: "The shot", text: "On a closed table the cue ball must first hit a ball of your own group, after clearing the group the 8. If no ball is pocketed, at least one ball (including the cue ball) must touch a cushion after the first contact. The cue tip may touch the cue ball only once per stroke; body, clothing and equipment (except the cue tip) must not touch any ball. If a ball rolls onto the cushion and returns without touching anything, the shot is legal; if it stays on the cushion, it is illegal." },
  },
  {
    id: "foul-liste", ref: "17", title: "Fouls",
    text: "Der Gegner bekommt die Weiße in die Hand (auf den ganzen Tisch, ohne Einschränkung der Richtung). Fouls sind u. a.: Weiße versenkt oder vom Tisch; zuerst eine falsche Kugel berührt; Stoß, solange sich eine Kugel noch bewegt; beide Füße gleichzeitig in der Luft; eine Kugel bleibt außerhalb des Tisches liegen; Kugeln unerlaubt berührt; Doppelstoß; Schiebestoß; schlechtes Spiel hinter der Kopflinie; Stoß mit nur einer Hand; ein Hilfsmittel (Verlängerung, Brücke) auf dem Tisch ablegen; ein Handyklingeln (beim ersten Mal Foul, danach Rackverlust).",
    en: { title: "Fouls", text: "The opponent gets ball in hand (anywhere on the table, any direction). Fouls include: cue ball pocketed or off the table; first contact with an illegal ball; shooting while a ball is still moving; both feet off the floor at the same time; an object ball coming to rest off the table; illegally touching balls; double hit; push shot; bad play from behind the head string; shooting with one hand only; placing auxiliary equipment (extension, bridge) on the table to shoot; a phone ringing (a foul the first time, loss of rack after that)." },
  },
  {
    id: "weisse-in-hand", ref: "8, 9", title: "Weiße in der Hand",
    text: "Mit der Weißen in der Hand darf sie überall auf dem Tisch platziert und bis zum Stoß beliebig verschoben werden. Dafür darf man jeden Teil des Queues nehmen – aber nicht die Spitze mit einer Stoßbewegung; eine Berührung mit der Spitze ist ein Foul. Nur nach einem Foul im Anstoß gilt die Einschränkung hinter der Kopflinie: Die Weiße darf dann nicht direkt auf eine Kugel hinter der Kopflinie gespielt werden (außer auf einer Kugel genau auf der Linie).",
    en: { title: "Ball in hand", text: "With ball in hand the cue ball may be placed anywhere and moved until the shot is played. You may use any part of the cue – but not the tip with a forward stroke; touching it with the tip is a foul. Only after a foul on the break does the head-string restriction apply: the cue ball may then not be played directly at a ball behind the head string (a ball exactly on the line can be shot)." },
  },
  {
    id: "doppelstoss", ref: "12.6, 12.7, 15.1", title: "Doppelstoß, Schieben & anliegende Kugeln",
    text: "Berührt das Queue die Weiße mehr als einmal oder berührt die Weiße die Objektkugel, bevor die Spitze sie verlassen hat, ist es ein Foul. Streift der Stoß die Objektkugel nur leicht, wird kein Foul angenommen. Die Spitze darf nicht verlängert aufliegen (Schieben) – der Stoß muss ein kurzer Schlag sein. Liegt die Weiße an einer eigenen Kugel an, ist die Stoßrichtung frei; bewegt sich die Objektkugel direkt, ist es kein Doppelstoß – ein offensichtlicher Schiebestoß bleibt aber ein Foul.",
    en: { title: "Double hit, pushing & frozen balls", text: "It is a foul if the cue touches the cue ball more than once or if the cue ball touches the object ball before the tip has left it. If the shot only lightly grazes the object ball, no foul is assumed. The tip must not stay in contact for long (pushing) – the stroke must be a short strike. If the cue ball is frozen to a legal object ball, the shooting direction is free; if the object ball moves directly it is not a double hit – an obvious push remains a foul." },
  },
  {
    id: "bande-anliegend", ref: "5, 15.2", title: "Kugel liegt an der Bande an",
    text: "Liegt eine Objektkugel an der Bande an und ist noch kein gültiger Bandenkontakt erfolgt, muss sie nach dem Treffer die Bande verlassen und danach wieder eine Bande berühren, oder eine andere Kugel (auch die Weiße) muss eine Bande berühren, oder eine Kugel wird versenkt. Sonst ist es ein Foul (Weiße in der Hand). Der Schiedsrichter sagt „anliegend“ an; sagt er nichts, gilt die Kugel als nicht anliegend.",
    en: { title: "Ball frozen to the cushion", text: "If an object ball is frozen to a cushion and no legal cushion contact has happened yet, after being hit it must leave the cushion and touch a cushion again, or another ball (including the cue ball) must touch a cushion, or a ball must be pocketed. Otherwise it is a foul (ball in hand). The referee announces frozen balls; without an announcement the ball counts as not frozen." },
  },
  {
    id: "sprung", ref: "16", title: "Sprungstoß",
    text: "Erlaubt: Die Weiße über Kugeln springen lassen und eine eigene Kugel treffen. Die Weiße muss dabei in der oberen Hälfte getroffen werden. Trifft man die untere Hälfte oder springt die Weiße durch einen Fehlstoß über eine Kugel, ist es ein ungültiger Sprungstoß (Foul). Springt sie nicht über eine Hindernis-Kugel und trifft regelgerecht, bleibt der Stoß gültig.",
    en: { title: "Jump shot", text: "Allowed: make the cue ball jump over balls and hit a ball of your own group. The cue ball must be struck in its upper half. Hitting the lower half, or the cue ball jumping over a ball because of a miscue, is an illegal jump shot (foul). If it does not jump over an obstructing ball and hits legally, the shot stays legal." },
  },
  {
    id: "gleichzeitig", ref: "10.4, 13", title: "Gleichzeitiger Treffer",
    text: "Ist bei zwei Kugeln nicht zu erkennen, welche zuerst getroffen wurde, gilt die erlaubte Kugel als zuerst getroffen. Berührt die Weiße bei offenem Tisch zwei Kugeln verschiedener Gruppen gleichzeitig und fallen beide (oder Kugeln beider Gruppen), darf der Spieler eine Gruppe wählen; der nächste Spieler bekommt dann die andere.",
    en: { title: "Simultaneous contact", text: "If it cannot be seen which of two balls was hit first, the legal ball is assumed to have been hit first. On an open table, if the cue ball hits two balls of different groups simultaneously and both (or balls of both groups) are pocketed, the player may choose either group; the next player then gets the other group." },
  },
  {
    id: "rackverlust", ref: "20", title: "Rackverlust",
    text: "Das Rack verliert, wer die 8 versenkt und dabei foult (außer im Anstoß), die 8 zusammen mit seiner letzten Gruppen-Kugel versenkt, die 8 vom Tisch spielt oder sie versenkt, bevor die eigene Gruppe leer ist. Solange die 8 auf dem Tisch liegt, gibt es nur Fouls; liegt sie nicht mehr auf dem Tisch, ist es Rackverlust.",
    en: { title: "Loss of rack", text: "You lose the rack if you pocket the 8 while fouling (except on the break), pocket the 8 together with your last group ball, drive the 8 off the table, or pocket it before your group is cleared. As long as the 8 is on the table there are only fouls; if it is no longer on the table, it is loss of rack." },
  },
  {
    id: "gruppen-verwechselt", ref: "19", title: "Gruppen verwechselt",
    text: "Wird nach dem Schließen des Tisches die falsche Gruppe gespielt, muss das Foul vor dem nächsten Stoß ausgesprochen werden. Bemerkt ein Spieler oder der Schiedsrichter die Verwechslung, wird das Rack sofort abgebrochen und neu aufgebaut.",
    en: { title: "Groups mixed up", text: "If the wrong group is played after the table is closed, the foul must be called before the next shot. When a player or the referee notices the mix-up, the rack is stopped at once and re-racked." },
  },
  {
    id: "patt", ref: "21", title: "Patt",
    text: "Droht ein Patt, schlägt der Schiedsrichter Neuaufbau und neuen Anstoß vor. Lehnt ein Spieler ab, bekommt jeder noch drei Stöße (oder der Schiedsrichter entscheidet anders). Bleibt es festgefahren, wird neu aufgebaut: Der ursprüngliche Anstoßende stößt wieder an, die Reihenfolge bleibt gleich.",
    en: { title: "Stalemate", text: "If a stalemate is likely, the referee proposes a re-rack and new break. If a player refuses, each gets three more shots (or the referee decides otherwise). If it stays stuck, the balls are re-racked: the original breaker breaks again and the order of play stays the same." },
  },
  {
    id: "foul-absicht", ref: "18, 23, 24", title: "Absichtliches Foul & Unsportlichkeit",
    text: "Ein absichtliches Foul verliert beim ersten Mal das Rack, beim zweiten Mal das Match. Unsportlich ist u. a.: den Gegner ablenken, Kugeln außerhalb eines Stoßes bewegen, absichtlich einen Fehlstoß machen, nach einem Foul weiterspielen, während des Matches üben, den Tisch markieren, absichtlich Zeit verzögern, eine Kugel oder das Spiel aufgeben (Aufgeben und „Schenken“ sind verboten), unangemessenes Verhalten. Die Strafe reicht von der Verwarnung bis zum Ausschluss.",
    en: { title: "Intentional foul & unsportsmanlike conduct", text: "An intentional foul loses the rack the first time and the match the second time. Unsportsmanlike conduct includes: distracting the opponent, moving balls other than by a shot, intentionally miscuing, continuing to play after a foul was called, practicing during the match, marking the table, intentionally delaying, conceding a ball or the match (conceding is prohibited), and inappropriate behavior. Penalties range from a warning to disqualification." },
  },
  {
    id: "zeit", ref: "14, Kap. I", title: "Zeit pro Stoß & Zeitspiel",
    text: "In der Regel gelten 45 Sekunden pro Stoß, ab 10 Sekunden gibt es eine Erinnerung, ab 5 Sekunden zählt der Schiedsrichter herunter. Pro Rack darf jeder Spieler einmal verlängern (üblicherweise 30 Sekunden). Wird die Zeit überschritten, ist es ein Foul. Für den Anstoß gelten 30 Sekunden ohne Verlängerung. Bei Spielen auf Zeit (z. B. 120 Minuten) entscheidet am Ende das Rack-Ergebnis; bei Gleichstand folgt ein Shootout mit fünf Stößen je Spieler (Weiße auf dem Kopfpunkt, die 8 auf dem Fußpunkt).",
    en: { title: "Shot clock & timed matches", text: "Usually 45 seconds per shot; there is a reminder at 10 seconds and the referee counts down from 5. Each player may call one extension per rack (usually 30 seconds). Exceeding the time is a foul. The break has 30 seconds with no extension. In timed matches (e.g. 120 minutes) the rack score decides at the end; if tied, a shootout with five shots per player follows (cue ball on the head spot, the 8 on the foot spot)." },
  },
  {
    id: "zuruecklegen", ref: "7", title: "Kugel zurücklegen",
    text: "Müssen Kugeln zurückgelegt werden, setzt sie der Schiedsrichter möglichst auf ihre ursprüngliche Stelle. Ist die blockiert, kommt die Kugel auf die Längsmittellinie zwischen Fußpunkt und oberer Bande, möglichst nahe am Fußpunkt. Der Spieler muss die vom Schiedsrichter bestimmte Lage akzeptieren.",
    en: { title: "Re-spotting balls", text: "If balls must be re-spotted, the referee places them as close to their original position as possible. If that is blocked, the ball goes on the long axis between the foot spot and the top cushion, as close to the foot spot as possible. The player must accept the position set by the referee." },
  },
];

/* Übersetzungen im üblichen Format (Schlüssel = deutscher Text) für addTranslations(). */
export const HEYBALL_EN = Object.fromEntries([
  [HEYBALL_SOURCE, HEYBALL_SOURCE_EN],
  ...HEYBALL_RULES.flatMap((r) => [[r.title, r.en.title], [r.text, r.en.text]]),
]);
