import { useEffect, useRef } from "react";

/* Sanftes Einblenden beim Hineinscrollen: der Haken haengt einen
   IntersectionObserver an den Container und setzt bei jedem Kind mit der
   Klasse "reveal" die Klasse "is-in", sobald es ins Bild kommt.

   Bewusst EIN Beobachter am Container statt einer Komponente pro Zeile -
   die Listen hier werden lang (Turnierliste, Matchliste), und ein Observer
   mit vielen Zielen ist deutlich billiger als viele Observer.

   Drei Dinge sind load-bearing:
   - Der versteckte Ausgangszustand steht NUR im CSS unter
     prefers-reduced-motion: no-preference (siehe App.css). Wer Animationen
     abgeschaltet hat, sieht alles sofort, ohne dass hier etwas laufen muss.
   - Ohne IntersectionObserver (sehr alte Browser) bekommt jedes Ziel sofort
     "is-in". Eine Animation darf nie darueber entscheiden, ob Inhalt
     ueberhaupt sichtbar ist.
   - Ein einmal eingeblendetes Element wird nicht mehr beobachtet
     (unobserve): es soll beim Zurueckscrollen nicht erneut aufblenden,
     das wirkt unruhig statt lebendig.

   deps: wie bei useEffect - die Liste neu durchsuchen, wenn sich der Inhalt
   geaendert hat (neue Zeilen tragen die Klasse noch nicht). */
export function useRevealOnScroll(deps = []) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = root.querySelectorAll(".reveal:not(.is-in)");
    if (!targets.length) return;
    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
