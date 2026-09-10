import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ChevronLeft, Trophy, Flag, Trash2, List, GitBranch, Users, UserPlus, Check, X, Timer, ScrollText, Download, Maximize2, Minimize2, ShieldCheck, Lock, FileText } from "lucide-react";
import { jsPDF } from "jspdf";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { initials, fmtDuration, fmtDateTime, fmtDate } from "../lib/format";
import Ball from "./Ball";
import PlayerMultiPicker from "./PlayerMultiPicker";
import TurnierGraph from "./TurnierGraph";
import TurnierMatchActions, { tmScores } from "./TurnierMatchActions";
import TurnierBerichtScreen from "./TurnierBerichtScreen";
import { bracketLabel, formatLabel, finalRoundLabel } from "../lib/turnierLayout";

const POLL_MS = 8000;

const bracketRank = { main: 0, winners: 0, losers: 1, final: 2 };

// Turnierraster: zeigt ein einzelnes Turnier an, laedt seine Daten selbst
// und pollt periodisch (kein Supabase Realtime im Einsatz, siehe CLAUDE.md) -
// bewusste Ausnahme vom sonstigen "alles ueber App.jsx loadData()"-Muster,
// weil das nur aktiv ist waehrend diese Seite offen ist.
export default function TurnierRasterScreen({ tournamentId, me, players, matches, toast, onBack, colorOf, badgeOf, photoOf, onReload, onReportTournamentMatch }) {
  const [tour, setTour] = useState(null);
  const [tms, setTms] = useState(null);
  const [roster, setRoster] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [viewMode, setViewMode] = useState("graph"); // list | graph | players - Grafik ist die Standardansicht (Nutzer-Feedback), Jeder-gegen-jeden ohne Playoff hat aber keinen Baum, siehe Fallback-Effekt unten
  const [journeyPlayerId, setJourneyPlayerId] = useState(null);
  // Maximieren-Modus fuer die Liste/Grafik-Ansicht des Turnierrasters (nicht
  // fuer Teilnehmer) - rein CSS-basiert (position:fixed ueber die ganze
  // Seite), bewusst OHNE die native Fullscreen-API: iOS Safari unterstuetzt
  // requestFullscreen() fuer normale Elemente ohnehin nicht (nur <video>),
  // und auf Browsern, die es unterstuetzen, rendert die Fullscreen-API NUR
  // das angeforderte Element selbst (den "Top Layer") - jeder Dialog, der
  // als Geschwister-Element danebenliegt (z.B. der Bestaetigen-Dialog fuer
  // neu eingegebene Ergebnisse, oder globale Popups wie "Du bist dran" aus
  // App.jsx), wird dabei komplett unsichtbar, unabhaengig vom z-index
  // (Nutzer-Feedback: Bestaetigen-Dialog im maximierten Zustand nicht
  // erreichbar - trat nur im echten Browser auf, nicht in der Vorschau, weil
  // requestFullscreen() dort mangels echter Nutzer-Geste stillschweigend
  // fehlschlug). Deshalb kein Versuch mehr, echtes Vollbild zu nutzen.
  const viewContainerRef = useRef(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const toggleMaximize = () => setIsMaximized((m) => !m);
  // Sicherheitsabfrage vor der ERSTEN Ergebnis-Erfassung (siehe organizerReport
  // unten) - eigenes Overlay im App-Layout statt window.confirm() (Nutzer-
  // Feedback), nach demselben modal-overlay/modal-box-Muster wie anderswo im
  // Code (z.B. MatchScreen.jsx "Match abbrechen?").
  const [pendingReport, setPendingReport] = useState(null); // { tm, s1, s2, onDone } | null
  // Turnier-Endplatzierung inkl. geteilter Plaetze (siehe tournament_final_
  // standings() in der DB) - nur relevant/geladen, sobald das Turnier
  // beendet ist, siehe load() unten.
  const [finalStandings, setFinalStandings] = useState(null);
  // Kompletter Turnierbericht (PDF/Druck, Nutzer-Feedback) - lokaler
  // Screen-Swap statt eigenem App.jsx-Tab (wie beim Maximieren-Modus oben),
  // da der Bericht rein aus bereits geladenen tms/finalStandings besteht.
  const [showReport, setShowReport] = useState(false);
  // Manuelles Hinzufuegen durch die Turnierleitung (Nutzer-Feedback: der
  // frueher entfernte PlayerMultiPicker-Auswahlschirm soll als ERGAENZUNG
  // zur Selbst-Anmeldung zurueckkommen, nicht als Ersatz) - eigener,
  // ausklappbarer Auswahlzustand statt eines Formularfelds, da er nur
  // waehrend der Anmeldephase gebraucht wird (siehe addPlayers/removePlayer
  // unten sowie tournament_organizer_add_players()/_remove_player()).
  const [showAddPlayers, setShowAddPlayers] = useState(false);
  const [addSelected, setAddSelected] = useState([]);
  const toggleAddSelected = (id) => setAddSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  // Gast-Person ohne App/Login (Nutzer-Feedback: "wenn jemand die App nicht
  // benutzen will") - eigenes, einfaches Textfeld statt PlayerMultiPicker,
  // da hier kein bestehender Spieler ausgewaehlt, sondern ein neuer
  // Platzhalter mit reinem Namen angelegt wird (siehe
  // tournament_organizer_add_guest() - erledigt Anlegen + Anmeldung in
  // einem Schritt). Ergebnisse gegen Gaeste zaehlen fuers Turnier normal,
  // fliessen aber nicht ins Rating (rebuild_elo() schliesst is_guest aus).
  const [guestName, setGuestName] = useState("");

  const load = useCallback(async () => {
    const [{ data: tr }, { data: matches }, { data: ros }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle(),
      supabase.from("tournament_matches")
        .select("id, bracket, round, bracket_position, player1_id, player2_id, is_bye, void, table_number, match_id, winner_id, next_match_id, loser_next_match_id, ready_at, match:matches(id, player1_id, player2_id, score1, score2, confirmed, reported_by, confirmed_by, played_at, discipline, run_log, high_run1, high_run2, avg1, avg2)")
        .eq("tournament_id", tournamentId)
        .order("bracket").order("round").order("bracket_position"),
      supabase.from("tournament_players").select("player_id").eq("tournament_id", tournamentId),
    ]);
    setTour(tr || null);
    setTms(matches || []);
    setRoster(ros || []);
    if (tr?.status === "finished") {
      const { data: fs } = await supabase.rpc("tournament_final_standings", { p_tournament_id: tournamentId });
      setFinalStandings(fs || null);
    } else {
      setFinalStandings(null);
    }
  }, [tournamentId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Grafik ist die Standardansicht (Nutzer-Feedback) - bei Jeder-gegen-jeden
  // OHNE Playoff gibt es aber keinen Baum; erst sobald tms geladen ist,
  // koennen wir das wissen, deshalb hier statt direkt im useState-Default.
  // Bewusst nur "abwaerts" (graph -> list), niemals umgekehrt - falls waehrend
  // des Betrachtens nachtraeglich ein Playoff-Baum entsteht, bleibt eine
  // manuell gewaehlte Ansicht unangetastet.
  useEffect(() => {
    if (!tms || !tour) return;
    // Bei normalem K.O. laeuft der Baum komplett unter bracket='main'
    // (generate_ko_bracket() nennt ihn nur bei Doppel-K.O. 'winners') - ohne
    // die format-Abfrage wuerde ein frisch gestartetes K.O.-Turnier hier
    // sofort wieder auf "Liste" zurueckfallen (siehe hasTreeSections unten).
    const hasTree = tour.format === "ko" || tms.some((tm) => tm.bracket !== "main");
    if (viewMode === "graph" && !hasTree) setViewMode("list");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tms, tour]);

  const nameOf = useCallback((id) => players.find((p) => p.id === id)?.nickname || null, [players]);

  // Nach Platz gruppiert (mehrere Eintraege = geteilter Platz), sortiert
  // aufsteigend - finalStandings kommt bereits mit korrektem placement/
  // tied_count aus tournament_final_standings(), hier nur zur Anzeige
  // gruppiert.
  const finalStandingsGrouped = useMemo(() => {
    if (!finalStandings || finalStandings.length === 0) return null;
    const byPlacement = {};
    finalStandings.forEach((row) => { (byPlacement[row.placement] ||= []).push(row.player_id); });
    return Object.keys(byPlacement).map(Number).sort((a, b) => a - b)
      .map((placement) => ({ placement, playerIds: byPlacement[placement] }));
  }, [finalStandings]);

  const standings = useMemo(() => {
    if (!tour || tour.format !== "round_robin" || !roster || !tms) return null;
    const tally = {};
    roster.forEach((r) => { tally[r.player_id] = { wins: 0, losses: 0 }; });
    tms.forEach((tm) => {
      // Nur die Gruppenphase zaehlt fuer die Tabelle - bei einem Turnier mit
      // Playoff-Stufe (bracket='final') sollen dessen Ergebnisse hier nicht
      // mit einfliessen, die Tabelle bildet nur die Gruppenphase ab.
      if (tm.bracket !== "main" || !tm.winner_id) return;
      const loser = tm.player1_id === tm.winner_id ? tm.player2_id : tm.player1_id;
      if (tally[tm.winner_id]) tally[tm.winner_id].wins += 1;
      if (loser && tally[loser]) tally[loser].losses += 1;
    });
    return Object.entries(tally)
      .map(([id, v]) => ({ id, name: nameOf(id), ...v }))
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  }, [tour, roster, tms, nameOf]);

  // Wartezeit einer Paarung = Zeit zwischen "beide Spieler stehen fest"
  // (tournament_matches.ready_at) und tatsaechlicher Ergebnismeldung
  // (matches.played_at) - zeigt, welche Paarungen am laengsten auf ihr
  // Match warten mussten (z.B. weil sie auf einen Tisch/Gegner-Ergebnis
  // warten mussten), absteigend sortiert.
  const waitRanked = useMemo(() => {
    if (!tms) return [];
    return tms
      .filter((tm) => tm.ready_at && tm.match?.played_at)
      .map((tm) => ({ tm, waitMs: new Date(tm.match.played_at) - new Date(tm.ready_at) }))
      .filter((x) => x.waitMs > 0)
      .sort((a, b) => b.waitMs - a.waitMs);
  }, [tms]);

  // Spielprotokoll: alle bestaetigten Partien in der Reihenfolge, in der sie
  // tatsaechlich gespielt/gemeldet wurden (matches.played_at) - unabhaengig
  // vom Baum-Layout, damit man den zeitlichen Ablauf des Turniertages
  // nachvollziehen kann. Erst am Ende des Turniers relevant, siehe Gating in
  // der JSX unten (tour.status === "finished").
  const timeline = useMemo(() => {
    if (!tms) return [];
    return tms
      .filter((tm) => tm.match?.confirmed && tm.match?.played_at)
      .sort((a, b) => new Date(a.match.played_at) - new Date(b.match.played_at));
  }, [tms]);

  const downloadProtocolPdf = () => {
    const doc = new jsPDF();
    const marginX = 14;
    const pageH = doc.internal.pageSize.getHeight();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;
    doc.setFontSize(16);
    doc.text(tour.name, marginX, y);
    y += 7;
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`${formatLabel(tour.format)} · ${t(tour.discipline)} · ${fmtDate(tour.created_at)}`, marginX, y);
    y += 10;
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text(t("Zeit"), marginX, y);
    doc.text(t("Partie"), marginX + 32, y);
    doc.text(t("Ergebnis"), pageW - marginX - 28, y);
    doc.setFont(undefined, "normal");
    y += 2;
    doc.setDrawColor(180);
    doc.line(marginX, y, pageW - marginX, y);
    y += 7;
    doc.setFontSize(10);
    timeline.forEach((tm) => {
      if (y > pageH - 20) { doc.addPage(); y = 20; }
      const n1 = nameOf(tm.player1_id) || "?", n2 = nameOf(tm.player2_id) || "?";
      const sc = tmScores(tm);
      doc.text(fmtDateTime(tm.match.played_at), marginX, y);
      doc.text(`${n1} – ${n2}`, marginX + 32, y, { maxWidth: pageW - marginX * 2 - 32 - 32 });
      doc.text(`${sc.s1}:${sc.s2}`, pageW - marginX - 28, y);
      y += 7;
    });
    if (timeline.length === 0) doc.text(t("Noch keine Partie in diesem Turnier."), marginX, y);
    doc.save(`${tour.name.replace(/[^\w\-]+/g, "_")}_protokoll.pdf`);
  };

  // Verlauf eines Spielers: alle Rasterplaetze, an denen er beteiligt ist,
  // in Lese-Reihenfolge durch den Baum (Gewinnerbaum vor Verliererbaum vor
  // Finale, je Abschnitt nach Runde) - erzaehlt seinen Weg durchs Turnier.
  const journeyFor = useCallback((playerId) => {
    if (!tms) return [];
    return tms
      .filter((tm) => tm.player1_id === playerId || tm.player2_id === playerId)
      .sort((a, b) => (bracketRank[a.bracket] - bracketRank[b.bracket]) || (a.round - b.round));
  }, [tms]);

  // Nur fuer die Selbst-Meldung eines Spielers - die geht ueber den vollen
  // MatchScreen-Flow (Siegchance-Vorschau, 14/1-Rechner). Die Turnierleitung
  // meldet/korrigiert stattdessen direkt inline (organizerReport/editMatch
  // unten) - schnelle Zaehler statt Navigation, siehe TurnierMatchActions.jsx.
  const openMatchScreen = (tm) => {
    onReportTournamentMatch({
      tournamentMatchId: tm.id, discipline: tour.discipline,
      player1Id: tm.player1_id, player2Id: tm.player2_id,
    });
  };

  // Anders als bei einer spaeteren Korrektur (siehe editMatch) ist dies die
  // ERSTE Erfassung des Ergebnisses - bestaetigt sofort und bestimmt den
  // Sieger, der im Turnierbaum weiterkommt. Eine falsche Sieger-Eintragung
  // ist danach evtl. gar nicht mehr korrigierbar (siehe Schutz in
  // tournament_organizer_edit_match, der eine Sieger-aendernde Korrektur
  // ablehnt, sobald der Sieger schon weitergezogen ist) - deshalb hier eine
  // explizite Sicherheitsabfrage MIT Sieger-Namen (Nutzer-Feedback). Stoesst
  // nur noch das Overlay an (siehe pendingReport/confirmPendingReport unten)
  // statt selbst zu blockieren - die eigentliche RPC laeuft erst nach
  // Bestaetigung im Overlay.
  const organizerReport = (tm, s1, s2, onDone) => {
    setPendingReport({ tm, s1, s2, onDone });
  };

  const confirmPendingReport = async () => {
    const { tm, s1, s2, onDone } = pendingReport;
    setPendingReport(null);
    setBusyId(tm.id);
    const { error } = await supabase.rpc("tournament_organizer_report_match", {
      p_tournament_match_id: tm.id, p_score1: s1, p_score2: s2,
    });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Ergebnis als Turnierleitung eingetragen."));
    onDone();
    await load();
    if (onReload) onReload();
  };

  const confirm = async (tm, ok) => {
    setBusyId(tm.id);
    const { error } = await supabase.rpc("confirm_match", { p_match_id: tm.match.id, p_ok: ok });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t(ok ? "Match bestaetigt - Ranking wird neu berechnet." : "Match zurueckgewiesen."));
    await load();
    if (onReload) onReload();
  };

  const forceConfirm = async (tm) => {
    if (!window.confirm(t("Dieses Ergebnis als Turnierleitung erzwungen bestätigen?"))) return;
    setBusyId(tm.id);
    const { error } = await supabase.rpc("tournament_force_confirm_match", { p_tournament_match_id: tm.id });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Erzwungen bestätigt."));
    await load();
    if (onReload) onReload();
  };

  const editMatch = async (tm, s1, s2, onDone) => {
    setBusyId(tm.id);
    const { error } = await supabase.rpc("tournament_organizer_edit_match", {
      p_tournament_match_id: tm.id, p_score1: s1, p_score2: s2,
    });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Ergebnis korrigiert."));
    onDone();
    await load();
    if (onReload) onReload();
  };

  // Nichterscheinen (Nutzer-Feedback): eine oder beide Parteien tauchen zum
  // Match nicht auf - siehe tournament_mark_no_show() fuer die Kaskade auf
  // alle weiteren offenen Partien der/des tatsaechlich Ausgeschiedenen.
  const markNoShow = async (tm, absentPlayerIds, onDone) => {
    setBusyId(tm.id);
    const { error } = await supabase.rpc("tournament_mark_no_show", {
      p_tournament_match_id: tm.id, p_absent_player_ids: absentPlayerIds,
    });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Nichterscheinen eingetragen."));
    onDone();
    await load();
    if (onReload) onReload();
  };

  const endEarly = async () => {
    if (!window.confirm(t("Turnier jetzt vorzeitig beenden? Bereits gespielte Partien bleiben als Turnierspiele in der Rangliste."))) return;
    setBusyId("end");
    const { error } = await supabase.rpc("tournament_end_early", { p_tournament_id: tournamentId });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Turnier beendet."));
    await load();
  };

  // Schranke (Nutzer-Feedback): erst mit dieser expliziten Bestaetigung durch
  // Turnierleitung/Admin werden Ergebnis-Korrekturen gesperrt (siehe
  // resultsLocked/tournament_confirm_results) - bis dahin bleiben Tippfehler
  // jederzeit korrigierbar. Bewusst window.confirm() wie bei endEarly/
  // deleteTournament (gleiche Kategorie: einmalige, irreversible Aktion ohne
  // weitere Dateneingabe) statt eines eigenen Overlays.
  const confirmResults = async () => {
    if (!window.confirm(t("Turnier endgültig bestätigen? Danach sind keine Ergebnis-Korrekturen mehr möglich."))) return;
    setBusyId("confirmResults");
    const { error } = await supabase.rpc("tournament_confirm_results", { p_tournament_id: tournamentId });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Turnier bestätigt - Korrekturen sind jetzt gesperrt."));
    await load();
  };

  const deleteTournament = async () => {
    if (!window.confirm(t("Dieses Turnier wirklich unwiderruflich löschen?"))) return;
    setBusyId("delete");
    const { error } = await supabase.rpc("tournament_delete", { p_tournament_id: tournamentId });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Turnier gelöscht."));
    onBack();
  };

  // Anmeldephase (Nutzer-Feedback): Turniere starten ohne Teilnehmerliste,
  // jeder meldet sich selbst an/ab, die Turnierleitung startet erst dann
  // explizit (generiert an dieser Stelle den Baum, siehe tournament_start).
  const register = async () => {
    setBusyId("register");
    const { error } = await supabase.rpc("tournament_register", { p_tournament_id: tournamentId });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Angemeldet."));
    await load();
  };

  const unregister = async () => {
    setBusyId("register");
    const { error } = await supabase.rpc("tournament_unregister", { p_tournament_id: tournamentId });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Abgemeldet."));
    await load();
  };

  const addPlayers = async () => {
    setBusyId("addPlayers");
    const { error } = await supabase.rpc("tournament_organizer_add_players", {
      p_tournament_id: tournamentId, p_player_ids: addSelected,
    });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Spieler hinzugefügt."));
    setAddSelected([]);
    setShowAddPlayers(false);
    await load();
  };

  const addGuest = async () => {
    if (!guestName.trim()) { toast(t("Name fehlt.")); return; }
    setBusyId("addGuest");
    const { error } = await supabase.rpc("tournament_organizer_add_guest", {
      p_tournament_id: tournamentId, p_nickname: guestName.trim(),
    });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Gast hinzugefügt."));
    setGuestName("");
    await load();
    if (onReload) await onReload();
  };

  const removePlayer = async (playerId) => {
    setBusyId("removePlayer");
    const { error } = await supabase.rpc("tournament_organizer_remove_player", {
      p_tournament_id: tournamentId, p_player_id: playerId,
    });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Spieler entfernt."));
    await load();
  };

  const startTournament = async () => {
    if (!window.confirm(t("Turnier jetzt starten? Der Turnierbaum wird aus den aktuell angemeldeten Spielern ausgelost."))) return;
    setBusyId("start");
    const { error } = await supabase.rpc("tournament_start", { p_tournament_id: tournamentId });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Turnier gestartet."));
    await load();
  };

  // Fuer den Fall, dass die Turnierleitung sich bei der Anwesenheitspruefung
  // verzaehlt/verklickt hat (Nutzer-Feedback) - nur solange noch KEIN Match
  // gemeldet wurde (serverseitig identisch zur canDeleteTournament-Pruefung
  // unten durchgesetzt), loescht den ausgelosten Baum wieder und geht
  // zurueck in die Anmeldephase - die Anmeldeliste selbst bleibt bestehen.
  const cancelStart = async () => {
    if (!window.confirm(t("Start rückgängig machen und zurück zur Anmeldung?"))) return;
    setBusyId("cancelStart");
    const { error } = await supabase.rpc("tournament_cancel_start", { p_tournament_id: tournamentId });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Start rückgängig gemacht."));
    await load();
  };

  if (!tour || !tms) {
    return (
      <div className="screen">
        <header className="screen-head with-back">
          <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
          <h2>{t("Turnier")}</h2>
        </header>
        <p className="hint">{t("Lade ...")}</p>
      </div>
    );
  }

  if (showReport) {
    return (
      <TurnierBerichtScreen tour={tour} tms={tms} finalStandings={finalStandings}
        nameOf={nameOf} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
        onBack={() => setShowReport(false)} />
    );
  }

  const isOrganizer = me.id === tour.organizer_id || me.role === "admin";
  // Nutzer-Feedback: die Turnierleitung war bisher nirgends sichtbar - man
  // musste erst selbst Organisator/Admin sein, um es an den eigenen
  // Rechten (isOrganizer) zu erahnen. tour.organizer_id ist ueber select("*")
  // in load() bereits geladen, hier nur eine Namens-/Avatar-Anzeige.
  const organizerName = nameOf(tour.organizer_id);

  if (tour.status === "setup") {
    const isRegistered = (roster || []).some((r) => r.player_id === me.id);
    return (
      <div className="screen">
        <div className="turnier-layout">
        <header className="screen-head with-back">
          <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
          <h2>{tour.name}</h2>
        </header>
        <p className="hint" style={{ marginTop: -6 }}>
          {formatLabel(tour.format)} · {t(tour.discipline)} · {t("Anmeldung offen")}
        </p>
        <div className="turnier-organizer-line">
          <span className="hint" style={{ margin: 0 }}>{t("Turnierleitung")}:</span>
          <Ball color={colorOf(organizerName)} label={initials(organizerName)} badge={badgeOf(organizerName)} photo={photoOf(organizerName)} size={22} />
          <b>{organizerName || "?"}</b>
        </div>

        <section className="stat-block">
          <h3><Users size={17} /> {t("Angemeldet")} ({(roster || []).length})</h3>
          {(roster || []).length === 0 ? (
            <p className="hint">{t("Noch niemand angemeldet.")}</p>
          ) : (
            <div className="pmp-grid">
              {(roster || []).map((r) => {
                const nick = nameOf(r.player_id);
                if (!nick) return null;
                const isGuest = players.find((p) => p.id === r.player_id)?.is_guest;
                return (
                  <div key={r.player_id} className="pmp-chip">
                    <Ball color={colorOf(nick)} label={initials(nick)} badge={badgeOf(nick)} photo={photoOf(nick)} size={32} />
                    <span className="pmp-name">{nick}{isGuest && <span className="guest-tag">{t("Gast")}</span>}</span>
                    {isOrganizer && (
                      <button type="button" className="pmp-remove" disabled={busyId === "removePlayer"}
                        onClick={() => removePlayer(r.player_id)} aria-label={t("Entfernen")} title={t("Entfernen")}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <button className="btn primary" style={{ marginTop: 14 }} disabled={busyId === "register"}
            onClick={isRegistered ? unregister : register}>
            {isRegistered ? t("Abmelden") : t("Anmelden")}
          </button>

          {isOrganizer && (
            <>
              <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setShowAddPlayers((s) => !s)}>
                {showAddPlayers ? <><X size={15} /> {t("Abbrechen")}</> : <><UserPlus size={15} /> {t("Spieler hinzufügen")}</>}
              </button>
              {showAddPlayers && (
                <div style={{ marginTop: 10 }}>
                  <PlayerMultiPicker players={players} matches={matches} me={me} selected={addSelected}
                    onToggle={toggleAddSelected} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                    exclude={(roster || []).map((r) => r.player_id)} />
                  <button className="btn primary" style={{ marginTop: 10 }}
                    disabled={addSelected.length === 0 || busyId === "addPlayers"} onClick={addPlayers}>
                    <Check size={15} /> {t("{n} Spieler hinzufügen", { n: addSelected.length })}
                  </button>
                </div>
              )}
              <div className="turnier-guest-form">
                <input type="text" placeholder={t("Name des Gasts")} value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addGuest(); }} />
                <button className="btn ghost" disabled={!guestName.trim() || busyId === "addGuest"} onClick={addGuest}>
                  <UserPlus size={15} /> {t("Gast hinzufügen")}
                </button>
              </div>
              <p className="hint" style={{ marginTop: 4 }}>
                {t("Für Personen ohne App - Ergebnisse gegen Gäste zählen fürs Turnier, aber nicht fürs Rating.")}
              </p>
            </>
          )}
        </section>

        {isOrganizer && (
          <div className="chips small" style={{ marginBottom: 10 }}>
            <button className="btn primary" disabled={busyId === "start"} onClick={startTournament}>
              <Flag size={15} /> {t("Turnier starten")}
            </button>
            <button className="btn ghost" disabled={busyId === "delete"} onClick={deleteTournament}>
              <Trash2 size={15} /> {t("Turnier löschen")}
            </button>
          </div>
        )}
        </div>
      </div>
    );
  }

  const canDeleteTournament = isOrganizer && !tms.some((tm) => tm.match_id);
  const resultsLocked = !!tour.results_confirmed_at;
  const canConfirmResults = isOrganizer && tour.status === "finished" && !resultsLocked;
  const groups = {};
  tms.forEach((tm) => { (groups[tm.bracket] ||= []).push(tm); });
  // Aus den TATSAECHLICH vorhandenen bracket-Werten ableiten statt aus einer
  // festen Formats-Tabelle - ein Jeder-gegen-jeden-Turnier mit Playoff hat
  // sowohl 'main' (Tabelle) als auch 'final' (Playoff-Baum), ein Doppel-K.O.
  // mit fruehem Cutover weiterhin winners/losers/final wie gehabt.
  const bracketOrder = ["main", "winners", "losers", "final"].filter((b) => groups[b]?.length);
  const finalTotalRounds = groups.final ? Math.max(...groups.final.map((m) => m.round)) : 0;
  // Bei normalem K.O. (nicht Doppel-K.O.) laeuft der komplette Baum unter
  // bracket='main' (generate_ko_bracket() nennt ihn nur bei Doppel-K.O.
  // 'winners') - ohne die format-Abfrage haette ein reines K.O.-Turnier nie
  // eine Grafik-Ansicht bekommen, da 'main' sonst nur die flache
  // Jeder-gegen-jeden-Tabelle ohne Baumstruktur ist (Nutzer-Feedback).
  const hasTreeSections = tour.format === "ko" || bracketOrder.some((b) => b !== "main");

  const renderMatch = (tm) => {
    const n1 = nameOf(tm.player1_id), n2 = nameOf(tm.player2_id);
    const sc = tmScores(tm);
    return (
      <div key={tm.id} className="turnier-match-card">
        <div className="turnier-match-meta">
          <span className="turnier-match-players">
            {tm.is_bye ? (
              <>
                {n1 && <Ball color={colorOf(n1)} label={initials(n1)} badge={badgeOf(n1)} photo={photoOf(n1)} size={22} />}
                <b>{n1 || "?"}</b>&nbsp;{t("(Freilos)")}
              </>
            ) : (
              <>
                {n1 && <Ball color={colorOf(n1)} label={initials(n1)} badge={badgeOf(n1)} photo={photoOf(n1)} size={22} />}
                <b>{n1 || t("TBD")}</b>
                <span className="turnier-match-score">{sc ? `${sc.s1}:${sc.s2}` : "–"}</span>
                <b>{n2 || t("TBD")}</b>
                {n2 && <Ball color={colorOf(n2)} label={initials(n2)} badge={badgeOf(n2)} photo={photoOf(n2)} size={22} />}
              </>
            )}
          </span>
        </div>
        {tm.table_number != null && <span className="m-disc">{t("Tisch")} {tm.table_number}</span>}
        <TurnierMatchActions tm={tm} me={me} isOrganizer={isOrganizer} tourStatus={tour.status} resultsLocked={resultsLocked} nameOf={nameOf}
          busyId={busyId} onOpenMatchScreen={openMatchScreen} onOrganizerReport={organizerReport}
          onConfirm={confirm} onForceConfirm={forceConfirm} onEditMatch={editMatch} onMarkNoShow={markNoShow} />
      </div>
    );
  };

  return (
    <div className="screen">
      <div className="turnier-layout">
      <header className="screen-head with-back">
        <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
        <h2>{tour.name}</h2>
      </header>
      <p className="hint" style={{ marginTop: -6 }}>
        {formatLabel(tour.format)} · {t(tour.discipline)} · {tour.status === "finished" ? t("beendet") : t("läuft")}
        {tour.status === "finished" && (resultsLocked
          ? <> · <Lock size={12} style={{ verticalAlign: -1 }} /> {t("Ergebnisse bestätigt")}</>
          : <> · {t("Korrekturen noch möglich")}</>)}
      </p>
      <div className="turnier-organizer-line">
        <span className="hint" style={{ margin: 0 }}>{t("Turnierleitung")}:</span>
        <Ball color={colorOf(organizerName)} label={initials(organizerName)} badge={badgeOf(organizerName)} photo={photoOf(organizerName)} size={22} />
        <b>{organizerName || "?"}</b>
      </div>

      {isOrganizer && (tour.status === "running" || canDeleteTournament || canConfirmResults) && (
        <div className="chips small" style={{ marginBottom: 10 }}>
          {tour.status === "running" && (
            <button className="btn ghost" disabled={busyId === "end"} onClick={endEarly}>
              <Flag size={15} /> {t("Turnier vorzeitig beenden")}
            </button>
          )}
          {tour.status === "running" && canDeleteTournament && (
            <button className="btn ghost" disabled={busyId === "cancelStart"} onClick={cancelStart}>
              <Users size={15} /> {t("Start rückgängig machen")}
            </button>
          )}
          {canConfirmResults && (
            <button className="btn ghost" disabled={busyId === "confirmResults"} onClick={confirmResults}>
              <ShieldCheck size={15} /> {t("Turnier bestätigen")}
            </button>
          )}
          {canDeleteTournament && (
            <button className="btn ghost" disabled={busyId === "delete"} onClick={deleteTournament}>
              <Trash2 size={15} /> {t("Turnier löschen")}
            </button>
          )}
        </div>
      )}

      {tour.status === "finished" && (
        <div className="chips small" style={{ marginBottom: 10 }}>
          <button className="btn ghost" onClick={() => setShowReport(true)}>
            <FileText size={15} /> {t("Kompletter Turnierbericht")}
          </button>
        </div>
      )}

      {finalStandingsGrouped && (
        <section className="stat-block">
          <h3><Trophy size={17} /> {t("Bestenliste")}</h3>
          {finalStandingsGrouped.map(({ placement, playerIds }) => (
            <div key={placement} className="stat-row turnier-standings-row">
              <span className="medal">{placement}.</span>
              <span className="stat-name turnier-tied-names">
                {playerIds.map((pid) => {
                  const n = nameOf(pid);
                  return n ? (
                    <span key={pid} className="turnier-tied-player">
                      <Ball color={colorOf(n)} label={initials(n)} badge={badgeOf(n)} photo={photoOf(n)} size={24} />
                      {n}
                    </span>
                  ) : null;
                })}
              </span>
              {playerIds.length > 1 && <span className="hint" style={{ margin: 0 }}>{t("geteilt")}</span>}
            </div>
          ))}
        </section>
      )}

      {standings && (
        <section className="stat-block">
          <h3><Trophy size={17} /> {t("Tabelle")}</h3>
          {standings.map((s, i) => (
            <div key={s.id} className="stat-row turnier-standings-row">
              <span className="medal">{i + 1}.</span>
              <Ball color={colorOf(s.name)} label={initials(s.name)} size={28} />
              <span className="stat-name">{s.name}</span>
              <span className="stat-val">{s.wins}S / {s.losses}N</span>
            </div>
          ))}
        </section>
      )}

      {waitRanked.length > 0 && (
        <section className="stat-block">
          <h3><Timer size={17} /> {t("Längste Wartezeiten")}</h3>
          <p className="hint" style={{ marginTop: 0 }}>{t("Zeit zwischen feststehender Paarung und gemeldetem Ergebnis.")}</p>
          {waitRanked.slice(0, 5).map(({ tm, waitMs }) => {
            const n1 = nameOf(tm.player1_id), n2 = nameOf(tm.player2_id);
            return (
              <div key={tm.id} className="stat-row turnier-standings-row">
                <Ball color={colorOf(n1)} label={initials(n1)} badge={badgeOf(n1)} photo={photoOf(n1)} size={26} />
                <Ball color={colorOf(n2)} label={initials(n2)} badge={badgeOf(n2)} photo={photoOf(n2)} size={26} />
                <span className="stat-name">{n1} – {n2}</span>
                <span className="stat-val">{fmtDuration(waitMs)}</span>
              </div>
            );
          })}
          {waitRanked.length > 5 && <p className="hint">{t("+{n} weitere", { n: waitRanked.length - 5 })}</p>}
        </section>
      )}

      {tour.status === "finished" && (
        <section className="stat-block">
          <div className="stat-block-head">
            <h3><ScrollText size={17} /> {t("Spielprotokoll")}</h3>
            <button className="btn ghost" onClick={downloadProtocolPdf}>
              <Download size={15} /> {t("Als PDF herunterladen")}
            </button>
          </div>
          <p className="hint" style={{ marginTop: 0 }}>{t("Zeitlicher Ablauf aller gespielten Partien.")}</p>
          {timeline.length === 0 && <p className="hint">{t("Noch keine Partie in diesem Turnier.")}</p>}
          {timeline.map((tm) => {
            const n1 = nameOf(tm.player1_id), n2 = nameOf(tm.player2_id);
            const won1 = tm.winner_id === tm.player1_id;
            const sc = tmScores(tm);
            return (
              <div key={tm.id} className="stat-row turnier-standings-row">
                <span className="m-date m-datetime">{fmtDateTime(tm.match.played_at)}</span>
                <Ball color={colorOf(n1)} label={initials(n1)} badge={badgeOf(n1)} photo={photoOf(n1)} size={24} />
                <span className="stat-name">
                  {n1} <b style={won1 ? { color: "var(--win)" } : undefined}>{sc.s1}</b>
                  {" : "}
                  <b style={!won1 ? { color: "var(--win)" } : undefined}>{sc.s2}</b> {n2}
                </span>
                <Ball color={colorOf(n2)} label={initials(n2)} badge={badgeOf(n2)} photo={photoOf(n2)} size={24} />
              </div>
            );
          })}
        </section>
      )}

      <div className="chips small turnier-view-toggle">
        {hasTreeSections && (
          <button className={"chip" + (viewMode === "graph" ? " active" : "")} onClick={() => setViewMode("graph")}>
            <GitBranch size={14} /> {t("Grafik")}
          </button>
        )}
        <button className={"chip" + (viewMode === "list" ? " active" : "")} onClick={() => setViewMode("list")}>
          <List size={14} /> {t("Liste")}
        </button>
        <button className={"chip" + (viewMode === "players" ? " active" : "")} onClick={() => setViewMode("players")}>
          <Users size={14} /> {t("Teilnehmer")}
        </button>
        {viewMode !== "players" && (
          <button className="chip turnier-maximize-btn" onClick={toggleMaximize}
            aria-label={t(isMaximized ? "Minimieren" : "Maximieren")}>
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        )}
      </div>

      <div ref={viewContainerRef} className={"turnier-view-container" + (isMaximized ? " is-maximized" : "")}>
      {/* Der maximierte Zustand deckt per position:fixed die ganze Seite ab,
          also auch die Umschalt-Chips oben mit dem "Minimieren"-Button darin -
          ohne diese Zeile gaebe es keinen Weg mehr zurueck. Fuer die Grafik-
          Ansicht sitzt das Minimieren stattdessen IN TurnierGraph.jsx' eigener
          Kopfzeile (spart die ganze Zeile hier, Nutzer-Feedback: "es wird
          immer noch Platz verschenkt") - diese separate Zeile ist deshalb nur
          fuer Liste/Teilnehmer noetig, die keine eigene Kopfzeile haben. */}
      {isMaximized && viewMode !== "graph" && (
        <div className="turnier-maximize-exit-row">
          <button className="chip" onClick={toggleMaximize} aria-label={t("Minimieren")}>
            <Minimize2 size={14} /> {t("Minimieren")}
          </button>
        </div>
      )}
      {viewMode === "players" ? (
        <section className="stat-block">
          <h3><Users size={17} /> {t("Teilnehmer")}</h3>
          {journeyPlayerId && (() => {
            const jName = nameOf(journeyPlayerId);
            const path = journeyFor(journeyPlayerId);
            return (
              <div className="turnier-graph-detail">
                <div className="turnier-match-meta">
                  <span className="turnier-match-players">
                    <Ball color={colorOf(jName)} label={initials(jName)} badge={badgeOf(jName)} photo={photoOf(jName)} size={28} />
                    <b>{jName}</b>
                  </span>
                  <button className="turnier-graph-detail-close" onClick={() => setJourneyPlayerId(null)} aria-label={t("Schliessen")}>
                    <X size={16} />
                  </button>
                </div>
                {path.length === 0 && <p className="hint">{t("Noch keine Partie in diesem Turnier.")}</p>}
                {path.map((tm) => {
                  const isP1 = tm.player1_id === journeyPlayerId;
                  const oppName = nameOf(isP1 ? tm.player2_id : tm.player1_id);
                  const sc = tmScores(tm);
                  const myScore = sc ? (isP1 ? sc.s1 : sc.s2) : null;
                  const oppScore = sc ? (isP1 ? sc.s2 : sc.s1) : null;
                  const won = tm.winner_id === journeyPlayerId;
                  let statusText;
                  if (tm.is_bye) statusText = t("Freilos");
                  else if (!tm.match_id) statusText = !oppName ? t("Wartet auf Gegner …") : tm.table_number == null ? t("Tisch wird noch zugeteilt") : t("Ausstehend");
                  else if (!tm.match.confirmed) statusText = t("Wartet auf Bestätigung ...");
                  else statusText = won ? t("Sieg") : t("Niederlage");
                  const roundLabel = tm.bracket === "final" ? finalRoundLabel(tm.round, finalTotalRounds) : `${t("Runde")} ${tm.round}`;
                  return (
                    <div key={tm.id} className="stat-row turnier-standings-row">
                      <span className="stat-name">
                        {bracketOrder.length > 1 ? bracketLabel(tm.bracket) : t("Raster")} · {roundLabel}
                        {oppName ? ` · vs ${oppName}` : ""}
                      </span>
                      <span className="stat-val" style={won ? { color: "var(--win)" } : (tm.match?.confirmed && !won ? { color: "var(--loss)" } : undefined)}>
                        {myScore != null ? `${myScore}:${oppScore}` : statusText}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div className="pmp-grid">
            {(roster || []).map((r) => {
              const nick = nameOf(r.player_id);
              if (!nick) return null;
              return (
                <button key={r.player_id} type="button"
                  className={"pmp-chip" + (journeyPlayerId === r.player_id ? " sel" : "")}
                  onClick={() => setJourneyPlayerId(r.player_id === journeyPlayerId ? null : r.player_id)}>
                  <Ball color={colorOf(nick)} label={initials(nick)} badge={badgeOf(nick)} photo={photoOf(nick)} size={32} />
                  <span className="pmp-name">{nick}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : viewMode === "graph" && hasTreeSections ? (
        <section className="stat-block">
          {/* Die Ueberschrift + Zoom-Icons rendert TurnierGraph.jsx jetzt selbst
              (eigene Kopfzeile), damit die Zoom-Buttons direkt daneben Platz
              finden statt in der Toolbar darunter (Nutzer-Feedback). Bei
              Jeder-gegen-jeden mit Playoff hat die Gruppenphase ('main') keine
              next_match_id-Struktur - nur die Playoff-Stufe ('final') gehoert
              in den Baum, die Gruppentabelle steht schon oben. */}
          <TurnierGraph matches={tour.format === "round_robin" ? tms.filter((tm) => tm.bracket !== "main") : tms}
            nameOf={nameOf} me={me} isOrganizer={isOrganizer} tourStatus={tour.status} resultsLocked={resultsLocked}
            busyId={busyId} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
            onOpenMatchScreen={openMatchScreen} onOrganizerReport={organizerReport}
            onConfirm={confirm} onForceConfirm={forceConfirm} onEditMatch={editMatch} onMarkNoShow={markNoShow}
            isMaximized={isMaximized} onToggleMaximize={toggleMaximize} />
        </section>
      ) : (
        <div className="turnier-brackets">
          {bracketOrder.map((b) => {
            const list = groups[b] || [];
            if (list.length === 0) return null;
            const byRound = {};
            list.forEach((tm) => { (byRound[tm.round] ||= []).push(tm); });
            return (
              <section key={b} className="stat-block">
                <h3><Trophy size={17} /> {bracketOrder.length > 1 ? bracketLabel(b) : t("Raster")}</h3>
                <div className="turnier-rounds">
                  {Object.keys(byRound).sort((a, c) => a - c).map((r) => (
                    <div key={r} className="turnier-round-col">
                      <p className="turnier-round-title">
                        {b === "final" ? finalRoundLabel(Number(r), finalTotalRounds) : `${t("Runde")} ${r}`}
                      </p>
                      {/* Bereits gespielte/entschiedene Partien (Ergebnis
                          gemeldet ODER Freilos) ans Ende der jeweiligen Runde
                          - Nutzer-Feedback: oben soll auf einen Blick
                          sichtbar sein, was noch aussteht, statt zwischen
                          bereits erledigten Partien suchen zu muessen.
                          .slice() vor sort() noetig, sonst wuerde das
                          Original-Array in byRound mutiert. */}
                      {byRound[r].slice().sort((a, c) => {
                        const aDone = a.match_id != null || a.is_bye ? 1 : 0;
                        const cDone = c.match_id != null || c.is_bye ? 1 : 0;
                        return aDone - cDone || a.bracket_position - c.bracket_position;
                      }).map(renderMatch)}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      </div>
      </div>
      {pendingReport && (
        <div className="modal-overlay" onClick={() => setPendingReport(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{t("Ergebnis eintragen?")}</h3>
            <p>{t("{winner} gewinnt {s1}:{s2}.", {
              winner: pendingReport.s1 > pendingReport.s2 ? nameOf(pendingReport.tm.player1_id) : nameOf(pendingReport.tm.player2_id),
              s1: pendingReport.s1, s2: pendingReport.s2,
            })}</p>
            <div className="sp-controls">
              <button className="btn ghost" onClick={() => setPendingReport(null)}>{t("Abbrechen")}</button>
              <button className="btn primary" onClick={confirmPendingReport}>{t("Eintragen")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
