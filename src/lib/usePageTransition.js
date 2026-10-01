import { useLayoutEffect, useRef } from "react";

/* Kurzer, weicher Seitenwechsel wie beim iPhone (Nutzer-Feedback 2026-10-01:
   "Etabliere bei den jeweiligen Menuepunkten eine kurze weiche Animation.
   Wie einen Seitenwechsel auf einem iPhone").

   Bewusst KEIN Umbau der Screens in Wrapper: der Haken setzt beim Wechsel des
   Tabs eine CSS-Klasse auf den frisch gerenderten .screen im Scroll-Container,
   die Animation selbst steht im reduced-motion-Block von App.css. Ohne
   Animationen (oder ohne JS) ist die Seite einfach sofort da.

   Richtung: die vier Hauptmenuepunkte haben ihre Reihenfolge in der Leiste
   (Statistik < Turniere < Live < Profil); wer nach rechts in der Leiste geht,
   bekommt die neue Seite von rechts, wer nach links geht, von links.
   Unterseiten (Match, Admin, Turnierdetail, ...) liegen "tiefer" als jeder
   Hauptpunkt: hinein = von rechts, zurueck = von links - wie ein
   Navigationsstapel.

   useLayoutEffect, damit die Klasse VOR dem ersten Zeichnen sitzt; mit
   useEffect blitzte die neue Seite erst fertig auf und startete dann. */
const MAIN = ["stats", "turnier", "live", "profil"];
const rank = (tab) => { const i = MAIN.indexOf(tab); return i === -1 ? 10 : i; };

export function usePageTransition(scrollEl, tab) {
  const prev = useRef(tab);
  useLayoutEffect(() => {
    const from = prev.current;
    prev.current = tab;
    if (!scrollEl || from === tab) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const page = scrollEl.querySelector(":scope > .screen");
    if (!page) return;
    const cls = rank(tab) < rank(from) ? "page-in-left" : "page-in-right";
    page.classList.remove("page-in-left", "page-in-right");
    void page.offsetWidth; // Animation neu starten, falls dieselbe Klasse schon dran war
    page.classList.add(cls);
    // animationend sprudelt aus Kindern nach oben (z.B. die Schritt-Animation
    // im Match) - nur das Ende der eigenen Animation zaehlt; der Timer ist die
    // Absicherung, falls das Ereignis nie kommt.
    const done = () => { page.classList.remove(cls); page.removeEventListener("animationend", onEnd); };
    const onEnd = (e) => { if (e.target === page) done(); };
    page.addEventListener("animationend", onEnd);
    const id = setTimeout(done, 700);
    return () => clearTimeout(id);
  }, [scrollEl, tab]);
}
