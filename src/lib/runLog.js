// Gemeinsame Aufbereitung des Match-Protokolls (matches.run_log). Zwei
// Formen: das detaillierte 14/1-Aufnahme-Protokoll (Array von Objekten mit
// .type) sowie das simple Punktestand-Protokoll aller anderen Disziplinen
// (Array von [s1, s2]-Paaren, ein Eintrag pro Zaehler-Klick). Wird sowohl
// live waehrend des Spiels (StraightPoolScorer) als auch beim
// nachtraeglichen Download (StatistikScreen, RanglisteScreen) verwendet,
// damit alle Stellen exakt dieselbe Darstellung zeigen.
import { t } from "./i18n";
import { fmtDateTime } from "./format";

export const isSimpleScoreLog = (log) => Array.isArray(log) && Array.isArray(log[0]);

// Mehrere Racks innerhalb derselben Aufnahme (Rack, Rack, ... erst dann
// Fehler/Safe/Foul) erzeugen je einen Log-Eintrag - fuer die Anzeige wird
// pro Spieler+Aufnahme aber nur die JEWEILS LETZTE Zeile gezeigt (die schon
// die kumulierte Serie und den Gesamtpunktestand dieser Aufnahme traegt).
export function collapseRunLog(log) {
  return (log || []).reduce((acc, e) => {
    const last = acc[acc.length - 1];
    if (last && last.player === e.player && last.inning === e.inning) acc[acc.length - 1] = e;
    else acc.push(e);
    return acc;
  }, []);
}

// Jede Zeile ist eigenstaendig nachvollziehbar: welche Aufnahme, was ist
// passiert (inkl. Foul-Abzug), welche Serie stand zu dem Zeitpunkt, und wie
// hoch war der Gesamtpunktestand des Spielers UNMITTELBAR danach
// (e.scoreAfter) - Score wird separat zurueckgegeben, damit er in einer
// eigenen rechtsbuendigen Spalte dargestellt werden kann.
export function describeRunLogEntry(e) {
  const parts = [t("Aufnahme {n}", { n: e.inning })];
  switch (e.type) {
    case "rack": parts.push(t("Rack +{n}", { n: e.potted })); break;
    case "safe": parts.push(t("Safe")); break;
    case "breakfoul": parts.push(t("Anstoß-Foul −2")); break;
    case "foul":
      parts.push(e.bonus ? t("Foul −1, 3er-Foul −15") : t("Foul −1"));
      break;
    default: parts.push(t("Fehler")); break; // "miss"
  }
  if (e.run > 0) parts.push(t("Serie {n}", { n: e.run }));
  return { label: parts.join(" · "), score: e.scoreAfter };
}

// Reines Text-Protokoll fuer den Download.
// 14/1: eine Zeile pro Aufnahme, chronologisch, mit Spielername.
// Andere Disziplinen: eine Zeile pro Punktestand-Aenderung ("s1:s2"), z.B.
// 0:0, 1:0, 2:0, 2:1, ... - so ist jederzeit nachvollziehbar, wie der
// Spielstand zustande kam, ohne dass jeder einzelne Ballwechsel erfasst
// werden muss.
export function formatRunLogText(log, names, meta) {
  const lines = [];
  if (meta) {
    lines.push(`${names[0]} ${meta.score1} : ${meta.score2} ${names[1]}`);
    if (meta.playedAt) lines.push(meta.playedAt);
    lines.push("");
  }
  if (isSimpleScoreLog(log)) {
    for (const [a, b] of log) lines.push(`${a}:${b}`);
  } else {
    for (const e of collapseRunLog(log)) {
      const d = describeRunLogEntry(e);
      lines.push(`${names[e.player]}: ${d.label} → ${d.score} Punkte`);
    }
  }
  return lines.join("\n");
}

// Protokoll eines Matches als .txt herunterladen - clientseitig per Blob,
// kein Server-Endpunkt noetig (run_log ist bereits vollstaendig im Match
// dabei, auch schon vor der Bestaetigung durch den Gegner).
export function downloadRunLogFile(m) {
  const names = [m.p1?.nickname ?? "?", m.p2?.nickname ?? "?"];
  const text = formatRunLogText(m.run_log, names, {
    score1: m.score1, score2: m.score2, playedAt: fmtDateTime(m.played_at),
  });
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const safe = (s) => s.replace(/[^\p{L}\p{N}]+/gu, "-");
  const discSlug = safe(m.discipline || "match");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${discSlug}_${m.played_at.slice(0, 10)}_${safe(names[0])}-${safe(names[1])}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
