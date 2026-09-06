// Reine Layout-Berechnung fuer die Turnierbaum-Grafik, aus TurnierGraph.jsx
// herausgezogen (haengt dort nur von "matches" ab) - damit sowohl die
// interaktive Ansicht (TurnierGraph.jsx) als auch der statische Baum im
// Turnierbericht (TurnierBerichtScreen.jsx) exakt dieselbe Geometrie nutzen,
// statt die Layout-Logik zweimal zu pflegen.
import { t } from "./i18n";

export const BOX_W = 240;
export const BOX_H = 62;
// Finale bewusst groesser + abgesetzt (siehe Layout unten) - das wichtigste
// Match eines Doppel-K.O.-Turniers soll nicht wie ein Feld unter vielen wirken.
export const FINAL_BOX_W = 260;
export const FINAL_BOX_H = 100;
export const COL_GAP = 84;
export const FINAL_GAP = COL_GAP * 1.7;
// Bewusst knapper als frueher (war 26/56) - die Kollisionsaufloesung im
// Layout (siehe unten) kann ueber mehrere Runden hinweg Luft aufsummieren,
// vor allem im Verliererbaum mit seinen bis zu 6 Runden bei 8 Spielern.
// Kleinere Werte halten den Baum kompakter, ohne dass Boxen/Linien enger
// werden als sie selbst sind - die Kollisionsaufloesung verhindert
// weiterhin jede Ueberlappung.
export const ROW_GAP = 14;
export const SECTION_GAP = 26;
export const LABEL_H = 26;

export const bracketLabel = (b) => (b === "winners" ? t("Gewinnerbaum") : b === "losers" ? t("Verliererbaum") : b === "final" ? t("Finale") : t("Raster"));
export const formatLabel = (f) => (f === "ko" ? t("K.O.") : f === "double_ko" ? t("Doppel-K.O.") : t("Jeder gegen jeden"));
// Die 'final'-Sektion kann mehrere Runden haben (Playoff-Stufe nach Jeder-
// gegen-jeden bzw. verkuerztes Doppel-K.O. mit bis zu 8 Finalisten, siehe
// Migration 2026-09-06_tournament_playoff_stage.sql) - Runden werden nach
// Abstand zum eigentlichen Finale benannt statt generisch "Runde n".
export const finalRoundLabel = (round, totalRounds) => {
  const fromEnd = totalRounds - round;
  if (fromEnd <= 0) return t("Finale");
  if (fromEnd === 1) return t("Halbfinale");
  if (fromEnd === 2) return t("Viertelfinale");
  if (fromEnd === 3) return t("Achtelfinale");
  return `${t("Runde")} ${round}`;
};

// Baumgrafik fuer ein ganzes Turnier (alle Bracket-Abschnitte in EINEM
// zusammenhaengenden Bild statt getrennter Grafiken pro Abschnitt, siehe
// Kommentar-Historie in git log fuer die Vorgeschichte dieser Datei: erst
// fehlten die Abstiegslinien aus dem Gewinnerbaum komplett, dann liess eine
// falsche Positionsrechnung den Verliererbaum wie zwei parallele Spuren statt
// einem echten Baum aussehen).
export function computeTurnierLayout(matches) {
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
}
