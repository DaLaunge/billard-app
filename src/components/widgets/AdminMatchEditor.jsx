import { useMemo, useState } from "react";
import { Pencil, Trash2, Check, X, Search } from "lucide-react";
import { supabase } from "../../supabase";
import { t } from "../../lib/i18n";
import { appConfirm } from "../../lib/confirmDialog";
import { fmtDate, mSide } from "../../lib/format";
import { activeDisciplines } from "../../lib/constants";
import { rpcRetry } from "../../lib/rpcRetry";
import AdminFold from "./AdminFold";

// Admin: bereits gespeicherte Matches im Nachhinein aendern (Ergebnis, Disziplin, Datum) oder loeschen.
// Die eigentliche Pruefung "nur Admin" passiert serverseitig (admin_update_match/admin_delete_match,
// supabase/2026-11-04_admin_edit_delete_match.sql); die Komponente wird ausserdem nur fuer Admins gerendert.
const PAGE = 15;

export default function AdminMatchEditor({ matches, toast, onReload }) {
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [editId, setEditId] = useState(null);
  const [ed, setEd] = useState({ s1: "", s2: "", disc: "", date: "" });
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (matches || [])
      .filter((m) => m.confirmed)
      .filter((m) => !needle || `${mSide(m, 1)} ${mSide(m, 2)} ${m.discipline}`.toLowerCase().includes(needle))
      .sort((a, b) => new Date(b.played_at) - new Date(a.played_at));
  }, [matches, q]);

  const locked = (m) => !!(m.tournament_id || m.winner_stays_session_id);
  const hasLog = (m) => !!m.run_log;
  const label = (m) => `${mSide(m, 1)} ${m.score1}:${m.score2} ${mSide(m, 2)} (${t(m.discipline)}, ${fmtDate(m.played_at)})`;

  const startEdit = (m) => {
    setEditId(m.id);
    setEd({ s1: String(m.score1), s2: String(m.score2), disc: m.discipline, date: new Date(m.played_at).toISOString().slice(0, 10) });
  };

  const save = async (m) => {
    const s1 = parseInt(ed.s1, 10), s2 = parseInt(ed.s2, 10);
    if (!(s1 >= 0) || !(s2 >= 0) || s1 === s2) { toast(t("Ungültiges Ergebnis.")); return; }
    if (!ed.date) { toast(t("Datum fehlt.")); return; }
    const sameDay = ed.date === new Date(m.played_at).toISOString().slice(0, 10);
    // Datum unveraendert -> exakten Zeitstempel behalten, sonst Mittag des gewaehlten Tages
    const played = sameDay ? m.played_at : new Date(ed.date + "T12:00:00").toISOString();
    if (!(await appConfirm(t("Match ändern?") + "\n" + label(m) + "\n→ " + `${s1}:${s2} (${t(ed.disc)}, ${fmtDate(played)})` + "\n" + t("Rating und Erfolge werden neu berechnet.")))) return;
    setBusy(true);
    const { error } = await rpcRetry("admin_update_match", {
      p_match: m.id, p_score1: s1, p_score2: s2, p_discipline: ed.disc, p_played_at: played,
    });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    setEditId(null);
    await onReload();
    toast(t("Match geändert."));
  };

  const remove = async (m) => {
    if (!(await appConfirm(t("Dieses Match endgültig löschen?") + "\n" + label(m) + "\n" + t("Rating und Erfolge werden neu berechnet. Das kann nicht rückgängig gemacht werden.")))) return;
    setBusy(true);
    const { error } = await rpcRetry("admin_delete_match", { p_match: m.id });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    if (editId === m.id) setEditId(null);
    await onReload();
    toast(t("Match gelöscht."));
  };

  return (
    <AdminFold id="editmatch" icon={<Pencil size={17} />} title={t("Matches ändern / löschen")}
      info={t("Nur für Admins. Jede Änderung wird protokolliert. Turnier- und Winner-Stays-Matches sind gesperrt.")}>
      <label className="search-field" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Search size={16} />
        <input type="search" value={q} placeholder={t("Spieler oder Disziplin suchen")}
          onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} style={{ flex: 1 }} />
      </label>
      {rows.length === 0 && <p className="hint">{t("Keine Matches gefunden.")}</p>}
      {rows.slice(0, shown).map((m) => (
        <div key={m.id} className="pending-row" style={{ display: "block" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="m-date">{fmtDate(m.played_at).slice(0, 6)}</span>
            <span className="m-txt" style={{ flex: 1, minWidth: 0 }}>
              {mSide(m, 1)} <b>{m.score1}:{m.score2}</b> {mSide(m, 2)} - {t(m.discipline)}
              {locked(m) && <span className="hint"> · {t("gesperrt")}</span>}
            </span>
            {!locked(m) && (
              <div className="confirm-actions">
                <button className="chip-btn" disabled={busy} onClick={() => (editId === m.id ? setEditId(null) : startEdit(m))}
                  aria-label={t("ändern")} title={t("ändern")}><Pencil size={15} /></button>
                <button className="chip-btn no" disabled={busy} onClick={() => remove(m)}
                  aria-label={t("löschen")} title={t("löschen")}><Trash2 size={15} /></button>
              </div>
            )}
          </div>
          {editId === m.id && (
            <div className="add-match" style={{ marginTop: 8 }}>
              {hasLog(m) && <p className="hint" style={{ margin: 0 }}>{t("Match mit Protokoll: Das Ergebnis ist gesperrt, Disziplin und Datum sind änderbar.")}</p>}
              <div className="am-scores">
                <input type="number" inputMode="numeric" min="0" value={ed.s1} disabled={hasLog(m)} onChange={(e) => setEd({ ...ed, s1: e.target.value })} />
                <span>:</span>
                <input type="number" inputMode="numeric" min="0" value={ed.s2} disabled={hasLog(m)} onChange={(e) => setEd({ ...ed, s2: e.target.value })} />
              </div>
              <div className="am-row">
                <select value={ed.disc} onChange={(e) => setEd({ ...ed, disc: e.target.value })}>
                  {[...new Set([...activeDisciplines(), m.discipline])].map((d) => <option key={d} value={d}>{t(d)}</option>)}
                </select>
                <input type="date" value={ed.date} onChange={(e) => setEd({ ...ed, date: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn primary small" disabled={busy} onClick={() => save(m)}>{t("Speichern")} <Check size={16} /></button>
                <button className="btn ghost small" disabled={busy} onClick={() => setEditId(null)}>{t("Abbrechen")} <X size={16} /></button>
              </div>
            </div>
          )}
        </div>
      ))}
      {rows.length > shown && (
        <button className="btn ghost small" onClick={() => setShown(shown + PAGE)}>{t("Mehr anzeigen")}</button>
      )}
    </AdminFold>
  );
}
