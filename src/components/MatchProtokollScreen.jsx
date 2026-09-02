import { ChevronLeft, Printer } from "lucide-react";
import { t } from "../lib/i18n";
import { fmtDateTime, mSide } from "../lib/format";
import { collapseRunLog, runLogEntryParts, isSimpleScoreLog } from "../lib/runLog";

// Nachtraegliche Ansicht des gespeicherten Match-Protokolls, als echte
// Tabelle (nicht als Fliesstext) - jede Spalte bedeutet immer dasselbe,
// Fouls/Fehler/Safes/Serien sind auf einen Blick erkennbar. "Als PDF
// speichern" nutzt den nativen Druckdialog des Browsers (auf Handy wie PC
// verfuegbar) statt einer eigenen PDF-Bibliothek - siehe @media print in
// App.css fuer die druckfreundliche Darstellung.
export default function MatchProtokollScreen({ match: m, onBack }) {
  const names = [mSide(m, 1), mSide(m, 2)];
  const simple = isSimpleScoreLog(m.run_log);

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
                  <th>{t("Aufnahme")}</th>
                  <th>{t("Spieler")}</th>
                  <th>{t("Ereignis")}</th>
                  <th>{t("Serie")}</th>
                  <th>{t("Punkte")}</th>
                </tr>
              </thead>
              <tbody>
                {collapseRunLog(m.run_log).map((e, i) => {
                  const p = runLogEntryParts(e);
                  return (
                    <tr key={i} className={"pl-" + e.player}>
                      <td>{p.inning}</td>
                      <td>{names[e.player]}</td>
                      <td><span className={"protokoll-tag t-" + p.type}>{p.action}</span></td>
                      <td>{p.run ?? "–"}</td>
                      <td className="protokoll-score-cell">{p.score}</td>
                    </tr>
                  );
                })}
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
