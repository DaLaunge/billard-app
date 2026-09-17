import { useState } from "react";
import { ChevronLeft, Printer, HelpCircle } from "lucide-react";
import { supabase } from "../supabase";
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
export default function MatchProtokollScreen({ match: m, me, toast, onReload, onBack }) {
  const names = [mSide(m, 1), mSide(m, 2)];
  const hasProtocol = !!m.run_log?.length;
  // Nutzer-Feedback: "Wenn kein Protokoll vorhanden ist, gib in der
  // Matchstatistik einen Button mit Fragezeichen an. Beim Klick darauf
  // kannst du angeben, wer die Eingaben gemacht hat und wann. Das kann nur
  // die Turnierleitung sowie ein Admin sein." - Transparenz-Notiz fuer
  // Turnierleitungs-Schnelleingabe-Matches ohne automatisches run_log (die
  // "n/a"-Faelle in TurnierBerichtScreen.jsx). Nur bei Turniermatches
  // moeglich (set_match_manual_entry_note() lehnt alles andere ab) - eine
  // "Turnierleitung" gibt es ausserhalb eines Turniers nicht.
  const canEditNote = !!(m.tournament_id && me && (me.role === "admin" || m.tournament?.organizer_id === me.id));
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(m.manual_entry_note || "");
  const [busy, setBusy] = useState(false);

  const saveNote = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("set_match_manual_entry_note", { p_match_id: m.id, p_note: noteDraft });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    setNoteOpen(false);
    onReload && onReload();
  };

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

        {!hasProtocol && !!m.tournament_id && (
          <div className="protokoll-no-log no-print">
            <p className="hint" style={{ margin: 0 }}>{t("Kein Protokoll vorhanden - wurde vermutlich nachträglich als Ergebnis eingetragen.")}</p>
            {m.manual_entry_note && <p className="protokoll-manual-note">{m.manual_entry_note}</p>}
            {(canEditNote || !m.manual_entry_note) && (
              <button type="button" className="btn ghost small" onClick={() => setNoteOpen((s) => !s)} title={t("Wer hat das eingetragen, und wann?")}>
                <HelpCircle size={15} /> {m.manual_entry_note ? t("Angabe bearbeiten") : t("Angabe hinzufügen")}
              </button>
            )}
            {noteOpen && (
              canEditNote ? (
                <div className="protokoll-manual-note-form">
                  <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={2}
                    placeholder={t("z. B. \"Von Stefan am 17.09. laut Zettel-Mitschrift eingetragen.\"")} />
                  <button className="btn primary small" disabled={busy} onClick={saveNote}>{t("Speichern")}</button>
                </div>
              ) : (
                <p className="hint" style={{ margin: 0 }}>{t("Nur die Turnierleitung oder ein Admin kann das eintragen.")}</p>
              )
            )}
          </div>
        )}

        <MatchProtokollTable match={m} names={names} />

        <button className="btn primary no-print" onClick={() => window.print()}>
          <Printer size={16} /> {t("Als PDF speichern")}
        </button>
      </div>
    </div>
  );
}
