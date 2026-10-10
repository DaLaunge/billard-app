import { isSimpleScoreLog, buildProtocolRows, splitProtocolRowsByPlayer,
  matchDurationMs, matchPlayTimeMs, matchUnitCount } from "./runLog";

/* Abgeleitete Werte des gespeicherten Match-Protokolls - die EINE Rechnung hinter
   der Bildschirm-Tabelle (MatchProtokollTable.jsx) und dem PDF (pdfExport.js /
   turnierBerichtPdf.js), damit beide dieselben Zahlen zeigen.

   Erklaerungen zu den einzelnen Werten stehen an den Stellen, an denen sie
   angezeigt werden (Gesamtdauer vs. reine Spielzeit bei Winner Stays, "Ø pro
   Spiel/Aufnahme" = Gesamtdauer bzw. Spielzeit geteilt durch die Anzahl). */
export function protocolData(m) {
  const simple = isSimpleScoreLog(m.run_log);
  const [rowsA, rowsB] = simple ? [[], []] : splitProtocolRowsByPlayer(buildProtocolRows(m.run_log));
  const maxRows = Math.max(rowsA.length, rowsB.length);
  const hasTime = simple ? m.run_log?.[0]?.[2] != null : m.run_log?.[0]?.ts != null;
  const duration = hasTime ? matchDurationMs(m.run_log) : null;
  const playTime = hasTime ? matchPlayTimeMs(m.run_log) : null;
  const units = hasTime ? matchUnitCount(m.run_log) : null;
  const avgBase = playTime ?? duration;
  const avgUnit = hasTime && units > 0 && avgBase != null ? avgBase / units : null;
  return { simple, rowsA, rowsB, maxRows, hasTime, duration, playTime, units, avgUnit };
}
