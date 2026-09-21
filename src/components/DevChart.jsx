import { useState, useEffect, useRef } from "react";
import { t } from "../lib/i18n";
import { fmtDate } from "../lib/format";

/* Selbst gezeichnetes Mehrlinien-Diagramm mit Scrubbing (SVG, ohne Bibliothek).
   Die Werte pro Spieler werden nicht mehr hier oberhalb des Graphen angezeigt,
   sondern im Nutzer-Raster unterhalb (siehe EntwicklungBlock.jsx) - deshalb
   nur noch das aktive Datum hier oben und ein Melden des aktiven Index nach
   oben (onActiveChange), damit das Raster beim Ziehen mitlesen kann. */
export default function DevChart({ dates, lines, onActiveChange }) {
  const [active, setActiveInner] = useState(null);
  const setActive = (v) => { setActiveInner(v); onActiveChange && onActiveChange(v); };
  // viewBox = tatsaechliche Groesse der .dev-plot-Box in px (per ResizeObserver
  // gemessen) statt einer festen abstrakten Einheit, die beim Skalieren
  // proportional mit der Kartengroesse mitwaechst/-schrumpft - Nutzer-
  // Feedback: Achsenbeschriftung sollte genauso gross wirken wie die
  // Nutzerliste daneben (.stat-name, feste 14px CSS-px). 1 viewBox-Einheit =
  // 1 CSS-px macht font-size/Radien/Strichstaerke zu echten, von der
  // Kartengroesse unabhaengigen px-Werten wie ueberall sonst im UI. Die
  // Hoehe der .dev-plot-Box selbst kommt komplett aus CSS (fest 210px normal,
  // 130px im Handy-Querformat, flex:1 im Maximieren-Modus der Karte - siehe
  // App.css) - dieser Hook kennt keinen dieser Faelle, er misst nur, was CSS
  // gerade entschieden hat, und der Graph passt sich dadurch automatisch an
  // jede neue Bedingung an, ohne dass hier neue Faelle ergaenzt werden muessten.
  const plotRef = useRef(null);
  const [box, setBox] = useState({ w: 300, h: 210 });
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width && r.height) setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = box.w, H = box.h, padL = 40, padR = 12, padT = 10, padB = 32;
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
  // up faengt bewusst auch pointercancel ab: Der Graph laesst senkrechtes
  // Scrollen der Seite absichtlich durch (touch-action: pan-y auf .dev-chart,
  // siehe App.css). Entscheidet der Browser waehrend eines Wischers, dass es
  // ein senkrechter Scroll ist, scrollt er und bricht unsere Zeigerfolge mit
  // pointercancel ab - ohne dieses Aufraeumen bliebe das Fadenkreuz stehen.
  const up = (e) => { e.currentTarget.releasePointerCapture?.(e.pointerId); setActive(null); };

  return (
    <div className="dev-wrap">
      <div className="dev-readout">
        {active == null ? (
          <span className="dev-hint">{t("Zum Ablesen über den Graphen ziehen")}</span>
        ) : (
          <b>{fmtDate(new Date(dates[active] + "T00:00:00"))}</b>
        )}
      </div>
      <div className="dev-plot" ref={plotRef}>
      <svg viewBox={`0 0 ${W} ${H}`} className="dev-chart" role="img" aria-label={t("Rating-Verlauf")}
        onPointerDown={down} onPointerMove={onMove} onPointerUp={up} onPointerLeave={() => setActive(null)} onPointerCancel={up}>
        {yticks.map((val) => (
          <g key={val}>
            <line x1={padL} y1={yFor(val)} x2={W - padR} y2={yFor(val)} className="grid" />
            <text x={padL - 6} y={yFor(val) + 5} className="ylabel">{val}</text>
          </g>
        ))}
        {xTicks.map((t, k) => (
          <text key={k} x={t.x} y={H - 6} className="xlabel">{t.label}</text>
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
                <circle cx={xFor(active)} cy={yFor(av)} r="4" fill={l.color} stroke="var(--felt)" strokeWidth="1.5" />
              )}
            </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
}

