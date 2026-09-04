import { useMemo } from "react";
import { t } from "../lib/i18n";

const BOX_W = 210;
const BOX_H = 62;
const COL_GAP = 64;
const ROW_GAP = 20;

// Baumgrafik fuer EINEN Bracket-Abschnitt (Gewinnerbaum/Verliererbaum/Finale/
// K.O.-Raster) - reine Anzeige, keine Eingabe (dafuer bleibt die Liste
// darueber/danebenliegend die Ansicht). Boxen als normale, absolut
// positionierte divs statt reinem SVG-Text, damit Spielernamen/Score wie
// ueberall sonst in der App gerendert werden (Kuerzen mit Ellipsis etc.) -
// nur die Verbinderlinien sind ein SVG-Overlay. Positionierung: Runde 1
// nacheinander gestapelt, jede weitere Runde auf der mittleren Hoehe ihrer
// tatsaechlichen Vorgaenger (ueber next_match_id zurueckverfolgt) - das
// ergibt bei einem sauberen (freilos-losen) Baum die klassische
// "zusammenlaufende" Turnierform, und bleibt bei unregelmaessigen Freilos-
// Ketten (Doppel-K.O. mit ungerader Teilnehmerzahl) trotzdem strukturell
// korrekt, auch wenn einzelne Linien dann mehrere Spalten ueberspringen.
export default function TurnierGraph({ matches, nameOf }) {
  const layout = useMemo(() => {
    const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
    const pos = {};

    rounds.forEach((r, colIdx) => {
      const inCol = matches.filter((m) => m.round === r).sort((a, b) => a.bracket_position - b.bracket_position);
      inCol.forEach((m, i) => {
        const feeders = matches.filter((f) => f.next_match_id === m.id && pos[f.id]);
        const y = feeders.length
          ? feeders.reduce((s, f) => s + pos[f.id].y, 0) / feeders.length
          : i * (BOX_H + ROW_GAP);
        pos[m.id] = { x: colIdx * (BOX_W + COL_GAP), y };
      });
    });

    const totalWidth = rounds.length * BOX_W + Math.max(0, rounds.length - 1) * COL_GAP;
    const maxY = Object.values(pos).reduce((mx, p) => Math.max(mx, p.y), 0);
    const totalHeight = maxY + BOX_H;

    const edges = matches
      .filter((m) => m.next_match_id && pos[m.id] && pos[m.next_match_id])
      .map((m) => ({ from: pos[m.id], to: pos[m.next_match_id] }));

    return { pos, edges, totalWidth, totalHeight };
  }, [matches]);

  return (
    <div className="turnier-graph-wrap">
      <div className="turnier-graph" style={{ width: layout.totalWidth, height: layout.totalHeight }}>
        <svg className="turnier-graph-svg" width={layout.totalWidth} height={layout.totalHeight}>
          {layout.edges.map((e, i) => {
            const x1 = e.from.x + BOX_W, y1 = e.from.y + BOX_H / 2;
            const x2 = e.to.x, y2 = e.to.y + BOX_H / 2;
            const midX = x1 + COL_GAP / 2;
            return <path key={i} className="turnier-graph-edge" d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`} />;
          })}
        </svg>
        {matches.map((m) => {
          const p = layout.pos[m.id];
          if (!p) return null;
          const n1 = nameOf(m.player1_id), n2 = nameOf(m.player2_id);
          const s1 = m.match?.score1, s2 = m.match?.score2;
          const pending = m.match_id && !m.match?.confirmed;
          return (
            <div key={m.id} className="turnier-graph-box" style={{ left: p.x, top: p.y, width: BOX_W, height: BOX_H }}>
              {m.table_number != null && <span className="turnier-graph-table">{t("Tisch")} {m.table_number}</span>}
              {pending && <span className="turnier-graph-pending" title={t("Wartet auf Bestätigung ...")}>•</span>}
              <div className={"turnier-graph-row" + (m.winner_id && m.winner_id === m.player1_id ? " won" : "")}>
                <span>{n1 || t("TBD")}</span>
                {s1 != null && <span>{s1}</span>}
              </div>
              <div className={"turnier-graph-row" + (m.winner_id && m.winner_id === m.player2_id ? " won" : "")}>
                <span>{m.is_bye ? t("(Freilos)") : (n2 || t("TBD"))}</span>
                {s2 != null && <span>{s2}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
