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
   geaendert hat (neue Zeilen tragen die Klasse noch nicht). **Nur stabile
   Werte uebergeben, also Laengen oder Filterwerte, NIEMALS das Array
   selbst.** Ein frisch erzeugtes Array ist bei jedem Render eine neue
   Identitaet; der Effekt liefe dann staendig neu und seine Aufraeumfunktion
   wuerde den Beobachter jedes Mal trennen, bevor er das erste Mal
   ausloesen kann. Genau so blieben die Rekorde-Zeilen am Desktop dauerhaft
   unsichtbar, obwohl sie mitten im Bild standen. */
export function useRevealOnScroll(deps = []) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = [...root.querySelectorAll(".reveal:not(.is-in)")];
    if (!targets.length) return;
    // Was beim Aufbau ohnehin schon im Bild steht, wird SOFORT sichtbar
    // gesetzt - ohne das haengt der erste Bildschirm voll Inhalt an der
    // Laufzeit des Beobachters (der erst nach dem naechsten Frame meldet),
    // und ein Fehler in dieser Kette wuerde Inhalt verschwinden lassen
    // statt nur seine Animation.
    const vh = window.innerHeight || 0;
    const rest = targets.filter((el) => {
      const r = el.getBoundingClientRect();
      const sichtbar = r.bottom > 0 && r.top < vh;
      if (sichtbar) el.classList.add("is-in");
      return !sichtbar;
    });
    if (!rest.length || typeof IntersectionObserver === "undefined") {
      rest.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
    rest.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
