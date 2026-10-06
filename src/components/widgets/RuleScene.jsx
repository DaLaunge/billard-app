import { useState, useRef, useEffect, useLayoutEffect, useId } from "react";
import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw, Check, X } from "lucide-react";
import { t } from "../../lib/i18n";
import { POOL_COLORS } from "../../lib/pool";
import { BALL_R, POCKETS, stateAt, timeline, stepMs } from "../../lib/ruleScenes";

/* Spielt eine Regelszene (lib/ruleScenes.js) als SVG ab - speicherfreundlich:
   keine Videos, keine Bibliothek, keine Animationsschleife.
   - React rendert immer den ZIELZUSTAND des aktuellen Schritts (Position,
     Tasche); die Bewegung ist nur eine Web-Animations-Ueberlagerung von der
     alten zur neuen Position (FLIP wie lib/flyBall.js). Faellt die Animation
     aus (prefers-reduced-motion, kein WAAPI), zeigt das Bild trotzdem den
     richtigen Stand - der Ruhezustand ist immer der sichtbare.
   - Es werden nur transform und opacity animiert (GPU, kein Layout).
   - Die automatische Wiedergabe stoppt, sobald die Szene aus dem Bild laeuft.
   - Das Urteil (Foul / kein Foul) erscheint erst im letzten Schritt, damit
     man vorher selbst raten kann. */

const tr = (p) => `translate(${p[0]}px, ${p[1]}px)`;
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const CREAM = "#F2EDE0";

function BallShape({ n, grad }) {
  if (n === 0) return <circle r={BALL_R} fill="#E7E0CE" />;
  const c = POOL_COLORS[n];
  return (
    <>
      <circle r={BALL_R} fill={n <= 8 ? c : `url(#${grad})`} />
      <circle r={2.6} fill={CREAM} />
      <text className="rs-no" textAnchor="middle" dominantBaseline="central" y={0.2}>{n}</text>
    </>
  );
}

export default function RuleScene({ scene }) {
  const uid = useId().replace(/:/g, "");
  const last = scene.steps.length - 1;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rootRef = useRef(null);
  const els = useRef({});
  const prevIdx = useRef(0);

  const { pos, out } = stateAt(scene, idx);
  const step = scene.steps[idx];
  const tl = idx > 0 ? timeline(step, stateAt(scene, idx - 1).pos) : {};
  const done = idx === last;

  // Bewegung: von der Position des vorigen Schritts zur neuen.
  useLayoutEffect(() => {
    const prev = prevIdx.current;
    prevIdx.current = idx;
    if (prev === idx || reducedMotion()) return;
    const from = stateAt(scene, prev), to = stateAt(scene, idx);
    const plan = idx === prev + 1 ? timeline(scene.steps[idx], from.pos) : null;
    for (const ball of scene.balls) {
      const el = els.current[ball.id];
      if (!el || !el.animate) continue;
      el.getAnimations().forEach((a) => a.cancel());
      const a = from.pos[ball.id], z = to.pos[ball.id];
      const wasOut = !!from.out[ball.id], isOut = !!to.out[ball.id];
      const m = plan && plan[ball.id];
      if (m) {
        let acc = 0;
        const frames = m.path.map((p, i) => {
          if (i > 0) acc += m.legs[i - 1];
          return { transform: tr(p), offset: i === m.path.length - 1 ? 1 : acc / m.total };
        });
        // Konstante Geschwindigkeit je Abschnitt: linear, sonst "stottert" die Kugel an den Knicken.
        const opts = { duration: m.dur, delay: m.delay, easing: "linear", fill: "backwards" };
        el.animate(frames, opts);
        if (m.out) el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], opts);
      } else if (a[0] !== z[0] || a[1] !== z[1] || wasOut !== isOut) {
        // Zurueck-/Sprung: kurze gerade Fahrt, damit der Wechsel nicht abrupt wirkt.
        const o = { duration: 350, easing: "ease-out" };
        el.animate([{ transform: tr(a) }, { transform: tr(z) }], o);
        if (wasOut !== isOut) el.animate([{ opacity: wasOut ? 0 : 1 }, { opacity: isOut ? 0 : 1 }], o);
      }
    }
  }, [idx, scene]);

  // Automatische Wiedergabe: naechster Schritt, wenn die Bewegung + eine Denkpause vorbei sind.
  useEffect(() => {
    if (!playing) return;
    if (idx >= last) { setPlaying(false); return; }
    const id = setTimeout(() => setIdx(idx + 1), (idx === 0 ? 400 : stepMs(scene, idx)) + 1100);
    return () => clearTimeout(id);
  }, [playing, idx, last, scene]);

  // Nicht im Bild = nicht animieren (Akku).
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) setPlaying(false); }, { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    if (idx >= last) setIdx(0);
    setPlaying(true);
  };
  const go = (i) => { setPlaying(false); setIdx(Math.max(0, Math.min(last, i))); };
  const markDelay = step.mark && step.mark.after && tl[step.mark.after] ? tl[step.mark.after].firstEnd : 0;
  const stripes = [...new Set(scene.balls.map((x) => x.n).filter((n) => n > 8))];

  return (
    <div className="rs-player" ref={rootRef}>
      <div className="rs-head">
        <span className="rs-label">{t(scene.label)}</span>
      </div>
      <svg className="rs-table" viewBox="0 0 220 120" role="img" aria-label={t(step.text)}>
        <defs>
          {stripes.map((n) => (
            <linearGradient key={n} id={`${uid}s${n}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={CREAM} /><stop offset="0.3" stopColor={CREAM} />
              <stop offset="0.3" stopColor={POOL_COLORS[n]} /><stop offset="0.7" stopColor={POOL_COLORS[n]} />
              <stop offset="0.7" stopColor={CREAM} /><stop offset="1" stopColor={CREAM} />
            </linearGradient>
          ))}
        </defs>
        <rect className="rs-rail" x="0" y="0" width="220" height="120" rx="9" />
        <rect className="rs-cloth" x="9" y="9" width="202" height="102" rx="2" />
        {POCKETS.map((p, i) => <circle key={i} className="rs-pocket" cx={p[0]} cy={p[1]} r="6.5" />)}

        {step.aim && (
          <line key={"aim" + idx} className="rs-aim" x1={step.aim[0][0]} y1={step.aim[0][1]} x2={step.aim[1][0]} y2={step.aim[1][1]} />
        )}

        {scene.balls.map((ball) => (
          <g key={ball.id} ref={(el) => { els.current[ball.id] = el; }} className="rs-ball"
            style={{ transform: tr(pos[ball.id]), opacity: out[ball.id] ? 0 : 1 }}>
            {(step.focus || []).includes(ball.id) && <circle className="rs-focus" r={BALL_R + 2.6} />}
            <BallShape n={ball.n} grad={`${uid}s${ball.n}`} />
          </g>
        ))}

        {step.mark && (
          <g key={"mark" + idx} className={"rs-mark " + step.mark.kind}
            style={{ transform: tr(step.mark.at), animationDelay: `${markDelay}ms` }}>
            <g className="rs-mark-in" style={{ animationDelay: `${markDelay}ms` }}>
              <circle r="9" />
              {step.mark.kind === "foul"
                ? <path d="M-3.5 -3.5 L3.5 3.5 M3.5 -3.5 L-3.5 3.5" />
                : <path d="M-4 0.4 L-1.2 3.2 L4 -3" />}
            </g>
          </g>
        )}
      </svg>

      <p className="rs-caption" aria-live="polite">{t(step.text)}</p>
      {done && (
        <p className={"rs-verdict " + scene.verdict}>
          {scene.verdict === "foul" ? <X size={15} /> : <Check size={15} />}
          <b>{scene.verdict === "foul" ? t("Foul") : t("Kein Foul")}</b>
          <span>{t(scene.reason)}</span>
        </p>
      )}

      <div className="rs-controls">
        <button type="button" className="icon-btn small" onClick={() => go(idx - 1)} disabled={idx === 0}
          title={t("Schritt zurück")} aria-label={t("Schritt zurück")}><ChevronLeft size={18} /></button>
        <button type="button" className="icon-btn small primary" onClick={togglePlay}
          title={playing ? t("Pause") : t("Abspielen")} aria-label={playing ? t("Pause") : t("Abspielen")}>
          {playing ? <Pause size={16} /> : done ? <RotateCcw size={16} /> : <Play size={16} />}
        </button>
        <button type="button" className="icon-btn small" onClick={() => go(idx + 1)} disabled={done}
          title={t("Nächster Schritt")} aria-label={t("Nächster Schritt")}><ChevronRight size={18} /></button>
        <span className="rs-dots" role="group" aria-label={t("Schritte")}>
          {scene.steps.map((_, i) => (
            <button key={i} type="button" className={"rs-dot" + (i === idx ? " on" : i < idx ? " past" : "")}
              onClick={() => go(i)} aria-label={t("Schritt {n}", { n: i + 1 })} aria-current={i === idx ? "step" : undefined} />
          ))}
        </span>
      </div>
    </div>
  );
}
