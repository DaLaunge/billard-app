import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, Repeat, UserPlus, X, Check, Trash2, Flag, Trophy, Crown, SkipForward, ChevronUp, ChevronDown, Pause, Play, Plus, Minus, WifiOff, RefreshCw } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { initials } from "../lib/format";
import { appConfirm } from "../lib/confirmDialog";
import Ball from "./Ball";
import PlayerPicker from "./PlayerPicker";
import PlayerMultiPicker from "./PlayerMultiPicker";
import ImprintFooter from "./widgets/ImprintFooter";
import KeepAwakeButton from "./widgets/KeepAwakeButton";
import { BreakPill, breakApplies, normalizeBreakRule } from "./widgets/BreakRule";
import { loadWsDraft, saveWsDraft } from "../lib/matchDraft";
import { rpcRetry } from "../lib/rpcRetry";
import DiscBall from "./widgets/DiscBall";

const POLL_MS = 8000;

// "Winner Stays" (Nutzer-Feedback): ein Tisch, mehrere Leute in einer
// Warteschlange - die zwei vordersten (Position 0/1) spielen, der Sieger
// bleibt (Position bleibt unveraendert), der Verlierer geht ans Ende, alle
// dahinter ruecken auf (siehe winner_stays_report_game() in der DB - die
// ganze Rotation passiert dort serverseitig, dieser Screen zeigt nur den
// aktuellen Stand und bietet die Eingabemaske). Voellig anderes Datenmodell
// als TurnierRasterScreen.jsx (keine Bracket-Struktur), deshalb ein
// eigener, viel einfacherer Screen statt einer Erweiterung dort.
export default function WinnerStaysScreen({ sessionId, me, players, matches, toast, colorOf, badgeOf, photoOf, onReload, onBack, keepAwake, onSetKeepAwake }) {
  const [session, setSession] = useState(null);
  const [entries, setEntries] = useState(null);
  const [games, setGames] = useState([]);
  const [busy, setBusy] = useState(false);

  // Verbindungsfehler duerfen den angezeigten Stand NIE leeren (Nutzer-Feedback:
  // "das Turnier kommt in einen nicht definierten Zustand, wenn man das Handy
  // sperrt"). Nach dem Entsperren ist das Netz oft noch ein paar Sekunden weg;
  // der Abruf scheitert dann, und die alte Fassung machte aus "keine Antwort"
  // einfach "keine Daten" - die Runde wirkte leer, das Formular zum Hinzufuegen
  // sprang auf. Jetzt bleibt der letzte gute Stand stehen, ein Hinweis zeigt
  // den Verbindungsverlust, und beim Zurueckkommen (sichtbar/online) wird
  // sofort neu geladen. reqRef verwirft Antworten, die von einer neueren
  // Anfrage ueberholt wurden.
  const [offline, setOffline] = useState(false);
  const [gone, setGone] = useState(false);
  const reqRef = useRef(0);
  const load = useCallback(async () => {
    const my = ++reqRef.current;
    let r;
    try {
      r = await Promise.all([
        supabase.from("winner_stays_sessions")
          .select("*, organizer:players!winner_stays_sessions_organizer_id_fkey(nickname)")
          .eq("id", sessionId).maybeSingle(),
        supabase.from("winner_stays_entries")
          .select("*, player1:players!winner_stays_entries_player1_id_fkey(nickname), player2:players!winner_stays_entries_player2_id_fkey(nickname)")
          .eq("session_id", sessionId).order("queue_position"),
        supabase.from("winner_stays_games")
          .select("id, game_no, entry_a_id, entry_b_id, score_a, score_b, winner_entry_id, played_at")
          .eq("session_id", sessionId).order("game_no", { ascending: false }).limit(20),
      ]);
    } catch { r = null; }
    if (my !== reqRef.current) return null;
    if (!r || r.some((x) => x.error)) { setOffline(true); return null; }
    const [{ data: sess }, { data: ents }, { data: gms }] = r;
    setOffline(false);
    if (!sess) { setGone(true); return null; }
    setGone(false);
    setSession(sess);
    setEntries(ents || []);
    setGames(gms || []);
    return gms || [];
  }, [sessionId]);

  useEffect(() => {
    load();
    // Im Hintergrund nicht abfragen (spart Datenvolumen, und gesperrte Handys
    // fuehren Timer ohnehin unzuverlaessig aus); beim Zurueckkommen sofort.
    const tick = () => { if (!document.hidden) load(); };
    const id = setInterval(tick, POLL_MS);
    const back = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("online", back);
    window.addEventListener("focus", back);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("online", back);
      window.removeEventListener("focus", back);
    };
  }, [load]);

  // Eingabe fuers naechste Ergebnis - zurueckgesetzt, sobald sich die
  // aktuelle Tisch-Paarung aendert (neue Runde nach Eintragen).
  const [sA, setSA] = useState(0);
  const [sB, setSB] = useState(0);
  // Spielstand der laufenden Partie gegen ein unfreiwilliges Neuladen sichern
  // (siehe lib/matchDraft.js). Gebunden an die Nummer des letzten gemeldeten
  // Spiels: wurde seither eins gemeldet (auch von einem anderen Geraet), ist der
  // alte Stand hinfaellig. Erst nach dem ersten Laden wiederherstellen, dann
  // speichern - sonst ueberschriebe die leere Anfangs-0 den Entwurf.
  const lastGameNo = games[0]?.game_no ?? 0;
  const wsRestoredRef = useRef(false);
  useEffect(() => {
    if (wsRestoredRef.current || !session) return;
    wsRestoredRef.current = true;
    const d = loadWsDraft(sessionId, lastGameNo);
    if (d) { setSA(d.sA); setSB(d.sB); }
  }, [session, sessionId, lastGameNo]);
  useEffect(() => {
    if (wsRestoredRef.current) saveWsDraft(sessionId, lastGameNo, sA, sB);
  }, [sessionId, lastGameNo, sA, sB]);
  // Wurde (z. B. von einem anderen Geraet) ein Spiel gemeldet, gehoert der
  // angefangene Stand zur alten Paarung und darf nicht stehen bleiben.
  const prevGameNoRef = useRef(null);
  useEffect(() => {
    if (!wsRestoredRef.current) return;
    if (prevGameNoRef.current !== null && prevGameNoRef.current !== lastGameNo) { setSA(0); setSB(0); }
    prevGameNoRef.current = lastGameNo;
  }, [session, lastGameNo]);
  const [showAdd, setShowAdd] = useState(false);
  const [addSelected, setAddSelected] = useState([]);
  const [teamP1, setTeamP1] = useState(null);
  const [teamP2, setTeamP2] = useState(null);
  // Nutzer-Feedback: nach dem Anlegen einer Runde ist der leere Zwischen-
  // Screen ("Hinzufügen" erst extra antippen) unnoetig - beim allerersten
  // Laden ohne Teilnehmer gleich direkt die Auswahl aufklappen. Nur EINMAL
  // (Ref statt State), damit ein spaeteres bewusstes Zuklappen (z.B. wenn
  // alle Teilnehmer wieder entfernt wurden) nicht ungefragt wieder aufspringt.
  const autoOpenedAddRef = useRef(false);
  useEffect(() => {
    if (entries && entries.length === 0 && !autoOpenedAddRef.current) {
      autoOpenedAddRef.current = true;
      setShowAdd(true);
    }
  }, [entries]);

  if (gone || !session || !entries) {
    return (
      <div className="screen">
        <header className="screen-head with-back">
          <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
          <h2>{t("Winner Stays")}</h2>
        </header>
        <p className="hint">{gone ? t("Diese Runde gibt es nicht mehr.") : offline ? t("Keine Verbindung – Stand wird neu geladen …") : t("Lade ...")}</p>
        {offline && !gone && (
          <button type="button" className="btn ghost" onClick={load}><RefreshCw size={15} /> {t("Neu laden")}</button>
        )}
      </div>
    );
  }

  const isOrganizer = me.id === session.organizer_id || me.role === "admin";
  const posA = entries.find((e) => e.queue_position === 0);
  const posB = entries.find((e) => e.queue_position === 1);
  const waiting = entries.filter((e) => e.queue_position >= 2).sort((a, b) => a.queue_position - b.queue_position);
  const ranked = [...entries].sort((a, b) => b.wins - a.wins || b.streak - a.streak || a.queue_position - b.queue_position);
  // Nutzer-Feedback: nicht nur die Turnierleitung, auch die beiden gerade
  // am Tisch stehenden Personen sollen selbst ein Ergebnis eintragen
  // koennen (bei Doppel beide Team-Mitglieder) - serverseitig identisch in
  // winner_stays_report_game() durchgesetzt, hier nur zusaetzlich als
  // Bedienbarkeits-Kriterium.
  const isAtTable = !!(posA && posB && [posA.player1_id, posA.player2_id, posB.player1_id, posB.player2_id].includes(me.id));
  // Nutzer-Feedback: "Winner stays ist der einzige Turniermodus, bei dem
  // jeder Spieler etwas eingeben kann... das Verschieben eines wartenden
  // Spielers muss fuer jeden moeglich sein, der im Turnier mitspielt" -
  // gilt fuer Ueberspringen UND Warteschlange-Umsortieren gleichermassen,
  // nicht nur fuer die Leitung (serverseitig identisch durchgesetzt in
  // winner_stays_skip_next()/winner_stays_move_entry()).
  const isParticipant = entries.some((e) => e.player1_id === me.id || e.player2_id === me.id);
  const canManageQueue = (isOrganizer || isParticipant) && session.status === "running";
  const canReport = (isOrganizer || isAtTable) && session.status === "running" && posA && posB;
  const canDelete = isOrganizer && games.length === 0;
  // "ueberspringen"-Button macht nur Sinn ab mehr als 3 Teilnehmern (siehe
  // winner_stays_skip_next() - sonst kaeme die uebersprungene Person sofort
  // wieder dran).
  const canSkip = canManageQueue && posA && posB && entries.length > 3;
  // Nutzer-Feedback: "Es kann jederzeit einer der Spieler ausfallen. Diese
  // Moeglichkeit sollte jeder haben." - Selbstbedienung, unabhaengig von
  // Position (auch am Tisch), siehe winner_stays_set_paused().
  const canTogglePaused = (e) => session.status === "running" && (isOrganizer || e.player1_id === me.id || e.player2_id === me.id);
  const existingPlayerIds = entries.flatMap((e) => [e.player1_id, e.player2_id]).filter(Boolean);

  const entryName = (e) => (e?.player2_id ? `${e.player1?.nickname} & ${e.player2?.nickname}` : e?.player1?.nickname);
  const entryById = (id) => entries.find((e) => e.id === id);

  const reportGame = async () => {
    if (sA === sB) { toast(t("Unentschieden gibt es beim Billard nicht.")); return; }
    const before = lastGameNo;
    setBusy(true);
    let error = null;
    try {
      ({ error } = await rpcRetry("winner_stays_report_game", { p_session_id: sessionId, p_score_a: sA, p_score_b: sB }));
    } catch (e) { error = e; }
    // Antwort verloren (Handy gesperrt, Netz weg) heisst nicht, dass das Spiel
    // nicht angekommen ist: nachsehen, bevor die Person es ein zweites Mal
    // einreicht und die naechste Paarung gleich mitzaehlt.
    let arrived = false;
    if (error) {
      const gms = await load();
      arrived = !!gms && (gms[0]?.game_no ?? 0) > before;
    }
    setBusy(false);
    if (error && !arrived) { toast(t("Fehler: ") + (error.message || "")); return; }
    if (arrived) toast(t("Ergebnis ist angekommen."));
    setSA(0); setSB(0);
    await load();
    onReload && onReload();
  };

  // Nutzer-Feedback: "damit gewaehrleistet ist, dass der Tisch so gut als
  // moeglich ausgenutzt wird, auch wenn der naechste Spieler gerade am WC
  // ist oder ein dringendes Telefonat fuehren muss" - schickt den
  // Herausforderer ohne Wertung ans Ende der Warteschlange (kein Rack,
  // keine Statistik-Aenderung, siehe winner_stays_skip_next()).
  const skipNext = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_skip_next", { p_session_id: sessionId });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Übersprungen."));
    await load();
  };

  // Nutzer-Feedback: "Ein 'Aussetzen' Button. Es kann jederzeit einer der
  // Spieler ausfallen. Diese Moeglichkeit sollte jeder haben." - erst als
  // einmalige Aktion gebaut, dann auf Nutzer-Feedback hin ("wie kann ich
  // den Aussetzen Button wieder ausschalten? Ich kann das kaffee-icon nur
  // aktivieren, nicht deaktivieren") zu einem echten Ein/Aus-Schalter
  // gemacht: pausierte Personen werden serverseitig automatisch
  // uebersprungen, sobald sie an der Reihe waeren (winner_stays_skip_paused
  // in der DB), bis sie sich selbst wieder aktiv melden.
  const togglePaused = async (entry) => {
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_set_paused", { p_session_id: sessionId, p_entry_id: entry.id, p_paused: !entry.is_paused });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(entry.is_paused ? t("Wieder dabei.") : t("Pausiert."));
    await load();
  };

  const addSingles = async () => {
    if (addSelected.length === 0) return;
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_add_entries", { p_session_id: sessionId, p_player_ids: addSelected });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Teilnehmer hinzugefügt."));
    setAddSelected([]); setShowAdd(false);
    await load();
  };

  // Nutzer-Feedback: "hier sollte bereits ein Gast-User vorgeschlagen
  // werden, weil es den user nicht im System gibt" - fuer Personen ohne
  // App/Login, direkt aus der Spieler-Suche heraus (siehe onCreateGuest an
  // PlayerMultiPicker unten). Legt die Gast-Person an UND meldet sie im
  // selben Schritt an (winner_stays_add_guest) - onReload() zusaetzlich zu
  // load(), da dabei ein neuer players-Datensatz entsteht, der auch in der
  // globalen App.jsx-Spielerliste ankommen muss.
  const addGuest = async (name) => {
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_add_guest", { p_session_id: sessionId, p_nickname: name });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Gast hinzugefügt."));
    await load();
    onReload && onReload();
  };

  const addTeam = async () => {
    if (!teamP1 || !teamP2) return;
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_add_team", { p_session_id: sessionId, p_player1_id: teamP1, p_player2_id: teamP2 });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Team hinzugefügt."));
    setTeamP1(null); setTeamP2(null); setShowAdd(false);
    await load();
  };

  // Nutzer-Feedback: Warteschlange soll umsortierbar sein - Pfeil-Buttons
  // statt echtem Drag & Drop (robuster am Handy), nur innerhalb der
  // Warteschlange (nicht die beiden Tisch-Positionen), siehe
  // winner_stays_move_entry(). Fuer jeden Teilnehmer der Runde erlaubt, wie
  // Ueberspringen.
  const moveEntry = async (entryId, delta) => {
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_move_entry", { p_session_id: sessionId, p_entry_id: entryId, p_delta: delta });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    await load();
  };

  // Anstoss-Regel (Wechselbreak/Winner-Break): Leitung kann sie umstellen, solange die Runde laeuft.
  const toggleBreakRule = async () => {
    const next = normalizeBreakRule(session.break_rule) === "winner" ? "alternate" : "winner";
    const { error } = await supabase.rpc("set_break_rule", { p_kind: "winner_stays", p_id: sessionId, p_rule: next });
    if (error) { toast(t("Fehler: ") + error.message); return; }
    await load();
  };

  const removeEntry = async (entryId) => {
    if (!(await appConfirm(t("Diese Person/dieses Team aus der Runde nehmen?")))) return;
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_remove_entry", { p_session_id: sessionId, p_entry_id: entryId });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    await load();
  };

  const finishSession = async () => {
    if (!(await appConfirm(t("Diese Runde jetzt beenden? Für jede Zweier-Paarung wird jetzt ein gewertetes Match mit Protokoll gespeichert.")))) return;
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_finish_session", { p_session_id: sessionId });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Runde beendet."));
    await load();
  };

  const deleteSession = async () => {
    if (!(await appConfirm(t("Diese Runde wirklich löschen?")))) return;
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_delete_session", { p_session_id: sessionId });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Runde gelöscht."));
    onBack();
  };

  const renderEntryAvatars = (e, size) => (
    <span className="ws-entry-avatars">
      <Ball color={colorOf(e.player1?.nickname)} label={initials(e.player1?.nickname)} badge={badgeOf(e.player1?.nickname)} photo={photoOf(e.player1?.nickname)} size={size} />
      {e.player2_id && <Ball color={colorOf(e.player2?.nickname)} label={initials(e.player2?.nickname)} badge={badgeOf(e.player2?.nickname)} photo={photoOf(e.player2?.nickname)} size={size} />}
    </span>
  );

  const myEntry = entries.find((e) => e.player1_id === me.id || e.player2_id === me.id);
  const rankOf = (e) => ranked.findIndex((x) => x.id === e.id) + 1;

  // Siege / Niederlagen / Serie / Platz in EINER Zeile, ueberall gleich (Am
  // Tisch, Warteschlange, "Mein Stand") - der Stand jeder Person soll ohne
  // Blick in die Rangliste ablesbar sein.
  const statLine = (e, place, center) => (
    <span className={"ws-statline" + (center ? " center" : "")}>
      <span title={t("Platz {n}", { n: place })}>#{place}</span>
      <span className="win" title={t("Siege")}>{e.wins} {t("S")}</span>
      <span className="loss" title={t("Niederlagen")}>{e.losses} {t("N")}</span>
      {e.streak > 1 && <span className="streak" title={t("{n} in Folge", { n: e.streak })}>🔥{e.streak}</span>}
    </span>
  );

  // Pause: ein beschrifteter Zwei-Zustands-Schalter statt eines Kaffeetassen-
  // Symbols (Nutzer-Feedback 2026-10-10: nicht intuitiv, leicht zu uebersehen,
  // schwer erreichbar). Beide Zustaende stehen als Text da, der aktive ist
  // gefuellt: "Dabei" gruen, "Pause" gelb (--warn). compact = unter der Person
  // am Tisch, icon = nur Symbol in der Warteschlangen-Zeile (Pause/Play, nie
  // eine Tasse).
  const pauseSwitch = (entry, { compact, icon } = {}) => {
    const on = !!entry.is_paused;
    if (icon) {
      return (
        <button type="button" className={"ws-act ws-act-pause" + (on ? " on" : "")} disabled={busy} onClick={() => togglePaused(entry)}
          aria-label={on ? t("Wieder dabei") : t("Pause setzen")} title={on ? t("Wieder dabei") : t("Pause setzen")}>
          {on ? <Play size={18} /> : <Pause size={18} />} <span>{on ? t("Wieder dabei") : t("Pause")}</span>
        </button>
      );
    }
    return (
      <div className={"ws-pause-switch" + (compact ? " compact" : "")} role="group" aria-label={t("Pause")}>
        <button type="button" className={"in" + (!on ? " active" : "")} aria-pressed={!on} disabled={busy} onClick={() => on && togglePaused(entry)}>
          <Play size={16} /> {t("Dabei")}
        </button>
        <button type="button" className={"out" + (on ? " active" : "")} aria-pressed={on} disabled={busy} onClick={() => !on && togglePaused(entry)}>
          <Pause size={16} /> {t("Pause")}
        </button>
      </div>
    );
  };

  return (
    <div className="screen">
      <div className="turnier-layout">
      <header className="screen-head with-back">
        <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
        <h2>{session.name}</h2>
        <KeepAwakeButton on={keepAwake} onChange={onSetKeepAwake} toast={toast} />
      </header>
      <p className="hint" style={{ marginTop: -6 }}>
        {t(session.is_doubles ? "Doppel" : "Einzel")} · <DiscBall disc={session.discipline} size={15} />
        {session.table_number != null && ` · ${t("Tisch")} ${session.table_number}`}
        {" · "}{session.status === "finished" ? t("beendet") : t("läuft")}
        {breakApplies(session.discipline) && (
          <> · <BreakPill rule={session.break_rule} onClick={isOrganizer && session.status !== "finished" ? toggleBreakRule : undefined} /></>
        )}
      </p>
      <div className="turnier-organizer-line">
        <span className="hint" style={{ margin: 0 }}>{t("Turnierleitung")}:</span>
        <Ball color={colorOf(session.organizer?.nickname)} label={initials(session.organizer?.nickname)} badge={badgeOf(session.organizer?.nickname)} photo={photoOf(session.organizer?.nickname)} size={22} />
        <b>{session.organizer?.nickname || "?"}</b>
      </div>

      {isOrganizer && (
        <div className="chips small" style={{ marginBottom: 10 }}>
          {session.status === "running" && (
            <button className="btn ghost" disabled={busy} onClick={finishSession}>
              <Flag size={15} /> {t("Runde beenden")}
            </button>
          )}
          {canDelete && (
            <button className="btn ghost" disabled={busy} onClick={deleteSession}>
              <Trash2 size={15} /> {t("Runde löschen")}
            </button>
          )}
        </div>
      )}

      {offline && (
        <p className="ws-offline" role="status"><WifiOff size={15} /> {t("Verbindung unterbrochen – Stand wird neu geladen.")}</p>
      )}

      {myEntry && session.status === "running" && (
        <section className="stat-block ws-me" aria-label={t("Mein Stand")}>
          <div className="ws-me-top">
            {renderEntryAvatars(myEntry, 40)}
            <div className="ws-me-info">
              <b className="ws-me-state">
                {myEntry.is_paused ? t("Du pausierst – du wirst übersprungen.")
                  : myEntry.queue_position <= 1 ? t("Du spielst gerade")
                  : myEntry.queue_position === 2 ? t("Du bist als Nächste/r dran")
                  : t("Warteschlange: Platz {n}", { n: myEntry.queue_position - 1 })}
              </b>
              {statLine(myEntry, rankOf(myEntry))}
            </div>
          </div>
          {pauseSwitch(myEntry)}
        </section>
      )}

      {(!posA || !posB) ? (
        <section className="stat-block">
          <p className="hint" style={{ margin: 0 }}>{t("Noch nicht genug Teilnehmer - mindestens zwei nötig, um zu spielen.")}</p>
        </section>
      ) : (
        <section className="stat-block">
          <h3><Trophy size={17} /> {t("Am Tisch")}</h3>
          <div className="ws-duel">
            {[[posA, sA, setSA, t("Verteidigt")], [posB, sB, setSB, t("Herausforderer")]].map(([e, val, setVal, role]) => (
              <div key={e.id} className={"ws-side" + (e.is_paused ? " is-paused" : "")}>
                <span className="ws-role">{role}</span>
                {renderEntryAvatars(e, 48)}
                <span className="ws-table-name">{entryName(e)}</span>
                {statLine(e, rankOf(e), true)}
                {e.is_paused && <span className="ws-paused-pill"><Pause size={13} /> {t("pausiert")}</span>}
                {canReport && (
                  <div className="ws-pad">
                    <button type="button" className="ws-pad-plus" onClick={() => setVal((v) => v + 1)}
                      aria-label={t("Punkt für {name}", { name: entryName(e) })}>
                      <Plus size={30} strokeWidth={3} />
                    </button>
                    <span className="ws-pad-val" key={val}>{val}</span>
                    <button type="button" className="ws-pad-minus" disabled={val === 0} onClick={() => setVal((v) => Math.max(0, v - 1))}
                      aria-label={t("Punkt abziehen")}>
                      <Minus size={20} strokeWidth={3} />
                    </button>
                  </div>
                )}
                {canTogglePaused(e) && e.id !== myEntry?.id && pauseSwitch(e, { compact: true })}
              </div>
            ))}
          </div>
          {canSkip && (
            <div className="chips small" style={{ marginTop: 10 }}>
              <button className="btn ghost" disabled={busy} onClick={skipNext} title={t("Herausforderer überspringen, wenn die Person gerade nicht verfügbar ist.")}>
                <SkipForward size={15} /> {t("Überspringen")}
              </button>
            </div>
          )}
        </section>
      )}

      {waiting.length > 0 && (
        <section className="stat-block">
          <h3><Repeat size={17} /> {t("Warteschlange")}</h3>
          <div className="ws-queue">
            {waiting.map((e, i) => (
              <div key={e.id} className={"ws-queue-row" + (e.is_paused ? " is-paused" : "") + (e.id === myEntry?.id ? " is-me" : "")}>
                <span className="ws-queue-no">{i + 1}.</span>
                {renderEntryAvatars(e, 34)}
                <span className="ws-queue-main">
                  <span className="ws-queue-name">{entryName(e)}</span>
                  {statLine(e, rankOf(e))}
                </span>
                {e.is_paused && <span className="ws-paused-pill"><Pause size={13} /> {t("pausiert")}</span>}
                <span className="ws-queue-actions">
                  {canManageQueue && (
                    <span className="ws-queue-move">
                      <button type="button" className="ws-act" disabled={busy || i === 0} onClick={() => moveEntry(e.id, -1)} aria-label={t("Nach vorne")} title={t("Nach vorne")}>
                        <ChevronUp size={20} />
                      </button>
                      <button type="button" className="ws-act" disabled={busy || i === waiting.length - 1} onClick={() => moveEntry(e.id, 1)} aria-label={t("Nach hinten")} title={t("Nach hinten")}>
                        <ChevronDown size={20} />
                      </button>
                    </span>
                  )}
                  {canTogglePaused(e) && e.id !== myEntry?.id && pauseSwitch(e, { icon: true })}
                  {isOrganizer && session.status === "running" && (
                    <button type="button" className="ws-act" disabled={busy} onClick={() => removeEntry(e.id)} aria-label={t("Entfernen")} title={t("Entfernen")}>
                      <X size={20} />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {isOrganizer && session.status === "running" && (
        <section className="stat-block">
          <div className="stat-block-head">
            <h3><UserPlus size={17} /> {t("Teilnehmer")}</h3>
            <button className="btn ghost" onClick={() => setShowAdd((s) => !s)}>
              {showAdd ? <><X size={15} /> {t("Abbrechen")}</> : <><UserPlus size={15} /> {t("Hinzufügen")}</>}
            </button>
          </div>
          {showAdd && (
            session.is_doubles ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <PlayerPicker players={players} matches={matches} me={me} getKey={(p) => p.id}
                  value={teamP1} exclude={[...existingPlayerIds, teamP2].filter(Boolean)}
                  onSelect={setTeamP1} placeholder={t("Erste Person")} />
                <PlayerPicker players={players} matches={matches} me={me} getKey={(p) => p.id}
                  value={teamP2} exclude={[...existingPlayerIds, teamP1].filter(Boolean)}
                  onSelect={setTeamP2} placeholder={t("Zweite Person")} />
                <button className="btn primary" disabled={busy || !teamP1 || !teamP2} onClick={addTeam}>
                  <Check size={15} /> {t("Team hinzufügen")}
                </button>
              </div>
            ) : (
              <div>
                <PlayerMultiPicker players={players} matches={matches} me={me} selected={addSelected}
                  onToggle={(id) => setAddSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
                  colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} exclude={existingPlayerIds}
                  onCreateGuest={addGuest} />
                <button className="btn primary" style={{ marginTop: 10 }} disabled={busy || addSelected.length === 0} onClick={addSingles}>
                  <Check size={15} /> {t("{n} Teilnehmer hinzufügen", { n: addSelected.length })}
                </button>
              </div>
            )
          )}
        </section>
      )}

      <section className="stat-block">
        <h3><Crown size={17} /> {t("Live-Rangliste")}</h3>
        {ranked.length === 0 ? (
          <p className="hint">{t("Noch keine Teilnehmer.")}</p>
        ) : (
          <div className="ws-rank-table">
            <div className="ws-rank-row ws-rank-head">
              <span className="ws-rank-pos"></span>
              <span className="ws-rank-name"></span>
              <span className="ws-rank-num" title={t("Siege")}>{t("S")}</span>
              <span className="ws-rank-num" title={t("Niederlagen")}>{t("N")}</span>
              <span className="ws-rank-streak"></span>
            </div>
            {ranked.map((e, i) => {
              const alt = i % 2 === 1 ? " ws-row-alt" : "";
              return (
                <div key={e.id} className="ws-rank-row">
                  <span className={"ws-rank-pos" + alt}>{i + 1}.</span>
                  <span className={"ws-rank-name" + alt}>
                    {renderEntryAvatars(e, 28)}
                    <span className="stat-name">
                      {entryName(e)}
                      {e.queue_position <= 1 && <span className="ws-live-tag">🎱 {t("Am Tisch")}</span>}
                      {e.is_paused && <span className="ws-paused-pill"><Pause size={12} /> {t("pausiert")}</span>}
                    </span>
                  </span>
                  <span className={"ws-rank-num" + alt}>{e.wins}</span>
                  <span className={"ws-rank-num" + alt}>{e.losses}</span>
                  <span className={"ws-rank-streak" + alt} title={e.streak > 1 ? t("{n} in Folge", { n: e.streak }) : undefined}>{e.streak > 1 ? `🔥${e.streak}` : ""}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {games.length > 0 && (
        <section className="stat-block">
          <h3><Repeat size={17} /> {t("Verlauf")}</h3>
          {games.map((g) => {
            const ea = entryById(g.entry_a_id), eb = entryById(g.entry_b_id);
            const wonA = g.winner_entry_id === g.entry_a_id;
            return (
              <div key={g.id} className="stat-row turnier-standings-row">
                <span className="medal">{g.game_no}.</span>
                <span className="stat-name">
                  <b style={wonA ? { color: "var(--win)" } : undefined}>{ea ? entryName(ea) : "?"}</b>
                  {" "}{g.score_a}:{g.score_b}{" "}
                  <b style={!wonA ? { color: "var(--win)" } : undefined}>{eb ? entryName(eb) : "?"}</b>
                </span>
              </div>
            );
          })}
        </section>
      )}

      {canReport && (
        <div className="sticky-cta ws-cta">
          <button className="btn primary" disabled={busy || sA === sB} onClick={reportGame}>
            <Check size={18} /> {sA === sB ? t("Eintragen") : t("{a}:{b} eintragen", { a: sA, b: sB })}
          </button>
        </div>
      )}
      </div>
      <ImprintFooter />
    </div>
  );
}
