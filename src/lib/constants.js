export const DEFAULT_DISCIPLINES = ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"];
// Kurzform fuer Disziplin-Chips app-weit (Nutzer-Feedback: so wenig Platz
// wie moeglich, vor allem am Handy) - der volle Name bleibt der eigentliche
// Wert fuer Filterung/State, nur die ANZEIGE wird abgekuerzt. Verwendung:
// t(DISC_LABEL[d] || d) statt t(d) an jeder Disziplin-Chip-Stelle.
export const DISC_LABEL = { "Gesamt": "Alle", "8 Ball": "8B", "9 Ball": "9B", "10 Ball": "10B", "14/1 Endlos": "14/1" };
export const APP_VERSION = "265";  // bei jedem Release erhöhen

/* Erfolgs-Katalog wird zur Laufzeit aus der Datenbank geladen (Tabelle
   badge_catalog). BADGE_INFO ist eine modulweite Map, die die App beim
   Start befüllt – so kennt auch die (zustandslose) Ball-Komponente die
   Emojis. Der kleine Fallback greift nur, falls der Katalog noch lädt. */
export const BADGE_INFO = {};
export const BADGE_FALLBACK = { emoji: "🏅", name: "Erfolg", description: "" };
export const badgeInfo = (key) => BADGE_INFO[key] || BADGE_FALLBACK;
