import { ChevronLeft, Printer } from "lucide-react";
import { t } from "../lib/i18n";
import { fmtDateTime, mSide } from "../lib/format";
import { runLogEntryParts, isSimpleScoreLog, buildProtocolRows, splitProtocolRowsByPlayer } from "../lib/runLog";

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

// Nachtraegliche Ansicht des gespeicherten Match-Protokolls, als echte
// Tabelle (nicht als Fliesstext) - jede Spalte bedeutet immer dasselbe,
// Fouls/Fehler/Safes/Serien sind auf einen Blick erkennbar. Beim 14/1
// bekommt jeder Spieler seinen eigenen Tabellenbereich (links/rechts)
// statt abwechselnder Zeilen - eine Zeile ist damit "Aufnahme n" fuer
// beide Spieler gleichzeitig. "Als PDF speichern" nutzt den nativen
// Druckdialog des Browsers (auf Handy wie PC verfuegbar) statt einer
// eigenen PDF-Bibliothek - siehe @media print in App.css.
export default function MatchProtokollScreen({ match: m, onBack }) {
  const names = [mSide(m, 1), mSide(m, 2)];
  const simple = isSimpleScoreLog(m.run_log);
  const [rowsA, rowsB] = simple ? [[], []] : splitProtocolRowsByPlayer(buildProtocolRows(m.run_log));
  const maxRows = Math.max(rowsA.length, rowsB.length);

  return (
    <div className="screen protokoll-screen">
      <header className="screen-head with-back no-print">
        <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
        <h2>{t("Protokoll")}</h2>
      </header>

      <div className="protokoll-doc">
        <div className="protokoll-head">
          <h1>{names[0]} <span className="protokoll-score">{m.score1} : {m.score2}</span> {names[1]}</h1>
          <p className="protokoll-meta">{t(m.discipline)} · {fmtDateTime(m.played_at)}</p>
        </div>

        {simple ? (
          <div className="protokoll-table-wrap">
            <table className="protokoll-table">
              <thead><tr><th>#</th><th>{t("Stand")}</th></tr></thead>
              <tbody>
                {m.run_log.map(([a, b], i) => (
                  <tr key={i}><td>{i}</td><td className="protokoll-score-cell">{a}:{b}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="protokoll-table-wrap">
            <table className="protokoll-table protokoll-table-141">
              <thead>
                <tr>
                  <th rowSpan={2}>{t("Aufnahme")}</th>
                  <th colSpan={4}>{names[0]}</th>
                  <th colSpan={4} className="protokoll-divider">{names[1]}</th>
                </tr>
                <tr>
                  <th>{t("Ereignis")}</th><th>{t("Serie")}</th><th>{t("Schnitt")}</th><th>{t("Punkte")}</th>
                  <th className="protokoll-divider">{t("Ereignis")}</th><th>{t("Serie")}</th><th>{t("Schnitt")}</th><th>{t("Punkte")}</th>
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

        <button className="btn primary no-print" onClick={() => window.print()}>
          <Printer size={16} /> {t("Als PDF speichern")}
        </button>
      </div>
    </div>
  );
}
