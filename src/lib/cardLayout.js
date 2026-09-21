// Frei per Drag & Drop sortierbare Statistik-Karten (Nutzer-Feedback: "lange
// druecken, dann verschieben" - Aktivierungsverzoegerung sitzt in
// StatistikScreen.jsx/SortableCard.jsx, nicht hier).
//
// Stufe 4 (nach drei frueheren Versuchen, siehe Git-Historie): keine
// automatische Spaltenzuteilung mehr ueberhaupt - der Nutzer entscheidet
// selbst, ob eine Karte in der mittleren oder rechten Spalte steht, entweder
// per Ziehen auf eine Karte der Zielspalte oder per Knopf an jeder Karte
// (siehe CardColumnButton.jsx - noetig, weil eine LEERE Spalte keine Karte
// zum Zielen bietet). Reihenfolge (cardOrder) und Spalte (cardColumns) sind
// zwei unabhaengige Werte, aber Ziehen darf beide gleichzeitig aendern: die
// Reihenfolge IMMER, die Spalte NUR fuer die gerade gezogene Karte selbst -
// keine andere Karte wechselt dabei ihre Spalte (siehe handleDragEnd in
// StatistikScreen.jsx). Nutzer-Feedback, das zu dieser Entscheidung
// fuehrte: "es könnte ja durchaus sein, dass der User zb. alles in der
// Mitte anzeigen will" (ein automatischer Hoehen-Ausgleich verhindert das
// strukturell), "am Smartphone sollte die Sortierung gleich bleiben, aber
// am PC wirkt sich eine solche Verschiebung aus" (die Spaltenwahl ist ein
// reines Desktop-Konzept - am Handy gibt es nur eine gemeinsame Liste in
// cardOrder, siehe StatistikScreen.jsx) und schliesslich "ich versuche die
// oberste Karte aus der rechten Spalte an die 1. Stelle in der breiten
// Spalte zu ziehen - das funktioniert aber nicht" (ein erster Entwurf
// dieser Stufe liess Ziehen NUR die Reihenfolge aendern, nie die Spalte -
// das widersprach der normalen Erwartung an Drag & Drop zwischen zwei
// sichtbaren Spalten).
//
// Vorgeschichte: Stufe 1 (ein flaches Array + EINE Hoehe pro Karte) fuehlte
// sich beim Ziehen unvorhersehbar an, weil eine verschobene Karte die
// Spaltenzuordnung mehrerer anderer Karten mit veraendern konnte. Stufe 2
// (zwei vom Nutzer direkt kontrollierte Spalten-Arrays, je eine eigene
// SortableContext) loeste das, erzeugte aber ein sichtbares Einfrieren der
// gezogenen Karte beim Ueberqueren der Spaltengrenze (jede SortableContext
// kennt nur Positionen innerhalb ihrer eigenen Liste), weil Ziehen dort
// GLEICHZEITIG zum Umsortieren auch zum Spaltenwechsel diente. Stufe 3 (ein
// automatischer Hoehen-Ausgleich, zuerst als freie Durchmischung, dann als
// Praefix/Suffix-Schnitt) vermied das Einfrieren wieder (nur noch EINE
// SortableContext), hatte aber weiterhin das Grundproblem: die Spalte einer
// Karte war nie wirklich frei waehlbar, sondern immer nur eine Folge der
// Reihenfolge. Stufe 4 loest genau das: Ziehen bleibt bei EINER
// SortableContext (kein Einfrieren moeglich), ein Spaltenwechsel durch
// Ziehen betrifft aber immer nur die gezogene Karte selbst - dadurch kann
// Ziehen niemals mehr eine andere, unbeteiligte Karte in die jeweils
// andere Spalte verschieben (der eigentliche Fehler in den fruehreren
// Stufen, nicht die Moeglichkeit eines Spaltenwechsels an sich).
export const STAT_CARD_SCREEN = "stats";

export const DEFAULT_STAT_CARD_ORDER = [
  "entwicklung",
  "letzteMatches",
  "aktuelleSerien",
  "schnellste141",
  "globalFilter",
  "rekordeClub",
  "rangliste",
  "meisteSiege",
  "besteSiegquote",
  "schnellstesTempo",
];

// Standard-Spaltenzuordnung (nur als Ausgangspunkt - der Nutzer kann jede
// Karte jederzeit per Knopf umstellen, siehe CardColumnButton.jsx). Fehlt
// eine Karte hier, gilt sie als "middle". Deckt sich bewusst mit der
// Aufteilung, die der fruehere automatische Hoehen-Ausgleich (Stufe 3) im
// Standardzustand ergab, damit sich fuer bestehende Nutzer beim Umstieg
// nichts sichtbar aendert.
export const DEFAULT_STAT_CARD_COLUMNS = {
  globalFilter: "right",
  rekordeClub: "right",
  rangliste: "right",
  meisteSiege: "right",
  besteSiegquote: "right",
  schnellstesTempo: "right",
};

// Bekannte, aber inzwischen entfernte Karten fallen beim Normalisieren
// einfach weg; neue, dem Nutzer noch unbekannte Karten werden ans Ende
// angehaengt statt zu verschwinden. Erkennt zusaetzlich die Formate
// frueherer Stufen ({order, columns} von Stufe 4 selbst nach einem
// zukuenftigen Schema-Wechsel, {middle:[...], right:[...]} von Stufe 2) und
// fuehrt sie zu EINER Reihenfolge zusammen (Mitte zuerst, dann Rechts),
// damit eine bereits gespeicherte Anordnung nicht einfach verloren geht,
// nur weil sich das Speicherformat geaendert hat.
export function normalizeCardOrder(saved, defaultOrder = DEFAULT_STAT_CARD_ORDER) {
  const known = new Set(defaultOrder);
  let flat;
  if (Array.isArray(saved)) flat = saved;
  else if (saved && Array.isArray(saved.order)) flat = saved.order;
  else if (saved && (Array.isArray(saved.middle) || Array.isArray(saved.right))) {
    flat = [...(saved.middle || []), ...(saved.right || [])];
  } else flat = [];
  const cleaned = flat.filter((id) => known.has(id));
  const seen = new Set(cleaned);
  const missing = defaultOrder.filter((id) => !seen.has(id));
  return [...cleaned, ...missing];
}

// Liest die vom Nutzer explizit gewaehlte Spalte je Karte (Stufe 4 - siehe
// Kommentar ganz oben). saved.columns ist das aktuelle Format ({cardId:
// "right"}, "middle" wird nie explizit gespeichert - alles, was hier nicht
// als "right" auftaucht, gilt als "middle"). Das aeltere {middle, right}-
// Format aus Stufe 2 wird ebenfalls erkannt, damit eine schon vom Nutzer
// getroffene Spaltenwahl beim Umstieg erhalten bleibt, statt auf den
// Standard zurueckzufallen. Fuer jede Karte OHNE explizite fruehere Wahl
// (reines Stufe-1/3-Array oder komplett neue Karte) greift defaultColumns.
export function normalizeCardColumns(saved, order, defaultColumns = DEFAULT_STAT_CARD_COLUMNS) {
  let explicit = null;
  if (saved && saved.columns && typeof saved.columns === "object") {
    explicit = saved.columns;
  } else if (saved && (Array.isArray(saved.middle) || Array.isArray(saved.right))) {
    explicit = {};
    (saved.middle || []).forEach((id) => { explicit[id] = "middle"; });
    (saved.right || []).forEach((id) => { explicit[id] = "right"; });
  }
  const columns = {};
  order.forEach((id) => {
    const chosen = explicit?.[id];
    columns[id] = chosen === "right" ? "right" : chosen === "middle" ? "middle" : (defaultColumns[id] === "right" ? "right" : "middle");
  });
  return columns;
}

// Teilt eine Kartenreihenfolge anhand der vom Nutzer gewaehlten Spalte auf
// (reines Filtern, keine Berechnung mehr - siehe Kommentar ganz oben, warum
// ein automatischer Ausgleich abgeschafft wurde). Die relative Reihenfolge
// innerhalb jeder Spalte kommt unveraendert aus "order".
export function splitCardColumns(order, columns = {}) {
  const middle = [];
  const right = [];
  order.forEach((id) => (columns[id] === "right" ? right : middle).push(id));
  return { middle, right };
}

// ---------------------------------------------------------------------------
// Sichtbarkeit einzelner Karten (Nutzer-Feedback: "es werden mittlerweile so
// viele Karten, dass es unuebersichtlich ist"). Bewusst getrennt vom
// Einklappen (collapsedCards, nur localStorage): Einklappen ist eine kurze
// Geste auf EINEM Geraet, Ausblenden eine dauerhafte Entscheidung, die der
// Nutzer in den Einstellungen wiederfinden und auf jedem Geraet gleich haben
// soll - deshalb am Spielerprofil gespeichert, im selben card_layout-Eintrag
// wie Reihenfolge und Spalte (siehe supabase/2026-09-21_card_visibility.sql).
//
// Pro Bildschirm liegt dort EIN Objekt ({order, columns, hidden}), also muss
// jeder Schreibzugriff den jeweils anderen Teil mit uebernehmen - sonst
// loescht ein Ausblenden die Drag&Drop-Reihenfolge und umgekehrt. Genau
// dafuer ist mergeCardLayout() da; beide Schreibwege (Statistik-Layout und
// Sichtbarkeit) gehen darueber.
//
// Der Katalog hier ist die einzige Stelle, die alle ausblendbaren Karten
// kennt - die Einstellungsseite im Profil baut ihre Liste daraus, und
// normalizeHiddenCards() wirft damit ids weg, die es nicht mehr gibt.
// Absichtlich NICHT dabei: die Identitaets-/Profilkarte in der Seitenspalte
// (sie ist der Kopf des Bildschirms, kein Modul unter vielen) und die
// Turnier-Liste (der ganze Inhalt des Turnier-Menuepunkts - ausblenden
// wuerde dort eine leere Seite hinterlassen).
export const CARD_SCREENS = [
  {
    screen: "stats",
    label: "Statistik",
    cards: [
      { id: "globalFilter", label: "Auswahl fuer alle Statistiken" },
      { id: "rangliste", label: "Rangliste" },
      { id: "entwicklung", label: "Entwicklung über die Zeit" },
      { id: "rekordeClub", label: "Rekorde" },
      { id: "letzteMatches", label: "Letzte Matches" },
      { id: "meisteSiege", label: "Meiste Siege" },
      { id: "besteSiegquote", label: "Beste Siegquote" },
      { id: "aktuelleSerien", label: "Aktuelle Serien" },
      { id: "schnellstesTempo", label: "Schnellstes Tempo" },
      { id: "schnellste141", label: "Schnellstes 14/1-Tempo" },
    ],
  },
  {
    screen: "live",
    label: "Live",
    cards: [
      { id: "duelle", label: "Duelle" },
      { id: "pings", label: "Live" },
      { id: "planung", label: "Planung" },
    ],
  },
  {
    screen: "profil",
    label: "Profil",
    cards: [
      { id: "erfolgeFortschritt", label: "Erfolge (Fortschritt)" },
      { id: "ratings", label: "Ratings nach Disziplin" },
      { id: "rekorde", label: "Rekorde" },
      { id: "headToHead", label: "Head-to-Head" },
      { id: "erfolge", label: "Erfolge (alle)" },
      { id: "tempo", label: "Spielgeschwindigkeit" },
      { id: "anmeldung", label: "Anmeldung & Sicherheit" },
      { id: "feedback", label: "Feedback" },
      { id: "tickets", label: "Meine Tickets" },
    ],
  },
];

export const CARD_SCREEN_BY_ID = Object.fromEntries(CARD_SCREENS.map((s) => [s.screen, s]));

export function screenCards(screen) {
  return CARD_SCREEN_BY_ID[screen]?.cards || [];
}

// Liest die ausgeblendeten Karten eines Bildschirms. Unbekannte ids (frueher
// ausgeblendete, inzwischen entfernte Karten) fallen weg - sonst wuerde eine
// Karte, die spaeter mit derselben id wiederkommt, unsichtbar bleiben, ohne
// dass der Nutzer das je entschieden haette. Ein reines Array als gespeicherter
// Wert ist das alte Format von Stufe 1 (nur Reihenfolge, siehe oben) und
// enthaelt daher nie ausgeblendete Karten.
export function normalizeHiddenCards(saved, screen) {
  const known = new Set(screenCards(screen).map((c) => c.id));
  const raw = saved && !Array.isArray(saved) && Array.isArray(saved.hidden) ? saved.hidden : [];
  return raw.filter((id) => known.has(id));
}

// Baut den neuen card_layout-Eintrag EINES Bildschirms: der gespeicherte
// Stand plus die geaenderten Felder. Aeltere Formate (flaches Array =
// Reihenfolge, {middle,right} = Stufe 2) werden dabei nicht mitgeschleppt -
// die lesenden Normalisierer (normalizeCardOrder/-Columns) haben sie beim
// Laden ohnehin schon in order/columns uebersetzt, und der Aufrufer schickt
// genau diese uebersetzten Werte wieder mit.
export function mergeCardLayout(saved, patch) {
  const base = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  return { ...base, ...patch };
}
