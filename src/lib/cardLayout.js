// Frei per Drag & Drop sortierbare Statistik-Karten (Nutzer-Feedback: "lange
// druecken, dann verschieben" - Aktivierungsverzoegerung sitzt in
// StatistikScreen.jsx/SortableCard.jsx, nicht hier).
//
// Stufe 3 (nach zwei frueheren Versuchen, siehe Git-Historie): die
// gespeicherte Reihenfolge ist wieder EIN flaches Array, mittlere und
// rechte Spalte werden automatisch daraus berechnet (splitCardColumns) -
// diesmal aber mit ZWEI Referenzhoehen pro Karte (eine fuer die breite
// mittlere, eine fuer die schmale rechte Spalte), nicht nur einer. Die
// Aufteilung selbst ist ein einziger Praefix/Suffix-Schnitt (siehe
// Kommentar bei splitCardColumns), keine freie Durchmischung - das hielt
// sich zwischenzeitlich (Karten-Tausch wirkungslos, dann: Verschieben
// innerhalb einer Spalte wirft fremde Karten raus) erst nach zwei
// Korrekturrunden durch.
//
// Vorgeschichte: Stufe 1 (ein flaches Array + EINE Hoehe pro Karte) fuehlte
// sich beim Ziehen unvorhersehbar an, weil eine verschobene Karte die
// Spaltenzuordnung mehrerer anderer Karten mit veraendern konnte. Stufe 2
// (zwei vom Nutzer direkt kontrollierte Spalten-Arrays, je eine eigene
// SortableContext) loeste das, erzeugte aber ein sichtbares Einfrieren der
// gezogenen Karte beim Ueberqueren der Spaltengrenze (jede SortableContext
// kennt nur Positionen innerhalb ihrer eigenen Liste). Nutzer-Feedback
// dazu: "behandle Mitte und Rechts wie eine einzige Spalte... die
// Entscheidung soll aufgrund der Layoutgroesse jeder Karte getroffen
// werden... beruecksichtige, dass die mittlere Spalte die Karten wegen der
// groesseren Breite auch hoeher macht" - zurueck zu EINER Reihenfolge +
// EINER SortableContext (kein Einfrieren mehr moeglich, es gibt keine
// Spaltengrenze fuer den Drag mehr), automatischer Ausgleich uebernimmt
// wieder die Spaltenzuteilung, jetzt aber mit spaltenspezifischen Hoehen.
export const STAT_CARD_SCREEN = "stats";

// Reihenfolge bewusst so gewaehlt, dass die fuer die breite mittlere Spalte
// gedachten Karten VORNE stehen und die fuer die schmale rechte Spalte
// gedachten Karten DANACH folgen ("breite Spalte Mitte --> duenne Spalte
// rechts", siehe Kommentar bei splitCardColumns) - das ergibt zusammen mit
// dem Praefix-Ausgleich dort automatisch die gewuenschte Standardaufteilung.
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

// Tatsaechlich gemessene Kartenhoehen (px) im Standardzustand ("3
// anzeigen", keine Filter, Testdaten) - je EINMAL bei 553px (mittlere,
// breite Spalte) und EINMAL bei 300px (rechte, schmale Spalte) Breite.
// Dient nur dem automatischen Spalten-Ausgleich beim Verteilen der Karten,
// NICHT der tatsaechlichen Live-Hoehe (die haengt z.B. von der gerade
// gewaehlten Top-N-Auswahl ab - deshalb feste Referenzwerte statt live zu
// messen, sonst wuerde ein Wechsel der Auswahl staendig neu balancieren
// und Karten sichtbar hin- und herspringen lassen).
//
// Wichtig: die schmalere Spalte macht eine Karte nicht automatisch hoeher!
// Karten mit reinen Listenzeilen (Bestenlisten) werden dort selten hoeher,
// weil ihre Zeilen selten umbrechen. Der Verlaufs-Graph (SVG mit
// viewBox + height:auto) wird dagegen in der BREITEN Spalte hoeher (die
// Grafik behaelt ihr Seitenverhaeltnis bei - mehr Breite ergibt
// proportional mehr Hoehe). Match-/Filterzeilen (Spielehistorie, Rekorde-
// Tabelle) werden dagegen in der schmalen Spalte hoeher, weil dort mehr
// umbricht. Deshalb zwei eigene Tabellen statt einer gemeinsamen mit einem
// pauschalen Auf-/Abschlag.
export const STAT_CARD_HEIGHTS_MIDDLE = { // Karte in der breiten mittleren Spalte (553px)
  entwicklung: 560,
  globalFilter: 159,
  rekordeClub: 513,
  letzteMatches: 665,
  rangliste: 191,
  meisteSiege: 211,
  besteSiegquote: 191,
  aktuelleSerien: 191,
  schnellstesTempo: 160,
  schnellste141: 123,
};
export const STAT_CARD_HEIGHTS_RIGHT = { // Karte in der schmalen rechten Spalte (300px)
  entwicklung: 436,
  globalFilter: 190,
  rekordeClub: 583,
  letzteMatches: 839,
  rangliste: 191,
  meisteSiege: 211,
  besteSiegquote: 191,
  aktuelleSerien: 191,
  schnellstesTempo: 160,
  schnellste141: 123,
};

// Bekannte, aber inzwischen entfernte Karten fallen beim Normalisieren
// einfach weg; neue, dem Nutzer noch unbekannte Karten werden ans Ende
// angehaengt statt zu verschwinden. Erkennt zusaetzlich das Format der
// vorherigen Stufe ({middle:[...], right:[...]}) und fuehrt es zu EINER
// Reihenfolge zusammen (Mitte zuerst, dann Rechts), damit eine bereits
// gespeicherte Anordnung nicht einfach verloren geht, nur weil sich das
// Speicherformat geaendert hat.
export function normalizeCardOrder(saved, defaultOrder = DEFAULT_STAT_CARD_ORDER) {
  const known = new Set(defaultOrder);
  let flat;
  if (Array.isArray(saved)) flat = saved;
  else if (saved && (Array.isArray(saved.middle) || Array.isArray(saved.right))) {
    flat = [...(saved.middle || []), ...(saved.right || [])];
  } else flat = [];
  const cleaned = flat.filter((id) => known.has(id));
  const seen = new Set(cleaned);
  const missing = defaultOrder.filter((id) => !seen.has(id));
  return [...cleaned, ...missing];
}

// Verteilt eine flache Kartenreihenfolge auf zwei Spalten (Desktop): die
// ERSTEN Karten der Reihenfolge gehen als zusammenhaengender Block in die
// mittlere Spalte, alle danach als zusammenhaengender Block in die rechte
// Spalte ("breite Spalte Mitte --> duenne Spalte rechts", wie urspruenglich
// angekuendigt) - gesucht wird nur die EINE Trennstelle (k), an der die
// Summe der Mitte-Hoehen vor k und die Summe der Rechts-Hoehen ab k
// moeglichst gleich gross sind. Bei mehreren gleich guten Trennstellen
// gewinnt die groessere (mehr Karten in der Mitte), damit die Lesereihen-
// folge grob von links nach rechts bleibt.
//
// Nutzer-Feedback: "wenn ich in der mittleren Spalte eine Karte von der 2.
// an die 1. Stelle verschiebe, springt die Karte an der 1. Stelle sofort in
// die rechte Spalte". Ursache war eine fruehere Version dieser Funktion, die
// JEDE Karte einzeln der Reihe nach der gerade kuerzeren Spalte zuteilte
// (freie Durchmischung statt zusammenhaengender Bloecke) - eine Karte weiter
// vorne in der Reihenfolge zu verschieben, veraenderte dadurch die
// laufenden Zwischensummen und konnte JEDE andere, spaeter geprüfte Karte
// unvorhersehbar in die andere Spalte umleiten, auch wenn beide gar nicht
// nah beieinander standen. Mit einer einzigen Trennstelle aendert eine
// Verschiebung INNERHALB desselben Blocks (vor oder nach k) dagegen gar
// nichts an der Spaltenzuteilung - nur ein Verschieben UEBER die
// Trennstelle hinweg kann sie verschieben, und dann auch nur fuer die dabei
// tatsaechlich uebersprungenen Karten (wie bei jeder normalen sortierbaren
// Liste).
export function splitCardColumns(order, middleHeights = STAT_CARD_HEIGHTS_MIDDLE, rightHeights = STAT_CARD_HEIGHTS_RIGHT) {
  const n = order.length;
  const prefixMiddle = [0];
  for (let i = 0; i < n; i++) prefixMiddle.push(prefixMiddle[i] + (middleHeights[order[i]] ?? 200));
  const suffixRight = new Array(n + 1);
  suffixRight[n] = 0;
  for (let i = n - 1; i >= 0; i--) suffixRight[i] = suffixRight[i + 1] + (rightHeights[order[i]] ?? 200);

  let bestK = 0;
  let bestDiff = Infinity;
  for (let k = 0; k <= n; k++) {
    const diff = Math.abs(prefixMiddle[k] - suffixRight[k]);
    if (diff <= bestDiff) { bestDiff = diff; bestK = k; }
  }
  return { middle: order.slice(0, bestK), right: order.slice(bestK) };
}
