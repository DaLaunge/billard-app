import { useRef, useState, useLayoutEffect, useEffect, useCallback } from "react";
// Ausgefuelltes Dreieck (Nutzer-Wunsch: statt des offenen Pfeils)
const Tri = ({ dir }) => (
  <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><path d={dir < 0 ? "M10 1 L2 7 L10 13 Z" : "M2 1 L10 7 L2 13 Z"} fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
);

/* Waagerecht scrollbare Reihe (Reiter, Kapitel-Leiste) mit Pfeilen am Rand: ein Pfeil zeigt, dass es in diese Richtung weitergeht, und
   verschwindet, sobald man am Ende ist (Nutzer-Wunsch 417.20: "ueberall, wo man links/rechts scrollen kann"). Ein Tipp auf den Pfeil
   scrollt ein Stueck weiter. `wrapClass` bestimmt Abstand/Form des Rahmens (.w-seg, .w-deck), `className`/restliche Props gehen an die Reihe. */
export default function ScrollRow({ wrapClass = "", className = "", children, ...rest }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdge((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);
  useLayoutEffect(measure); // nach jedem Rendern (Reiter kommen/gehen, Auswahl aendert Breite)
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro?.disconnect(); window.removeEventListener("resize", measure); };
  }, [measure]);
  const go = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.6, behavior: "smooth" });
  return (
    <div className={"scroll-wrap " + wrapClass}>
      <div ref={ref} className={className} onScroll={measure} {...rest}>{children}</div>
      {edge.left && <button type="button" className="scroll-arrow left" tabIndex={-1} aria-hidden="true" onClick={() => go(-1)}><Tri dir={-1} /></button>}
      {edge.right && <button type="button" className="scroll-arrow right" tabIndex={-1} aria-hidden="true" onClick={() => go(1)}><Tri dir={1} /></button>}
    </div>
  );
}
