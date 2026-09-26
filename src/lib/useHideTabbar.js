import { useState, useEffect } from "react";

/* ============================================================
   TABBAR BEIM RUNTERSCROLLEN AUSBLENDEN

   Die untere Leiste ist fest positioniert und liegt damit dauerhaft
   ueber dem Inhalt - am Handy sind das rund 76px, die beim Lesen einer
   Rangliste oder beim Betrachten eines Graphen nie fuer Inhalt zur
   Verfuegung stehen. Wer runterscrollt, liest; wer hochscrollt, sucht
   meist die Navigation. Genau dieses Muster bildet der Hook ab.

   Standardmaessig AUS (siehe getHideTabbar() in uiPrefs.js) - eine
   Navigation, die von selbst verschwindet, soll niemand ungefragt
   bekommen.

   Zwei Feinheiten, die das Verhalten ruhig statt zappelig machen:
   - MIN_DELTA: erst ab 8px Scrollweg wird ueberhaupt entschieden. Ohne
     das wechselt die Leiste beim Gummiband-Effekt am Rand und bei jedem
     Zittern des Daumens den Zustand.
   - Der Vergleichswert wird NICHT aktualisiert, solange die Schwelle
     nicht erreicht ist. Dadurch summieren sich auch langsame Bewegungen
     irgendwann zu einer Entscheidung, statt fuer immer ignoriert zu
     werden.
   Oben am Anfang der Liste (< NEAR_TOP) ist die Leiste immer sichtbar:
   dort ist man gerade angekommen und orientiert sich.

   Gedrosselt wird ueber einen Zeitstempel und nicht ueber
   requestAnimationFrame: rAF laeuft nicht, solange die Seite nicht
   gezeichnet wird (verstecktes Fenster, Hintergrund-Tab). Fuer das
   Verhalten selbst ist das egal - was man nicht sieht, scrollt man nicht -
   aber es macht den Hook ohne sichtbares Fenster ueberhaupt nicht
   testbar, und ein einmal gesetztes "laeuft schon"-Flag haengt bis zum
   naechsten Frame. Ein Zeitstempel hat beides nicht.
   ============================================================ */
const MIN_DELTA = 8;
const NEAR_TOP = 60;
const THROTTLE_MS = 60;

/* Der Scroll-Container kommt als DOM-Knoten aus einem useState-Ref
   (ref={setContentEl} in App.jsx), NICHT als useRef. Grund: <main class=
   "content"> wird erst gerendert, sobald ein Spieler geladen ist. Ein
   useRef aendert beim Mounten nichts an den Abhaengigkeiten, der Effekt
   lief hier also genau einmal - mit ref.current === null - und haengte
   sich nie an das spaeter erscheinende Element. Mit State rendert React
   nach dem Mounten neu, der Effekt laeuft erneut und findet den Knoten. */
export function useHideTabbar(enabled, scrollEl, resetKey) {
  const [hidden, setHidden] = useState(false);

  // Bildschirmwechsel zeigt die Leiste immer wieder an - sonst landet man
  // auf einer neuen Seite und die Navigation ist unsichtbar, ohne dass man
  // selbst gescrollt haette.
  useEffect(() => { setHidden(false); }, [resetKey]);

  useEffect(() => {
    if (!enabled || !scrollEl) { setHidden(false); return undefined; }
    const el = scrollEl;
    let last = el.scrollTop;
    let lastRun = 0;
    const onScroll = () => {
      const now = Date.now();
      if (now - lastRun < THROTTLE_MS) return;
      lastRun = now;
      const y = el.scrollTop;
      if (y < NEAR_TOP) { last = y; setHidden(false); return; }
      const dy = y - last;
      if (Math.abs(dy) < MIN_DELTA) return;
      last = y;
      setHidden(dy > 0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [enabled, scrollEl]);

  return enabled && hidden;
}
