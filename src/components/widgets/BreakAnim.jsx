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
const CUE_X = 100, CUE_END = 164; // Weisse: Start und Endlage (nach dem Stoss rollt sie ein Stueck zurueck)
const X0 = 8 + R, X1 = 352 - R, Y0 = 8 + R, Y1 = 92 - R; // Mittelpunkte der Kugeln bleiben innerhalb der Banden

// Bahn einer Kugel: Start, Richtung, Laenge; an den Banden wird gespiegelt (mit Verlust)
function route(x, y, ang, len) {
  const pts = [[x, y]]; let dx = Math.cos(ang), dy = Math.sin(ang), left = len;
  for (let n = 0; n < 4 && left > 0.5; n++) {
    const [cx, cy] = pts[pts.length - 1];
    const tx = dx > 0 ? (X1 - cx) / dx : dx < 0 ? (X0 - cx) / dx : Infinity;
    const ty = dy > 0 ? (Y1 - cy) / dy : dy < 0 ? (Y0 - cy) / dy : Infinity;
    const s = Math.min(tx, ty, left);
    pts.push([cx + dx * s, cy + dy * s]);
    left = (left - s) * 0.78;
    if (s === tx) dx = -dx;
    if (s === ty) dy = -dy;
  }
  return pts;
}
const at = (pts, d) => { // Punkt in Entfernung d entlang der Bahn
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= seg || i === pts.length - 1) { const f = seg ? Math.min(1, d / seg) : 1; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]; }
    d -= seg;
  }
  return pts[pts.length - 1];
};

const RACK = (() => {
  const out = []; let i = 0;
  ROWS.forEach((row, r) => row.forEach((n, k) => {
    const x = AX + r * DX, y = AY + (k - r / 2) * DY;
    const a = ((i * 137 + 29) % 100) / 100, b = ((i * 59 + 11) % 100) / 100;
    // Richtung: vom Stosspunkt nach aussen, mit Streuung; Laenge: weit (Powerbreak)
    const ang = Math.atan2(y - AY, x - (AX - 12)) + (b - 0.5) * 0.9;
    const len = 110 + a * 230 + r * 14;
    out.push({ n, x, y, i, route: route(x, y, ang, len), rot: Math.round((a - 0.5) * 420) });
    i++;
  }));
  // Endlagen: nie uebereinander (und nicht auf der Weissen) - das Bahnende wird dafuer leicht verschoben
  const ends = out.map((o) => [...o.route[o.route.length - 1]]);
  for (let it = 0; it < 400; it++) {
    const pts = [...ends.map((e) => ({ e })), { e: [CUE_END, 50], fixed: true }];
    for (let p = 0; p < pts.length; p++) for (let q = p + 1; q < pts.length; q++) {
      let dx = pts[q].e[0] - pts[p].e[0], dy = pts[q].e[1] - pts[p].e[1], d = Math.hypot(dx, dy);
      if (d < 0.5) { dx = Math.cos(p * 2.4 + q); dy = Math.sin(p * 2.4 + q); d = 1; }
      const gap = 2 * R + 0.4 - d;
      if (gap <= 0) continue;
      const ux = dx / d, uy = dy / d, mp = pts[p].fixed ? 0 : 1, mq = pts[q].fixed ? 0 : 1, m = mp + mq;
      pts[p].e[0] -= ux * gap * mp / m; pts[p].e[1] -= uy * gap * mp / m;
      pts[q].e[0] += ux * gap * mq / m; pts[q].e[1] += uy * gap * mq / m;
    }
    ends.forEach((e) => { e[0] = Math.min(X1, Math.max(CUE_END + 2 * R + 1, e[0])); e[1] = Math.min(Y1, Math.max(Y0, e[1])); });
  }
  out.forEach((o, j) => { o.route[o.route.length - 1] = ends[j]; });
  // Keyframes (relativ zur Ausgangslage), Abbremsung baked: schnell am Anfang, ausrollend
  const total = (rt) => rt.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - rt[i][0], p[1] - rt[i][1]), 0);
  out.forEach((o) => {
    const L = total(o.route), N = 30;
    o.frames = Array.from({ length: N + 1 }, (_, s) => {
      const f = s / N, p = at(o.route, L * (1 - Math.pow(1 - f, 2.6)));
      return { transform: `translate(${(p[0] - o.x).toFixed(2)}px, ${(p[1] - o.y).toFixed(2)}px) rotate(${(o.rot * f).toFixed(1)}deg)`, offset: f };
    });
  });
  return out;
})();

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

export const BREAK_MS = 2300;
const HIT_MS = 840; // so lange dauert es, bis die Weisse das Dreieck trifft

export default function BreakButton({ onOpen }) {
  const [breaking, setBreaking] = useState(false);
  const timer = useRef(null);
  const els = useRef([]);
  const anims = useRef([]);
  useEffect(() => () => { clearTimeout(timer.current); anims.current.forEach((a) => a.cancel()); }, []);
  const go = () => {
    if (breaking) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { onOpen(); return; }
    setBreaking(true);
    anims.current = els.current.map((el, i) => el?.animate?.(RACK[i].frames, { duration: 1400, delay: HIT_MS, easing: "linear", fill: "both" })).filter(Boolean);
    timer.current = setTimeout(() => {
      anims.current.forEach((a) => a.cancel()); anims.current = [];
      setBreaking(false); onOpen();
    }, BREAK_MS);
  };
  return (
    <button type="button" className={"break-btn" + (breaking ? " breaking" : "")} onClick={go} aria-label={t("Neues Turnier")}>
      <svg viewBox="0 0 360 100" className="break-svg" aria-hidden="true" focusable="false">
        {RACK.map((b) => <Ball key={b.i} b={b} refFn={(el) => { els.current[b.i] = el; }} />)}
        <g className="bb-cue">
          <circle cx={CUE_X} cy="50" r={R} fill="#f6f2e8" />
          <circle cx={CUE_X - 3} cy="46.7" r="1.9" fill="#fff" opacity=".8" />
        </g>
        <g className="bb-stick">
          <path d={`M-1500 47 L${CUE_X - 12} 49.2 L${CUE_X - 12} 50.8 L-1500 53 Z`} className="bb-stick-body" />
          <rect x={CUE_X - 13} y="49" width="4.6" height="2" rx="1" className="bb-stick-tip" />
        </g>
      </svg>
      <span className="break-label">{t("Neues Turnier")}</span>
    </button>
  );
}
