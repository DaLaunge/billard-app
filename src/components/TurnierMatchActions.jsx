import { Check, X, ShieldAlert } from "lucide-react";
import { t } from "../lib/i18n";

// Ermittelt, ob es fuer DIESEN Nutzer bei diesem Turniermatch ueberhaupt
// etwas zu tun gibt - von der Grafikansicht genutzt, um nur tatsaechlich
// bedienbare Boxen klickbar/hervorgehoben zu machen.
export function hasTurnierAction(tm, me, isOrganizer, tourStatus) {
  const confirmed = tm.match?.confirmed;
  const isMyMatch = me.id === tm.player1_id || me.id === tm.player2_id;
  const openSlot = !tm.is_bye && tm.player1_id && tm.player2_id && !tm.match_id && tourStatus === "running";
  const canReport = openSlot && isMyMatch;
  const canOrganizerReport = openSlot && !isMyMatch && isOrganizer;
  const canConfirm = tm.match_id && !confirmed && tm.match?.reported_by !== me.id && isMyMatch;
  const canForce = tm.match_id && !confirmed && isOrganizer && !isMyMatch;
  return canReport || canOrganizerReport || canConfirm || canForce;
}

// Aktionen fuer EIN Turniermatch (Ergebnis melden/als Turnierleitung
// eintragen, bestaetigen/ablehnen, erzwingen) - aus TurnierRasterScreen.jsx
// herausgezogen, damit Listen- und Grafikansicht (TurnierGraph.jsx) exakt
// dieselben Regeln und Buttons verwenden statt zweier gepflegter Kopien.
export default function TurnierMatchActions({ tm, me, isOrganizer, tourStatus, busyId, onOpenMatchScreen, onConfirm, onForceConfirm }) {
  const confirmed = tm.match?.confirmed;
  const isMyMatch = me.id === tm.player1_id || me.id === tm.player2_id;
  const openSlot = !tm.is_bye && tm.player1_id && tm.player2_id && !tm.match_id && tourStatus === "running";
  const canReport = openSlot && isMyMatch;
  const canOrganizerReport = openSlot && !isMyMatch && isOrganizer;
  const canConfirm = tm.match_id && !confirmed && tm.match?.reported_by !== me.id && isMyMatch;
  const canForce = tm.match_id && !confirmed && isOrganizer && !isMyMatch;
  const manuallyEntered = tm.match?.reported_by && tm.match.reported_by === tm.match.confirmed_by;

  return (
    <>
      {tm.match_id && !confirmed && <span className="hint" style={{ margin: 0 }}>{t("Wartet auf Bestätigung ...")}</span>}
      {manuallyEntered && <span className="hint" style={{ margin: 0 }}>{t("Manuell nachgetragen")}</span>}
      {(canReport || canOrganizerReport) && (
        <button className="btn primary" disabled={busyId === tm.id} onClick={() => onOpenMatchScreen(tm, canOrganizerReport)}>
          {canReport ? t("Melden") : t("Als Turnierleitung eintragen")}
        </button>
      )}
      {canConfirm && (
        <div className="confirm-actions">
          <button className="chip-btn ok" disabled={busyId === tm.id} onClick={() => onConfirm(tm, true)}><Check size={15} /> {t("Bestätigen")}</button>
          <button className="chip-btn no" disabled={busyId === tm.id} onClick={() => onConfirm(tm, false)}><X size={15} /> {t("Ablehnen")}</button>
        </div>
      )}
      {canForce && (
        <button className="btn ghost" disabled={busyId === tm.id} onClick={() => onForceConfirm(tm)}>
          <ShieldAlert size={15} /> {t("Als Turnierleitung erzwingen")}
        </button>
      )}
    </>
  );
}
