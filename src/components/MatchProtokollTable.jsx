import { t } from "../lib/i18n";
import { fmtTime, fmtDuration } from "../lib/format";
import { runLogEntryParts, isSimpleScoreLog, buildProtocolRows, splitProtocolRowsByPlayer,
  matchDurationMs, matchUnitCount, avgUnitDurationMs } from "../lib/runLog";

// Eine Tabellenzeile je Spieler+Seite: entweder die vier Datenzellen
// (Ereignis/Serie/Schnitt/Punkte) oder leer, wenn dieser Spieler diese
// Aufnahme-Nummer (noch) nicht erreicht hat.
function SideCells({ row, divider }) {
  if (!row) return <><td className={divider ? "protokoll-divider" : undefined}></td><td></td><td></td><td></td></>;
  const p = runLogEntryParts(row);
  return (
    <>
      <td className={divider ? "protokoll-divider" : undefined}>
        <span className={"protokoll-tag t-" + p.type}>{p.action}</span>
      </td>
      <td>{p.run ?? "–"}</td>
      <td>{row.avg != null ? row.avg.toFixed(1) : "–"}</td>
      <td className="protokoll-score-cell">{p.score}</td>
    </>
  );
}

// Volles Rack-fuer-Rack-Protokoll EINES Matches als Tabelle (nicht als
// Fliesstext) - aus MatchProtokollScreen.jsx herausgezogen, damit sowohl die
// einzelne Match-Protokoll-Ansicht als auch der "Vollstaendig"-Modus im
// Turnierbericht (TurnierBerichtScreen.jsx) dieselbe Tabellen-Logik nutzen
// statt sie zweimal zu pflegen. Beim 14/1 bekommt jeder Spieler seinen
// eigenen Tabellenbereich (links/rechts) statt abwechselnder Zeilen - eine
// Zeile ist damit "Aufnahme n" fuer beide Spieler gleichzeitig.
export default function MatchProtokollTable({ match: m, names }) {
  const simple = isSimpleScoreLog(m.run_log);
  const [rowsA, rowsB] = simple ? [[], []] : splitProtocolRowsByPlayer(buildProtocolRows(m.run_log));
  const maxRows = Math.max(rowsA.length, rowsB.length);
  const hasTime = simple ? m.run_log?.[0]?.[2] != null : m.run_log?.[0]?.ts != null;
  const duration = hasTime ? matchDurationMs(m.run_log) : null;
  const units = hasTime ? matchUnitCount(m.run_log) : null;
  const avgUnit = hasTime ? avgUnitDurationMs(m.run_log, m.discipline) : null;

  return (
    <>
      {simple ? (
        <div className="protokoll-table-wrap">
          <table className="protokoll-table">
            <thead><tr><th>#</th><th>{t("Stand")}</th>{hasTime && <th>{t("Zeit")}</th>}</tr></thead>
            <tbody>
              {m.run_log.map(([a, b, ts], i) => (
                <tr key={i}>
                  <td>{i}</td>
                  <td className="protokoll-score-cell">{a}:{b}</td>
                  {hasTime && <td>{fmtTime(ts)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="protokoll-table-wrap">
          <table className="protokoll-table protokoll-table-141">
            <thead>
              <tr>
                <th rowSpan={2} title={t("Aufnahme")}>#</th>
                <th colSpan={4}>{names[0]}</th>
                <th colSpan={4} className="protokoll-divider">{names[1]}</th>
              </tr>
              <tr>
                <th>{t("Ereignis")}</th><th>{t("Serie")}</th><th title={t("Schnitt")}>Ø</th><th title={t("Punkte")}>{t("Pkt.")}</th>
                <th className="protokoll-divider">{t("Ereignis")}</th><th>{t("Serie")}</th><th title={t("Schnitt")}>Ø</th><th title={t("Punkte")}>{t("Pkt.")}</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRows }, (_, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <SideCells row={rowsA[i]} />
                  <SideCells row={rowsB[i]} divider />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {duration != null && (
        <div className="protokoll-duration">
          <span>{t("Gesamtdauer")}: <b>{fmtDuration(duration)}</b></span>
          {units > 0 && (
            <span>
              {simple ? t("Ø pro Spiel") : t("Ø pro Aufnahme")}: <b>{fmtDuration(avgUnit)}</b>
            </span>
          )}
        </div>
      )}
    </>
  );
}
