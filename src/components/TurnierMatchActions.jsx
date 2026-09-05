import { useState } from "react";
import { Check, X, ShieldAlert, Pencil, Minus, Plus } from "lucide-react";
import { t } from "../lib/i18n";

// Kompakter +/- Zaehler fuer die schnelle Turnierleitungs-Eingabe (Melden/
// Korrigieren) - bewusst kein grosser Zaehler wie im normalen MatchScreen,
// der ist fuer die Spieler selbst gedacht (Siegchance-Vorschau, 14/1-
// Protokoll). Der Wert ist direkt eintippbar (nicht nur per +/-), da bei
// 14/1 Endlos ueblich dreistellige Ergebnisse (z.B. 100:98) vorkommen -
// ueber +/- allein waere das viel zu umstaendlich.
function ScoreStepper({ value, onChange }) {
  return (
    <div className="turnier-stepper">
      <button type="button" className="turnier-stepper-btn" onClick={() => onChange(Math.max(0, value - 1))} aria-label="minus"><Minus size={14} /></button>
      <input type="number" inputMode="numeric" min="0" className="turnier-stepper-val-input" value={value}
        onChange={(e) => { const v = parseInt(e.target.value, 10); onChange(Number.isNaN(v) ? 0 : Math.max(0, v)); }} />
      <button type="button" className="turnier-stepper-btn plus" onClick={() => onChange(value + 1)} aria-label="plus"><Plus size={14} /></button>
    </div>
  );
}

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
export default function TurnierMatchActions({ tm, me, isOrganizer, tourStatus, busyId, onOpenMatchScreen, onOrganizerReport, onConfirm, onForceConfirm, onEditMatch }) {
  const [editing, setEditing] = useState(false);
  const [es1, setEs1] = useState(0);
  const [es2, setEs2] = useState(0);
  const [os1, setOs1] = useState(0);
  const [os2, setOs2] = useState(0);
  const confirmed = tm.match?.confirmed;
  const isMyMatch = me.id === tm.player1_id || me.id === tm.player2_id;
  const openSlot = !tm.is_bye && tm.player1_id && tm.player2_id && !tm.match_id && tourStatus === "running";
  const canReport = openSlot && isMyMatch;
  const canOrganizerReport = openSlot && !isMyMatch && isOrganizer;
  const canConfirm = tm.match_id && !confirmed && tm.match?.reported_by !== me.id && isMyMatch;
  const canForce = tm.match_id && !confirmed && isOrganizer && !isMyMatch;
  // bewusst OHNE "!isMyMatch" - anders als bei Erzwingen/Turnierleitungs-Meldung
  // darf die Turnierleitung ein bereits bestaetigtes Ergebnis auch bei einem
  // eigenen Match korrigieren (kleiner Verein, oft selbst Turnierteilnehmer -
  // sonst gaebe es fuer einen Tippfehler im eigenen Match niemanden zum Fixen).
  const canEdit = tm.match_id && confirmed && isOrganizer;
  const manuallyEntered = tm.match?.reported_by && tm.match.reported_by === tm.match.confirmed_by;

  const startEdit = () => {
    const sc = tmScores(tm);
    setEs1(sc?.s1 ?? 0); setEs2(sc?.s2 ?? 0);
    setEditing(true);
  };

  return (
    <>
      {tm.match_id && !confirmed && <span className="hint" style={{ margin: 0 }}>{t("Wartet auf Bestätigung ...")}</span>}
      {manuallyEntered && <span className="hint" style={{ margin: 0 }}>{t("Manuell nachgetragen")}</span>}
      {canReport && (
        <button className="btn primary" disabled={busyId === tm.id} onClick={() => onOpenMatchScreen(tm)}>
          {t("Melden")}
        </button>
      )}
      {canOrganizerReport && (
        <div className="turnier-quick-score">
          <ScoreStepper value={os1} onChange={setOs1} />
          <span>:</span>
          <ScoreStepper value={os2} onChange={setOs2} />
          <button className="btn primary" disabled={busyId === tm.id || os1 === os2}
            onClick={() => onOrganizerReport(tm, os1, os2, () => { setOs1(0); setOs2(0); })}>
            {t("Eintragen")}
          </button>
        </div>
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
        <div className="turnier-quick-score">
          <ScoreStepper value={es1} onChange={setEs1} />
          <span>:</span>
          <ScoreStepper value={es2} onChange={setEs2} />
          <button className="btn primary" disabled={busyId === tm.id || es1 === es2}
            onClick={() => onEditMatch(tm, es1, es2, () => setEditing(false))}>
            {t("Speichern")}
          </button>
          <button className="btn ghost" disabled={busyId === tm.id} onClick={() => setEditing(false)}>{t("Abbrechen")}</button>
        </div>
      )}
    </>
  );
}
