// Gemeinsame Aufbereitung des Match-Protokolls (matches.run_log). Zwei
// Formen: das detaillierte 14/1-Aufnahme-Protokoll (Array von Objekten mit
// .type) sowie das simple Punktestand-Protokoll aller anderen Disziplinen
// (Array von [s1, s2]-Paaren, ein Eintrag pro Zaehler-Klick). Wird sowohl
// live waehrend des Spiels (StraightPoolScorer) als auch in der
// nachtraeglichen Protokoll-Ansicht (MatchProtokollScreen) verwendet,
// damit beide Stellen exakt dieselben Werte zeigen.
import { t } from "./i18n";

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

// Einzelteile eines 14/1-Log-Eintrags, getrennt statt als ein zusammen-
// geklebter Satz - damit sie sich sauber in eigene Tabellenspalten setzen
// lassen (kein Herumspringen des Texts, jede Spalte bedeutet immer dasselbe).
export function runLogEntryParts(e) {
  let action;
  switch (e.type) {
    case "rack": action = t("Rack +{n}", { n: e.potted }); break;
    case "safe": action = t("Safe"); break;
    case "breakfoul": action = t("Anstoß-Foul −2"); break;
    case "foul": action = e.bonus ? t("Foul −1, 3er-Foul −15") : t("Foul −1"); break;
    default: action = t("Fehler"); break; // "miss"
  }
  return { inning: e.inning, type: e.type, action, run: e.run > 0 ? e.run : null, score: e.scoreAfter };
}

// Kompakte Ein-Zeilen-Beschreibung (fuers Live-Protokoll im Spiel selbst,
// wo Platz begrenzt ist) - baut auf runLogEntryParts() auf.
export function describeRunLogEntry(e) {
  const p = runLogEntryParts(e);
  const parts = [t("Aufnahme {n}", { n: p.inning }), p.action];
  if (p.run) parts.push(t("Serie {n}", { n: p.run }));
  return { label: parts.join(" · "), score: p.score };
}

// Fuer die Tabellen-Ansicht: kollabiert wie collapseRunLog(), traegt aber
// zusaetzlich den laufenden Offensivschnitt (versenkte Kugeln je Fehler-
// Aufnahme, wie am Spielbrett selbst) je Zeile mit. Wird auf dem
// UNKOLLABIERTEN Log berechnet, damit auch mehrere Racks innerhalb
// derselben Aufnahme korrekt mitzaehlen, bevor am Ende kollabiert wird.
export function buildProtocolRows(log) {
  const pk = [0, 0], mi = [0, 0];
  return (log || []).reduce((acc, e) => {
    pk[e.player] += e.potted || 0;
    if (e.type === "miss" || e.type === "foul") mi[e.player] += 1;
    const row = { ...e, avg: mi[e.player] > 0 ? pk[e.player] / mi[e.player] : null };
    const last = acc[acc.length - 1];
    if (last && last.player === e.player && last.inning === e.inning) acc[acc.length - 1] = row;
    else acc.push(row);
    return acc;
  }, []);
}

// Zwei getrennte, chronologisch sortierte Listen (eine je Spieler) fuer die
// Tabellenansicht mit einem eigenen Bereich pro Spieler statt abwechselnder
// Zeilen - Zeile i zeigt links die i-te Aufnahme von Spieler 0 und rechts
// die i-te Aufnahme von Spieler 1.
export function splitProtocolRowsByPlayer(rows) {
  return [rows.filter((r) => r.player === 0), rows.filter((r) => r.player === 1)];
}
