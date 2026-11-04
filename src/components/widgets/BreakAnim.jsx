import { Trophy } from "lucide-react";
import { t } from "../../lib/i18n";

/* Anstoss als Anlege-Animation (Nutzer 2026-11-04): die weisse Kugel rollt ins Dreieck, die Kugeln stieben auseinander.
   Reine Zeichnung (SVG), die Bewegung steckt in App.css (nur ohne "Bewegung reduzieren"); ohne Animation sieht man das fertige Dreieck. */
const COLORS = ["#f2c230", "#2f5fd0", "#d8392b", "#6a3fa0", "#ee7d1d", "#1f8a4c", "#8a2a2a", "#1b1b1b",
  "#f2c230", "#2f5fd0", "#d8392b", "#6a3fa0", "#ee7d1d", "#1f8a4c", "#8a2a2a"];
const R = 8.5;
const BALLS = (() => {
  const out = []; let i = 0;
  for (let row = 0; row < 5; row++) {
    for (let k = 0; k <= row; k++) {
      const x = 190 + row * 15.2, y = 75 + (k - row / 2) * 17.4;
      // feste, aber unregelmaessig wirkende Streuung nach rechts/seitlich, in den Tisch geklemmt (Tisch 12..288 x 12..138)
      const a = ((i * 137) % 100) / 100, b = ((i * 59) % 100) / 100;
      const dx = Math.min(288 - R - x, 14 + a * 80 + row * 6), dy = Math.max(12 + R - y, Math.min(138 - R - y, (b - 0.5) * 120));
      out.push({ x, y, c: COLORS[i], dx: Math.round(dx), dy: Math.round(dy), d: i });
      i++;
    }
  }
  return out;
})();

export default function BreakAnim({ label }) {
  return (
    <div className="break-anim" role="status" aria-live="polite">
      <svg viewBox="0 0 300 150" className="break-svg" aria-hidden="true">
        <rect x="2" y="2" width="296" height="146" rx="14" className="brk-rail" />
        <rect x="12" y="12" width="276" height="126" rx="6" className="brk-cloth" />
        {[[12, 12], [150, 9], [288, 12], [12, 138], [150, 141], [288, 138]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" className="brk-pocket" />)}
        {BALLS.map((b) => (
          <g key={b.d} className="brk-ball" style={{ "--dx": b.dx + "px", "--dy": b.dy + "px" }}>
            <circle cx={b.x} cy={b.y} r={R} fill={b.c} />
            <circle cx={b.x - 2.6} cy={b.y - 2.8} r="2.2" fill="#fff" opacity=".35" />
          </g>
        ))}
        <g className="brk-cue">
          <circle cx="172" cy="75" r={R} fill="#f6f2e8" />
          <circle cx="169.4" cy="72.2" r="2.2" fill="#fff" opacity=".7" />
        </g>
      </svg>
      <div className="break-msg"><Trophy size={18} /> {label || t("Turnier angelegt")}</div>
    </div>
  );
}
