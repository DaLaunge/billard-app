/* ============================================================
   ANZEIGE-EINSTELLUNGEN PRO GERAET (localStorage)

   Bewusst in localStorage und nicht im Profil (players-Tabelle):
   das sind Geraete-Eigenschaften, keine Kontoeinstellungen -
   dieselbe Logik wie beim Wachhalten des Bildschirms (wakeLock.js)
   und beim Update-Intervall. Wer am Handy jeden Pixel braucht,
   will am PC nicht dasselbe.
   ============================================================ */

/* Tabbar beim Runterscrollen ausblenden.

   Standard ist AUS: die untere Leiste ist die Hauptnavigation, und eine
   Navigation, die von selbst verschwindet, ueberrascht jeden, der sie
   nicht bestellt hat. Wer den Platz will (76px sind am Handy ueber 9%
   der Bildschirmhoehe), schaltet es im Profil unter "Bildschirm" ein.
   Nur ein ausdrueckliches "an" wird gespeichert, darum der Vergleich
   gegen "1" - umgekehrt zu getKeepAwake(), das standardmaessig an ist. */
const HIDE_TABBAR_KEY = "hideTabbarOnScroll";

export function getHideTabbar() {
  try { return localStorage.getItem(HIDE_TABBAR_KEY) === "1"; } catch { return false; }
}

export function storeHideTabbar(on) {
  try { localStorage.setItem(HIDE_TABBAR_KEY, on ? "1" : "0"); } catch { /* ignore */ }
}

/* Filter-Felder (Trichter-Symbol im Kartenkopf) beim Oeffnen eines Screens
   gleich aufgeklappt zeigen. Standard ist AUS (zu), nur ein ausdrueckliches
   "an" wird gespeichert. Ein- und Ausklappen per Trichter geht in beiden
   Faellen weiter - die Einstellung bestimmt nur den Anfangszustand. */
const FILTERS_OPEN_KEY = "filtersAlwaysOpen";

export function getFiltersOpen() {
  try { return localStorage.getItem(FILTERS_OPEN_KEY) === "1"; } catch { return false; }
}

export function storeFiltersOpen(on) {
  try { localStorage.setItem(FILTERS_OPEN_KEY, on ? "1" : "0"); } catch { /* ignore */ }
}

/* Kugel-Flug im Match: waehlt man einen Spieler, springt seine Kugel aus der
   Kachel in den freien Platz der Aufstellung, beim Entfernen zurueck (lib/flyBall.js).
   Standard ist AN - nur ein ausdrueckliches "aus" wird gespeichert, darum der
   Vergleich gegen "0" (wie bei getKeepAwake()). Einstellbar unter Profil ->
   Profil bearbeiten -> Dieses Geraet. */
const MATCH_FLY_KEY = "matchFlyAnim";

export function getMatchFly() {
  try { return localStorage.getItem(MATCH_FLY_KEY) !== "0"; } catch { return true; }
}

export function storeMatchFly(on) {
  try { localStorage.setItem(MATCH_FLY_KEY, on ? "1" : "0"); } catch { /* ignore */ }
}

/* Popup "Match wartet auf deine Bestaetigung" (App.jsx, showPendingPopup).
   Standard ist AN - nur ein ausdrueckliches "aus" wird gespeichert. Pro Geraet,
   unabhaengig von den Benachrichtigungen; die Bestaetigung im Profil bleibt
   in jedem Fall. */
const PENDING_POPUP_KEY = "pendingPopup";

export function getPendingPopup() {
  try { return localStorage.getItem(PENDING_POPUP_KEY) !== "0"; } catch { return true; }
}

export function storePendingPopup(on) {
  try { localStorage.setItem(PENDING_POPUP_KEY, on ? "1" : "0"); } catch { /* ignore */ }
}

/* Listen und Kapitel (Nutzer-Wunsch 2026-10-18), pro Geraet unter Profil -> Einstellungen -> Dieses Geraet:
   - listMode: "chapters" (Standard, "Tab-Freak") = wie frueher, die Kapitel-Buttons oben schalten je ein Kapitel um;
     "stacked" ("Doomscroller") = alle Kapitel als EINE lange Liste untereinander.
   - stickyHeads (Standard an): Kapitelkoepfe bleiben beim Scrollen oben stehen. Nur ein ausdrueckliches "aus" wird gespeichert;
     applyListPrefs() setzt dafuer html[data-sticky-heads] (CSS in App.css schaltet position: sticky ab).
   Die Kapitel-Buttons oben gibt es nur im Modus "chapters" (Tab-Freak): ein Klick zeigt das Kapitel wie ein Tab. */
const LIST_MODE_KEY = "listMode";
const STICKY_HEADS_KEY = "stickyHeads";

export function getListMode() {
  try { return localStorage.getItem(LIST_MODE_KEY) === "stacked" ? "stacked" : "chapters"; } catch { return "chapters"; }
}
// true, solange auf diesem Geraet noch nie gewaehlt wurde (neues Geraet oder nach dem Zuruecksetzen) - dann fragt die App einmal.
export function hasListModeChoice() {
  try { return localStorage.getItem(LIST_MODE_KEY) !== null; } catch { return true; }
}
export function clearListPrefs() {
  try { localStorage.removeItem(LIST_MODE_KEY); localStorage.removeItem(STICKY_HEADS_KEY); } catch { /* ignore */ }
  applyListPrefs();
}
export function storeListMode(mode) {
  try { localStorage.setItem(LIST_MODE_KEY, mode === "stacked" ? "stacked" : "chapters"); } catch { /* ignore */ }
}
export function getStickyHeads() {
  try { return localStorage.getItem(STICKY_HEADS_KEY) !== "0"; } catch { return true; }
}
export function storeStickyHeads(on) {
  try { localStorage.setItem(STICKY_HEADS_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  applyListPrefs();
}
export function applyListPrefs() {
  try { document.documentElement.dataset.stickyHeads = getStickyHeads() ? "on" : "off"; } catch { /* ignore */ }
}

/* Schriftgroesse pro Geraet (Einstellungen -> Aussehen). Der Faktor (1 = Standard) steht in der CSS-Variable --fs;
   jede font-size in App.css rechnet damit (calc(Npx * var(--fs, 1))). Nur ein vom Standard abweichender Wert wird gespeichert,
   "Alle Einstellungen zuruecksetzen" ruft clearFontScale() auf. */
const FONT_SCALE_KEY = "fontScale";
export const FONT_SCALE_MIN = 0.8;
export const FONT_SCALE_MAX = 1.4;
export const FONT_SCALE_STEP = 0.05;

export function getFontScale() {
  try {
    const v = parseFloat(localStorage.getItem(FONT_SCALE_KEY));
    return Number.isFinite(v) ? Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, v)) : 1;
  } catch { return 1; }
}
export function applyFontScale(scale = getFontScale()) {
  try { document.documentElement.style.setProperty("--fs", String(scale)); } catch { /* ignore */ }
}
export function storeFontScale(scale) {
  try { if (Math.abs(scale - 1) < 0.001) localStorage.removeItem(FONT_SCALE_KEY); else localStorage.setItem(FONT_SCALE_KEY, String(scale)); } catch { /* ignore */ }
  applyFontScale(scale);
}
export function clearFontScale() {
  try { localStorage.removeItem(FONT_SCALE_KEY); } catch { /* ignore */ }
  applyFontScale(1);
}
