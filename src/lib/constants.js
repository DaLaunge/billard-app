export const DEFAULT_DISCIPLINES = ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"];
export const APP_VERSION = "104";  // bei jedem Release erhöhen

/* Erfolgs-Katalog wird zur Laufzeit aus der Datenbank geladen (Tabelle
   badge_catalog). BADGE_INFO ist eine modulweite Map, die die App beim
   Start befüllt – so kennt auch die (zustandslose) Ball-Komponente die
   Emojis. Der kleine Fallback greift nur, falls der Katalog noch lädt. */
export const BADGE_INFO = {};
export const BADGE_FALLBACK = { emoji: "🏅", name: "Erfolg", description: "" };
export const badgeInfo = (key) => BADGE_INFO[key] || BADGE_FALLBACK;
