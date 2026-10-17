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
