// Frei per Drag & Drop sortierbare Statistik-Karten (Nutzer-Feedback: "lange
// druecken, dann verschieben" - Aktivierungsverzoegerung sitzt in
// StatistikScreen.jsx/SortableCard.jsx, nicht hier). Die gespeicherte
// Reihenfolge ist EIN flaches Array aller Karten-IDs, nicht getrennt nach
// Spalte - welche Karte auf dem Desktop in der mittleren bzw. rechten
// Spalte landet, berechnet splitCardColumns() daraus automatisch per
// Hoehen-Ausgleich, siehe dort. Auf dem Handy werden einfach beide Gruppen
// hintereinander gestapelt (erst Mitte, dann rechts).
export const STAT_CARD_SCREEN = "stats";

// "entwicklung" bewusst zuerst: splitCardColumns() weist die allererste
// Karte per Gleichstand-Regel immer der mittleren Spalte zu - der
// Verlaufs-Graph ist "der eigentliche Fokus dieser Seite" (siehe App.css)
// und soll das auch im nie-angefassten Standardzustand bleiben, nicht
// zufaellig in die rechte Spalte rutschen. "globalFilter" bewusst gleich
// danach: landet dadurch im Standardzustand ganz oben in der rechten
// Spalte (wie bisher fest verdrahtet), ist jetzt aber wie jede andere
// Karte frei verschiebbar (Nutzer-Feedback: "auch die 'Selection for all
// Statistics' verschiebbar machen").
export const DEFAULT_STAT_CARD_ORDER = [
  "entwicklung",
  "globalFilter",
  "rekordeClub",
  "letzteMatches",
  "rangliste",
  "meisteSiege",
  "besteSiegquote",
  "aktuelleSerien",
  "schnellstesTempo",
  "schnellste141",
];

// Grobe Referenzhoehen (px) im Modus "3 anzeigen", NICHT die tatsaechliche
// gerade gerenderte Hoehe - dient nur dem automatischen Spalten-Ausgleich
// beim Verteilen der Karten. Bewusst fest geschaetzt statt live gemessen:
// sonst wuerde ein Wechsel der globalen Top-3/10/Alle-Auswahl staendig neu
// balancieren und Karten sichtbar hin- und herspringen lassen (Nutzer-
// Feedback: Spaltenlaenge soll sich am "3 anzeigen"-Modus orientieren,
// nicht an der gerade gewaehlten Anzahl).
export const STAT_CARD_HEIGHTS = {
  rangliste: 230,
  entwicklung: 360,
  globalFilter: 150,
  meisteSiege: 195,
  rekordeClub: 440,
  besteSiegquote: 195,
  aktuelleSerien: 195,
  letzteMatches: 560,
  schnellstesTempo: 195,
  schnellste141: 195,
};

// Bekannte, aber inzwischen entfernte Karten fallen beim Normalisieren
// einfach weg; neue, dem Nutzer noch unbekannte Karten werden ans Ende
// angehaengt statt zu verschwinden (siehe normalizeCardOrder).
export function normalizeCardOrder(saved, defaultOrder = DEFAULT_STAT_CARD_ORDER) {
  const known = new Set(defaultOrder);
  const cleaned = (Array.isArray(saved) ? saved : []).filter((id) => known.has(id));
  const seen = new Set(cleaned);
  const missing = defaultOrder.filter((id) => !seen.has(id));
  return [...cleaned, ...missing];
}

// Verteilt eine flache Kartenreihenfolge auf zwei Spalten (Desktop): jede
// Karte geht der Reihe nach in die aktuell kuerzere Spalte (Nutzer-Feedback:
// "Spalten sollten insgesamt etwa gleichlang sein, damit der Scrollweg immer
// gleich bleibt"). Bei gleicher Hoehe gewinnt die mittlere Spalte, damit die
// Lesereihenfolge grob von links nach rechts bleibt.
export function splitCardColumns(order, heights = STAT_CARD_HEIGHTS) {
  const middle = [];
  const right = [];
  let hMiddle = 0;
  let hRight = 0;
  order.forEach((id) => {
    const h = heights[id] ?? 200;
    if (hMiddle <= hRight) { middle.push(id); hMiddle += h; }
    else { right.push(id); hRight += h; }
  });
  return { middle, right };
}
