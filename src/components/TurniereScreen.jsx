import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Trophy, X } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { fmtDate } from "../lib/format";
import { DEFAULT_DISCIPLINES } from "../lib/constants";
import PlayerMultiPicker from "./PlayerMultiPicker";

const formatLabel = (f) => (f === "ko" ? t("K.O.") : f === "double_ko" ? t("Doppel-K.O.") : t("Jeder gegen jeden"));
const statusLabel = (s) => (s === "finished" ? t("beendet") : s === "cancelled" ? t("abgebrochen") : t("läuft"));

// Turnierverwaltung: Liste laufender/vergangener Turniere + Formular zum
// Anlegen. Anlegen ist aktuell auf Admins beschraenkt (Stefans Vorgabe zur
// Missbrauchsvermeidung, solange der Modus in der Erprobung ist - siehe
// supabase/2026-09-04_tournament_admin_only.sql, gilt bis er es widerruft).
// Ansehen/Mitspielen bleibt fuer alle offen.
export default function TurniereScreen({ me, players, matches, colorOf, badgeOf, photoOf, toast, onOpenTournament, onBack }) {
  const [tournaments, setTournaments] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all"); // all | running | done - schnelles Finden bereits gespielter Turniere
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [format, setFormat] = useState("ko");
  const [discipline, setDiscipline] = useState(DEFAULT_DISCIPLINES[0]);
  const [selected, setSelected] = useState([]);
  const [tableMode, setTableMode] = useState("range");
  const [tableFrom, setTableFrom] = useState("");
  const [tableTo, setTableTo] = useState("");
  const [tableList, setTableList] = useState("");
  const [busy, setBusy] = useState(false);
  // Playoff-Groesse: bei round_robin optional (null = wie bisher nur
  // Tabelle, kein Finale), bei double_ko immer gesetzt (2 = heutiges
  // Standardverhalten: Gewinner-/Verliererbaum laufen komplett durch).
  const [playoffSize, setPlayoffSize] = useState(null);
  const [doubleRoundRobin, setDoubleRoundRobin] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("tournaments")
      .select("id, name, format, discipline, status, created_at")
      .order("created_at", { ascending: false });
    if (!error) setTournaments(data || []);
  };
  useEffect(() => { load(); }, []);

  const togglePlayer = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const chooseFormat = (f) => {
    setFormat(f);
    setDoubleRoundRobin(false);
    setPlayoffSize(f === "double_ko" ? 2 : null);
  };

  const parseTables = () => {
    if (tableMode === "range") {
      const from = parseInt(tableFrom, 10), to = parseInt(tableTo, 10);
      if (!from || !to || from > to) return null;
      const arr = [];
      for (let i = from; i <= to; i++) arr.push(i);
      return arr;
    }
    const arr = tableList.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n) && n > 0);
    return arr.length ? arr : null;
  };

  const create = async () => {
    if (!name.trim()) { toast(t("Turniername fehlt.")); return; }
    if (format === "round_robin" && selected.length < 3) {
      toast(t("Jeder-gegen-jeden braucht mindestens 3 Teilnehmer.")); return;
    }
    if (format !== "round_robin" && selected.length < 2) {
      toast(t("Mindestens 2 Teilnehmer nötig.")); return;
    }
    const tables = parseTables();
    if (!tables) { toast(t("Bitte gültige Tischnummern angeben.")); return; }
    if (playoffSize != null && playoffSize > selected.length) {
      toast(t("Playoff-Größe darf nicht größer als die Teilnehmerzahl sein.")); return;
    }
    if (format === "double_ko" && playoffSize > 2 && selected.length < playoffSize * 2) {
      toast(t("Für diese Playoff-Größe werden mindestens {n} Teilnehmer benötigt.", { n: playoffSize * 2 })); return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("create_tournament", {
      p_name: name.trim(), p_format: format, p_discipline: discipline,
      p_player_ids: selected, p_table_numbers: tables,
      p_playoff_size: playoffSize, p_double_round_robin: doubleRoundRobin,
    });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Turnier erstellt – Raster wird ausgelost."));
    setShowForm(false);
    setName(""); setSelected([]); setTableFrom(""); setTableTo(""); setTableList("");
    await load();
    onOpenTournament(data.id);
  };

  return (
    <div className="screen">
      <div className="turnier-layout">
      <header className="screen-head with-back">
        <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
        <h2>{t("Turniere")}</h2>
      </header>

      <section className="stat-block">
        <div className="stat-block-head">
          <h3><Trophy size={17} /> {t("Turniere")}</h3>
          {me?.role === "admin" && (
            <button className="btn ghost" onClick={() => setShowForm((s) => !s)}>
              {showForm ? <><X size={15} /> {t("Abbrechen")}</> : <><Plus size={15} /> {t("Neues Turnier")}</>}
            </button>
          )}
        </div>

        {me?.role !== "admin" && (
          <p className="hint" style={{ marginTop: 0 }}>{t("Turniere anlegen ist aktuell nur für Admins möglich.")}</p>
        )}

        {showForm && me?.role === "admin" && (
          <div className="turnier-form" style={{ marginBottom: 16 }}>
            <input type="text" placeholder={t("Turniername")} value={name} onChange={(e) => setName(e.target.value)} />

            <p className="hint" style={{ marginBottom: 4 }}>{t("Format")}</p>
            <div className="chips small">
              <button className={"chip" + (format === "ko" ? " active" : "")} onClick={() => chooseFormat("ko")}>{t("K.O.")}</button>
              <button className={"chip" + (format === "double_ko" ? " active" : "")} onClick={() => chooseFormat("double_ko")}>{t("Doppel-K.O.")}</button>
              <button className={"chip" + (format === "round_robin" ? " active" : "")} onClick={() => chooseFormat("round_robin")}>{t("Jeder gegen jeden")}</button>
            </div>

            {format === "round_robin" && (
              <>
                <p className="hint" style={{ marginBottom: 4 }}>{t("Spielrunden")}</p>
                <div className="chips small">
                  <button className={"chip" + (!doubleRoundRobin ? " active" : "")} onClick={() => setDoubleRoundRobin(false)}>{t("Einfach")}</button>
                  <button className={"chip" + (doubleRoundRobin ? " active" : "")} onClick={() => setDoubleRoundRobin(true)}>{t("Hin & Rück")}</button>
                </div>
              </>
            )}

            {format !== "ko" && (
              <>
                <p className="hint" style={{ marginBottom: 4 }}>{format === "double_ko" ? t("Finalrunde") : t("Abschluss")}</p>
                <div className="chips small">
                  {format === "round_robin" && (
                    <button className={"chip" + (playoffSize == null ? " active" : "")} onClick={() => setPlayoffSize(null)}>{t("Nur Tabelle")}</button>
                  )}
                  <button className={"chip" + (playoffSize === 2 ? " active" : "")} onClick={() => setPlayoffSize(2)}>{t("Finale (Top 2)")}</button>
                  <button className={"chip" + (playoffSize === 4 ? " active" : "")} onClick={() => setPlayoffSize(4)}>{t("Halbfinale (Top 4)")}</button>
                  <button className={"chip" + (playoffSize === 8 ? " active" : "")} onClick={() => setPlayoffSize(8)}>{t("Viertelfinale (Top 8)")}</button>
                </div>
              </>
            )}

            <p className="hint" style={{ marginBottom: 4 }}>{t("Disziplin")}</p>
            <div className="chips small">
              {DEFAULT_DISCIPLINES.map((d) => (
                <button key={d} className={"chip" + (discipline === d ? " active" : "")} onClick={() => setDiscipline(d)}>{t(d)}</button>
              ))}
            </div>

            <p className="hint" style={{ marginBottom: 4 }}>{t("Tische")}</p>
            <div className="chips small">
              <button className={"chip" + (tableMode === "range" ? " active" : "")} onClick={() => setTableMode("range")}>{t("Von–Bis")}</button>
              <button className={"chip" + (tableMode === "list" ? " active" : "")} onClick={() => setTableMode("list")}>{t("Liste")}</button>
            </div>
            {tableMode === "range" ? (
              <div className="turnier-score-inputs">
                <input type="number" inputMode="numeric" min="1" placeholder={t("von")} value={tableFrom} onChange={(e) => setTableFrom(e.target.value)} />
                <span>–</span>
                <input type="number" inputMode="numeric" min="1" placeholder={t("bis")} value={tableTo} onChange={(e) => setTableTo(e.target.value)} />
              </div>
            ) : (
              <input type="text" placeholder={t("z. B. 1, 3, 5")} value={tableList} onChange={(e) => setTableList(e.target.value)} />
            )}

            <p className="hint" style={{ marginBottom: 4, marginTop: 10 }}>{t("Teilnehmer")} ({selected.length})</p>
            <PlayerMultiPicker players={players} matches={matches} me={me} selected={selected} onToggle={togglePlayer}
              colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} />

            <button className="btn primary" disabled={busy} onClick={create}>
              {busy ? t("Lege an …") : <><Trophy size={16} /> {t("Turnier auslosen")}</>}
            </button>
          </div>
        )}

        {tournaments != null && tournaments.length > 0 && (
          <div className="chips small" style={{ marginBottom: 10 }}>
            <button className={"chip" + (statusFilter === "all" ? " active" : "")} onClick={() => setStatusFilter("all")}>{t("Alle")}</button>
            <button className={"chip" + (statusFilter === "running" ? " active" : "")} onClick={() => setStatusFilter("running")}>{t("Läuft")}</button>
            <button className={"chip" + (statusFilter === "done" ? " active" : "")} onClick={() => setStatusFilter("done")}>{t("Beendet")}</button>
          </div>
        )}

        {tournaments == null ? (
          <p className="hint">{t("Lade ...")}</p>
        ) : tournaments.length === 0 ? (
          <p className="hint">{t("Noch keine Turniere.")}</p>
        ) : (() => {
          const filtered = tournaments.filter((tr) =>
            statusFilter === "all" ? true : statusFilter === "running" ? tr.status === "running" : tr.status !== "running");
          return filtered.length === 0 ? (
            <p className="hint">{t("Keine Turniere in diesem Filter.")}</p>
          ) : filtered.map((tr) => (
            <button key={tr.id} className="turnier-list-row" onClick={() => onOpenTournament(tr.id)}>
              <span className="turnier-list-row-main">
                <b>{tr.name}</b>
                <span className="turnier-list-row-meta">{formatLabel(tr.format)} · {t(tr.discipline)} · {statusLabel(tr.status)} · {fmtDate(tr.created_at)}</span>
              </span>
              <ChevronRight size={20} className="turnier-list-row-chevron" />
            </button>
          ));
        })()}
      </section>
      </div>
    </div>
  );
}
