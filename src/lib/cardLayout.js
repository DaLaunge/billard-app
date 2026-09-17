// Frei per Drag & Drop sortierbare Statistik-Karten (Nutzer-Feedback: "lange
// druecken, dann verschieben" - Aktivierungsverzoegerung sitzt in
// StatistikScreen.jsx/SortableCard.jsx, nicht hier).
//
// Stufe 4 (nach drei frueheren Versuchen, siehe Git-Historie): keine
// automatische Spaltenzuteilung mehr ueberhaupt - der Nutzer entscheidet
// selbst per Knopf an jeder Karte (siehe CardColumnButton.jsx), ob sie in
// der mittleren oder rechten Spalte steht. Reihenfolge (cardOrder) und
// Spalte (cardColumns) sind dadurch zwei VOELLIG unabhaengige Werte:
// Ziehen aendert nur die Reihenfolge INNERHALB der jeweils eigenen Spalte,
// der Knopf aendert nur die Spalte, nie die Reihenfolge. Nutzer-Feedback,
// das zu dieser Entscheidung fuehrte: "es könnte ja durchaus sein, dass der
// User zb. alles in der Mitte anzeigen will" (ein automatischer
// Hoehen-Ausgleich verhindert das strukturell) und "am Smartphone sollte
// die Sortierung gleich bleiben, aber am PC wirkt sich eine solche
// Verschiebung aus" (die Spaltenwahl ist ein reines Desktop-Konzept - am
// Handy gibt es nur eine gemeinsame Liste in cardOrder, siehe
// StatistikScreen.jsx).
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
// SortableContext (kein Einfrieren moeglich), aber ein Spaltenwechsel
// passiert nie mehr durch Ziehen ueber eine Grenze hinweg, sondern
// ausschliesslich durch den expliziten Knopf - dadurch kann Ziehen
// niemals mehr eine andere, unbeteiligte Karte in die jeweils andere
// Spalte verschieben.
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
