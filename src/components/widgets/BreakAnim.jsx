import { useState, useRef, useEffect } from "react";
import { t } from "../../lib/i18n";

/* "Neues Turnier"-Knopf wie der Ping-Knopf im Live-Tab (Nutzer 2026-11-04): in Ruhe bewegt sich nur der Queue leicht, ein Klick loest den Anstoss aus
   (Queue holt aus, stoesst die weisse Kugel, diese sprengt das Dreieck), danach oeffnet sich das Anlege-Fenster. Ohne "Bewegung reduzieren" ist
   es ein ruhiges Bild und das Fenster oeffnet sofort. Reine SVG-Zeichnung, die Bewegung steckt in App.css. */
const COLORS = ["#f2c230", "#2f5fd0", "#d8392b", "#6a3fa0", "#ee7d1d", "#1f8a4c", "#8a2a2a", "#1b1b1b", "#f2c230", "#d8392b"];
const R = 6.4;
const RACK = (() => {
  const out = []; let i = 0;
  for (let row = 0; row < 4; row++) {
    for (let k = 0; k <= row; k++) {
      const x = 158 + row * 11.2, y = 40 + (k - row / 2) * 12.8;
      const a = ((i * 137) % 100) / 100, b = ((i * 59) % 100) / 100;
      out.push({ x, y, c: COLORS[i], dx: Math.round(Math.min(232 - R - x, 12 + a * 44 + row * 5)), dy: Math.round(Math.max(6 + R - y, Math.min(74 - R - y, (b - 0.5) * 70))), i });
      i++;
    }
  }
  return out;
})();

export const BREAK_MS = 1600;

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
      <svg viewBox="0 0 240 80" className="break-svg" aria-hidden="true" focusable="false">
        {RACK.map((b) => (
          <g key={b.i} className="bb-ball" style={{ "--dx": b.dx + "px", "--dy": b.dy + "px" }}>
            <circle cx={b.x} cy={b.y} r={R} fill={b.c} />
            <circle cx={b.x - 2} cy={b.y - 2.2} r="1.8" fill="#fff" opacity=".35" />
          </g>
        ))}
        <g className="bb-cue">
          <circle cx="116" cy="40" r={R} fill="#f6f2e8" />
          <circle cx="114" cy="37.8" r="1.8" fill="#fff" opacity=".8" />
        </g>
        <g className="bb-stick">
          <path d="M-30 38.2 L100 39 L100 41 L-30 41.8 Z" className="bb-stick-body" />
          <rect x="99" y="38.9" width="3.4" height="2.2" rx="1" className="bb-stick-tip" />
        </g>
      </svg>
      <span className="break-label">{t("Neues Turnier")}</span>
    </button>
  );
}
