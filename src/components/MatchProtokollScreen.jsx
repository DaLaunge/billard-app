import { ChevronLeft, Printer } from "lucide-react";
import { t } from "../lib/i18n";
import { fmtDateTime, mSide } from "../lib/format";
import MatchProtokollTable from "./MatchProtokollTable";
import TournamentFlag from "./TournamentFlag";

// Nachtraegliche Ansicht des gespeicherten Match-Protokolls, als echte
// Tabelle (nicht als Fliesstext) - die eigentliche Tabellen-Logik steckt in
// MatchProtokollTable.jsx (auch vom "Vollstaendig"-Modus des Turnierberichts
// genutzt, siehe TurnierBerichtScreen.jsx). "Als PDF speichern" nutzt den
// nativen Druckdialog des Browsers (auf Handy wie PC verfuegbar) statt einer
// eigenen PDF-Bibliothek - siehe @media print in App.css.
export default function MatchProtokollScreen({ match: m, onBack }) {
  const names = [mSide(m, 1), mSide(m, 2)];

  return (
    <div className="screen protokoll-screen">
      <header className="screen-head with-back no-print">
        <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
        <h2>{t("Protokoll")}</h2>
      </header>

      <div className="protokoll-doc">
        <div className="protokoll-head">
          <h1>{names[0]} <span className="protokoll-score">{m.score1} : {m.score2}</span> {names[1]}</h1>
          <p className="protokoll-meta">{t(m.discipline)} · {fmtDateTime(m.played_at)} <TournamentFlag match={m} /></p>
        </div>

        <MatchProtokollTable match={m} names={names} />

        <button className="btn primary no-print" onClick={() => window.print()}>
          <Printer size={16} /> {t("Als PDF speichern")}
        </button>
      </div>
    </div>
  );
}
