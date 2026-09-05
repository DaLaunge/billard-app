import { useState } from "react";
import { Check, X, ShieldAlert, Pencil } from "lucide-react";
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

// tm.match.score1/score2 stehen in der Reihenfolge von matches.player1_id/
// player2_id - die kann von tournament_matches.player1_id/player2_id
// abweichen (tournament_report_match traegt den Melder immer als player1
// in matches ein, unabhaengig von seiner Rolle im Turnier). Diese Funktion
// liefert die Punkte immer in tm.player1/tm.player2-Reihenfolge, damit
// Anzeige und Korrektur-Formular nicht die Spieler vertauschen.
export function tmScores(tm) {
  if (!tm.match) return null;
  const isP1 = tm.match.player1_id === tm.player1_id;
  return isP1 ? { s1: tm.match.score1, s2: tm.match.score2 } : { s1: tm.match.score2, s2: tm.match.score1 };
}

// Aktionen fuer EIN Turniermatch (Ergebnis melden/als Turnierleitung
// eintragen, bestaetigen/ablehnen, erzwingen) - aus TurnierRasterScreen.jsx
// herausgezogen, damit Listen- und Grafikansicht (TurnierGraph.jsx) exakt
// dieselben Regeln und Buttons verwenden statt zweier gepflegter Kopien.
export default function TurnierMatchActions({ tm, me, isOrganizer, tourStatus, busyId, onOpenMatchScreen, onConfirm, onForceConfirm, onEditMatch }) {
  const [editing, setEditing] = useState(false);
  const [es1, setEs1] = useState("");
  const [es2, setEs2] = useState("");
  const confirmed = tm.match?.confirmed;
  const isMyMatch = me.id === tm.player1_id || me.id === tm.player2_id;
  const openSlot = !tm.is_bye && tm.player1_id && tm.player2_id && !tm.match_id && tourStatus === "running";
  const canReport = openSlot && isMyMatch;
  const canOrganizerReport = openSlot && !isMyMatch && isOrganizer;
  const canConfirm = tm.match_id && !confirmed && tm.match?.reported_by !== me.id && isMyMatch;
  const canForce = tm.match_id && !confirmed && isOrganizer && !isMyMatch;
  const canEdit = tm.match_id && confirmed && isOrganizer && !isMyMatch;
  const manuallyEntered = tm.match?.reported_by && tm.match.reported_by === tm.match.confirmed_by;

  const startEdit = () => {
    const sc = tmScores(tm);
    setEs1(String(sc?.s1 ?? "")); setEs2(String(sc?.s2 ?? ""));
    setEditing(true);
  };
  const saveEdit = () => {
    const s1 = parseInt(es1, 10), s2 = parseInt(es2, 10);
    if (Number.isNaN(s1) || Number.isNaN(s2) || s1 < 0 || s2 < 0 || s1 === s2) return;
    onEditMatch(tm, s1, s2, () => setEditing(false));
  };

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
      {canEdit && !editing && (
        <button className="btn ghost" disabled={busyId === tm.id} onClick={startEdit}>
          <Pencil size={15} /> {t("Ergebnis korrigieren")}
        </button>
      )}
      {canEdit && editing && (
        <div className="turnier-score-inputs">
          <input type="number" inputMode="numeric" min="0" value={es1} onChange={(e) => setEs1(e.target.value)} />
          <span>:</span>
          <input type="number" inputMode="numeric" min="0" value={es2} onChange={(e) => setEs2(e.target.value)} />
          <button className="btn primary" disabled={busyId === tm.id} onClick={saveEdit}>{t("Speichern")}</button>
          <button className="btn ghost" disabled={busyId === tm.id} onClick={() => setEditing(false)}>{t("Abbrechen")}</button>
        </div>
      )}
    </>
  );
}
