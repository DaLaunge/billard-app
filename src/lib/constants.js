export const DEFAULT_DISCIPLINES = ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"];
/* Heyball (WPA Rules of Heyball, 2025-08-16) ist eine Disziplin, die der Admin komplett ein-
   und ausschalten kann (app_settings.heyball_enabled, supabase/2026-10-10_heyball.sql). Der Schalter
   wird wie BADGE_INFO modulweit gehalten, damit auch zustandslose Stellen (Match, Turnier, Filter,
   Regelkunde) ihn ohne Prop-Durchreichen kennen; App.jsx setzt ihn in loadData() und haelt einen
   State daneben, damit alles neu zeichnet. Aus = Heyball ist nirgends waehlbar; bereits gespielte
   Heyball-Matches bleiben in der Datenbank und in Listen sichtbar. Start aus dem lokalen Speicher,
   damit der erste Bildschirmaufbau nicht flackert. */
export const HEYBALL = "Heyball";
const FLAG_KEY = "featureHeyball";
export const FEATURES = { heyball: (() => { try { return localStorage.getItem(FLAG_KEY) === "1"; } catch { return false; } })() };
export function setHeyballEnabled(on) {
  FEATURES.heyball = !!on;
  try { localStorage.setItem(FLAG_KEY, on ? "1" : "0"); } catch { /* Privatmodus */ }
}
// Disziplinen, die man jetzt NEU anlegen/auswaehlen darf (Match, Turnier, Filter, Regelkunde).
export const activeDisciplines = () => (FEATURES.heyball ? [...DEFAULT_DISCIPLINES, HEYBALL] : DEFAULT_DISCIPLINES);
// Kurzform fuer Disziplin-Chips app-weit (Nutzer-Feedback: so wenig Platz
// wie moeglich, vor allem am Handy) - der volle Name bleibt der eigentliche
// Wert fuer Filterung/State, nur die ANZEIGE wird abgekuerzt. Verwendung:
// t(DISC_LABEL[d] || d) statt t(d) an jeder Disziplin-Chip-Stelle.
export const DISC_LABEL = { "Gesamt": "Alle", "8 Ball": "8B", "9 Ball": "9B", "10 Ball": "10B", "14/1 Endlos": "14/1", "Heyball": "HB" };
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
// Versionszaehlung (Nutzer-Vorgabe 2026-09-30): GANZE Nummern (391, 392, ...)
// nur fuer einen ausdruecklich freigegebenen Push von test nach main (Prod).
// Jeder Push auf test zaehlt dagegen "<letzte Prod-Nummer>.<Minor>", also 391.0,
// 391.1, ... bis zur Freigabe; danach steht Prod auf 392 und test beginnt bei
// 392.0. Als STRING, damit "391.10" nicht zu 391.1 wird.
export const APP_VERSION = "404.5";

/* Erfolgs-Katalog wird zur Laufzeit aus der Datenbank geladen (Tabelle
   badge_catalog). BADGE_INFO ist eine modulweite Map, die die App beim
   Start befüllt – so kennt auch die (zustandslose) Ball-Komponente die
   Emojis. Der kleine Fallback greift nur, falls der Katalog noch lädt. */
export const BADGE_INFO = {};
export const BADGE_FALLBACK = { emoji: "🏅", name: "Erfolg", description: "" };
export const badgeInfo = (key) => BADGE_INFO[key] || BADGE_FALLBACK;
