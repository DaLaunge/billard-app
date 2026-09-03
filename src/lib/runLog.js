// Gemeinsame Aufbereitung des Match-Protokolls (matches.run_log). Zwei
// Formen: das detaillierte 14/1-Aufnahme-Protokoll (Array von Objekten mit
// .type, .ts) sowie das simple Punktestand-Protokoll aller anderen
// Disziplinen (Array von [s1, s2, ts]-Tripeln, ein Eintrag pro
// Zaehler-Klick). Wird sowohl live waehrend des Spiels (StraightPoolScorer)
// als auch in der nachtraeglichen Protokoll-Ansicht (MatchProtokollScreen)
// und den Geschwindigkeits-Statistiken im Profil verwendet.
import { t } from "./i18n";

export const isSimpleScoreLog = (log) => Array.isArray(log) && Array.isArray(log[0]);
const entryTs = (e) => (Array.isArray(e) ? e[2] : e?.ts);
// "start" markiert nur den Zeitpunkt des Losgehens (14/1) - keine echte
// Aufnahme, zaehlt nirgends als Tabellenzeile mit.
const isMarker = (e) => e?.type === "start";

// Mehrere Racks innerhalb derselben Aufnahme (Rack, Rack, ... erst dann
// Fehler/Safe/Foul) erzeugen je einen Log-Eintrag - fuer die Anzeige wird
// pro Spieler+Aufnahme aber nur die JEWEILS LETZTE Zeile gezeigt (die schon
// die kumulierte Serie und den Gesamtpunktestand dieser Aufnahme traegt).
export function collapseRunLog(log) {
  return (log || []).filter((e) => !isMarker(e)).reduce((acc, e) => {
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
  return (log || []).filter((e) => !isMarker(e)).reduce((acc, e) => {
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

// ---- Dauer & Tempo ---------------------------------------------------
// Alle Zeitstempel sind ms seit Epoch (Date.now()). Aeltere, vor dieser
// Funktion gespeicherte Matches haben keine .ts-Werte - alle Funktionen
// geben dann sauber null zurueck statt falscher Werte.

export function matchDurationMs(log) {
  if (!log || log.length < 2) return null;
  const first = entryTs(log[0]);
  const last = entryTs(log[log.length - 1]);
  if (typeof first !== "number" || typeof last !== "number") return null;
  return last - first;
}

// "Einheiten" fuer die Pro-Stueck-Dauer: bei Punktestand-Protokollen die
// Anzahl gespielter Spiele (Endstand s1+s2), beim 14/1 die Gesamtzahl an
// Aufnahmen beider Spieler.
export function matchUnitCount(log) {
  if (isSimpleScoreLog(log)) {
    const lastEntry = log[log.length - 1];
    return (lastEntry?.[0] ?? 0) + (lastEntry?.[1] ?? 0);
  }
  return collapseRunLog(log).length;
}

// Wie matchDurationMs/matchUnitCount, aber gefiltert um die Plausibilitaets-
// grenze (siehe MIN_MS_PER_BALL unten) - schliesst nachtraeglich in Sekunden
// durchgeklickte Matches aus statt eine falsche Pro-Stueck-Dauer zu zeigen.
export function avgUnitDurationMs(log, discipline) {
  if (isSimpleScoreLog(log)) {
    const { timeMs, count } = gameSpeedSums(log, discipline);
    return count > 0 ? timeMs / count : null;
  }
  const { timeMs, count } = inningSpeedSums(log);
  return count > 0 ? timeMs / count : null;
}

// Plausibilitaets-Untergrenze fuer die Geschwindigkeits-Statistik: schneller
// als 3s/Kugel ist physikalisch praktisch unmoeglich (selbst ein 3:0-Sieg im
// 8-Ball mit 1s/Kugel waere nur 24s - reale Bestzeiten liegen deutlich
// darueber). Zeitspannen, die diese Grenze unterschreiten, stammen so gut
// wie sicher von nachtraeglich (nach dem eigentlichen Spiel) durchgeklickten
// Matches und nicht von echtem Live-Tempo - sie werden aus den Summen
// ausgeschlossen statt die Statistik zu verfaelschen.
const MIN_MS_PER_BALL = 3000;
// Objektkugeln pro Spiel/Rack je Disziplin, fuer dieselbe Plausibilitaets-
// pruefung bei den einfachen Punktestand-Protokollen (8/9/10 Ball).
const BALLS_PER_GAME = { "8 Ball": 8, "9 Ball": 9, "10 Ball": 10 };

// Zeit- und Kugel-Summen je Spieler aus dem chronologischen 14/1-Rohprotokoll
// (auch einzelne Racks innerhalb derselben Aufnahme zaehlen separat) - fuer
// die Spielgeschwindigkeits-Statistik im Profil. Fouls (Foul/Anstoss-Foul)
// zaehlen nicht mit, weder als Zeit noch als Kugeln - ein verhauener Stoss
// ist kein repraesentatives Antempo.
export function ballSpeedSums(log) {
  const sums = [{ timeMs: 0, balls: 0 }, { timeMs: 0, balls: 0 }];
  if (!log || isSimpleScoreLog(log)) return sums;
  let prevTs = null;
  for (const e of log) {
    const ts = entryTs(e);
    if (isMarker(e)) { prevTs = ts; continue; }
    if (typeof ts === "number" && typeof prevTs === "number" && e.potted > 0
        && (e.type === "rack" || e.type === "miss" || e.type === "safe")) {
      const delta = ts - prevTs;
      if (delta >= e.potted * MIN_MS_PER_BALL) {
        sums[e.player].timeMs += delta;
        sums[e.player].balls += e.potted;
      }
    }
    prevTs = ts;
  }
  return sums;
}

// Analog zu ballSpeedSums, aber fuer die einfachen Punktestand-Protokolle
// (8/9/10 Ball): jeder Log-Eintrag markiert ein gewonnenes Spiel, die Zeit-
// spanne zum vorigen Eintrag ist dessen Dauer. Selbe Plausibilitaetsgrenze
// wie bei 14/1, nur mit den Objektkugeln der jeweiligen Disziplin.
export function gameSpeedSums(log, discipline) {
  let timeMs = 0, count = 0;
  if (!log || !isSimpleScoreLog(log)) return { timeMs, count };
  const minMs = (BALLS_PER_GAME[discipline] || 8) * MIN_MS_PER_BALL;
  let prevTs = null;
  for (const e of log) {
    const ts = entryTs(e);
    if (typeof ts === "number" && typeof prevTs === "number") {
      const delta = ts - prevTs;
      if (delta >= minMs) { timeMs += delta; count += 1; }
    }
    prevTs = ts;
  }
  return { timeMs, count };
}

// Analog zu ballSpeedSums, aber pro Aufnahme statt pro Log-Eintrag gruppiert
// (eine Aufnahme kann mehrere Racks/Eintraege umfassen, siehe collapseRunLog).
// Dauer einer Aufnahme = Zeit vom Ende der vorigen Aufnahme (bzw. Start-
// Marker) bis zum letzten Eintrag DIESER Aufnahme, geprueft gegen die darin
// insgesamt versenkten Kugeln - fuer "Ø pro Aufnahme" im Match-Protokoll.
export function inningSpeedSums(log) {
  let timeMs = 0, count = 0;
  if (!log || isSimpleScoreLog(log)) return { timeMs, count };
  let groupEndTs = null; // Ende der vorigen Aufnahme = Start der naechsten
  let curPlayer = null, curInning = null, curPotted = 0, curEndTs = null;
  const flush = () => {
    if (curEndTs == null || groupEndTs == null) return;
    const delta = curEndTs - groupEndTs;
    if (delta >= curPotted * MIN_MS_PER_BALL) { timeMs += delta; count += 1; }
  };
  for (const e of log) {
    const ts = entryTs(e);
    if (isMarker(e)) { groupEndTs = ts; continue; }
    if (typeof ts !== "number") continue;
    if (curPlayer === e.player && curInning === e.inning) {
      curPotted += e.potted || 0;
      curEndTs = ts;
    } else {
      flush();
      groupEndTs = curEndTs ?? groupEndTs;
      curPlayer = e.player; curInning = e.inning; curPotted = e.potted || 0; curEndTs = ts;
    }
  }
  flush();
  return { timeMs, count };
}

// Aggregiert Spielgeschwindigkeit fuer einen Spieler ueber alle seine
// bestaetigten Matches mit gespeichertem Protokoll: allgemeine Zeit pro
// Spiel (Nicht-14/1) sowie beim 14/1 die Zeit pro versenkter Kugel (und
// daraus hochgerechnet die Zeit pro Rack = 14 Kugeln). Summiert Zeit und
// Einheiten ueber ALLE Matches vor der Division (statt Durchschnitt der
// Einzelschnitte), damit laengere Matches korrekt staerker ins Gewicht
// fallen.
export function computeSpeedStats(matches, playerId) {
  let gameMs = 0, gameCount = 0, matchesWithGames = 0;
  let ballMs = 0, ballCount = 0, matches141 = 0;
  for (const m of matches) {
    if (!m.run_log?.length) continue;
    const mySide = (m.player1_id === playerId || m.player1b_id === playerId) ? 0
      : (m.player2_id === playerId || m.player2b_id === playerId) ? 1 : null;
    if (mySide == null) continue;
    if (isSimpleScoreLog(m.run_log)) {
      const { timeMs, count } = gameSpeedSums(m.run_log, m.discipline);
      if (count > 0) { gameMs += timeMs; gameCount += count; matchesWithGames += 1; }
    } else {
      const sums = ballSpeedSums(m.run_log)[mySide];
      if (sums.balls > 0) { ballMs += sums.timeMs; ballCount += sums.balls; matches141 += 1; }
    }
  }
  return {
    avgGameMs: gameCount > 0 ? gameMs / gameCount : null,
    gameSampleMatches: matchesWithGames,
    avgBallMs: ballCount > 0 ? ballMs / ballCount : null,
    avgRackMs: ballCount > 0 ? (ballMs / ballCount) * 14 : null,
    ballSampleMatches: matches141,
  };
}
