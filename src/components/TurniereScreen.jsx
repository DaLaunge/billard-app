import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, Trophy, X, Repeat } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { fmtDate } from "../lib/format";
import { DEFAULT_DISCIPLINES, DISC_LABEL } from "../lib/constants";
import ImprintFooter from "./widgets/ImprintFooter";

const formatLabel = (item) =>
  item._kind === "winnerstays"
    ? `${t("Winner Stays")} · ${t(item.is_doubles ? "Doppel" : "Einzel")}`
    : item.format === "ko" ? t("K.O.") : item.format === "double_ko" ? t("Doppel-K.O.") : t("Jeder gegen jeden");
const statusLabel = (s) => (s === "finished" ? t("beendet") : s === "setup" ? t("Anmeldung offen") : s === "cancelled" ? t("abgebrochen") : t("läuft"));

// Turnierverwaltung: EINE Liste + EIN Anlegen-Formular fuer beide
// Strukturen (Nutzer-Feedback: "Winner stays sollte als Turniermodus so
// wie KO und Doppel KO und Jeder gegen jeden auswaehlbar sein" - urspruenglich
// als eigener Umschalter/eigene Liste gebaut, das fand der Nutzer aber nicht
// intuitiv). "Winner Stays" ist im Formular ein vierter Format-Chip neben
// K.O./Doppel-K.O./Jeder gegen jeden; abhaengig davon werden andere Felder
// gezeigt (Einzel/Doppel + optional EIN Tisch statt Playoff-Groesse +
// mehrerer Tische) und eine andere RPC gerufen. Das Datenmodell bleibt
// bewusst getrennt (tournaments/tournament_matches vs. winner_stays_*
// Tabellen, siehe WinnerStaysScreen.jsx) - keine Bracket-Struktur, sondern
// eine dynamische Warteschlange - nur die Oberflaeche tut so, als waere es
// ein einziges Menü.
export default function TurniereScreen({ toast, onOpenTournament, onOpenWinnerStays, onBack }) {
  const [tournaments, setTournaments] = useState(null);
  const [wsSessions, setWsSessions] = useState(null);
  // Default "running" statt "all" (Nutzer-Feedback) - beim Oeffnen der
  // Turnierliste sind die AKTUELL laufenden Turniere fast immer das
  // Relevante, nicht die komplette Historie.
  const [statusFilter, setStatusFilter] = useState("running"); // all | running | done
  const [query, setQuery] = useState(""); // Suche nach Name
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [format, setFormat] = useState("ko"); // "ko" | "double_ko" | "round_robin" | "winner_stays"
  const [discipline, setDiscipline] = useState(DEFAULT_DISCIPLINES[0]);
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
  // Nur fuer format === "winner_stays": Einzel/Doppel + EIN optionaler
  // Tisch, statt der Playoff-/Mehrtisch-Felder oben.
  const [wsDoubles, setWsDoubles] = useState(false);
  const [wsTable, setWsTable] = useState("");

  const load = async () => {
    // organizer(nickname) per Inline-Join statt eines eigenen players-Props
    // (Nutzer-Feedback: Turnierleitung soll gut ersichtlich sein) - dieser
    // Screen laedt sonst keine Spielerliste, ein Join spart eine zusaetzliche
    // Anfrage/Prop-Kette.
    const { data, error } = await supabase.from("tournaments")
      .select("id, name, format, discipline, status, created_at, organizer:players!tournaments_organizer_id_fkey(nickname)")
      .order("created_at", { ascending: false });
    if (!error) setTournaments(data || []);
  };
  const loadWs = async () => {
    const { data, error } = await supabase.from("winner_stays_sessions")
      .select("id, name, discipline, is_doubles, table_number, status, created_at, organizer:players!winner_stays_sessions_organizer_id_fkey(nickname)")
      .order("created_at", { ascending: false });
    if (!error) setWsSessions(data || []);
  };
  useEffect(() => { load(); loadWs(); }, []);

  // Beide Listen zu einer gemeinsamen, nach Datum sortierten Liste
  // zusammenfuehren - fuer den Nutzer ist das EIN "Turniere"-Bereich.
  const combined = useMemo(() => {
    if (tournaments == null || wsSessions == null) return null;
    return [
      ...tournaments.map((tr) => ({ ...tr, _kind: "tournament" })),
      ...wsSessions.map((s) => ({ ...s, _kind: "winnerstays" })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [tournaments, wsSessions]);

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

  const resetForm = () => {
    setShowForm(false);
    setName(""); setTableFrom(""); setTableTo(""); setTableList(""); setWsTable(""); setWsDoubles(false);
  };

  const create = async () => {
    if (!name.trim()) { toast(t("Turniername fehlt.")); return; }

    if (format === "winner_stays") {
      const tableNum = wsTable.trim() ? parseInt(wsTable.trim(), 10) : null;
      if (wsTable.trim() && !Number.isFinite(tableNum)) { toast(t("Bitte gültige Tischnummern angeben.")); return; }
      setBusy(true);
      const { data, error } = await supabase.rpc("winner_stays_create_session", {
        p_name: name.trim(), p_discipline: discipline, p_is_doubles: wsDoubles,
        p_table_number: tableNum,
      });
      setBusy(false);
      if (error) { toast(t("Fehler: ") + error.message); return; }
      toast(t("Winner-Stays-Runde erstellt."));
      resetForm();
      await loadWs();
      onOpenWinnerStays(data.id);
      return;
    }

    const tables = parseTables();
    if (!tables) { toast(t("Bitte gültige Tischnummern angeben.")); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("create_tournament", {
      p_name: name.trim(), p_format: format, p_discipline: discipline,
      p_table_numbers: tables,
      p_playoff_size: playoffSize, p_double_round_robin: doubleRoundRobin,
    });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Turnier erstellt – Anmeldung ist jetzt offen."));
    resetForm();
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
          <button className="btn ghost" onClick={() => setShowForm((s) => !s)}>
            {showForm ? <><X size={15} /> {t("Abbrechen")}</> : <><Plus size={15} /> {t("Neues Turnier")}</>}
          </button>
        </div>

        {showForm && (
          <div className="turnier-form" style={{ marginBottom: 16 }}>
            <input type="text" placeholder={t("Turniername")} value={name} onChange={(e) => setName(e.target.value)} />

            <p className="hint" style={{ marginBottom: 4 }}>{t("Format")}</p>
            <div className="chips small">
              <button className={"chip" + (format === "ko" ? " active" : "")} onClick={() => chooseFormat("ko")}>{t("K.O.")}</button>
              <button className={"chip" + (format === "double_ko" ? " active" : "")} onClick={() => chooseFormat("double_ko")}>{t("Doppel-K.O.")}</button>
              <button className={"chip" + (format === "round_robin" ? " active" : "")} onClick={() => chooseFormat("round_robin")}>{t("Jeder gegen jeden")}</button>
              <button className={"chip" + (format === "winner_stays" ? " active" : "")} onClick={() => chooseFormat("winner_stays")}><Repeat size={14} /> {t("Winner Stays")}</button>
            </div>

            {format === "winner_stays" && (
              <p className="hint" style={{ marginTop: 4 }}>
                {t("Ein Tisch, mehrere Leute: der Sieger bleibt, der Verlierer geht ans Ende der Schlange - funktioniert mit 3 oder beliebig vielen Personen, auch im Doppel.")}
              </p>
            )}

            {format === "round_robin" && (
              <>
                <p className="hint" style={{ marginBottom: 4 }}>{t("Spielrunden")}</p>
                <div className="chips small">
                  <button className={"chip" + (!doubleRoundRobin ? " active" : "")} onClick={() => setDoubleRoundRobin(false)}>{t("Einfach")}</button>
                  <button className={"chip" + (doubleRoundRobin ? " active" : "")} onClick={() => setDoubleRoundRobin(true)}>{t("Hin & Rück")}</button>
                </div>
              </>
            )}

            {format !== "ko" && format !== "winner_stays" && (
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

            {format === "winner_stays" && (
              <>
                <p className="hint" style={{ marginBottom: 4 }}>{t("Modus")}</p>
                <div className="chips small">
                  <button className={"chip" + (!wsDoubles ? " active" : "")} onClick={() => setWsDoubles(false)}>{t("Einzel")}</button>
                  <button className={"chip" + (wsDoubles ? " active" : "")} onClick={() => setWsDoubles(true)}>{t("Doppel")}</button>
                </div>
              </>
            )}

            <p className="hint" style={{ marginBottom: 4 }}>{t("Disziplin")}</p>
            <div className="chips small">
              {DEFAULT_DISCIPLINES.map((d) => (
                <button key={d} className={"chip" + (discipline === d ? " active" : "")} onClick={() => setDiscipline(d)}>{t(DISC_LABEL[d] || d)}</button>
              ))}
            </div>

            {format === "winner_stays" ? (
              <>
                <p className="hint" style={{ marginBottom: 4 }}>{t("Tisch (optional)")}</p>
                <div className="turnier-score-inputs">
                  <input type="number" inputMode="numeric" min="1" placeholder={t("z. B. 3")} value={wsTable} onChange={(e) => setWsTable(e.target.value)} />
                </div>
                <p className="hint" style={{ marginTop: 10 }}>{t("Teilnehmer fügst du danach direkt in der Runde hinzu.")}</p>
              </>
            ) : (
              <>
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
                <p className="hint" style={{ marginTop: 10 }}>{t("Nach dem Anlegen ist das Turnier offen zur Anmeldung - Spieler melden sich selbst an, du startest, sobald alle da sind.")}</p>
              </>
            )}

            <button className="btn primary" disabled={busy} onClick={create}>
              {busy ? t("Lege an …") : <><Trophy size={16} /> {t("Turnier anlegen")}</>}
            </button>
          </div>
        )}

        {combined != null && combined.length > 0 && (
          <>
            <div className="search-row" style={{ marginBottom: 10 }}>
              <Search size={16} className="mail-ico" />
              <input placeholder={t("Turnier suchen …")} value={query} onChange={(e) => setQuery(e.target.value)} />
              {query && <button className="clear-btn" onClick={() => setQuery("")} aria-label={t("Suche loeschen")}><X size={15} /></button>}
            </div>
            <div className="chips small" style={{ marginBottom: 10 }}>
              <button className={"chip" + (statusFilter === "all" ? " active" : "")} onClick={() => setStatusFilter("all")}>{t("Alle")}</button>
              <button className={"chip" + (statusFilter === "running" ? " active" : "")} onClick={() => setStatusFilter("running")}>{t("Läuft")}</button>
              <button className={"chip" + (statusFilter === "done" ? " active" : "")} onClick={() => setStatusFilter("done")}>{t("Beendet")}</button>
            </div>
          </>
        )}

        {combined == null ? (
          <p className="hint">{t("Lade ...")}</p>
        ) : combined.length === 0 ? (
          <p className="hint">{t("Noch keine Turniere.")}</p>
        ) : (() => {
          const q = query.trim().toLowerCase();
          const filtered = combined
            .filter((it) => statusFilter === "all" ? true : statusFilter === "running" ? it.status !== "finished" : it.status === "finished")
            .filter((it) => !q || it.name.toLowerCase().includes(q));
          return filtered.length === 0 ? (
            <p className="hint">{t("Keine Turniere in diesem Filter.")}</p>
          ) : filtered.map((it) => (
            <button key={it.id} className="turnier-list-row"
              onClick={() => it._kind === "winnerstays" ? onOpenWinnerStays(it.id) : onOpenTournament(it.id)}>
              <span className="turnier-list-row-main">
                <b>{it.name}</b>
                <span className="turnier-list-row-meta">
                  {formatLabel(it)} · {t(it.discipline)}
                  {it._kind === "winnerstays" && it.table_number != null && ` · ${t("Tisch")} ${it.table_number}`}
                  {" · "}{statusLabel(it.status)} · {fmtDate(it.created_at)}
                </span>
                <span className="turnier-list-row-meta">{t("Turnierleitung")}: {it.organizer?.nickname || "?"}</span>
              </span>
              <ChevronRight size={20} className="turnier-list-row-chevron" />
            </button>
          ));
        })()}
      </section>
      </div>
      <ImprintFooter />
    </div>
  );
}
