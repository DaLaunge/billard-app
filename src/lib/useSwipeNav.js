import { useEffect, useRef } from "react";

/* Wischgesten (Nutzer-Feedback 2026-10-01: "Lass zu, dass Wischgesten
   funktionieren").

   - Auf den vier Hauptmenuepunkten: nach links/rechts wischen wechselt zum
     Nachbarn in der Leiste (onNext / onPrev).
   - Auf Unterseiten: von links nach rechts wischen = zurueck (onBack), aber nur,
     wenn die Geste im linken Drittel beginnt, nicht im ersten Streifen am
     Rand (EDGE_MIN) - dort uebernimmt, wo es sie gibt, die Zurueck-Geste des
     Systems, und beides zusammen wuerde zweimal zurueckspringen.

   Zuverlaessig HEISST hier vor allem: nie etwas Falsches ausloesen. Deshalb
   zaehlt nur ein deutlich waagerechter, schneller Strich (MIN_DX, Verhaeltnis
   zu dy, MAX_MS - ein langes Halten ist Ziehen/Lesen, kein Wischen; so loest
   auch das Karten-Ziehen der Statistik, das erst nach 300 ms greift, nichts
   aus). Ausgenommen sind Eingabefelder, waagerecht scrollbare Bereiche
   (Turnierrunden, Tabellen, Graphen) und alles, was ein Overlay oeffnet.
   Alle Listener sind passiv - gescrollt wird nie behindert. */
const MIN_DX = 70;
const MAX_MS = 650;
const EDGE_MIN = 24;
const RATIO = 1.8;

// root = der Scroll-Container der App selbst: er wird NICHT geprueft - waehrend
// der Seitenwechsel-Animation ragt die verschobene Seite kurz seitlich heraus,
// und er wuerde sich sonst fuer waagerecht scrollbar halten und die naechste
// Geste verschlucken.
function blocked(target, root) {
  if (!(target instanceof Element)) return true;
  if (target.closest("input, textarea, select, [contenteditable='true'], [data-no-swipe], .dev-chart")) return true;
  for (let el = target; el && el !== root && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 2) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
  }
  return false;
}

export function useSwipeNav(el, { enabled, onBack, onPrev, onNext }) {
  // Die Rueckrufe aendern sich bei jedem Render; die Listener sollen trotzdem
  // nur einmal angehaengt werden.
  const cb = useRef({});
  cb.current = { enabled, onBack, onPrev, onNext };

  useEffect(() => {
    if (!el) return undefined;
    let st = null;
    const start = (e) => {
      if (!cb.current.enabled || e.touches.length !== 1
        || document.querySelector(".modal-overlay, .celebrate-overlay") || blocked(e.target, el)) { st = null; return; }
      const p = e.touches[0];
      st = { x: p.clientX, y: p.clientY, at: Date.now() };
    };
    const end = (e) => {
      if (!st) return;
      const s = st;
      st = null;
      const p = e.changedTouches[0];
      const dx = p.clientX - s.x;
      const dy = p.clientY - s.y;
      if (Date.now() - s.at > MAX_MS || Math.abs(dx) < MIN_DX || Math.abs(dx) < Math.abs(dy) * RATIO) return;
      const c = cb.current;
      if (dx > 0) {
        if (c.onBack) { if (s.x >= EDGE_MIN && s.x < window.innerWidth * 0.34) c.onBack(); }
        else c.onPrev?.();
      } else {
        c.onNext?.();
      }
    };
    const cancel = () => { st = null; };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
    el.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", cancel);
    };
  }, [el]);
}
