import { useEffect, useState } from "react";

// Ab dieser Breite steht die App dreispaltig (siehe @media (min-width: 900px)
// in App.css) - und nur dort gibt es ueberhaupt Spalten, in die der Nutzer
// eine Karte stecken kann.
export const WIDE_QUERY = "(min-width: 900px)";

/* Ist gerade die mehrspaltige Desktop-Ansicht aktiv?
   Normalerweise beantwortet das CSS allein, hier braucht es aber JavaScript:
   @dnd-kit muss beim Ziehen wissen, in welcher REIHENFOLGE die Karten
   tatsaechlich am Bildschirm stehen (am Handy eine durchgehende Liste, am
   Desktop erst die mittlere, dann die rechte Spalte). Lag das frueher
   auseinander, stimmte zwar das Ergebnis, aber die Zieh-Animation zeigte
   eine andere Karte als die, die sich am Ende bewegte. */
export function useWideScreen() {
  const [wide, setWide] = useState(() => {
    try { return window.matchMedia(WIDE_QUERY).matches; } catch { return false; }
  });
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia(WIDE_QUERY); } catch { return undefined; }
    const onChange = (e) => setWide(e.matches);
    setWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}
