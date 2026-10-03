/* ============================================================
   TUTORIAL-KATALOG - die EINE Stelle, an der Schritte stehen.

   Neues Feature gebaut? Hier einen Schritt ans ENDE der Liste haengen - mehr
   ist nicht noetig. Wer das Tutorial schon kennt, bekommt beim naechsten
   Start automatisch nur die Schritte gezeigt, die er noch nicht gesehen hat
   ("Neu in dieser Version"); neue Nutzer bekommen alle. Das Erkennen laeuft
   ueber die ids (siehe tutorialState.js), nicht ueber Versionsnummern - die
   zaehlen auf test als 391.x und waeren dafuer zu grob.

   Regeln:
   - id: stabil und eindeutig, wird auf dem Geraet gemerkt. NIE umbenennen oder
     wiederverwenden (sonst sehen alle den Schritt erneut bzw. nie). Soll ein
     Schritt inhaltlich neu erscheinen, bekommt er eine NEUE id (z.B. "match-2").
   - Reihenfolge = Reihenfolge in der Tour; neue Schritte ans Ende (Neu-Anzeige
     zeigt nur die ungesehenen, in dieser Reihenfolge).
   - tab: Hauptbildschirm, auf dem der Schritt spielt ("stats" | "turnier" |
     "live" | "profil"); die Tour wechselt dorthin. Ohne tab bleibt man, wo man ist.
   - target: CSS-Selektor des Elements, das hervorgehoben wird (z.B.
     '[data-tour="tab-live"]'). Fehlt es oder wird es nicht gefunden, erscheint
     der Schritt mittig ohne Hervorhebung - ein kaputter Selektor bricht also nie.
   - icon: Schluessel aus ICONS in TutorialOverlay.jsx.
   - title/body: deutsche Texte wie ueberall (t()-Schluessel); englische
     Uebersetzung in lib/i18n.js nachtragen. Kurz halten: ein Gedanke pro Schritt.
   - Nicht hier aufnehmen: Bildschirme mit unbestaetigter Eingabe (Match,
     Winner Stays) - die Tour zeigt nur Hauptbildschirme.
   ============================================================ */
export const TUTORIAL_STEPS = [
  {
    id: "welcome", icon: "welcome",
    title: "Willkommen bei Break & Rank",
    body: "Hier hältst du eure Billard-Matches fest, siehst dein Rating und misst dich mit dem Club. Die kurze Tour zeigt dir das Wichtigste. Du findest sie jederzeit wieder unter Profil → Zahnrad → Konto & Hilfe.",
  },
  {
    id: "match", icon: "match", tab: "stats", target: '[data-tour="tab-fab"]',
    title: "Neues Match eintragen",
    body: "Mit dem großen Plus startest du ein Match: Disziplin wählen, Gegner antippen, Match starten und Punkte zählen. Dein Gegner bestätigt das Ergebnis – erst dann zählt es fürs Rating.",
  },
  {
    id: "stats", icon: "stats", tab: "stats", target: '[data-tour="tab-stats"]',
    title: "Statistik",
    body: "Bestenlisten, Rating-Verlauf, Rekorde und deine letzten Matches. Hinter dem Trichter-Symbol filterst du nach Disziplin, Einzel oder Doppel.",
  },
  {
    id: "turnier", icon: "turnier", tab: "stats", target: '[data-tour="tab-turnier"]',
    title: "Turniere",
    body: "Lege Turniere an (Gruppen, K.-o., Winner Stays …) und spiele sie direkt in der App. Wenn du am Tisch dran bist, meldet sich die App.",
  },
  {
    id: "live", icon: "live", tab: "live", target: '[data-tour="tab-live"]',
    title: "Live: Mitspieler finden",
    body: "Zeig mit „Ich bin am Tisch“, dass du spielen willst, fordere jemanden heraus oder plane einen Termin. Die Zahl am Symbol sagt dir, ob etwas auf dich wartet.",
  },
  {
    id: "profil", icon: "profil", tab: "profil", target: '[data-tour="tab-profil"]',
    title: "Dein Profil",
    body: "Hier siehst du Erfolge, deine Zahlen und Rekorde. Über das QR-Symbol laden andere dich zum Match ein, mit dem Zahnrad passt du alles an.",
  },
  {
    id: "achievements", icon: "achievements", tab: "profil", target: "#pf-achievements-full",
    title: "Erfolge",
    body: "Ganz oben stehen die drei Erfolge, die dir am nächsten sind – tippe einen an, um die genaue Bedingung zu lesen. Freigeschaltete Erfolge kannst du als Avatar zeigen.",
  },
  {
    id: "customize", icon: "customize", tab: "profil",
    title: "Passe die App an dich an",
    body: "Zu viel auf einmal? Jede Karte hat oben ein Drei-Punkte-Menü zum Ausblenden. Unter Zahnrad → Karten ordnest du alles neu, und unter „Dieses Gerät“ stellst du z. B. ein, dass Filter immer offen sind.",
  },
  {
    id: "match-extras", icon: "extras", tab: "stats",
    title: "Zusatzzähler und Spieluhr",
    body: "Beim Zählen im Match läuft eine Uhr mit Pause-Knopf, und optional zählst du Fluke, Runout, Scratch und Foul mit. Die App weist dich darauf hin, wenn eine Eingabe nicht stimmen kann.",
  },
];
