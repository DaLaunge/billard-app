import { useState } from "react";
import { t } from "../lib/i18n";
import { fmtDate } from "../lib/format";

/* Selbst gezeichnetes Mehrlinien-Diagramm mit Scrubbing (SVG, ohne Bibliothek). */
export default function DevChart({ dates, lines }) {
  const [active, setActive] = useState(null);
  const W = 340, H = 210, padL = 34, padR = 12, padT = 12, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const all = lines.flatMap((l) => l.points.map((p) => p.rating));
  if (all.length === 0) return <p className="hint center">{t("Keine Daten im gewählten Zeitraum.")}</p>;

  let yMin = Math.min(...all), yMax = Math.max(...all);
  const pad = Math.max(10, (yMax - yMin) * 0.12);
  yMin = Math.floor((yMin - pad) / 10) * 10;
  yMax = Math.ceil((yMax + pad) / 10) * 10;
  const nD = dates.length;
  const times = dates.map((ds) => new Date(ds + "T00:00:00").getTime());
  const minT = times[0], maxT = times[nD - 1];
  const spanT = (maxT - minT) || 1;
  const xFor = (i) => (nD <= 1 ? padL + plotW / 2 : padL + ((times[i] - minT) / spanT) * plotW);
  const yFor = (r) => padT + (1 - (r - yMin) / ((yMax - yMin) || 1)) * plotH;
  const yticks = [0, 1, 2, 3].map((i) => Math.round(yMin + ((yMax - yMin) * i) / 3));

  // Zeitachse: gleichmäßig verteilte Beschriftungen nach ECHTER Zeit
  const mmYY = (t) => { const d = new Date(t); return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`; };
  const nTicks = nD === 1 ? 1 : 5;
  const seenX = new Set();
  const xTicks = Array.from({ length: nTicks }, (_, k) => {
    const frac = nTicks === 1 ? 0 : k / (nTicks - 1);
    return { x: padL + frac * plotW, label: mmYY(minT + frac * spanT) };
  }).filter((t) => (seenX.has(t.label) ? false : (seenX.add(t.label), true)));

  const valAt = (l, i) => { const p = l.points.find((pp) => pp.i === i); return p ? p.rating : null; };

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vbX = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0, bd = Infinity;
    for (let i = 0; i < nD; i++) { const dx = Math.abs(xFor(i) - vbX); if (dx < bd) { bd = dx; best = i; } }
    setActive(best);
  };
  const down = (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); onMove(e); };
  const up = (e) => { e.currentTarget.releasePointerCapture?.(e.pointerId); setActive(null); };

  return (
    <div className="dev-wrap">
      <div className="dev-readout">
        {active == null ? (
          <span className="dev-hint">{t("Zum Ablesen über den Graphen ziehen")}</span>
        ) : (
          <>
            <b>{fmtDate(new Date(dates[active] + "T00:00:00"))}</b>
            {lines.map((l) => {
              const v = valAt(l, active);
              return v == null ? null : (
                <span key={l.nickname} className="ro">
                  <span className="legend-dot" style={{ background: l.color }} />{Math.round(v)}
                </span>
              );
            })}
          </>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="dev-chart" role="img" aria-label="Rating-Verlauf"
        onPointerDown={down} onPointerMove={onMove} onPointerUp={up} onPointerLeave={() => setActive(null)} onPointerCancel={up}>
        {yticks.map((val) => (
          <g key={val}>
            <line x1={padL} y1={yFor(val)} x2={W - padR} y2={yFor(val)} className="grid" />
            <text x={padL - 5} y={yFor(val) + 3} className="ylabel">{val}</text>
          </g>
        ))}
        {xTicks.map((t, k) => (
          <text key={k} x={t.x} y={H - 8} className="xlabel">{t.label}</text>
        ))}
        {active != null && (
          <line x1={xFor(active)} y1={padT} x2={xFor(active)} y2={padT + plotH} className="crosshair" />
        )}
        {lines.map((l) => {
          const pts = l.points.map((p) => `${xFor(p.i)},${yFor(p.rating)}`).join(" ");
          const av = active != null ? valAt(l, active) : null;
          return (
            <g key={l.nickname}>
              <polyline points={pts} fill="none" stroke={l.color} strokeWidth="2.2"
                strokeLinejoin="round" strokeLinecap="round" />
              {l.points.length > 0 && (
                <circle cx={xFor(l.points.at(-1).i)} cy={yFor(l.points.at(-1).rating)} r="3" fill={l.color} />
              )}
              {av != null && (
                <circle cx={xFor(active)} cy={yFor(av)} r="4" fill={l.color} stroke="#0A2B21" strokeWidth="1.5" />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

