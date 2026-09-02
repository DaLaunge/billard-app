// Gemeinsame Aufbereitung des 14/1-Aufnahme-Protokolls (matches.run_log) -
// wird sowohl live waehrend des Spiels (StraightPoolScorer) als auch beim
// nachtraeglichen Download (StatistikScreen) verwendet, damit beide exakt
// dieselbe Darstellung zeigen.
import { t } from "./i18n";

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

// Reines Text-Protokoll fuer den Download - eine Zeile pro Aufnahme,
// chronologisch, mit Spielername.
export function formatRunLogText(log, names, meta) {
  const lines = [];
  if (meta) {
    lines.push(`${names[0]} ${meta.score1} : ${meta.score2} ${names[1]}`);
    if (meta.playedAt) lines.push(meta.playedAt);
    lines.push("");
  }
  for (const e of collapseRunLog(log)) {
    const d = describeRunLogEntry(e);
    lines.push(`${names[e.player]}: ${d.label} → ${d.score} Punkte`);
  }
  return lines.join("\n");
}
