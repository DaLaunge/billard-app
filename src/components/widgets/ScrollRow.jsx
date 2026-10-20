import { useRef, useState, useLayoutEffect, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
      {edge.left && <button type="button" className="scroll-arrow left" tabIndex={-1} aria-hidden="true" onClick={() => go(-1)}><ChevronLeft size={16} /></button>}
      {edge.right && <button type="button" className="scroll-arrow right" tabIndex={-1} aria-hidden="true" onClick={() => go(1)}><ChevronRight size={16} /></button>}
    </div>
  );
}
