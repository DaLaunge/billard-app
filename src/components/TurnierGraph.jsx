import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { t } from "../lib/i18n";
import TurnierMatchActions, { hasTurnierAction } from "./TurnierMatchActions";

const BOX_W = 220;
const BOX_H = 62;
const COL_GAP = 84;
const ROW_GAP = 26;

// Baumgrafik fuer EINEN Bracket-Abschnitt (Gewinnerbaum/Verliererbaum/Finale/
// K.O.-Raster). Boxen als normale, absolut positionierte divs (Spielernamen/
// Score wie ueberall sonst in der App gerendert) - nur die Verbinderlinien
// sind ein SVG-Overlay. Positionierung: Runde 1 nacheinander gestapelt, jede
// weitere Runde auf der mittleren Hoehe ihrer tatsaechlichen Vorgaenger (ueber
// next_match_id zurueckverfolgt) - das ergibt bei einem sauberen (freilos-
// losen) Baum die klassische "zusammenlaufende" Turnierform. Verbinder als
// weiche Kurven statt rechtwinkliger Ecken und in zwei Staerken (bereits
// entschiedene Matches heller/dicker als noch offene) - reine rechtwinklige
// duenne Linien in der urspruenglichen Fassung gingen im Hintergrund unter.
//
// Turnierleitung/Spieler koennen direkt in der Grafik agieren: eine Box mit
// verfuegbarer Aktion (Ergebnis melden/eintragen, bestaetigen, erzwingen)
// ist per goldenem Rahmen erkennbar und oeffnet per Klick ein Detail-Panel
// mit denselben Aktionen wie in der Liste (TurnierMatchActions.jsx) - liegt
// bewusst im normalen Dokumentfluss statt als Pop-over ueber der Box, damit
// es beim Verschieben/Zoomen des Baums nicht mitwandern muss.
export default function TurnierGraph({ matches, nameOf, me, isOrganizer, tourStatus, busyId, scores, setScores, onReport, onOrganizerReport, onConfirm, onForceConfirm }) {
  const [selectedId, setSelectedId] = useState(null);

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

    const byId = {};
    matches.forEach((m) => { byId[m.id] = m; });
    const edges = matches
      .filter((m) => m.next_match_id && pos[m.id] && pos[m.next_match_id])
      .map((m) => ({ from: pos[m.id], to: pos[m.next_match_id], decided: !!m.winner_id }));

    return { pos, edges, totalWidth, totalHeight, byId };
  }, [matches]);

  const selected = selectedId ? layout.byId[selectedId] : null;

  return (
    <div className="turnier-graph-block">
      {selected && (
        <div className="turnier-graph-detail">
          <div className="turnier-match-meta">
            <span className="turnier-match-players">
              <b>{nameOf(selected.player1_id) || t("TBD")}</b>
              <span className="turnier-match-score">{selected.match ? `${selected.match.score1}:${selected.match.score2}` : "–"}</span>
              <b>{nameOf(selected.player2_id) || t("TBD")}</b>
            </span>
            <button className="turnier-graph-detail-close" onClick={() => setSelectedId(null)} aria-label={t("Schliessen")}>
              <X size={16} />
            </button>
          </div>
          {selected.table_number != null && <span className="m-disc">{t("Tisch")} {selected.table_number}</span>}
          <TurnierMatchActions tm={selected} me={me} isOrganizer={isOrganizer} tourStatus={tourStatus}
            busyId={busyId} scores={scores} setScores={setScores}
            onReport={onReport} onOrganizerReport={onOrganizerReport} onConfirm={onConfirm} onForceConfirm={onForceConfirm} />
        </div>
      )}

      <div className="turnier-graph-wrap">
        <div className="turnier-graph" style={{ width: layout.totalWidth, height: layout.totalHeight }}>
          <svg className="turnier-graph-svg" width={layout.totalWidth} height={layout.totalHeight}>
            {layout.edges.map((e, i) => {
              const x1 = e.from.x + BOX_W, y1 = e.from.y + BOX_H / 2;
              const x2 = e.to.x, y2 = e.to.y + BOX_H / 2;
              const midX = (x1 + x2) / 2;
              return (
                <path key={i} className={"turnier-graph-edge" + (e.decided ? " decided" : "")}
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`} />
              );
            })}
          </svg>
          {matches.map((m) => {
            const p = layout.pos[m.id];
            if (!p) return null;
            const n1 = nameOf(m.player1_id), n2 = nameOf(m.player2_id);
            const s1 = m.match?.score1, s2 = m.match?.score2;
            const pending = m.match_id && !m.match?.confirmed;
            const actionable = hasTurnierAction(m, me, isOrganizer, tourStatus);
            return (
              <button key={m.id} type="button"
                className={"turnier-graph-box" + (actionable ? " actionable" : "") + (selectedId === m.id ? " selected" : "")}
                style={{ left: p.x, top: p.y, width: BOX_W, height: BOX_H }}
                onClick={() => actionable && setSelectedId(m.id === selectedId ? null : m.id)}>
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
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
