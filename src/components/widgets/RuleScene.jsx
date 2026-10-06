import { useState, useRef, useEffect, useLayoutEffect, useId } from "react";
import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw, Check, X } from "lucide-react";
import { t } from "../../lib/i18n";
import { POOL_COLORS } from "../../lib/pool";
import { BALL_R, POCKETS, stateAt, timeline, stepMs, pathFrames, CLOCK_MS, clockAt, hasClock, bubbleSpot, bubbleWidth } from "../../lib/ruleEngine";

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

function BallShape({ n, grad, fill }) {
  if (n === 0) return <circle r={BALL_R} fill={fill || "#E7E0CE"} />;
  const c = POOL_COLORS[n];
  return (
    <>
      <circle r={BALL_R} fill={n <= 8 ? c : `url(#${grad})`} />
      <circle r={2.6} fill={CREAM} />
      <text className="rs-no" textAnchor="middle" dominantBaseline="central" y={0.2}>{n}</text>
    </>
  );
}

/* Figuren (Queue, Hand): gezeichnet wie ein Kugelsymbol, nie Teil der Physik. Pose = Spitze/Handgelenk
   `at`, Blickrichtung `angle` (Grad, 0 = nach rechts). Beim Schrittwechsel gleitet die Figur von `from`
   nach `at` (CSS-Animation, nur im Bewegungs-Block; der Ruhezustand ist die Endpose).
   until: "hit" = bis zum Treffmoment der Weissen (Schieben), sonst dur ms. */
function Figure({ f, tl }) {
  const to = f.at, from = f.from || f.at;
  const w = tl && tl.w;
  const dur = f.until === "hit" && w ? w.firstEnd : f.dur || 300;
  const style = { transform: tr(to), "--fx": from[0] + "px", "--fy": from[1] + "px", "--dur": dur + "ms", "--del": (f.delay || 0) + "ms" };
  return (
    <g className="rs-fig" style={style} aria-hidden="true">
      <g transform={`rotate(${f.angle || 0})`}>
        {f.kind === "template" ? (
          <polygon className="rs-template" points="-17,-3 17,-3 13,3 -13,3" />
        ) : f.kind === "cue" ? (
          <>
            <line className="rs-cue-shaft" x1="-72" y1="0" x2="-3" y2="0" />
            <line className="rs-cue-tip" x1="-3.2" y1="0" x2="0" y2="0" />
          </>
        ) : (
          <>
            <circle className="rs-hand" r="4" />
            {[-4, -1.8, 0.4, 2.6].map((y) => <rect key={y} className="rs-hand" x="2.5" y={y - 0.3} width="7.5" height="1.9" rx="0.95" />)}
            <rect className="rs-hand" x="0" y="3.6" width="5.2" height="2" rx="1" transform="rotate(35 0 3.6)" />
          </>
        )}
      </g>
    </g>
  );
}

/* Symbol in der Sprechblase: Mund = es wird gesprochen/angesagt, Hand = es wird eingegriffen (Stoerung). */
function SayIcon({ kind, x, y }) {
  return (
    <g className="rs-sayicon" transform={`translate(${x} ${y})`} aria-hidden="true">
      {kind === "hand" ? (
        <>
          <rect x="1.6" y="3.6" width="5" height="4" rx="1.2" />
          <path d="M2.2 3.8 V1.2 M3.8 3.4 V0.6 M5.4 3.4 V0.8 M7 3.8 V1.6" />
        </>
      ) : (
        <>
          <path d="M0.8 4.5 Q2.6 1.7 4 2.9 Q5.4 1.7 7.2 4.5 Q4 8.1 0.8 4.5 Z" />
          <path d="M0.9 4.5 H7.1" />
        </>
      )}
    </g>
  );
}

/* Standbild von der Seite (Regel 3.4): Boden, Tischkante, Spieler mit Queue. air = beide Fuesse in der Luft. */
function Stance({ mode }) {
  const ok = mode === "ok";
  return (
    <svg className={"rs-stance " + (ok ? "ok" : "air")} viewBox="0 0 110 62" role="img" aria-label={t(ok ? "Mindestens ein Fuß am Boden" : "Beide Füße in der Luft")}>
      <line className="rs-floor" x1="2" y1="58" x2="108" y2="58" />
      <rect className="rs-tablex" x="72" y="30" width="36" height="28" rx="2" />
      <circle className="rs-body" cx="22" cy="10" r="5" />
      <path className="rs-body" d="M22 15 L32 33 M28 24 L50 28 M40 27 L106 27" />
      {ok ? (
        <path className="rs-body" d="M32 33 L27 57 L35 57 M32 33 L44 44 L40 52" />
      ) : (
        <path className="rs-body" d="M32 33 L46 44 L38 50 M32 33 L50 40 L44 48" />
      )}
      {ok
        ? <path className="rs-stance-mark ok" d="M44 53 L48 57 L56 49" />
        : <path className="rs-stance-mark air" d="M44 50 L56 62 M56 50 L44 62" />}
    </svg>
  );
}

/* Uhr mit Sekundenzaehler: Zifferblatt mit Fortschrittsbogen und Zeiger (eine
   Umdrehung = Grenze), grosse Zahl und je Sekunde ein Punkt. Steht ausserhalb des
   Tisches, verdeckt also nie eine Kugel. */
function Clock({ s, limit = 5 }) {
  const p = Math.min(1, s / limit), over = s >= limit;
  return (
    <div className={"rs-clock" + (over ? " over" : "")} role="timer" aria-label={t("Zeit: {s} Sekunden", { s })}>
      <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
        <circle className="rs-clock-face" cx="18" cy="18" r="15" />
        <circle className="rs-clock-arc" cx="18" cy="18" r="15" pathLength="100" strokeDasharray={`${p * 100} 100`} transform="rotate(-90 18 18)" />
        {Array.from({ length: limit }, (_, i) => {
          const a = (i / limit) * Math.PI * 2;
          return <line key={i} className="rs-clock-tick" x1={18 + Math.sin(a) * 12.5} y1={18 - Math.cos(a) * 12.5} x2={18 + Math.sin(a) * 14.5} y2={18 - Math.cos(a) * 14.5} />;
        })}
        <line className="rs-clock-hand" x1="18" y1="18" x2="18" y2="8.5" style={{ transform: `rotate(${p * 360}deg)`, transformOrigin: "18px 18px" }} />
        <circle className="rs-clock-pin" cx="18" cy="18" r="1.7" />
      </svg>
      <span className="rs-clock-num">{s}<small> s</small></span>
      <span className="rs-clock-dots" aria-hidden="true">
        {Array.from({ length: limit }, (_, i) => <i key={i} className={i < s ? "on" : ""} />)}
      </span>
      {over && <span className="rs-clock-flag">{t("Grenze erreicht")}</span>}
    </div>
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

  // Uhr: zaehlt beim Schrittwechsel sichtbar bis zum Zielwert hoch (rueckwaerts/ohne Animation sofort).
  const withClock = hasClock(scene);
  const clockTarget = clockAt(scene, idx);
  const [clockShown, setClockShown] = useState(clockTarget);
  const clockRef = useRef(clockTarget);
  useEffect(() => {
    if (!withClock) return;
    if (clockTarget <= clockRef.current || reducedMotion()) { clockRef.current = clockTarget; setClockShown(clockTarget); return; }
    const id = setInterval(() => {
      clockRef.current += 1;
      setClockShown(clockRef.current);
      if (clockRef.current >= clockTarget) clearInterval(id);
    }, CLOCK_MS);
    return () => clearInterval(id);
  }, [clockTarget, withClock]);

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
      if (m && m.place) {
        // Hingelegt: am Ziel einblenden statt zu rollen.
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: m.dur, delay: m.delay, fill: "backwards", easing: "ease-out" });
      } else if (m) {
        // Bremskurve ist in die Keyframes eingerechnet (lib/ruleScenes.js), daher linear abspielen.
        const frames = pathFrames(m).map((f) => ({ transform: tr(f.p), offset: f.offset }));
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
  // Siegel-Zeitpunkt: im Treffmoment (after) bzw. am Bewegungsende (afterEnd) einer Kugel, plus delay.
  const mk = step.mark || {};
  const markDelay = (mk.delay || 0)
    + (mk.after && tl[mk.after] ? tl[mk.after].firstEnd : 0)
    + (mk.afterEnd && tl[mk.afterEnd] ? tl[mk.afterEnd].delay + tl[mk.afterEnd].dur : 0);
  const stripes = [...new Set(scene.balls.map((x) => x.n).filter((n) => n > 8))];

  return (
    <div className="rs-player" ref={rootRef}>
      <div className="rs-head">
        <span className="rs-label">{t(scene.label)}</span>
        {scene.tag && <span className="rs-tagchip">{t(scene.tag)}</span>}
      </div>
      {(step.shot || step.count) && (
        <div className="rs-seq" key={"seq" + idx}>
          {step.shot && <span className="rs-shot">{t("Stoß {n} von {of}", { n: step.shot.n, of: step.shot.of })}{step.shot.who ? " · " + t(step.shot.who) : ""}</span>}
          {step.count && (
            <span className={"rs-count" + (step.count.good ? " good" : step.count.n >= step.count.of ? " full" : "")} aria-label={t(step.count.label) + " " + step.count.n + "/" + step.count.of}>
              {t(step.count.label)}
              <span className="rs-count-dots" aria-hidden="true">
                {Array.from({ length: step.count.of }, (_, i) => <i key={i} className={i < step.count.n ? "on" : ""} />)}
              </span>
            </span>
          )}
        </div>
      )}
      {scene.steps.some((x) => x.stance) && <div className="rs-stancebox">{step.stance && <Stance mode={step.stance} />}</div>}
      {withClock && <Clock s={clockShown} limit={scene.clockLimit || 5} />}
      <svg className="rs-table" viewBox="0 0 220 120" role="button" tabIndex={0} aria-label={t(step.text)}
        onClick={togglePlay} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePlay(); } }}>
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
        {scene.table && scene.table.headLine && (
          <g className="rs-lines" aria-hidden="true">
            <rect className="rs-kitchen" x="10" y="10" width="50" height="100" />
            <line x1="60" y1="10" x2="60" y2="110" />
            <circle cx="60" cy="60" r="1.2" /><circle cx="110" cy="60" r="1.2" /><circle cx="160" cy="60" r="1.2" />
          </g>
        )}
        {scene.table && scene.table.triangle && <polygon className="rs-triangle" points="149,60 203.6,28.5 203.6,91.5" />}
        {POCKETS.map((p, i) => <circle key={i} className="rs-pocket" cx={p[0]} cy={p[1]} r="6.5" />)}

        {step.aim && (
          <polyline key={"aim" + idx} className="rs-aim" fill="none" points={step.aim.map((p) => p.join(",")).join(" ")} />
        )}

        {scene.balls.map((ball) => (
          <g key={ball.id} ref={(el) => { els.current[ball.id] = el; }} className="rs-ball"
            style={{ transform: tr(pos[ball.id]), opacity: out[ball.id] ? 0 : 1 }}>
            {(step.focus || []).includes(ball.id) && <circle className="rs-focus" r={BALL_R + 2.6} />}
            <BallShape n={ball.n} grad={`${uid}s${ball.n}`} fill={ball.fill} />
          </g>
        ))}

        {(step.figs || []).map((f, i) => <Figure key={"fig" + idx + "-" + i} f={f} tl={tl} />)}

        {step.say && (() => {
          const w = bubbleWidth(t(step.say), step.sayIcon);
          const spot = bubbleSpot(scene, idx, w);
          return (
            <g key={"say" + idx} className="rs-say">
              <rect x={spot.x} y={spot.y} rx="3" height="11" width={w} />
              {step.sayIcon && <SayIcon kind={step.sayIcon} x={spot.x + 3} y={spot.y + 1.5} />}
              <text x={spot.x + (step.sayIcon ? 14 : 4)} y={spot.y + 5.6} dominantBaseline="central">{t(step.say)}</text>
            </g>
          );
        })()}

        {step.mark && (
          <g key={"mark" + idx} className={"rs-mark " + step.mark.kind}
            style={{ transform: tr(step.mark.at), animationDelay: `${markDelay}ms` }}>
            <g className="rs-mark-in" style={{ animationDelay: `${markDelay}ms` }}>
              <circle className="rs-ring" r="8.6" />
              <g transform="translate(7.6 -7.6)">
                <circle className="rs-badge-bg" r="4.7" />
                {step.mark.kind === "foul"
                  ? <path d="M-2 -2 L2 2 M2 -2 L-2 2" />
                  : <path d="M-2.3 0.2 L-0.6 1.9 L2.3 -1.7" />}
              </g>
            </g>
          </g>
        )}
      </svg>

      <p className="rs-caption" aria-live="polite">{t(step.text)}</p>
      {done && (
        <p className={"rs-verdict " + scene.verdict}>
          {scene.verdict === "foul" ? <X size={15} /> : <Check size={15} />}
          <b>{scene.verdictLabel ? t(scene.verdictLabel) : scene.verdict === "foul" ? t("Foul") : t("Kein Foul")}</b>
          <span>{t(scene.reason)}</span>
        </p>
      )}

      <div className="rs-controls">
        <button type="button" className="icon-btn" onClick={() => go(idx - 1)} disabled={idx === 0}
          title={t("Schritt zurück")} aria-label={t("Schritt zurück")}><ChevronLeft size={26} /></button>
        <button type="button" className="icon-btn primary big" onClick={togglePlay}
          title={playing ? t("Pause") : t("Abspielen")} aria-label={playing ? t("Pause") : t("Abspielen")}>
          {playing ? <Pause size={26} /> : done ? <RotateCcw size={26} /> : <Play size={26} />}
        </button>
        <button type="button" className="icon-btn" onClick={() => go(idx + 1)} disabled={done}
          title={t("Nächster Schritt")} aria-label={t("Nächster Schritt")}><ChevronRight size={26} /></button>
      </div>
      <span className="rs-dots" role="group" aria-label={t("Schritte")}>
        {scene.steps.map((_, i) => (
          <button key={i} type="button" className={"rs-dot" + (i === idx ? " on" : i < idx ? " past" : "")}
            onClick={() => go(i)} aria-label={t("Schritt {n}", { n: i + 1 })} aria-current={i === idx ? "step" : undefined} />
        ))}
      </span>
    </div>
  );
}
