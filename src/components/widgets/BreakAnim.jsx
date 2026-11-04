import { useState, useRef, useEffect } from "react";
import { t } from "../../lib/i18n";

/* "Neues Turnier"-Knopf wie der Ping-Knopf im Live-Tab (Nutzer 2026-11-04): in Ruhe bewegt sich nur der Queue leicht, ein Klick loest den Anstoss aus
   (Queue holt aus und stoesst die weisse Kugel, diese sprengt das richtig aufgebaute 15er-Dreieck wie ein Powerbreak: die Kugeln fliegen weit, prallen
   von den Banden ab und rollen aus), danach oeffnet sich das Anlege-Fenster. Die Zeichnung waechst mit der Breite (viewBox), der Queue ist sehr lang.
   Ohne "Bewegung reduzieren" ist es ein ruhiges Bild und das Fenster oeffnet sofort. Der Weg jeder Kugel wird einmal berechnet (Bahn mit Bandenreflexion,
   Ausrollen als Abbremsung) und per Web Animations API abgespielt; die Weisse und der Queue laufen ueber CSS (App.css). */
const COL = { 1: "#f2c230", 2: "#2f5fd0", 3: "#d8392b", 4: "#6a3fa0", 5: "#ee7d1d", 6: "#1f8a4c", 7: "#8a2a2a", 8: "#1b1b1b" };
// Zeilen von der Spitze: 8 in der Mitte der 3. Reihe, in den hinteren Ecken eine volle und eine halbe, 7 Volle und 7 Halbe
const ROWS = [[1], [11, 3], [7, 8, 13], [9, 2, 12, 5], [4, 14, 6, 10, 15]];
const R = 8.6;
const AX = 190, AY = 50, DX = 14.9, DY = 17.2; // Spitze des Dreiecks und Abstaende
const CUE_X = 100; // Weisse: Startpunkt
const SIM_S = 1.5, FPS = 30; // simulierte Dauer nach dem Stoss, Bilder pro Sekunde
const HIT_MS = 760; // so lange dauert es, bis die Weisse das Dreieck trifft

/* Kleine Physik (bei jedem Klick neu, mit Zufall): Scheiben gleicher Masse, elastische Stoesse zwischen allen Kugeln, Rollreibung, kurz nach dem Stoss bekommt jede
   Kugel des Dreiecks einen kraeftigen Schub nach aussen (die schnellen verlassen den Knopf, der ihn abschneidet). So laufen Kugeln nie durcheinander durch und enden nie uebereinander. */
function simulate(rack) {
  const hit = [AX - 2 * R, AY];
  // jedes Mal anders: Kraft, Grundrichtung und je Kugel Richtung/Tempo sind zufaellig
  const power = 0.88 + Math.random() * 0.3, bias = (Math.random() - 0.5) * 0.3;
  const B = rack.map((o) => {
    const a = Math.random(), j = Math.random();
    const ang = Math.atan2(o.y - AY, o.x - (AX - 14)) + bias + (j - 0.5) * 0.6, sp = (75 + a * 200) * power;
    return { x: o.x, y: o.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, roll: 0 };
  });
  B.push({ x: hit[0], y: hit[1], vx: -55, vy: 8, roll: 0 }); // die Weisse rollt nach dem Stoss langsam zurueck
  const dt = 1 / 240, fr = 140, frames = [];
  const snap = () => frames.push(B.map((b) => [b.x, b.y, b.roll]));
  snap();
  const steps = Math.round(SIM_S / dt), every = Math.round(1 / (FPS * dt));
  for (let st = 1; st <= steps; st++) {
    B.forEach((b) => {
      const v = Math.hypot(b.vx, b.vy);
      if (v > 0) { const nv = Math.max(0, v - fr * dt); b.vx *= nv / v; b.vy *= nv / v; }
      b.x += b.vx * dt; b.y += b.vy * dt; b.roll += (b.vx * dt) / R;
    });
    for (let it = 0; it < 3; it++) for (let p = 0; p < B.length; p++) for (let q = p + 1; q < B.length; q++) {
      const dx = B[q].x - B[p].x, dy = B[q].y - B[p].y, d = Math.hypot(dx, dy);
      if (d >= 2 * R || d < 1e-6) continue;
      const nx = dx / d, ny = dy / d, over = (2 * R - d) / 2;
      B[p].x -= nx * over; B[p].y -= ny * over; B[q].x += nx * over; B[q].y += ny * over;
      const rv = (B[q].vx - B[p].vx) * nx + (B[q].vy - B[p].vy) * ny;
      if (rv < 0) { const j = -(1 + 0.93) * rv / 2; B[p].vx -= j * nx; B[p].vy -= j * ny; B[q].vx += j * nx; B[q].vy += j * ny; }
    }
    if (st % every === 0) snap();
  }
  return frames;
}

const RACK = (() => {
  const out = []; let i = 0;
  ROWS.forEach((row, r) => row.forEach((n, k) => { out.push({ n, x: AX + r * DX, y: AY + (k - r / 2) * DY, i }); i++; }));
  return out;
})();

// Ein Anstoss: Keyframes fuer jede Kugel des Dreiecks und fuer die Weisse (erst in Ruhe, dann zum Stosspunkt, danach der simulierte Verlauf)
function planBreak() {
  const fr = simulate(RACK), N = fr.length - 1;
  const tf = (x0, y0, f, idx) => `translate(${(f[idx][0] - x0).toFixed(2)}px, ${(f[idx][1] - y0).toFixed(2)}px) rotate(${(f[idx][2] * 57.3 * 0.6).toFixed(1)}deg)`;
  const balls = RACK.map((o) => fr.map((f, s) => ({ transform: tf(o.x, o.y, f, o.i), offset: s / N })));
  const cue = [], T = HIT_MS + SIM_S * 1000, hitX = AX - 2 * R - CUE_X;
  cue.push({ transform: "translate(0px, 0px)", offset: 0 });
  cue.push({ transform: "translate(0px, 0px)", offset: 700 / T });
  cue.push({ transform: `translate(${hitX}px, 0px)`, offset: HIT_MS / T });
  fr.forEach((f, s) => { if (s > 0) cue.push({ transform: `translate(${(f[15][0] - CUE_X).toFixed(2)}px, ${(f[15][1] - AY).toFixed(2)}px)`, offset: (HIT_MS + (s / N) * SIM_S * 1000) / T }); });
  return { balls, cue, total: T };
}

function Ball({ b, refFn }) {
  const base = b.n > 8 ? b.n - 8 : b.n, stripe = b.n > 8, h = R * 0.52, w = Math.sqrt(R * R - h * h);
  return (
    <g className="bb-ball" ref={refFn}>
      <circle cx={b.x} cy={b.y} r={R} fill={stripe ? "#f6f2e8" : COL[base]} />
      {stripe && <path d={`M${b.x - w} ${b.y - h}L${b.x + w} ${b.y - h}A${R} ${R} 0 0 1 ${b.x + w} ${b.y + h}L${b.x - w} ${b.y + h}A${R} ${R} 0 0 1 ${b.x - w} ${b.y - h}Z`} fill={COL[base]} />}
      <circle cx={b.x} cy={b.y} r="3.7" fill="#f6f2e8" />
      <text x={b.x} y={b.y + 1.9} textAnchor="middle" fontSize="5.2" fontWeight="800" fill="#111">{b.n}</text>
      <circle cx={b.x - 3} cy={b.y - 3.3} r="1.9" fill="#fff" opacity=".3" />
    </g>
  );
}

/* Queue: ein sehr lang gezogenes Dreieck (dick am Griff, spitz an der Kappe) mit heller Spitze, Zwinge, Gelenk und einer zufaelligen Verzierung am Griff. */
const TIP = CUE_X - 12; // Spitze des Queues
const half = (x) => Math.min(5, (2.2 + (TIP - x) * 0.065) / 2);
const quad = (x1, x2) => `M${x1} ${50 - half(x1)}L${x2} ${50 - half(x2)}L${x2} ${50 + half(x2)}L${x1} ${50 + half(x1)}Z`;
const PALETTES = [["#d8392b", "#f2c230"], ["#2f9fd0", "#f6f2e8"], ["#1f8a4c", "#f2c230"], ["#a24bd0", "#f6f2e8"], ["#ee7d1d", "#1b1b1b"], ["#e04d8a", "#f6f2e8"]];
const makeDeco = (prev) => { let n; do { n = { kind: Math.floor(Math.random() * 5), pal: Math.floor(Math.random() * PALETTES.length) }; } while (prev && n.kind === prev.kind && n.pal === prev.pal); return n; };
function stick({ kind, pal }) {
  const [c1, c2] = PALETTES[pal];
  const butt = [];
  if (kind === 0) { [[26, 20], [14, 11], [2, -1]].forEach(([x1, x2], i) => butt.push(<path key={i} d={quad(x1, x2)} fill={i % 2 ? c2 : c1} />)); } // Ringe
  if (kind === 1) { [24, 8, -8].forEach((x, i) => butt.push(<path key={i} d={`M${x} ${50 - half(x) * 0.8}L${x + half(x) * 0.9} 50L${x} ${50 + half(x) * 0.8}L${x - half(x) * 0.9} 50Z`} fill={i % 2 ? c2 : c1} />)); } // Rauten
  if (kind === 2) { for (let i = 0; i < 5; i++) { const x = 28 - i * 8; butt.push(<path key={i} d={`M${x} ${50 - half(x)}L${x - 7} ${50 - half(x - 7)}L${x - 3} ${50 + half(x - 3)}L${x + 4} ${50 + half(x + 4)}Z`} fill={i % 2 ? c2 : c1} />); } } // Wickel schraeg
  if (kind === 3) { [26, 15, 4, -7].forEach((x, i) => butt.push(<circle key={i} cx={x} cy="50" r={half(x) * 0.5} fill={i % 2 ? c2 : c1} />)); } // Punkte
  if (kind === 4) { butt.push(<path key="a" d={quad(28, -14)} fill={c1} />); butt.push(<path key="b" d={`M26 50L2 ${50 - half(2) * 0.7}L-12 50L2 ${50 + half(2) * 0.7}Z`} fill={c2} />); } // Band mit Raute
  return (
    <>
      <path d={`M40 ${50 - half(40)}L${TIP} ${50 - half(TIP)}L${TIP} ${50 + half(TIP)}L40 ${50 + half(40)}Z`} fill="#e8c78a" />
      <path d={`M40 ${50 - half(40)}L-35 45L-1500 45L-1500 55L-35 55L40 ${50 + half(40)}Z`} fill="#3b2a1d" />
      <path d={quad(41, 38)} fill="#c9a24a" />
      {butt}
      <path d={quad(TIP - 6, TIP - 1)} fill="#f6f2e8" />
      <rect x={TIP - 0.2} y={50 - half(TIP)} width="2.2" height={half(TIP) * 2} rx="0.8" fill="#6fb1d6" />
    </>
  );
}

export const BREAK_MS = 2500;

export default function BreakButton({ onOpen }) {
  const [breaking, setBreaking] = useState(false);
  const timer = useRef(null);
  const els = useRef([]);
  const anims = useRef([]);
  const cueEl = useRef(null);
  const [deco, setDeco] = useState(() => makeDeco());
  useEffect(() => () => { clearTimeout(timer.current); anims.current.forEach((a) => a.cancel()); }, []);
  const go = () => {
    if (breaking) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { onOpen(); return; }
    setBreaking(true);
    const plan = planBreak();
    anims.current = els.current.map((el, i) => el?.animate?.(plan.balls[i], { duration: SIM_S * 1000, delay: HIT_MS, easing: "linear", fill: "both" })).filter(Boolean);
    if (cueEl.current?.animate) anims.current.push(cueEl.current.animate(plan.cue, { duration: plan.total, easing: "linear", fill: "both" }));
    timer.current = setTimeout(() => {
      anims.current.forEach((a) => a.cancel()); anims.current = [];
      setBreaking(false); setDeco((d) => makeDeco(d)); onOpen();
    }, BREAK_MS);
  };
  return (
    <button type="button" className={"break-btn" + (breaking ? " breaking" : "")} onClick={go} aria-label={t("Neues Turnier")}>
      <svg viewBox="0 0 360 100" className="break-svg" aria-hidden="true" focusable="false">
        {RACK.map((b) => <Ball key={b.i} b={b} refFn={(el) => { els.current[b.i] = el; }} />)}
        <g className="bb-cue" ref={cueEl}>
          <circle cx={CUE_X} cy="50" r={R} fill="#f6f2e8" />
          <circle cx={CUE_X - 3} cy="46.7" r="1.9" fill="#fff" opacity=".8" />
        </g>
        <g className="bb-stick">{stick(deco)}</g>
      </svg>
      <span className="break-label">{t("Neues Turnier")}</span>
    </button>
  );
}
