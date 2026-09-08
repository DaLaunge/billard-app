import { useState } from "react";
import { Check, X, ShieldAlert, Pencil, Minus, Plus, UserX } from "lucide-react";
import { t } from "../lib/i18n";

// Kompakter +/- Zaehler fuer die schnelle Turnierleitungs-Eingabe (Melden/
// Korrigieren) - bewusst kein grosser Zaehler wie im normalen MatchScreen,
// der ist fuer die Spieler selbst gedacht (Siegchance-Vorschau, 14/1-
// Protokoll). Der Wert ist direkt eintippbar (nicht nur per +/-), da bei
// 14/1 Endlos ueblich dreistellige Ergebnisse (z.B. 100:98) vorkommen -
// ueber +/- allein waere das viel zu umstaendlich.
// compact: fuer die Inline-Eingabe direkt in einer Turniergraph-Box gedacht
// (TurnierGraph.jsx) - dort muss der Zaehler in dieselbe Boxhoehe passen wie
// die normale Namen-/Ergebnis-Zeile, sonst waechst die Box beim Editieren.
export function ScoreStepper({ value, onChange, compact }) {
  const iconSize = compact ? 11 : 14;
  return (
    <div className={"turnier-stepper" + (compact ? " turnier-stepper--compact" : "")}>
      <button type="button" className="turnier-stepper-btn" onClick={() => onChange(Math.max(0, value - 1))} aria-label="minus"><Minus size={iconSize} /></button>
      <input type="number" inputMode="numeric" min="0" className="turnier-stepper-val-input" value={value}
        onChange={(e) => { const v = parseInt(e.target.value, 10); onChange(Number.isNaN(v) ? 0 : Math.max(0, v)); }} />
      <button type="button" className="turnier-stepper-btn plus" onClick={() => onChange(value + 1)} aria-label="plus"><Plus size={iconSize} /></button>
    </div>
  );
}

// Zentrale Regel-Berechnung fuer EIN Turniermatch (melden/als Turnierleitung
// eintragen/bestaetigen/erzwingen/korrigieren) - von hasTurnierAction(), der
// Komponente selbst UND TurnierGraph.jsx (Inline-Eingabe direkt in der Box)
// genutzt, damit es nur eine einzige gepflegte Kopie dieser Bedingungen gibt.
export function turnierActions(tm, me, isOrganizer, tourStatus, resultsLocked) {
  const confirmed = tm.match?.confirmed;
  const isMyMatch = me.id === tm.player1_id || me.id === tm.player2_id;
  // !tm.void: beide Seiten haben ein doppeltes Nichterscheinen gemeldet
  // bekommen (siehe tournament_mark_no_show()) - dieses Match ist damit
  // endgueltig erledigt (niemand kommt weiter, die Baumstelle wird zum
  // Freilos fuer die Gegenseite), keine weiteren Aktionen mehr moeglich.
  const openSlot = !tm.is_bye && !tm.void && tm.player1_id && tm.player2_id && tm.table_number != null && !tm.match_id && tourStatus === "running";
  const waitingForTable = !tm.is_bye && !tm.void && tm.player1_id && tm.player2_id && tm.table_number == null && !tm.match_id && tourStatus === "running";
  const canReport = openSlot && isMyMatch;
  const canOrganizerReport = openSlot && !isMyMatch && isOrganizer;
  const canConfirm = tm.match_id && !confirmed && tm.match?.reported_by !== me.id && isMyMatch;
  const canForce = tm.match_id && !confirmed && isOrganizer && !isMyMatch;
  // Ausnahmsweise darf die Turnierleitung ein bereits bestaetigtes Ergebnis
  // auch bei einem eigenen Match korrigieren (kleiner Verein, oft selbst
  // Turnierteilnehmer) - ABER nur, wenn sie zusaetzlich Admin ist. Sonst
  // koennte sich eine Turnierleitung, die selbst mitspielt (seit jeder ein
  // Turnier anlegen kann, nicht mehr nur Admins), im eigenen Match die
  // Punktedifferenz nachtraeglich schoenrechnen (der Sieger laesst sich zwar
  // nicht mehr aendern, aber die Elo-Wirkung haengt zusaetzlich vom Punkte-
  // abstand ab, siehe rebuild_elo()/CLAUDE.md) - ohne dass der Gegner das
  // nochmal bestaetigen muesste (Nutzer-Feedback). Serverseitig identisch
  // durchgesetzt in tournament_organizer_edit_match, hier zusaetzlich
  // ausgeblendet, damit der Button gar nicht erst als bedienbar erscheint.
  // resultsLocked: Turnierleitung/Admin hat den Turnierabschluss bestaetigt
  // (siehe tournament_confirm_results/results_confirmed_at) - danach serverseitig
  // ohnehin von tournament_organizer_edit_match abgelehnt, hier zusaetzlich
  // ausgeblendet, damit der Button gar nicht erst als bedienbar erscheint.
  const canEdit = tm.match_id && confirmed && isOrganizer && !resultsLocked && (!isMyMatch || me.role === "admin");
  // Nichterscheinen melden: wie canOrganizerReport (Paarung + Tisch stehen,
  // noch kein Ergebnis) - bewusst AUCH ohne isMyMatch-Ausnahme (anders als
  // canEdit), damit eine mitspielende Turnierleitung nicht einseitig
  // behaupten kann, der eigene Gegner sei nicht erschienen, um sich selbst
  // einen Forfeit-Sieg zu verschaffen (Nutzer-Feedback zur Missbrauchs-
  // vermeidung, gleiche Ueberlegung wie bei canOrganizerReport/canForce).
  const canMarkNoShow = openSlot && isOrganizer && !isMyMatch;
  return { confirmed, isMyMatch, waitingForTable, canReport, canOrganizerReport, canConfirm, canForce, canEdit, canMarkNoShow };
}

// Ermittelt, ob es fuer DIESEN Nutzer bei diesem Turniermatch ueberhaupt
// etwas zu tun gibt - von der Grafikansicht genutzt, um nur tatsaechlich
// bedienbare Boxen klickbar/hervorgehoben zu machen.
export function hasTurnierAction(tm, me, isOrganizer, tourStatus, resultsLocked) {
  const a = turnierActions(tm, me, isOrganizer, tourStatus, resultsLocked);
  return a.canReport || a.canOrganizerReport || a.canConfirm || a.canForce;
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
export default function TurnierMatchActions({ tm, me, isOrganizer, tourStatus, resultsLocked, busyId, nameOf, onOpenMatchScreen, onOrganizerReport, onConfirm, onForceConfirm, onEditMatch, onMarkNoShow }) {
  const [editing, setEditing] = useState(false);
  const [es1, setEs1] = useState(0);
  const [es2, setEs2] = useState(0);
  const [os1, setOs1] = useState(0);
  const [os2, setOs2] = useState(0);
  const [noShowPicking, setNoShowPicking] = useState(false);
  const [absent1, setAbsent1] = useState(false);
  const [absent2, setAbsent2] = useState(false);
  const { confirmed, waitingForTable, canReport, canOrganizerReport, canConfirm, canForce, canEdit, canMarkNoShow } = turnierActions(tm, me, isOrganizer, tourStatus, resultsLocked);
  const manuallyEntered = tm.match?.reported_by && tm.match.reported_by === tm.match.confirmed_by;

  const resetNoShow = () => { setNoShowPicking(false); setAbsent1(false); setAbsent2(false); };
  const submitNoShow = () => {
    const absentIds = [absent1 && tm.player1_id, absent2 && tm.player2_id].filter(Boolean);
    onMarkNoShow(tm, absentIds, resetNoShow);
  };

  const startEdit = () => {
    const sc = tmScores(tm);
    setEs1(sc?.s1 ?? 0); setEs2(sc?.s2 ?? 0);
    setEditing(true);
  };

  return (
    <>
      {tm.void && <span className="hint" style={{ margin: 0 }}>{t("Nicht gewertet - beide nicht erschienen")}</span>}
      {waitingForTable && <span className="hint" style={{ margin: 0 }}>{t("Tisch wird noch zugeteilt")}</span>}
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
      {canMarkNoShow && !noShowPicking && (
        <button className="btn ghost" disabled={busyId === tm.id} onClick={() => setNoShowPicking(true)}>
          <UserX size={15} /> {t("Nichterscheinen melden")}
        </button>
      )}
      {canMarkNoShow && noShowPicking && (
        <div className="turnier-no-show-form" onClick={(e) => e.stopPropagation()}>
          <label className="turnier-no-show-check">
            <input type="checkbox" checked={absent1} onChange={(e) => setAbsent1(e.target.checked)} />
            {t("{name} nicht erschienen", { name: nameOf(tm.player1_id) || t("TBD") })}
          </label>
          <label className="turnier-no-show-check">
            <input type="checkbox" checked={absent2} onChange={(e) => setAbsent2(e.target.checked)} />
            {t("{name} nicht erschienen", { name: nameOf(tm.player2_id) || t("TBD") })}
          </label>
          {absent1 && absent2 && (
            <p className="hint" style={{ margin: "6px 0 4px" }}>{t("Kommen beide nicht, kommt niemand von ihnen weiter - die Stelle im Baum wird zum Freilos.")}</p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn primary" style={{ width: "auto", flex: 1 }}
              disabled={busyId === tm.id || (!absent1 && !absent2)}
              onClick={submitNoShow}>
              {t("Eintragen")}
            </button>
            <button className="btn ghost" style={{ width: "auto", flex: 1 }} disabled={busyId === tm.id} onClick={resetNoShow}>
              {t("Abbrechen")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
