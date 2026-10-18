import { useEffect } from "react";

/* Kartenkoepfe, die beim Scrollen oben kleben (App.css, ".stat-block-head" am Handy), bekommen die Klasse "is-stuck", sobald sie
   tatsaechlich angeheftet sind (Kopf sitzt tiefer als der Kartenanfang). Nur dann verliert der Kopf seine runden oberen Ecken:
   mit Rundung blieben im Eckenbereich die senkrechten Kartenraender und die darunter durchlaufenden Zeilen sichtbar und
   "durchstiessen" die Rundung (Nutzer-Feedback 415.3, Erfolge-Seite). In Ruhe, am Kartenanfang, bleibt die Rundung.
   Gemessen wird nicht gegen den Scrollbereich, sondern Kopf gegen Karte - das ist unabhaengig von Polstern und Safe-Areas. */
export function useStuckHeads(contentEl, tab) {
  useEffect(() => {
    if (!contentEl) return undefined;
    let raf = 0;
    const update = () => {
      raf = 0;
      contentEl.querySelectorAll(".screen .stat-block:not(.is-maximized) > .stat-block-head").forEach((h) => {
        const card = h.parentElement;
        const stuck = h.getBoundingClientRect().top - card.getBoundingClientRect().top > 0.5;
        if (h.classList.contains("is-stuck") !== stuck) h.classList.toggle("is-stuck", stuck);
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    contentEl.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const t0 = setTimeout(update, 350);
    return () => {
      contentEl.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      clearTimeout(t0);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [contentEl, tab]);
}
