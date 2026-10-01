import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Hand, Plus, BarChart3, Trophy, Radio, User, Award, SlidersHorizontal, Timer, X, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { t } from "../lib/i18n";

/* Tutorial-Overlay: zeigt Schritte aus lib/tutorial/steps.js einen nach dem
   anderen, optional mit Hervorhebung eines Elements (Spotlight).

   - Wechselt bei Bedarf auf den Hauptbildschirm des Schritts (onGoTab) und
     sucht das Ziel dann kurz mehrfach - die Seitenanimation dauert ~280 ms.
     Wird es nicht gefunden, erscheint die Karte mittig ohne Hervorhebung.
   - news = true: Kopf "Neu in dieser Version" (nur ungesehene Schritte nach
     einem Update); sonst die ganze Tour.
   - Am Ende, bei "Ueberspringen" und beim Schliessen ruft es onFinish() - der
     Aufrufer markiert dann ALLE gezeigten Schritte als gesehen (ein
     halbgesehenes Tutorial soll nicht bei jedem Start wiederkommen). */
const ICONS = {
  welcome: Hand, match: Plus, stats: BarChart3, turnier: Trophy, live: Radio,
  profil: User, achievements: Award, customize: SlidersHorizontal, extras: Timer,
};
const PAD = 8;

export default function TutorialOverlay({ steps, news, tab, onGoTab, onFinish }) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const nextRef = useRef(null);
  const step = steps[idx];
  const last = idx === steps.length - 1;

  // Zum Hauptbildschirm des Schritts wechseln.
  useEffect(() => {
    if (step?.tab && step.tab !== tab) onGoTab(step.tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Ziel suchen und messen; bei Resize/Scroll nachziehen.
  useLayoutEffect(() => {
    setRect(null);
    if (!step?.target) return undefined;
    let alive = true, tries = 0, timer = null;
    const measure = () => {
      const el = document.querySelector(step.target);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;
      return { top: r.top, left: r.left, width: r.width, height: r.height, el };
    };
    const find = () => {
      if (!alive) return;
      const m = measure();
      if (m) {
        // Liegt das Ziel ausserhalb des Bildes (Karte weiter unten), erst hinscrollen.
        if (m.top < 60 || m.top + m.height > window.innerHeight - 20) m.el.scrollIntoView({ block: "center", behavior: "instant" });
        const m2 = measure();
        if (m2) setRect(m2);
      } else if (++tries < 12) timer = setTimeout(find, 120);
    };
    timer = setTimeout(find, step.tab && step.tab !== tab ? 380 : 60);
    const upd = () => { const m = measure(); if (m && alive) setRect(m); };
    window.addEventListener("resize", upd);
    document.addEventListener("scroll", upd, true);
    return () => { alive = false; clearTimeout(timer); window.removeEventListener("resize", upd); document.removeEventListener("scroll", upd, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, tab]);

  useEffect(() => { nextRef.current?.focus(); }, [idx]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onFinish();
      else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!step) return null;
  const go = (d) => {
    if (d > 0 && last) { onFinish(); return; }
    setIdx((i) => Math.max(0, Math.min(steps.length - 1, i + d)));
  };
  const Icon = ICONS[step.icon] || Sparkles;
  // Karte ueber oder unter dem Ziel, je nachdem wo mehr Platz ist.
  const cardAtTop = rect ? rect.top + rect.height / 2 > window.innerHeight / 2 : false;

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-label={t("Tutorial")}>
      {rect
        ? <div className="tour-spot" style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />
        : <div className="tour-dim" />}
      <div className={"tour-card" + (rect ? (cardAtTop ? " at-top" : " at-bottom") : " centered")} key={step.id}>
        <button type="button" className="tour-x" onClick={onFinish} aria-label={t("Tutorial beenden")} title={t("Tutorial beenden")}><X size={18} /></button>
        {news && <span className="tour-news"><Sparkles size={13} /> {t("Neu in dieser Version")}</span>}
        <div className="tour-head"><span className="tour-ico"><Icon size={22} /></span><h3>{t(step.title)}</h3></div>
        <p>{t(step.body)}</p>
        <div className="tour-foot">
          <span className="tour-count">{idx + 1} / {steps.length}</span>
          <div className="tour-btns">
            {idx > 0 && <button type="button" className="icon-btn" onClick={() => go(-1)} aria-label={t("Zurück")} title={t("Zurück")}><ChevronLeft size={18} /></button>}
            <button type="button" ref={nextRef} className="btn primary small" onClick={() => go(1)}>
              {last ? t("Fertig") : t("Weiter")} {!last && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
