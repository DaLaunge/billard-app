import { useState } from "react";
import { t } from "../lib/i18n";

const formatLabel = (f) => (f === "ko" ? t("K.O.") : f === "double_ko" ? t("Doppel-K.O.") : t("Jeder gegen jeden"));

// Klickbares Turnier-Flag (Nutzer-Feedback: "Das Turnierflag möchte ich
// überall anklickbar machen. Es soll den Modus des Turniers über ein Popup
// anzeigen.") - zeigt per Popup, aus welchem Turnier bzw. welcher
// Winner-Stays-Runde ein Match stammt. match.tournament/match.winner_stays_session
// kommen als Inline-Join aus der matches-Abfrage in App.jsx; ist keins von
// beiden gesetzt, rendert die Komponente nichts.
export default function TournamentFlag({ match }) {
  const [open, setOpen] = useState(false);
  const tour = match.tournament;
  const ws = match.winner_stays_session;
  if (!tour && !ws) return null;
  const name = tour ? tour.name : ws.name;
  const mode = tour ? formatLabel(tour.format) : `${t("Winner Stays")} · ${t(ws.is_doubles ? "Doppel" : "Einzel")}`;

  return (
    <>
      <button type="button" className="tournament-flag" onClick={() => setOpen(true)}
        aria-label={t("Turnierinfo")} title={t("Turnierinfo")}>🏆</button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{name}</h3>
            <p>{mode}</p>
            <button className="btn primary" onClick={() => setOpen(false)}>{t("Schließen")}</button>
          </div>
        </div>
      )}
    </>
  );
}
