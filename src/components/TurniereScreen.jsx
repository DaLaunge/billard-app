import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, Trophy, X } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { fmtDate } from "../lib/format";
import { DEFAULT_DISCIPLINES } from "../lib/constants";
import ImprintFooter from "./widgets/ImprintFooter";
import FieldLabel from "./widgets/FieldLabel";
import { ModeTiles } from "./widgets/ModePick";
import DiscBall, { DiscPick } from "./widgets/DiscBall";
import { FORMAT_GLYPH } from "./widgets/FormatGlyph";
import { useRevealOnScroll } from "../lib/useRevealOnScroll";

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
// Die Feld-Ueberschrift (Erklaertext im Info-Knopf statt als Dauertext) ist
// seit 2026-09-30 ein gemeinsames Widget mit "Neues Match" (FieldLabel.jsx).

// Drei Fuellstufen DESSELBEN Akzents statt dreier Farben (siehe CLAUDE.md,
// "Exactly ONE accent colour"): laufend = volle Flaeche, Anmeldung offen =
// getoente Flaeche, beendet/abgebrochen = neutral.
const statusTone = (s) => (s === "setup" ? "open" : s === "finished" || s === "cancelled" ? "done" : "live");

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
  // Zeilen blenden sich beim Hineinscrollen ein (siehe useRevealOnScroll) -
  // neu gefilterte Listen muessen dafuer erneut durchsucht werden, deshalb
  // haengen Filter und Suche in den Abhaengigkeiten.
  const listRef = useRevealOnScroll([tournaments?.length, wsSessions?.length, statusFilter, query, showForm]);

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
      <div className="turnier-layout" ref={listRef}>
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

        {/* Auf- und Zuklappen ueber grid-template-rows 0fr/1fr - die einzige
            Art, eine unbekannte Hoehe wirklich zu animieren, ohne sie vorher
            zu messen. Unter prefers-reduced-motion schaltet das CSS die
            Ueberblendung ab, der Inhalt erscheint dann sofort. */}
        <div className={"collapsible" + (showForm ? " open" : "")} inert={showForm ? undefined : ""}>
          <div className="collapsible-inner">
          <div className="turnier-form" style={{ marginBottom: 16 }}>
            {/* Ganz oben: die Disziplin ist die eine Angabe, die IMMER gewaehlt
                werden muss (Nutzer-Feedback 2026-09-30) - vorher stand sie
                nach Name und Format, unterhalb der Falz. Sie hat einen
                Vorgabewert, wird aber bei jedem Turnier bewusst entschieden. */}
            <FieldLabel label={t("Disziplin")} />
            <div className="disc-picks">
              {DEFAULT_DISCIPLINES.map((d) => (
                // Kugel statt Kuerzel (siehe DiscBall.jsx); gewaehlt = Ring in der
                // Akzentfarbe, wie bei der Kugelauswahl im 14/1-Protokoll.
                <DiscPick key={d} disc={d} selected={discipline === d} onSelect={() => setDiscipline(d)} />
              ))}
            </div>

            <input type="text" placeholder={t("Turniername")} value={name} onChange={(e) => setName(e.target.value)} />

            {/* Format als Kacheln mit Struktur-Zeichnung statt als Textchips
                (Nutzer-Feedback: Erklaerungen lieber visuell). "Doppel-K.O."
                sagt einem Neuling nichts, ein Baum mit zweitem Pfad darunter
                schon - der ausgeschriebene Text dazu steckt im Info-Knopf
                daneben, statt dauerhaft Platz zu kosten. */}
            <FieldLabel label={t("Format")} info={t("K.O.: eine Niederlage und du bist raus. Doppel-K.O.: erst die zweite Niederlage scheidet aus, bis dahin laeuft eine Verliererrunde mit. Jeder gegen jeden: alle spielen gegen alle, eine Tabelle entscheidet. Winner Stays: ein Tisch, mehrere Leute - der Sieger bleibt, der Verlierer geht ans Ende der Schlange; funktioniert mit 3 oder beliebig vielen Personen, auch im Doppel.")} />
            <div className="fmt-grid">
              {[["ko", t("K.O.")], ["double_ko", t("Doppel-K.O.")], ["round_robin", t("Jeder gegen jeden")], ["winner_stays", t("Winner Stays")]].map(([key, label]) => {
                const Glyph = FORMAT_GLYPH[key];
                return (
                  <button key={key} type="button" className={"fmt-card" + (format === key ? " sel" : "")}
                    aria-pressed={format === key} onClick={() => chooseFormat(key)}>
                    <Glyph />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {format === "round_robin" && (
              <>
                <FieldLabel label={t("Spielrunden")} info={t("Einfach: jede Paarung spielt einmal. Hin & Rueck: jede Paarung spielt zweimal, einmal pro Seite - fairer, dauert aber doppelt so lang.")} />
                <div className="chips small">
                  <button className={"chip" + (!doubleRoundRobin ? " active" : "")} onClick={() => setDoubleRoundRobin(false)}>{t("Einfach")}</button>
                  <button className={"chip" + (doubleRoundRobin ? " active" : "")} onClick={() => setDoubleRoundRobin(true)}>{t("Hin & Rück")}</button>
                </div>
              </>
            )}

            {format !== "ko" && format !== "winner_stays" && (
              <>
                <FieldLabel label={format === "double_ko" ? t("Finalrunde") : t("Abschluss")} info={t("Wie viele der Bestplatzierten spielen den Sieger danach noch im K.O. aus. \"Nur Tabelle\" beendet das Turnier direkt mit dem Tabellenstand.")} />
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
                {/* Dieselben Kacheln wie in "Neues Match" (ModeTiles). */}
                <FieldLabel label={t("Modus")} />
                <ModeTiles value={wsDoubles ? "double" : "single"} onChange={(m) => setWsDoubles(m === "double")} />
              </>
            )}

            {format === "winner_stays" ? (
              <>
                <FieldLabel label={t("Tisch (optional)")} info={t("Teilnehmer fuegst du danach direkt in der Runde hinzu.")} />
                <div className="turnier-score-inputs">
                  <input type="number" inputMode="numeric" min="1" placeholder={t("z. B. 3")} value={wsTable} onChange={(e) => setWsTable(e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <FieldLabel label={t("Tische")} info={t("Nach dem Anlegen ist das Turnier offen zur Anmeldung - Spieler melden sich selbst an, du startest, sobald alle da sind.")} />
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
              </>
            )}

            <button className="btn primary" disabled={busy} onClick={create}>
              {busy ? t("Lege an …") : <><Trophy size={16} /> {t("Turnier anlegen")}</>}
            </button>
          </div>
          </div>
        </div>

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
          ) : filtered.map((it) => {
            // Die Zeile zeigt das Format als dieselbe Zeichnung wie die
            // Auswahl im Formular - man erkennt den Turniertyp, ohne das
            // Wort zu lesen. Der Name steht weiterhin daneben.
            const Glyph = FORMAT_GLYPH[it._kind === "winnerstays" ? "winner_stays" : it.format] || FORMAT_GLYPH.ko;
            return (
              <button key={it.id} className="turnier-list-row reveal"
                onClick={() => it._kind === "winnerstays" ? onOpenWinnerStays(it.id) : onOpenTournament(it.id)}>
                <span className="turnier-list-row-glyph" title={formatLabel(it)}><Glyph /></span>
                <span className="turnier-list-row-main">
                  <span className="turnier-list-row-title">
                    <b>{it.name}</b>
                    <span className={"turnier-status " + statusTone(it.status)}>{statusLabel(it.status)}</span>
                  </span>
                  <span className="turnier-list-row-meta">
                    {formatLabel(it)} · <DiscBall disc={it.discipline} size={15} />
                    {it._kind === "winnerstays" && it.table_number != null && ` · ${t("Tisch")} ${it.table_number}`}
                    {" · "}{fmtDate(it.created_at)}
                  </span>
                  <span className="turnier-list-row-meta">{t("Turnierleitung")}: {it.organizer?.nickname || "?"}</span>
                </span>
                <ChevronRight size={20} className="turnier-list-row-chevron" />
              </button>
            );
          });
        })()}
      </section>
      </div>
      <ImprintFooter />
    </div>
  );
}
