import { supabase } from "../supabase";
import { t } from "./i18n";
import { fmtTime, fmtDuration, fmtDateTime } from "./format";
import { runLogEntryParts } from "./runLog";
import { protocolData } from "./protocolData";

/* ============================================================
   PDF-ERZEUGUNG (Protokoll, Turnierbericht)

   Ersetzt den Druckdialog des Browsers (window.print()): das PDF wird hier
   direkt gezeichnet (jsPDF, Text bleibt Text - auswaehlbar, scharf, durchsuchbar)
   und als Datei gespeichert. jsPDF wird erst beim ersten Speichern nachgeladen,
   damit es nicht im Start-Bundle der App liegt.

   Dateinamen: JJJJMMDD_Was_Wer.pdf (siehe fileDate()/safePart()), damit man sie auf
   der Festplatte nach Datum sortieren und leicht wiederfinden kann.
   ============================================================ */

// ---- Dateinamen ---------------------------------------------------------
export function fileDate(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  const ok = !Number.isNaN(x.getTime());
  const y = ok ? x : new Date();
  return `${y.getFullYear()}${String(y.getMonth() + 1).padStart(2, "0")}${String(y.getDate()).padStart(2, "0")}`;
}

// Namensteil fuer Dateinamen: ohne Umlaute/Sonderzeichen (laeuft auf jedem
// Dateisystem), Woerter mit "_" verbunden. "&" wird zu "und" (Doppel).
export function safePart(s) {
  return String(s ?? "")
    .replace(/&/g, " und ")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// 20261010_Stefan_gegen_Chris_8Ball_5-3.pdf
export function matchFileName(m, names) {
  const parts = [fileDate(m.played_at), safePart(names[0]), "gegen", safePart(names[1]), safePart(m.discipline)];
  // 14/1 kann negativ enden: "-7" waere im Dateinamen ein doppelter Strich ("78--7").
  const sc = (v) => (v < 0 ? `m${-v}` : String(v));
  if (m.score1 != null && m.score2 != null) parts.push(`${sc(m.score1)}-${sc(m.score2)}`);
  return `${parts.filter(Boolean).join("_")}.pdf`;
}

// 20261010_Turnier_Herbstcup_Bericht.pdf
export function tournamentFileName(tour, kind) {
  return `${[fileDate(tour.finished_at || tour.created_at), "Turnier", safePart(tour.name), kind].filter(Boolean).join("_")}.pdf`;
}

// jsPDF zeichnet mit den Standardschriften nur Latin-1 (+ ein paar Satzzeichen):
// alles andere (z. B. das Minuszeichen U+2212 in "Foul −1", Emojis) wuerde als
// Zeichensalat erscheinen. Hier wird es durch Naheliegendes ersetzt bzw. entfernt.
export function clean(s) {
  return String(s ?? "")
    .replace(/−/g, "-")
    .replace(/[→↗]/g, ">")
    .replace(/[^\n\t -~ -ÿ–—‘’“”•…€]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---- Speichern ---------------------------------------------------------
// Auf dem Handy bietet das Teilen-Menue "In Dateien sichern" (ein Download aus einer
// installierten App wird dort oft verschluckt); am PC wird die Datei normal geladen.
export async function savePdf(doc, filename) {
  try {
    const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    if (touch && typeof navigator !== "undefined" && navigator.canShare) {
      const file = new File([doc.output("blob")], filename, { type: "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename.replace(/\.pdf$/, "") });
          return;
        } catch (e) {
          if (e?.name === "AbortError") return; // Teilen-Menue abgebrochen: nichts weiter tun
        }
      }
    }
  } catch { /* faellt auf den normalen Download zurueck */ }
  doc.save(filename);
}

// ---- Dokument-Baukasten ------------------------------------------------
export const MARGIN = 14;
const INK = [30, 30, 30];
const DIM = [110, 110, 110];
const LINE = [200, 200, 200];
const HEAD_BG = [236, 238, 240];
const ZEBRA = [247, 248, 249];
export const TAG_COLOR = { rack: [30, 120, 70], safe: [60, 90, 150], breakfoul: [170, 50, 50], foul: [170, 50, 50], miss: [120, 120, 120] };

export async function newPdf() {
  const { jsPDF } = await import("jspdf");
  return new Pdf(new jsPDF({ unit: "mm", format: "a4" }));
}

export class Pdf {
  constructor(doc) {
    this.doc = doc;
    this.y = MARGIN;
    doc.setFont("helvetica", "normal");
  }

  get w() { return this.doc.internal.pageSize.getWidth(); }
  get h() { return this.doc.internal.pageSize.getHeight(); }
  get inner() { return this.w - MARGIN * 2; }
  get bottom() { return this.h - 16; } // Platz fuer die Fusszeile

  newPage(orientation) {
    if (orientation) this.doc.addPage("a4", orientation); else this.doc.addPage();
    this.y = MARGIN;
  }

  // Platz fuer ein Element der Hoehe h - sonst neue Seite. Gibt true zurueck, wenn
  // umgebrochen wurde.
  ensure(h) {
    if (this.y + h <= this.bottom) return false;
    this.newPage();
    return true;
  }

  gap(mm) { this.y += mm; }

  title(text) {
    const d = this.doc;
    d.setFont("helvetica", "bold"); d.setFontSize(17); d.setTextColor(...INK);
    const lines = d.splitTextToSize(clean(text), this.inner);
    this.ensure(lines.length * 7.2);
    d.text(lines, MARGIN, this.y + 6);
    this.y += lines.length * 7.2;
  }

  meta(text) {
    const d = this.doc;
    d.setFont("helvetica", "normal"); d.setFontSize(10); d.setTextColor(...DIM);
    this.ensure(6);
    d.text(clean(text), MARGIN, this.y + 4);
    this.y += 7;
    d.setTextColor(...INK);
  }

  heading(text) {
    const d = this.doc;
    this.ensure(14);
    this.y += 3;
    d.setFont("helvetica", "bold"); d.setFontSize(12.5); d.setTextColor(...INK);
    d.text(clean(text), MARGIN, this.y + 4);
    d.setDrawColor(...LINE); d.setLineWidth(0.3);
    d.line(MARGIN, this.y + 6, MARGIN + this.inner, this.y + 6);
    this.y += 9;
  }

  // Einzelne Zeile Fliesstext (bricht bei Bedarf um).
  text(text, { size = 9.5, bold = false, color = INK } = {}) {
    const d = this.doc;
    d.setFont("helvetica", bold ? "bold" : "normal"); d.setFontSize(size); d.setTextColor(...color);
    const lines = d.splitTextToSize(clean(text), this.inner);
    const lh = size * 0.42;
    this.ensure(lines.length * lh + 1);
    d.text(lines, MARGIN, this.y + lh * 0.85);
    this.y += lines.length * lh + 1.5;
    d.setTextColor(...INK);
  }

  // Zeile aus Wert-Paaren ("Spielzeit: 12:03   Dauer: 14:10"), Beschriftung normal,
  // Wert fett - wie die Dauer-Zeile am Bildschirm.
  facts(pairs) {
    const d = this.doc;
    const items = pairs.filter(([, v]) => v != null && v !== "");
    if (!items.length) return;
    this.ensure(6);
    d.setFontSize(9);
    let x = MARGIN;
    items.forEach(([label, value]) => {
      const l = `${clean(label)}: `;
      d.setFont("helvetica", "normal"); d.setTextColor(...DIM);
      d.text(l, x, this.y + 4);
      x += d.getTextWidth(l);
      d.setFont("helvetica", "bold"); d.setTextColor(...INK);
      const v = clean(value);
      d.text(v, x, this.y + 4);
      x += d.getTextWidth(v) + 8;
    });
    this.y += 6.5;
    d.setFont("helvetica", "normal");
  }

  /* Tabelle mit wiederholter Kopfzeile ueber Seitenumbrueche.
     cols:   [{ label, w (Gewicht), align: "left"|"right"|"center", divider?: true }]
     groups: optionale Gruppenzeile ueber den Spalten [{ label, span, divider? }]
     rows:   [[Zelle, ...]] - Zelle = Text oder { text, bold, color:[r,g,b] }
     width:  Tabellenbreite in mm (Standard: volle Breite) */
  table({ cols, rows, groups, width, fontSize = 8.5, rowH = 5.3 }) {
    const d = this.doc;
    const total = cols.reduce((a, c) => a + (c.w || 1), 0);
    const tw = Math.min(width || this.inner, this.inner);
    const widths = cols.map((c) => ((c.w || 1) / total) * tw);
    const xs = widths.reduce((acc, wd, i) => { acc.push(i ? acc[i - 1] + widths[i - 1] : MARGIN); return acc; }, []);
    const pad = 1.6;
    const headH = rowH + 0.6;

    const fit = (text, wd, bold) => {
      d.setFont("helvetica", bold ? "bold" : "normal"); d.setFontSize(fontSize);
      let s = clean(text);
      if (d.getTextWidth(s) <= wd - pad * 2) return s;
      while (s.length > 1 && d.getTextWidth(`${s}...`) > wd - pad * 2) s = s.slice(0, -1);
      return `${s}...`;
    };
    const put = (text, i, y, { bold, color, align } = {}) => {
      const wd = widths[i];
      const s = fit(text, wd, bold);
      d.setFont("helvetica", bold ? "bold" : "normal"); d.setFontSize(fontSize);
      d.setTextColor(...(color || INK));
      const a = align || cols[i].align || "left";
      const x = a === "right" ? xs[i] + wd - pad : a === "center" ? xs[i] + wd / 2 : xs[i] + pad;
      d.text(s, x, y + rowH * 0.7, { align: a });
    };

    const header = () => {
      d.setFillColor(...HEAD_BG);
      if (groups) {
        d.rect(MARGIN, this.y, tw, headH, "F");
        let ci = 0;
        groups.forEach((g) => {
          const gx = xs[ci], gw = widths.slice(ci, ci + g.span).reduce((a, b) => a + b, 0);
          d.setFont("helvetica", "bold"); d.setFontSize(fontSize); d.setTextColor(...INK);
          d.text(fit(g.label, gw, true), gx + gw / 2, this.y + rowH * 0.7, { align: "center" });
          if (g.divider) { d.setDrawColor(...LINE); d.setLineWidth(0.25); d.line(gx, this.y, gx, this.y + headH * 2); }
          ci += g.span;
        });
        this.y += headH;
      }
      d.setFillColor(...HEAD_BG);
      d.rect(MARGIN, this.y, tw, headH, "F");
      cols.forEach((c, i) => put(c.label, i, this.y, { bold: true, align: c.align === "right" ? "right" : c.align }));
      d.setDrawColor(150, 150, 150); d.setLineWidth(0.3);
      d.line(MARGIN, this.y + headH, MARGIN + tw, this.y + headH);
      this.y += headH;
    };

    if (this.y + headH * (groups ? 2 : 1) + rowH * 2 > this.bottom) this.newPage();
    header();
    rows.forEach((row, ri) => {
      if (this.y + rowH > this.bottom) { this.newPage(); header(); }
      if (ri % 2 === 1) { d.setFillColor(...ZEBRA); d.rect(MARGIN, this.y, tw, rowH, "F"); }
      row.forEach((cell, i) => {
        const c = cell && typeof cell === "object" ? cell : { text: cell };
        if (c.text == null || c.text === "") return;
        put(c.text, i, this.y, c);
      });
      cols.forEach((c, i) => {
        if (c.divider) { d.setDrawColor(...LINE); d.setLineWidth(0.25); d.line(xs[i], this.y, xs[i], this.y + rowH); }
      });
      this.y += rowH;
    });
    d.setDrawColor(...LINE); d.setLineWidth(0.25);
    d.line(MARGIN, this.y, MARGIN + tw, this.y);
    this.y += 2;
    d.setTextColor(...INK);
  }

  // Fusszeile auf jeder Seite: App-Name, Erstellungsdatum, "Seite i von n".
  finish() {
    const d = this.doc;
    const n = d.getNumberOfPages();
    const stamp = fmtDateTime(new Date());
    for (let i = 1; i <= n; i += 1) {
      d.setPage(i);
      const w = this.w, h = this.h;
      d.setDrawColor(...LINE); d.setLineWidth(0.25);
      d.line(MARGIN, h - 11, w - MARGIN, h - 11);
      d.setFont("helvetica", "normal"); d.setFontSize(8); d.setTextColor(...DIM);
      d.text(`Break & Rank · ${clean(stamp)}`, MARGIN, h - 7);
      d.text(clean(t("Seite {i} von {n}", { i, n })), w - MARGIN, h - 7, { align: "right" });
    }
    d.setTextColor(...INK);
    return d;
  }
}

// ---- Match-Protokoll als PDF-Block ---------------------------------------
// Dasselbe wie MatchProtokollTable.jsx am Bildschirm: Tabelle (einfache
// Standtabelle oder Rack-fuer-Rack je Spieler beim 14/1) plus Dauer-Zeilen.
// clock = { net_ms, total_ms } aus match_clock oder null.
export function addMatchProtocol(pdf, m, names, clock) {
  const p = protocolData(m);
  if (!m.run_log?.length) {
    pdf.text(t("Kein Protokoll vorhanden - wurde vermutlich nachträglich als Ergebnis eingetragen."), { size: 9, color: DIM });
  } else if (p.simple) {
    const cols = [{ label: "#", w: 1, align: "right" }, { label: t("Stand"), w: 2, align: "center" }];
    if (p.hasTime) cols.push({ label: t("Zeit"), w: 2.2, align: "center" });
    pdf.table({
      cols, width: p.hasTime ? 80 : 56,
      rows: m.run_log.map(([a, b, ts], i) => {
        const row = [String(i), { text: `${a}:${b}`, bold: true }];
        if (p.hasTime) row.push(fmtTime(ts));
        return row;
      }),
    });
  } else {
    const side = (row) => {
      if (!row) return ["", "", "", ""];
      const e = runLogEntryParts(row);
      return [
        { text: e.action, color: TAG_COLOR[e.type] },
        e.run ?? "–",
        row.avg != null ? row.avg.toFixed(1) : "–",
        { text: String(e.score), bold: true },
      ];
    };
    const sub = (divider) => [
      { label: t("Ereignis"), w: 3.1, divider },
      { label: t("Serie"), w: 1.2, align: "right" },
      { label: "Ø", w: 1.2, align: "right" },
      { label: t("Pkt."), w: 1.3, align: "right" },
    ];
    pdf.table({
      groups: [{ label: "", span: 1 }, { label: names[0], span: 4 }, { label: names[1], span: 4, divider: true }],
      cols: [{ label: "#", w: 0.9, align: "right" }, ...sub(false), ...sub(true)],
      rows: Array.from({ length: p.maxRows }, (_, i) => [String(i + 1), ...side(p.rowsA[i]), ...side(p.rowsB[i])]),
      fontSize: 8, rowH: 5,
    });
  }
  pdf.facts([
    [t("Spielzeit ohne Pause"), clock ? fmtDuration(clock.net_ms) : null],
    [t("Dauer mit Pause"), clock ? fmtDuration(clock.total_ms) : null],
  ]);
  pdf.facts([
    [t("Gesamtdauer"), p.duration != null ? fmtDuration(p.duration) : null],
    [t("Reine Spielzeit"), p.playTime != null ? fmtDuration(p.playTime) : null],
    [p.simple ? t("Ø pro Spiel") : t("Ø pro Aufnahme"), p.units > 0 && p.avgUnit != null ? fmtDuration(p.avgUnit) : null],
  ]);
}

// Uhr-Dauer(n) aus match_clock; fehlt die Tabelle oder der Eintrag, bleibt es leer.
export async function loadClocks(matchIds) {
  const ids = [...new Set((matchIds || []).filter(Boolean))];
  if (!ids.length) return {};
  try {
    const { data } = await supabase.from("match_clock").select("match_id, net_ms, total_ms").in("match_id", ids);
    return Object.fromEntries((data || []).map((r) => [r.match_id, r]));
  } catch { return {}; }
}

// Ein einzelnes Match-Protokoll als PDF speichern (Knopf "Als PDF speichern").
export async function exportMatchPdf(m, names, tournamentName) {
  const pdf = await newPdf();
  pdf.title(`${names[0]}  ${m.score1} : ${m.score2}  ${names[1]}`);
  pdf.meta([t(m.discipline), fmtDateTime(m.played_at), tournamentName].filter(Boolean).join(" · "));
  pdf.gap(2);
  const clocks = await loadClocks([m.id]);
  addMatchProtocol(pdf, m, names, clocks[m.id] || null);
  pdf.finish();
  await savePdf(pdf.doc, matchFileName(m, names));
}
