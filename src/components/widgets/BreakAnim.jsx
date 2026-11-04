import { useState, useRef, useEffect } from "react";
import { t } from "../../lib/i18n";

/* "Neues Turnier"-Knopf wie der Ping-Knopf im Live-Tab (Nutzer 2026-11-04): in Ruhe bewegt sich nur der Queue leicht, ein Klick loest den Anstoss aus
   (Queue holt aus, stoesst die weisse Kugel, diese sprengt das richtig aufgebaute 15er-Dreieck - bewusst uebertrieben, comichaft), danach oeffnet sich
   das Anlege-Fenster. Die Zeichnung waechst mit der Breite (viewBox), der Queue ist sehr lang und fuellt den Knopf. Ohne "Bewegung reduzieren" ist es
   ein ruhiges Bild und das Fenster oeffnet sofort. Reine SVG-Zeichnung, die Bewegung steckt in App.css. */
const COL = { 1: "#f2c230", 2: "#2f5fd0", 3: "#d8392b", 4: "#6a3fa0", 5: "#ee7d1d", 6: "#1f8a4c", 7: "#8a2a2a", 8: "#1b1b1b" };
// Zeilen von der Spitze: 8 in der Mitte der 3. Reihe, in den hinteren Ecken eine volle und eine halbe, 7 Volle und 7 Halbe
const ROWS = [[1], [11, 3], [7, 8, 13], [9, 2, 12, 5], [4, 14, 6, 10, 15]];
const R = 8.6;
const AX = 252, AY = 50, DX = 14.9, DY = 17.2; // Spitze des Dreiecks und Abstaende
const RACK = (() => {
  const out = []; let i = 0;
  ROWS.forEach((row, r) => row.forEach((n, k) => {
    const x = AX + r * DX, y = AY + (k - r / 2) * DY;
    const a = ((i * 137 + 29) % 100) / 100, b = ((i * 59 + 11) % 100) / 100;
    out.push({
      n, x, y, i,
      dx: Math.round(Math.min(354 - R - x, 20 + a * 70 + r * 7)),
      dy: Math.round(Math.max(6 + R - y, Math.min(94 - R - y, (b - 0.5) * 120))),
      rot: Math.round((a - 0.5) * 900),
    });
    i++;
  }));
  return out;
})();

function Ball({ b }) {
  const base = b.n > 8 ? b.n - 8 : b.n, stripe = b.n > 8, h = R * 0.52, w = Math.sqrt(R * R - h * h);
  return (
    <g className="bb-ball" style={{ "--dx": b.dx + "px", "--dy": b.dy + "px", "--rot": b.rot + "deg" }}>
      <circle cx={b.x} cy={b.y} r={R} fill={stripe ? "#f6f2e8" : COL[base]} />
      {stripe && <path d={`M${b.x - w} ${b.y - h}L${b.x + w} ${b.y - h}A${R} ${R} 0 0 1 ${b.x + w} ${b.y + h}L${b.x - w} ${b.y + h}A${R} ${R} 0 0 1 ${b.x - w} ${b.y - h}Z`} fill={COL[base]} />}
      <circle cx={b.x} cy={b.y} r="3.7" fill="#f6f2e8" />
      <text x={b.x} y={b.y + 1.9} textAnchor="middle" fontSize="5.2" fontWeight="800" fill="#111">{b.n}</text>
      <circle cx={b.x - 3} cy={b.y - 3.3} r="1.9" fill="#fff" opacity=".3" />
    </g>
  );
}

export const BREAK_MS = 1800;

export default function BreakButton({ onOpen }) {
  const [breaking, setBreaking] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const go = () => {
    if (breaking) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { onOpen(); return; }
    setBreaking(true);
    timer.current = setTimeout(() => { setBreaking(false); onOpen(); }, BREAK_MS);
  };
  return (
    <button type="button" className={"break-btn" + (breaking ? " breaking" : "")} onClick={go} aria-label={t("Neues Turnier")}>
      <svg viewBox="0 0 360 100" className="break-svg" aria-hidden="true" focusable="false">
        {RACK.map((b) => <Ball key={b.i} b={b} />)}
        <g className="bb-burst">
          <polygon points="0,-24 6,-9 21,-13 11,-1 24,8 8,9 6,24 -3,10 -18,17 -10,3 -24,-6 -8,-7" transform={`translate(${AX - 6} ${AY})`} />
        </g>
        <text x="300" y="19" textAnchor="middle" className="bb-crack">{t("KRACH!")}</text>
        <g className="bb-cue">
          <circle cx="170" cy="50" r={R} fill="#f6f2e8" />
          <circle cx="167" cy="46.7" r="1.9" fill="#fff" opacity=".8" />
        </g>
        <g className="bb-stick">
          <path d="M-1500 47 L158 49.2 L158 50.8 L-1500 53 Z" className="bb-stick-body" />
          <rect x="157" y="49" width="4.6" height="2" rx="1" className="bb-stick-tip" />
        </g>
      </svg>
      <span className="break-label">{t("Neues Turnier")}</span>
    </button>
  );
}
