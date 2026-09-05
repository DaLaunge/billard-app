import { useState, useMemo } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { t } from "../lib/i18n";
import TurnierMatchActions, { hasTurnierAction } from "./TurnierMatchActions";

const BOX_W = 220;
const BOX_H = 62;
const COL_GAP = 84;
const ROW_GAP = 26;
const SECTION_GAP = 56;
const LABEL_H = 26;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.2;

const bracketLabel = (b) => (b === "winners" ? t("Gewinnerbaum") : b === "losers" ? t("Verliererbaum") : b === "final" ? t("Finale") : t("Raster"));

// Baumgrafik fuer ein ganzes Turnier (alle Bracket-Abschnitte in EINEM
// zusammenhaengenden Bild statt getrennter Grafiken pro Abschnitt, siehe
// Kommentar-Historie in git log fuer die Vorgeschichte dieser Datei: erst
// fehlten die Abstiegslinien aus dem Gewinnerbaum komplett, dann liess eine
// falsche Positionsrechnung den Verliererbaum wie zwei parallele Spuren statt
// einem echten Baum aussehen). Damit das zusammenhaengende Bild trotz vieler
// kreuzender Linien uebersichtlich bleibt, gibt es jetzt zusaetzlich:
// - Farbcodierung je Abschnitt (Gewinnerbaum gruen, Verliererbaum rot,
//   Finale gold - linker Rahmenstreifen an jeder Box plus Abschnittslabel).
// - Klick auf eine Box hebt ihre direkt angeschlossenen Verbinder + die
//   damit verbundenen Boxen hervor, alles andere wird gedaempft.
// - Ein Zoom-Regler (Buttons, nicht nur Pinch-Zoom des ganzen Bildschirms -
//   der wuerde auch Kopfzeile/Navigation mitzoomen statt nur den Baum).
export default function TurnierGraph({ matches, nameOf, me, isOrganizer, tourStatus, busyId, scores, setScores, onReport, onOrganizerReport, onConfirm, onForceConfirm }) {
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);

  const layout = useMemo(() => {
    const sectionOrder = ["main", "winners", "losers", "final"].filter((b) => matches.some((m) => m.bracket === b));
    const labelOffset = sectionOrder.length > 1 ? LABEL_H : 0;
    const pos = {};
    const sections = [];
    const sectionTopByBracket = {};
    let yOffset = 0;

    sectionOrder.forEach((bracket) => {
      const bracketMatches = matches.filter((m) => m.bracket === bracket);
      const rounds = [...new Set(bracketMatches.map((m) => m.round))].sort((a, b) => a - b);
      const boxesTop = yOffset + labelOffset;
      sectionTopByBracket[bracket] = boxesTop;
      let sectionMaxY = 0;

      rounds.forEach((r, colIdx) => {
        const inCol = bracketMatches.filter((m) => m.round === r).sort((a, b) => a.bracket_position - b.bracket_position);
        inCol.forEach((m, i) => {
          // Ueber ALLE Matches suchen (nicht nur diesen Abschnitt) und BEIDE
          // Verknuepfungsarten pruefen: next_match_id (Sieger-Weg) UND
          // loser_next_match_id (Abstieg aus dem Gewinnerbaum) - jeder
          // Vorgaenger wird auf seine EIGENE (lokale) Position innerhalb
          // SEINES Abschnitts normiert, bevor gemittelt wird - sonst wuerden
          // Boxen mit nur einem abschnittsfremden Vorgaenger exakt auf
          // dessen absolute Position "springen" und andere Boxen ueberdecken.
          const feeders = matches.filter((f) => (f.next_match_id === m.id || f.loser_next_match_id === m.id) && pos[f.id]);
          const localY = feeders.length
            ? feeders.reduce((s, f) => s + (pos[f.id].y - sectionTopByBracket[f.bracket]), 0) / feeders.length
            : i * (BOX_H + ROW_GAP);
          pos[m.id] = { x: colIdx * (BOX_W + COL_GAP), y: boxesTop + localY };
          sectionMaxY = Math.max(sectionMaxY, localY);
        });
      });

      sections.push({ bracket, top: yOffset, cols: rounds.length });
      yOffset = boxesTop + sectionMaxY + BOX_H + SECTION_GAP;
    });

    const totalWidth = Math.max(BOX_W, ...Object.values(pos).map((p) => p.x + BOX_W));
    const totalHeight = Math.max(0, yOffset - SECTION_GAP);

    const byId = {};
    matches.forEach((m) => { byId[m.id] = m; });
    const edges = [];
    matches.forEach((m) => {
      if (m.next_match_id && pos[m.id] && pos[m.next_match_id]) {
        edges.push({ from: pos[m.id], to: pos[m.next_match_id], decided: !!m.winner_id, kind: "advance", fromId: m.id, toId: m.next_match_id });
      }
      if (m.loser_next_match_id && pos[m.id] && pos[m.loser_next_match_id]) {
        edges.push({ from: pos[m.id], to: pos[m.loser_next_match_id], decided: !!m.winner_id, kind: "drop", fromId: m.id, toId: m.loser_next_match_id });
      }
    });

    return { pos, edges, totalWidth, totalHeight, byId, sections, showSectionLabels: sections.length > 1 };
  }, [matches]);

  const selected = selectedId ? layout.byId[selectedId] : null;

  // Direkt an die Auswahl angeschlossene Verbinder + die damit verbundenen
  // Boxen - alles ausserhalb davon wird gedaempft (siehe .dim in App.css),
  // damit bei vielen kreuzenden Linien sofort erkennbar ist, wohin genau
  // diese eine Partie fuehrt/woher sie kommt.
  const highlightIds = useMemo(() => {
    if (!selectedId) return null;
    const ids = new Set([selectedId]);
    layout.edges.forEach((e) => {
      if (e.fromId === selectedId || e.toId === selectedId) { ids.add(e.fromId); ids.add(e.toId); }
    });
    return ids;
  }, [selectedId, layout.edges]);

  const zoomBy = (delta) => setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z + delta).toFixed(2))));

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

      <div className="turnier-graph-toolbar">
        <button type="button" onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} aria-label={t("Verkleinern")}><ZoomOut size={16} /></button>
        <span className="turnier-graph-zoom-level">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} aria-label={t("Vergrößern")}><ZoomIn size={16} /></button>
        {zoom !== 1 && <button type="button" className="turnier-graph-zoom-reset" onClick={() => setZoom(1)}>{t("Zoom zurücksetzen")}</button>}
      </div>

      <div className="turnier-graph-wrap">
        <div style={{ width: layout.totalWidth * zoom, height: layout.totalHeight * zoom }}>
          <div className="turnier-graph" style={{ width: layout.totalWidth, height: layout.totalHeight, transform: `scale(${zoom})` }}>
            <svg className="turnier-graph-svg" width={layout.totalWidth} height={layout.totalHeight}>
              {layout.edges.map((e, i) => {
                const x1 = e.from.x + BOX_W, y1 = e.from.y + BOX_H / 2;
                const x2 = e.to.x, y2 = e.to.y + BOX_H / 2;
                const midX = (x1 + x2) / 2;
                const isHighlighted = selectedId && (e.fromId === selectedId || e.toId === selectedId);
                const isDim = selectedId && !isHighlighted;
                return (
                  <path key={i}
                    className={"turnier-graph-edge" + (e.decided ? " decided" : "") + (e.kind === "drop" ? " drop" : "")
                      + (isHighlighted ? " highlighted" : "") + (isDim ? " dim" : "")}
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`} />
                );
              })}
            </svg>
            {layout.showSectionLabels && layout.sections.map((s) => (
              <div key={s.bracket} className={"turnier-graph-section-label section--" + s.bracket} style={{ top: s.top }}>
                {bracketLabel(s.bracket)}
              </div>
            ))}
            {matches.map((m) => {
              const p = layout.pos[m.id];
              if (!p) return null;
              const n1 = nameOf(m.player1_id), n2 = nameOf(m.player2_id);
              const s1 = m.match?.score1, s2 = m.match?.score2;
              const pending = m.match_id && !m.match?.confirmed;
              const actionable = hasTurnierAction(m, me, isOrganizer, tourStatus);
              const isSelected = selectedId === m.id;
              const isConnected = highlightIds && highlightIds.has(m.id) && !isSelected;
              const isDim = highlightIds && !highlightIds.has(m.id);
              return (
                <button key={m.id} type="button"
                  className={"turnier-graph-box turnier-graph-box--" + m.bracket
                    + (actionable ? " actionable" : "") + (isSelected ? " selected" : "")
                    + (isConnected ? " connected" : "") + (isDim ? " dim" : "")}
                  style={{ left: p.x, top: p.y, width: BOX_W, height: BOX_H }}
                  onClick={() => setSelectedId(m.id === selectedId ? null : m.id)}>
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
    </div>
  );
}
