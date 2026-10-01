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
