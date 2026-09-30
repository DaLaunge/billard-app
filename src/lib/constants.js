export const DEFAULT_DISCIPLINES = ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"];
// Kurzform fuer Disziplin-Chips app-weit (Nutzer-Feedback: so wenig Platz
// wie moeglich, vor allem am Handy) - der volle Name bleibt der eigentliche
// Wert fuer Filterung/State, nur die ANZEIGE wird abgekuerzt. Verwendung:
// t(DISC_LABEL[d] || d) statt t(d) an jeder Disziplin-Chip-Stelle.
export const DISC_LABEL = { "Gesamt": "Alle", "8 Ball": "8B", "9 Ball": "9B", "10 Ball": "10B", "14/1 Endlos": "14/1" };
// EINE Mengenauswahl fuer jede Liste, in der man waehlen kann, wie viele
// Eintraege (Spieler, Matches, Gegner) angezeigt werden: Bestenlisten,
// Letzte Matches, Head-to-Head, Gegnerauswahl beim Match anlegen.
// Nutzer-Feedback 2026-09-30: "top 3 ist eigentlich zu wenig, wenn diese
// Filter so greifen ... Also: top 10, 20, 50, 100, alle" - vorher hatte jede
// Liste ihre eigene Auswahl ([3,10,"all"], [3,10,20,"all"], [10,...,"all"]).
// Standard ist die kleinste Stufe.
export const LIST_COUNT_OPTIONS = [10, 20, 50, 100, "all"];
export const DEFAULT_LIST_COUNT = LIST_COUNT_OPTIONS[0];
// Liest eine gespeicherte Wahl zurueck. Alles, was keine gueltige Stufe ist
// (z.B. das fruehere "3" aus localStorage), faellt auf den Standard - sonst
// waere nach dem Umstieg gar kein Chip aktiv.
export function normalizeListCount(v) {
  if (v === "all") return "all";
  const n = Number(v);
  return LIST_COUNT_OPTIONS.includes(n) ? n : DEFAULT_LIST_COUNT;
}
export const APP_VERSION = "405";  // bei jedem Release erhöhen

/* Erfolgs-Katalog wird zur Laufzeit aus der Datenbank geladen (Tabelle
   badge_catalog). BADGE_INFO ist eine modulweite Map, die die App beim
   Start befüllt – so kennt auch die (zustandslose) Ball-Komponente die
   Emojis. Der kleine Fallback greift nur, falls der Katalog noch lädt. */
export const BADGE_INFO = {};
export const BADGE_FALLBACK = { emoji: "🏅", name: "Erfolg", description: "" };
export const badgeInfo = (key) => BADGE_INFO[key] || BADGE_FALLBACK;
