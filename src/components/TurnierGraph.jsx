import { useState, useMemo, useRef, useEffect } from "react";
import { X, ZoomIn, ZoomOut, Trophy } from "lucide-react";
import { t } from "../lib/i18n";
import { initials } from "../lib/format";
import Ball from "./Ball";
import TurnierMatchActions, { hasTurnierAction, tmScores } from "./TurnierMatchActions";

const BOX_W = 240;
const BOX_H = 62;
// Finale bewusst groesser + abgesetzt (siehe Layout unten) - das wichtigste
// Match eines Doppel-K.O.-Turniers soll nicht wie ein Feld unter vielen wirken.
const FINAL_BOX_W = 260;
const FINAL_BOX_H = 100;
const COL_GAP = 84;
const FINAL_GAP = COL_GAP * 1.7;
// Bewusst knapper als frueher (war 26/56) - die Kollisionsaufloesung im
// Layout (siehe unten) kann ueber mehrere Runden hinweg Luft aufsummieren,
// vor allem im Verliererbaum mit seinen bis zu 6 Runden bei 8 Spielern.
// Kleinere Werte halten den Baum kompakter, ohne dass Boxen/Linien enger
// werden als sie selbst sind - die Kollisionsaufloesung verhindert
// weiterhin jede Ueberlappung.
const ROW_GAP = 14;
const SECTION_GAP = 26;
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
export default function TurnierGraph({ matches, nameOf, me, isOrganizer, tourStatus, busyId, onOpenMatchScreen, onOrganizerReport, onConfirm, onForceConfirm, onEditMatch, colorOf, badgeOf, photoOf }) {
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const wrapRef = useRef(null);
  const pinchRef = useRef(null);

  // Pinch-to-Zoom mit zwei Fingern + Trackpad-Kneifen (Ctrl+Wheel, so
  // melden Browser das Trackpad-Pinch) direkt im Baum - nativ per
  // addEventListener statt React-Touch-Handlern, weil touchmove nur mit
  // { passive: false } preventDefault() erlaubt (sonst scrollt/zoomt die
  // ganze Seite mit statt nur der Baum). touch-action: pan-x pan-y im CSS
  // unterbindet zusaetzlich die native Pinch-Zoom-Geste des Browsers auf
  // diesem Element, laesst einfingriges Scrollen aber unangetastet.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const dist = (touches) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const clamp = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +z.toFixed(2)));

    const onTouchStart = (e) => {
      if (e.touches.length === 2) pinchRef.current = { startDist: dist(e.touches), startZoom: zoomRef.current };
    };
    const onTouchMove = (e) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        setZoom(clamp(pinchRef.current.startZoom * (dist(e.touches) / pinchRef.current.startDist)));
      }
    };
    const onTouchEnd = (e) => { if (e.touches.length < 2) pinchRef.current = null; };
    const onWheel = (e) => {
      if (!e.ctrlKey) return; // Trackpad-Kneifen kommt als Ctrl+Wheel, normales Scrollen soll unberuehrt bleiben
      e.preventDefault();
      setZoom(clamp(zoomRef.current - e.deltaY * 0.01));
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  const layout = useMemo(() => {
    // Gewinner-/Verliererbaum (bzw. "main" bei K.O./Jeder-gegen-jeden) werden
    // wie bisher senkrecht gestapelt. Ein EINRUNDIGES Finale (der Normalfall)
    // wird bewusst NICHT mitgestapelt, sondern separat ganz rechts neben
    // beiden platziert und vertikal zwischen ihnen zentriert - das wichtigste
    // Match soll wie ein Zielpunkt wirken. Hat die Playoff-Stufe dagegen
    // MEHRERE Runden (Halbfinale/Viertelfinale vor dem eigentlichen Finale -
    // siehe Migration 2026-09-06_tournament_playoff_stage.sql), wird sie
    // stattdessen wie Gewinner-/Verliererbaum als eigener gestapelter
    // Abschnitt gerendert (einheitliche Boxgroesse durchgehend) - die
    // Sonder-Box fuers Finale waere in einer Mehrrunden-Spalte inkonsistent.
    const finalMatches = matches.filter((m) => m.bracket === "final");
    const finalMaxRound = finalMatches.length ? Math.max(...finalMatches.map((m) => m.round)) : 0;
    const hasFinal = finalMaxRound > 0;
    const finalMultiRound = finalMaxRound > 1;
    const stackedOrder = ["main", "winners", "losers"].filter((b) => matches.some((m) => m.bracket === b))
      .concat(finalMultiRound ? ["final"] : []);
    const labelOffset = (stackedOrder.length > 1 || hasFinal) ? LABEL_H : 0;
    const pos = {};
    const sections = [];
    const sectionTopByBracket = {};
    let yOffset = 0;
    let stackedRight = 0;

    stackedOrder.forEach((bracket) => {
      const bracketMatches = matches.filter((m) => m.bracket === bracket);
      const rounds = [...new Set(bracketMatches.map((m) => m.round))].sort((a, b) => a - b);
      const boxesTop = yOffset + labelOffset;
      sectionTopByBracket[bracket] = boxesTop;
      let sectionMaxY = 0;

      rounds.forEach((r, colIdx) => {
        const inCol = bracketMatches.filter((m) => m.round === r).sort((a, b) => a.bracket_position - b.bracket_position);
        // 1) Rohe Y-Position je Box: Durchschnitt der (auf den eigenen
        //    Abschnitt normierten) Vorgaenger-Positionen - siehe Kommentar
        //    zu "feeders" unten fuer den Grund der Normierung.
        const raw = inCol.map((m, i) => {
          // Ueber ALLE Matches suchen (nicht nur diesen Abschnitt) und BEIDE
          // Verknuepfungsarten pruefen: next_match_id (Sieger-Weg) UND
          // loser_next_match_id (Abstieg aus dem Gewinnerbaum) - jeder
          // Vorgaenger wird auf seine EIGENE (lokale) Position innerhalb
          // SEINES Abschnitts normiert, bevor gemittelt wird - sonst wuerden
          // Boxen mit nur einem abschnittsfremden Vorgaenger exakt auf
          // dessen absolute Position "springen" und andere Boxen ueberdecken.
          const feeders = matches.filter((f) => (f.next_match_id === m.id || f.loser_next_match_id === m.id) && pos[f.id]);
          return feeders.length
            ? feeders.reduce((s, f) => s + (pos[f.id].y - sectionTopByBracket[f.bracket]), 0) / feeders.length
            : i * (BOX_H + ROW_GAP);
        });
        // 2) Kollisionsaufloesung: der reine Durchschnitt kann bei manchen
        //    Verliererbaum-Formen (z.B. wenn eine Box von einem "aeusseren"
        //    und die andere von einem "inneren" Vorrunden-Paar gespeist
        //    wird) fuer zwei VERSCHIEDENE Boxen denselben Y-Wert ergeben -
        //    sie laegen dann exakt uebereinander und saehen wie eine
        //    einzelne Box mit zwei widerspruechlichen Linien aus (siehe
        //    Nutzer-Screenshot: zwei Verliererbaum-Erstrunden-Felder auf
        //    identischer Position). Deshalb hier in bracket_position-
        //    Reihenfolge einen Mindestabstand erzwingen, ohne die
        //    Reihenfolge selbst zu vertauschen.
        let prevBottom = -Infinity;
        const resolved = raw.map((y) => {
          const finalY = Math.max(y, prevBottom);
          prevBottom = finalY + BOX_H + ROW_GAP;
          return finalY;
        });
        inCol.forEach((m, i) => {
          pos[m.id] = { x: colIdx * (BOX_W + COL_GAP), y: boxesTop + resolved[i] };
          sectionMaxY = Math.max(sectionMaxY, resolved[i]);
          stackedRight = Math.max(stackedRight, colIdx * (BOX_W + COL_GAP) + BOX_W);
        });
      });

      sections.push({ bracket, top: yOffset, left: 0, cols: rounds.length, bottom: boxesTop + sectionMaxY + BOX_H });
      yOffset = boxesTop + sectionMaxY + BOX_H + SECTION_GAP;
    });

    const stackedBottom = Math.max(0, yOffset - SECTION_GAP);
    let totalWidth = Math.max(BOX_W, stackedRight);
    let totalHeight = stackedBottom;

    if (hasFinal && !finalMultiRound) {
      const finalMatch = finalMatches[0];
      const finalX = stackedRight + FINAL_GAP;
      const finalY = Math.max(labelOffset, (stackedBottom - FINAL_BOX_H) / 2);
      pos[finalMatch.id] = { x: finalX, y: finalY };
      sections.push({ bracket: "final", top: finalY - labelOffset, left: finalX, cols: 1 });
      totalWidth = finalX + FINAL_BOX_W;
      totalHeight = Math.max(stackedBottom, finalY + FINAL_BOX_H);
    }

    const byId = {};
    matches.forEach((m) => { byId[m.id] = m; });
    // Die groessere Sonder-Box gilt nur fuer ein einrundiges Finale - bei
    // mehreren Playoff-Runden ist bracket='final' ein normaler gestapelter
    // Abschnitt mit einheitlicher Boxgroesse (siehe oben).
    const bigFinalBox = hasFinal && !finalMultiRound;
    const edges = [];
    matches.forEach((m) => {
      if (m.next_match_id && pos[m.id] && pos[m.next_match_id]) {
        const toH = bigFinalBox && byId[m.next_match_id]?.bracket === "final" ? FINAL_BOX_H : BOX_H;
        edges.push({ from: pos[m.id], to: pos[m.next_match_id], toH, decided: !!m.winner_id, kind: "advance", fromId: m.id, toId: m.next_match_id });
      }
      if (m.loser_next_match_id && pos[m.id] && pos[m.loser_next_match_id]) {
        const toH = bigFinalBox && byId[m.loser_next_match_id]?.bracket === "final" ? FINAL_BOX_H : BOX_H;
        edges.push({ from: pos[m.id], to: pos[m.loser_next_match_id], toH, decided: !!m.winner_id, kind: "drop", fromId: m.id, toId: m.loser_next_match_id });
      }
    });

    // Farbige Hintergrundflaechen je gestapeltem Abschnitt (Gewinner-/
    // Verliererbaum) - die farbigen Randstreifen an jeder Box allein reichen
    // nicht, um beide Baeume auf einen Blick sauber zu trennen, siehe Nutzer-
    // Feedback. Das Finale bekommt bewusst KEINE Flaeche, es hebt sich schon
    // durch Position + Groesse ab.
    const bands = sections
      .filter((s) => s.bracket !== "final")
      .map((s) => ({ bracket: s.bracket, top: s.top, height: s.bottom - s.top, width: Math.max(BOX_W, stackedRight) }));

    return { pos, edges, totalWidth, totalHeight, byId, sections, bands, bigFinalBox, showSectionLabels: sections.length > 1 };
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

  // Position + Boxhoehe des ausgewaehlten Matches - fuers Andocken des
  // Aktions-Popovers direkt an der Box (siehe unten), statt eines separaten
  // Menuebereichs oberhalb des Graphen.
  const selPos = selectedId ? layout.pos[selectedId] : null;
  const selIsFinal = selected?.bracket === "final" && layout.bigFinalBox;
  const selBoxH = selIsFinal ? FINAL_BOX_H : BOX_H;

  return (
    <div className="turnier-graph-block">
      <div className="turnier-graph-toolbar">
        <button type="button" onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} aria-label={t("Verkleinern")}><ZoomOut size={20} /></button>
        <span className="turnier-graph-zoom-level">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} aria-label={t("Vergrößern")}><ZoomIn size={20} /></button>
        {zoom !== 1 && <button type="button" className="turnier-graph-zoom-reset" onClick={() => setZoom(1)}>{t("Zoom zurücksetzen")}</button>}
      </div>

      <div className="turnier-graph-wrap" ref={wrapRef}>
        <div style={{ width: layout.totalWidth * zoom, height: layout.totalHeight * zoom }}>
          <div className="turnier-graph" style={{ width: layout.totalWidth, height: layout.totalHeight, transform: `scale(${zoom})` }}>
            {layout.bands.map((b) => (
              <div key={b.bracket} className={"turnier-graph-band section--" + b.bracket}
                style={{ top: b.top, width: b.width, height: b.height }} />
            ))}
            <svg className="turnier-graph-svg" width={layout.totalWidth} height={layout.totalHeight}>
              {layout.edges.map((e, i) => {
                const x1 = e.from.x + BOX_W, y1 = e.from.y + BOX_H / 2;
                const x2 = e.to.x, y2 = e.to.y + e.toH / 2;
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
              <div key={s.bracket} className={"turnier-graph-section-label section--" + s.bracket} style={{ top: s.top, left: s.left }}>
                {s.bracket === "final" && <Trophy size={12} />} {bracketLabel(s.bracket)}
              </div>
            ))}
            {matches.map((m) => {
              const p = layout.pos[m.id];
              if (!p) return null;
              const isFinal = m.bracket === "final" && layout.bigFinalBox;
              const boxW = isFinal ? FINAL_BOX_W : BOX_W;
              const boxH = isFinal ? FINAL_BOX_H : BOX_H;
              const n1 = nameOf(m.player1_id), n2 = nameOf(m.player2_id);
              const msc = tmScores(m);
              const s1 = msc?.s1, s2 = msc?.s2;
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
                  style={{ left: p.x, top: p.y, width: boxW, height: boxH }}
                  onClick={() => setSelectedId(m.id === selectedId ? null : m.id)}>
                  {isFinal && <Trophy className="turnier-graph-final-icon" size={17} />}
                  {m.table_number != null && <span className="turnier-graph-table">{t("Tisch")} {m.table_number}</span>}
                  {pending && <span className="turnier-graph-pending" title={t("Wartet auf Bestätigung ...")}>•</span>}
                  <div className={"turnier-graph-row" + (m.winner_id && m.winner_id === m.player1_id ? " won" : "")}>
                    <span className="turnier-graph-name">
                      {n1 && <Ball color={colorOf(n1)} label={initials(n1)} badge={badgeOf(n1)} photo={photoOf(n1)} size={isFinal ? 26 : 20} />}
                      <span>{n1 || t("TBD")}</span>
                    </span>
                    {s1 != null && <span>{s1}</span>}
                  </div>
                  <div className={"turnier-graph-row" + (m.winner_id && m.winner_id === m.player2_id ? " won" : "")}>
                    <span className="turnier-graph-name">
                      {!m.is_bye && n2 && <Ball color={colorOf(n2)} label={initials(n2)} badge={badgeOf(n2)} photo={photoOf(n2)} size={isFinal ? 26 : 20} />}
                      <span>{m.is_bye ? t("(Freilos)") : (n2 || t("TBD"))}</span>
                    </span>
                    {s2 != null && <span>{s2}</span>}
                  </div>
                </button>
              );
            })}
            {selected && selPos && (
              <div className="turnier-graph-popover" style={{ left: selPos.x, top: selPos.y + selBoxH + 8 }}>
                <div className="turnier-match-meta">
                  <span className="turnier-match-players">
                    {nameOf(selected.player1_id) && <Ball color={colorOf(nameOf(selected.player1_id))} label={initials(nameOf(selected.player1_id))} badge={badgeOf(nameOf(selected.player1_id))} photo={photoOf(nameOf(selected.player1_id))} size={22} />}
                    <b>{nameOf(selected.player1_id) || t("TBD")}</b>
                    <span className="turnier-match-score">{selected.match ? (() => { const sc = tmScores(selected); return `${sc.s1}:${sc.s2}`; })() : "–"}</span>
                    <b>{nameOf(selected.player2_id) || t("TBD")}</b>
                    {nameOf(selected.player2_id) && <Ball color={colorOf(nameOf(selected.player2_id))} label={initials(nameOf(selected.player2_id))} badge={badgeOf(nameOf(selected.player2_id))} photo={photoOf(nameOf(selected.player2_id))} size={22} />}
                  </span>
                  <button className="turnier-graph-detail-close" onClick={() => setSelectedId(null)} aria-label={t("Schliessen")}>
                    <X size={16} />
                  </button>
                </div>
                {selected.table_number != null && <span className="m-disc">{t("Tisch")} {selected.table_number}</span>}
                <TurnierMatchActions tm={selected} me={me} isOrganizer={isOrganizer} tourStatus={tourStatus}
                  busyId={busyId} onOpenMatchScreen={onOpenMatchScreen} onOrganizerReport={onOrganizerReport}
                  onConfirm={onConfirm} onForceConfirm={onForceConfirm} onEditMatch={onEditMatch} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
