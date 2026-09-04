import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { t } from "../lib/i18n";
import TurnierMatchActions, { hasTurnierAction } from "./TurnierMatchActions";

const BOX_W = 220;
const BOX_H = 62;
const COL_GAP = 84;
const ROW_GAP = 26;
const SECTION_GAP = 56;
const LABEL_H = 26;

const bracketLabel = (b) => (b === "winners" ? t("Gewinnerbaum") : b === "losers" ? t("Verliererbaum") : b === "final" ? t("Finale") : t("Raster"));

// Baumgrafik fuer ein ganzes Turnier (alle Bracket-Abschnitte in EINEM
// zusammenhaengenden Bild statt getrennter Grafiken pro Abschnitt - bei
// Doppel-K.O. war die Verliererbaum-Grafik dadurch bisher fuer sich isoliert
// unverstaendlich: Spieler, die aus dem Gewinnerbaum absteigen, tauchten in
// der Verliererbaum-Box scheinbar aus dem Nichts auf, weil die dafuer
// zustaendige Verknuepfung (loser_next_match_id, ein WB-Match zu einem LB-
// Match) beim Zeichnen schlicht ignoriert wurde). Abschnitte werden
// uebereinander gestapelt (Gewinnerbaum, Verliererbaum, Finale), jeweils mit
// eigener Spalten-/Zeilenrechnung; Sieger-Pfade (next_match_id) werden als
// weiche horizontale Kurve gezeichnet, Abstiegs-Pfade (loser_next_match_id,
// i.d.R. abwaerts in die naechste Sektion) gestrichelt und in Verlustfarbe,
// sobald der Verlierer feststeht - sonst gedaempft. Boxen als normale,
// absolut positionierte divs (Spielernamen/Score wie ueberall sonst in der
// App gerendert), nur die Verbinder sind ein SVG-Overlay.
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
          // loser_next_match_id (Abstieg aus dem Gewinnerbaum) - eine
          // Verliererbaum-Partie hat i.d.R. GENAU EINEN Vorgaenger von jeder
          // Art. Nur next_match_id zu beruecksichtigen liess den
          // Verliererbaum wie zwei parallele, nie zusammenlaufende Spuren
          // aussehen, obwohl er strukturell ein echter Baum ist. Jeder
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
        edges.push({ from: pos[m.id], to: pos[m.next_match_id], decided: !!m.winner_id, kind: "advance" });
      }
      if (m.loser_next_match_id && pos[m.id] && pos[m.loser_next_match_id]) {
        edges.push({ from: pos[m.id], to: pos[m.loser_next_match_id], decided: !!m.winner_id, kind: "drop" });
      }
    });

    return { pos, edges, totalWidth, totalHeight, byId, sections, showSectionLabels: sections.length > 1 };
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
                <path key={i} className={"turnier-graph-edge" + (e.decided ? " decided" : "") + (e.kind === "drop" ? " drop" : "")}
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`} />
              );
            })}
          </svg>
          {layout.showSectionLabels && layout.sections.map((s) => (
            <div key={s.bracket} className="turnier-graph-section-label" style={{ top: s.top }}>
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
