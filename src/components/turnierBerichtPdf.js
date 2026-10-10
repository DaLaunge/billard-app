import { t } from "../lib/i18n";
import { fmtDate, fmtDateTime, fmtDuration } from "../lib/format";
import { matchDurationMs } from "../lib/runLog";
import { computeTurnierLayout, bracketLabel, formatLabel, BOX_W, BOX_H, FINAL_BOX_W, FINAL_BOX_H } from "../lib/turnierLayout";
import { newPdf, clean, savePdf, tournamentFileName, addMatchProtocol, loadClocks, MARGIN } from "../lib/pdfExport";
import { tmScores } from "./TurnierMatchActions";

/* Turnierbericht und Spielprotokoll als PDF (statt Druckdialog). Dieselben Inhalte wie
   TurnierBerichtScreen am Bildschirm: Bestenliste, chronologischer Match-Log
   (kompakt oder vollstaendig), Turnierverlauf als Baumgrafik auf einer Querformat-Seite. */

// "Zeit am Tisch" fuer EIN Turniermatch: bevorzugt aus dem Zeitprotokoll (run_log
// traegt bei JEDER Disziplin Zeitstempel, siehe matchDurationMs()) - nur bei
// Turnierleitungs-/Admin-Eintragung gibt es kein run_log, dort zaehlt ersatzweise die
// Tischblockierzeit von Paarung-steht-fest bis Ergebnis-gemeldet (dieselbe Formel wie
// die "Laengste Wartezeiten"-Sektion in TurnierRasterScreen.jsx).
export function tableTimeMs(tm) {
  const fromLog = matchDurationMs(tm.match?.run_log);
  if (fromLog != null) return fromLog;
  if (tm.ready_at && tm.match?.played_at) {
    const ms = new Date(tm.match.played_at) - new Date(tm.ready_at);
    return ms >= 0 ? ms : null;
  }
  return null;
}

const BRACKET_STROKE = { winners: [30, 91, 58], losers: [107, 31, 36], final: [160, 115, 25], main: [150, 150, 150] };
const BRACKET_BAND = { winners: [226, 245, 232], losers: [250, 228, 228] };

// Turnierbaum als Vektorgrafik: dieselbe Geometrie wie die Bildschirm-Ansicht
// (computeTurnierLayout), auf die Seite skaliert.
function drawBracket(pdf, matches, nameOf) {
  const d = pdf.doc;
  const layout = computeTurnierLayout(matches);
  const labelH = layout.showSectionLabels ? 18 : 0;
  const vbW = layout.totalWidth;
  const vbH = layout.totalHeight + labelH;
  const availW = pdf.inner;
  const availH = pdf.bottom - pdf.y - 2;
  const s = Math.min(availW / vbW, availH / vbH);
  const ox = MARGIN + (availW - vbW * s) / 2;
  const oy = pdf.y + labelH * s;
  const X = (x) => ox + x * s;
  const Y = (y) => oy + y * s;
  const pt = (px, min = 4.5, max = 11) => Math.max(min, Math.min(max, px * s * 2.8346));

  layout.bands.forEach((b) => {
    const c = BRACKET_BAND[b.bracket];
    if (!c) return;
    d.setFillColor(...c);
    d.rect(X(0), Y(b.top), b.width * s, b.height * s, "F");
  });

  layout.edges.forEach((e) => {
    const x1 = e.from.x + BOX_W, y1 = e.from.y + BOX_H / 2;
    const x2 = e.to.x, y2 = e.to.y + e.toH / 2;
    const mx = (x1 + x2) / 2;
    const pts = [];
    for (let i = 0; i <= 16; i += 1) {
      const u = i / 16, k = 1 - u;
      pts.push([
        k * k * k * x1 + 3 * k * k * u * mx + 3 * k * u * u * mx + u * u * u * x2,
        k * k * k * y1 + 3 * k * k * u * y1 + 3 * k * u * u * y2 + u * u * u * y2,
      ]);
    }
    const segs = pts.slice(1).map((p, i) => [(p[0] - pts[i][0]) * s, (p[1] - pts[i][1]) * s]);
    if (e.kind === "drop") { d.setDrawColor(175, 175, 175); d.setLineDashPattern([1.2, 1], 0); d.setLineWidth(0.25); }
    else { d.setDrawColor(70, 100, 140); d.setLineDashPattern([], 0); d.setLineWidth(0.4); }
    d.lines(segs, X(pts[0][0]), Y(pts[0][1]), [1, 1], "S");
  });
  d.setLineDashPattern([], 0);

  if (layout.showSectionLabels) {
    d.setFont("helvetica", "bold"); d.setFontSize(pt(13)); d.setTextColor(90, 90, 90);
    layout.sections.forEach((sec) => d.text(clean(bracketLabel(sec.bracket)).toUpperCase(), X(sec.left + 4), Y(sec.top - 6)));
  }

  const fitText = (text, maxW) => {
    let str = clean(text);
    if (d.getTextWidth(str) <= maxW) return str;
    while (str.length > 1 && d.getTextWidth(`${str}...`) > maxW) str = str.slice(0, -1);
    return `${str}...`;
  };

  matches.forEach((m) => {
    const p = layout.pos[m.id];
    if (!p) return;
    const isFinal = m.bracket === "final" && layout.bigFinalBox;
    const w = (isFinal ? FINAL_BOX_W : BOX_W) * s;
    const h = (isFinal ? FINAL_BOX_H : BOX_H) * s;
    const x = X(p.x), y = Y(p.y);
    d.setFillColor(255, 255, 255);
    d.setDrawColor(...(BRACKET_STROKE[m.bracket] || BRACKET_STROKE.main));
    d.setLineWidth(m.bracket === "winners" || m.bracket === "losers" || m.bracket === "final" ? 0.5 : 0.3);
    d.roundedRect(x, y, w, h, 8 * s, 8 * s, "FD");
    const pad = 10 * s;
    const fs = pt(13);
    d.setFontSize(fs);
    const n1 = nameOf(m.player1_id) || t("TBD");
    if (m.is_bye) {
      d.setFont("helvetica", "normal"); d.setTextColor(30, 30, 30);
      d.text(fitText(n1, w - pad * 2), x + pad, y + h * 0.42, { baseline: "middle" });
      d.setFont("helvetica", "italic"); d.setTextColor(120, 120, 120);
      d.text(clean(t("(Freilos)")), x + pad, y + h * 0.72, { baseline: "middle" });
      return;
    }
    const n2 = nameOf(m.player2_id) || t("TBD");
    const sc = tmScores(m);
    d.setDrawColor(215, 215, 215); d.setLineWidth(0.2);
    d.line(x, y + h / 2, x + w, y + h / 2);
    [[n1, m.player1_id, sc?.s1, 0.4], [n2, m.player2_id, sc?.s2, 0.78]].forEach(([name, pid, score, at]) => {
      const won = m.winner_id && m.winner_id === pid;
      d.setFont("helvetica", won ? "bold" : "normal"); d.setTextColor(...(won ? [20, 20, 20] : [70, 70, 70]));
      const scoreW = score != null ? d.getTextWidth(String(score)) + pad : 0;
      d.text(fitText(name, w - pad * 2 - scoreW), x + pad, y + h * at, { baseline: "middle" });
      if (score != null) d.text(String(score), x + w - pad, y + h * at, { baseline: "middle", align: "right" });
    });
  });
  d.setTextColor(30, 30, 30);
}

// Kompletter Turnierbericht. logDetail: "kompakt" | "voll" (wie am Bildschirm gewaehlt).
export async function exportTurnierBerichtPdf({ tour, standingsGrouped, aggByPlayer, timeline, logDetail, bracketMatches, hasTree, nameOf }) {
  const pdf = await newPdf();
  pdf.title(tour.name);
  pdf.meta(`${formatLabel(tour.format)} · ${t(tour.discipline)} · ${fmtDate(tour.finished_at || tour.created_at)}`);

  if (standingsGrouped) {
    pdf.heading(t("Bestenliste"));
    const rows = [];
    standingsGrouped.forEach(({ placement, rows: group }) => group.forEach((row, i) => {
      const a = aggByPlayer[row.player_id] || { wins: 0, losses: 0, gamesFor: 0, gamesAgainst: 0, tableMs: 0 };
      const podium = placement <= 3;
      rows.push([
        i === 0 ? { text: `${placement}.${row.tied_count > 1 ? ` ${t("geteilt")}` : ""}`, bold: podium } : "",
        { text: nameOf(row.player_id) || "?", bold: podium },
        String(a.wins), String(a.losses), `${a.gamesFor}:${a.gamesAgainst}`,
        a.tableMs > 0 ? fmtDuration(a.tableMs) : "–",
      ]);
    }));
    pdf.table({
      cols: [
        { label: t("Platz"), w: 1.5 }, { label: t("Spieler"), w: 4 }, { label: t("Siege"), w: 1.2, align: "right" },
        { label: t("Niederlagen"), w: 1.8, align: "right" }, { label: t("Games +/-"), w: 1.8, align: "right" },
        { label: t("Zeit am Tisch"), w: 2.2, align: "right" },
      ],
      rows,
    });
  }

  pdf.heading(t("Chronologischer Match-Log"));
  if (!timeline.length) {
    pdf.text(t("Noch keine Partie in diesem Turnier."), { size: 9, color: [110, 110, 110] });
  } else if (logDetail === "kompakt") {
    let anyNa = false;
    const rows = timeline.map((tm) => {
      const n1 = nameOf(tm.player1_id) || "?", n2 = nameOf(tm.player2_id) || "?";
      const sc = tmScores(tm);
      const hr = [tm.match.high_run1, tm.match.high_run2].filter((v) => v != null);
      const avg = [tm.match.avg1, tm.match.avg2].filter((v) => v != null);
      const ms = tableTimeMs(tm);
      // Turnierleitungs-Schnelleingabe: kein Rack-fuer-Rack-Mitzaehlen, also keine
      // Hoechstserie/Schnitt - "n/a" statt "-", erklaert in der Fussnote.
      const manualEntry = tm.match.reported_by && tm.match.reported_by === tm.match.confirmed_by;
      if (manualEntry && (!hr.length || !avg.length)) anyNa = true;
      return [
        fmtDateTime(tm.match.played_at), `${n1} – ${n2}`, { text: `${sc.s1}:${sc.s2}`, bold: true },
        hr.length ? hr.join(" / ") : (manualEntry ? t("n/a") : "–"),
        avg.length ? avg.map((v) => v.toFixed(1)).join(" / ") : (manualEntry ? t("n/a") : "–"),
        ms != null ? fmtDuration(ms) : "–",
      ];
    });
    pdf.table({
      cols: [
        { label: t("Zeit"), w: 2.6 }, { label: t("Partie"), w: 4.4 }, { label: t("Ergebnis"), w: 1.4, align: "center" },
        { label: t("Höchstserie"), w: 1.8, align: "center" }, { label: t("Schnitt"), w: 1.8, align: "center" },
        { label: t("Zeit am Tisch"), w: 1.9, align: "right" },
      ],
      rows,
    });
    if (anyNa) pdf.text(`n/a: ${t("Nur bei Live-Mitzählen über \"Melden\" verfügbar, nicht bei Turnierleitungs-Schnelleingabe.")}`, { size: 8, color: [110, 110, 110] });
  } else {
    const clocks = await loadClocks(timeline.map((tm) => tm.match?.id));
    timeline.forEach((tm) => {
      const n1 = nameOf(tm.player1_id) || "?", n2 = nameOf(tm.player2_id) || "?";
      pdf.ensure(34);
      pdf.gap(2);
      pdf.text(`${n1} ${tm.match.score1}:${tm.match.score2} ${n2} · ${fmtDateTime(tm.match.played_at)}`, { size: 10, bold: true });
      addMatchProtocol(pdf, tm.match, [n1, n2], clocks[tm.match.id] || null);
    });
  }

  if (hasTree && bracketMatches?.length) {
    pdf.newPage("landscape");
    pdf.heading(t("Turnierverlauf"));
    drawBracket(pdf, bracketMatches, nameOf);
  }

  pdf.finish();
  await savePdf(pdf.doc, tournamentFileName(tour, logDetail === "voll" ? "Bericht_vollstaendig" : "Bericht"));
}

// Einfaches Spielprotokoll (Zeit, Partie, Ergebnis) aus der Raster-Ansicht.
export async function exportTurnierProtocolPdf({ tour, timeline, nameOf }) {
  const pdf = await newPdf();
  pdf.title(tour.name);
  pdf.meta(`${formatLabel(tour.format)} · ${t(tour.discipline)} · ${fmtDate(tour.created_at)}`);
  pdf.gap(1);
  if (!timeline.length) {
    pdf.text(t("Noch keine Partie in diesem Turnier."), { size: 9, color: [110, 110, 110] });
  } else {
    pdf.table({
      cols: [{ label: t("Zeit"), w: 2.6 }, { label: t("Partie"), w: 6 }, { label: t("Ergebnis"), w: 1.5, align: "center" }],
      rows: timeline.map((tm) => {
        const sc = tmScores(tm);
        return [fmtDateTime(tm.match.played_at), `${nameOf(tm.player1_id) || "?"} – ${nameOf(tm.player2_id) || "?"}`, { text: `${sc.s1}:${sc.s2}`, bold: true }];
      }),
      fontSize: 9, rowH: 5.8,
    });
  }
  pdf.finish();
  await savePdf(pdf.doc, tournamentFileName(tour, "Spielprotokoll"));
}
