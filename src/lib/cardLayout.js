// Frei per Drag & Drop sortierbare Statistik-Karten (Nutzer-Feedback: "lange
// druecken, dann verschieben" - Aktivierungsverzoegerung sitzt in
// StatistikScreen.jsx/SortableCard.jsx, nicht hier).
//
// Stufe 2 (Nutzer-Feedback nach dem ersten Test): urspruenglich war die
// gespeicherte Reihenfolge EIN flaches Array, die Aufteilung auf die
// mittlere/rechte Spalte wurde automatisch per laufender Hoehensumme
// berechnet (splitCardColumns, inzwischen entfernt). Das fuehlte sich beim
// Ziehen unvorhersehbar an: eine einzelne Karte verschieben konnte die
// Spaltenzuordnung mehrerer ANDERER Karten mit veraendern ("Karten
// verschieben sich 2 oder 3 Karten weiter statt den Platz zu tauschen").
// Jetzt sind Mitte und Rechts ZWEI eigene Arrays, die der Nutzer direkt per
// Drag & Drop kontrolliert (getrennte SortableContext je Spalte in
// StatistikScreen.jsx) - keine automatische Umverteilung mehr, eine
// verschobene Karte aendert nur noch ihre eigene Position. Auf dem Handy
// werden beide Spalten einfach hintereinander gestapelt (erst Mitte, dann
// rechts).
export const STAT_CARD_SCREEN = "stats";

// Entspricht dem urspruenglichen, fest verdrahteten Layout vor dem Drag&Drop-
// Feature (Verlaufs-Graph + Rekorde + Spielehistorie in der Mitte, alles
// andere rechts) - "globalFilter" ist neu Teil davon (Nutzer-Feedback: "auch
// die 'Selection for all Statistics' verschiebbar machen"), an ihrer alten
// festen Position ganz oben rechts.
export const DEFAULT_STAT_CARD_COLUMNS = {
  middle: ["entwicklung", "rekordeClub", "letzteMatches"],
  right: ["globalFilter", "rangliste", "meisteSiege", "besteSiegquote", "aktuelleSerien", "schnellstesTempo", "schnellste141"],
};

const ALL_STAT_CARD_IDS = [...DEFAULT_STAT_CARD_COLUMNS.middle, ...DEFAULT_STAT_CARD_COLUMNS.right];

// Bekannte, aber inzwischen entfernte Karten fallen beim Normalisieren
// einfach weg; neue, dem Nutzer noch unbekannte Karten werden an ihrer
// Standardposition angehaengt statt zu verschwinden. Eine gespeicherte
// Struktur aus der fruehen (flachen) Version dieses Features hat weder
// "middle" noch "right" - faellt hier also komplett auf die Standard-
// Aufteilung zurueck statt abzustuerzen.
export function normalizeCardColumns(saved) {
  const known = new Set(ALL_STAT_CARD_IDS);
  const middle = (Array.isArray(saved?.middle) ? saved.middle : []).filter((id) => known.has(id));
  const right = (Array.isArray(saved?.right) ? saved.right : []).filter((id) => known.has(id));
  const seen = new Set([...middle, ...right]);
  DEFAULT_STAT_CARD_COLUMNS.middle.forEach((id) => { if (!seen.has(id)) { middle.push(id); seen.add(id); } });
  DEFAULT_STAT_CARD_COLUMNS.right.forEach((id) => { if (!seen.has(id)) { right.push(id); seen.add(id); } });
  return { middle, right };
}
