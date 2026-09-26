import { useState, useEffect } from "react";
import { isIos, isStandalone } from "./notifications";

/* ============================================================
   HERUNTERZIEHEN ZUM NEULADEN - NUR IPHONE-HOME-BILDSCHIRM-APP

   Im Browser und in der installierten Android-App bringt der Browser die
   Geste selbst mit. Eine vom iPhone-Home-Bildschirm gestartete App hat sie
   NICHT (Safari bietet sie dort nicht an) - genau dort, wo Updates am
   schwersten ankommen, fehlte damit der uebliche Weg. Darum hier eine
   eigene, bewusst schlichte Umsetzung, die sonst nirgends aktiv ist.

   Ablauf beim Loslassen ueber der Schwelle: erst nach einer neuen Version
   suchen und kurz warten, bis sie fertig installiert ist, DANN neu laden -
   ein wartendes Update spielt Trigger F in App.jsx beim Seitenaufruf ein.
   Ohne die Suche vorher kaeme eine gerade erst veroeffentlichte Version
   erst beim uebernaechsten Mal.

   Sperren (wie beim nativen Herunterziehen, siehe html.live-entry in
   App.css): nie auf LIVE_ENTRY_TABS - erkannt an der Klasse live-entry auf
   <html>, die App.jsx genau dann setzt. Ausserdem nur, wenn der Inhalt
   ganz oben steht, die Bewegung ueberwiegend senkrecht ist und sofort
   beginnt: Auf Statistik startet ein Karten-Verschieben erst nach 300 ms
   Gedrueckthalten (TouchSensor in StatistikScreen.jsx) - wer so lange
   haelt, zieht eine Karte und will nicht neu laden.

   Die Listener sind passiv und rufen nie preventDefault() - das iOS-
   Gummiband und das normale Scrollen bleiben unangetastet, der Hook
   schaut nur zu.
   ============================================================ */
const THRESHOLD = 70;   // Zugweg (nach Daempfung) ab dem beim Loslassen neu geladen wird
const MAX_PULL = 110;
const DAMPING = 0.5;
const MAX_START_DELAY = 250;

async function checkThenReload() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await Promise.race([reg.update(), new Promise((r) => setTimeout(r, 3000))]);
      const sw = reg.installing;
      if (sw) {
        await Promise.race([
          new Promise((r) => sw.addEventListener("statechange", () => { if (sw.state !== "installing") r(); })),
          new Promise((r) => setTimeout(r, 5000)),
        ]);
      }
    }
  } catch { /* ignore - dann eben nur neu laden */ }
  window.location.reload();
}

export function usePullToRefresh(scrollEl) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!scrollEl || !isIos() || !isStandalone()) return undefined;
    const el = scrollEl;
    let startX = 0, startY = 0, startAt = 0, active = false, dist = 0;

    const blocked = () => document.documentElement.classList.contains("live-entry");
    const onStart = (e) => {
      active = false; dist = 0;
      if (e.touches.length !== 1 || el.scrollTop > 0 || blocked()) return;
      startX = e.touches[0].clientX; startY = e.touches[0].clientY; startAt = Date.now();
      active = true;
    };
    const onMove = (e) => {
      if (!active) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (dist === 0 && dy > 0) {
        // Erste echte Bewegung: zu spaet (Karte ziehen) oder zu schraeg -> aus
        if (Date.now() - startAt > MAX_START_DELAY || Math.abs(dx) > dy) { active = false; return; }
      }
      if (dy <= 0 || el.scrollTop > 0) { dist = 0; setPull(0); if (dy < 0) active = false; return; }
      dist = Math.min(MAX_PULL, dy * DAMPING);
      setPull(dist);
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      if (dist >= THRESHOLD && !blocked()) {
        setRefreshing(true);
        setPull(THRESHOLD);
        checkThenReload();
      } else {
        setPull(0);
      }
      dist = 0;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    const onCancel = () => { active = false; dist = 0; setPull(0); };
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [scrollEl]);

  return { pull, ready: pull >= THRESHOLD, refreshing, threshold: THRESHOLD };
}
