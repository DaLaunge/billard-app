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
