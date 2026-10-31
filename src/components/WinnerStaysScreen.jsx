import { Fragment, useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { ChevronLeft, Repeat, UserPlus, X, Check, Trash2, Flag, Crown, ChevronUp, ChevronDown, Pause, Play, Plus, Minus, WifiOff, RefreshCw } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { initials } from "../lib/format";
import { appConfirm } from "../lib/confirmDialog";
import Ball from "./Ball";
import PlayerPicker from "./PlayerPicker";
import PlayerMultiPicker from "./PlayerMultiPicker";
import ImprintFooter from "./widgets/ImprintFooter";
import EndTournamentButton from "./widgets/EndTournamentButton";
import KeepAwakeButton from "./widgets/KeepAwakeButton";
import { BreakPill, BreakGlyph, breakApplies, normalizeBreakRule, nextBreaker } from "./widgets/BreakRule";
import { loadWsDraft, saveWsDraft } from "../lib/matchDraft";
import { rpcRetry } from "../lib/rpcRetry";
import DiscBall from "./widgets/DiscBall";
import PlaceLink from "./widgets/PlaceLink";
import TurnierQrButton from "./widgets/TurnierQr";
import Emoji from "./Emoji";

const POLL_MS = 8000;

// "Winner Stays" (Nutzer-Feedback): ein Tisch, mehrere Leute in einer
// Warteschlange - die zwei vordersten (Position 0/1) spielen, der Sieger
// bleibt (Position bleibt unveraendert), der Verlierer geht ans Ende, alle
// dahinter ruecken auf (siehe winner_stays_report_game() in der DB - die
// ganze Rotation passiert dort serverseitig, dieser Screen zeigt nur den
// aktuellen Stand und bietet die Eingabemaske). Voellig anderes Datenmodell
// als TurnierRasterScreen.jsx (keine Bracket-Struktur), deshalb ein
// eigener, viel einfacherer Screen statt einer Erweiterung dort.
// Goldener Schnitt (phi = 1,618): eine Grundeinheit u waechst mit der Breite, alle Groessen der Tafel sind Potenzen von phi
// (Statistik u, Name phi*u, Avatar phi^4*u, Spielstand phi^6*u) - die gleiche Formel steckt als --ws-u in der CSS.
const PHI = 1.618;
const wsUnit = (w) => Math.min(18, Math.max(11, 7 + 0.009 * w));
function goldenAvatar() {
  if (typeof window === "undefined") return 56;
  return Math.round(wsUnit(window.innerWidth) * PHI ** 4);
}
export default function WinnerStaysScreen({ sessionId, me, players, matches, toast, colorOf, badgeOf, photoOf, onReload, onBack, keepAwake, onSetKeepAwake }) {
  const [session, setSession] = useState(null);
  const [entries, setEntries] = useState(null);
  const [games, setGames] = useState([]);
  const [busy, setBusy] = useState(false);
  // Kurzer Hinweis "Eingetragen" (Haken) nach dem Speichern eines Spiels.
  // Avatargroesse der Tafel nach Bildschirmbreite: je mehr Platz, desto groesser (der Spielstand soll auch von weiter weg gut erkennbar sein).
  const [boardAvatar, setBoardAvatar] = useState(() => goldenAvatar());
  useEffect(() => {
    const onResize = () => setBoardAvatar(goldenAvatar());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [justSaved, setJustSaved] = useState(null);   // Text wie "Raphi ist neuer Verteidiger" oder null
  useEffect(() => {
    if (!justSaved) return undefined;
    const id = setTimeout(() => setJustSaved(null), 3600);
    return () => clearTimeout(id);
  }, [justSaved]);

  // Avatare wandern an ihren neuen Platz (FLIP): ein Herausforderer, der gewinnt, zieht auf den Verteidiger-Platz, der
  // Verlierer geht ans Ende der Warteschlange, der Naechste rueckt an den Tisch. Gemessen wird relativ zum Bildschirm-
  // Container (nicht zum Fenster), damit Scrollen dazwischen keine falsche Bewegung ausloest; verglichen wird die
  // Belegung (Teilnehmer + Platz), nicht die Pixel - gleiche Belegung = nie eine Animation.
  const rootRef = useRef(null);
  const flipPrev = useRef(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) { flipPrev.current = null; return; }
    const els = [...root.querySelectorAll("[data-eid]")];
    const origin = root.getBoundingClientRect();
    const rects = {};
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      rects[el.dataset.eid] = { x: r.left - origin.left, y: r.top - origin.top, w: r.width || 1, el };
    });
    const key = els.map((el) => `${el.dataset.eid}:${el.dataset.slot}`).join("|");
    const prev = flipPrev.current;
    const calm = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prev && prev.key !== key && !calm) {
      els.forEach((el) => {
        const p = prev.rects[el.dataset.eid];
        const n = rects[el.dataset.eid];
        if (!p || !n) return;
        const dx = p.x - n.x, dy = p.y - n.y, sc = p.w / n.w;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && Math.abs(sc - 1) < 0.02) return;
        const from = `translate(${dx}px, ${dy}px) scale(${sc})`;
        el.animate(
          [{ transform: from, transformOrigin: "0 0", zIndex: 30 }, { transform: "none", transformOrigin: "0 0", zIndex: 30 }],
          { duration: 850, easing: "cubic-bezier(.22, .8, .3, 1)" }
        );
      });
    }
    flipPrev.current = { key, rects: Object.fromEntries(Object.entries(rects).map(([k, v]) => [k, { x: v.x, y: v.y, w: v.w }])) };
  });

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
  // Reihenfolge der Punkte in dieser Partie ([a, b, ts] je Aenderung): daraus ergibt sich bei Winner-Break, wer das letzte Rack
  // gewonnen hat und damit das naechste anstoesst (nextBreaker in widgets/BreakRule.jsx).
  const [rackLog, setRackLog] = useState([]);
  const bumpScore = (side, d) => {
    const na = side === "a" ? Math.max(0, sA + d) : sA;
    const nb = side === "b" ? Math.max(0, sB + d) : sB;
    if (na === sA && nb === sB) return;
    setSA(na); setSB(nb);
    setRackLog((l) => [...l, [na, nb, Date.now()]]);
  };
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
    if (prevGameNoRef.current !== null && prevGameNoRef.current !== lastGameNo) { setSA(0); setSB(0); setRackLog([]); }
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
  // Nutzer-Feedback: "Es kann jederzeit einer der Spieler ausfallen. Diese
  // Moeglichkeit sollte jeder haben." - Selbstbedienung, unabhaengig von
  // Position (auch am Tisch), siehe winner_stays_set_paused().
  const canTogglePaused = (e) => session.status === "running" && (isOrganizer || e.player1_id === me.id || e.player2_id === me.id);
  const existingPlayerIds = entries.flatMap((e) => [e.player1_id, e.player2_id]).filter(Boolean);

  const entryName = (e) => (e?.player2_id ? `${e.player1?.nickname} & ${e.player2?.nickname}` : e?.player1?.nickname);
  const entryById = (id) => entries.find((e) => e.id === id);

  const reportGame = async () => {
    if (sA === sB) { toast(t("Unentschieden gibt es beim Billard nicht.")); return false; }
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
    if (error && !arrived) { toast(t("Fehler: ") + (error.message || "")); return false; }
    if (arrived) toast(t("Ergebnis ist angekommen."));
    // Wer jetzt verteidigt: der Sieger bleibt/wird Verteidiger - das sagt der Hinweis, die Bewegung der Avatare zeigt es.
    const winnerEntry = sA > sB ? posA : posB;
    setJustSaved(winnerEntry ? t(sA > sB ? "{name} bleibt Verteidiger" : "{name} ist neuer Verteidiger", { name: entryName(winnerEntry) }) : t("Eingetragen"));
    setSA(0); setSB(0); setRackLog([]);
    await load();
    onReload && onReload();
    return true;
  };

  // Nutzer-Feedback: "damit gewaehrleistet ist, dass der Tisch so gut als
  // moeglich ausgenutzt wird, auch wenn der naechste Spieler gerade am WC
  // ist oder ein dringendes Telefonat fuehren muss" - schickt den
  // Herausforderer ohne Wertung ans Ende der Warteschlange (kein Rack,
  // keine Statistik-Aenderung, siehe winner_stays_skip_next()).

  // Nutzer-Feedback: "Ein 'Aussetzen' Button. Es kann jederzeit einer der
  // Spieler ausfallen. Diese Moeglichkeit sollte jeder haben." - erst als
  // einmalige Aktion gebaut, dann auf Nutzer-Feedback hin ("wie kann ich
  // den Aussetzen Button wieder ausschalten? Ich kann das kaffee-icon nur
  // aktivieren, nicht deaktivieren") zu einem echten Ein/Aus-Schalter
  // gemacht: pausierte Personen werden serverseitig automatisch
  // uebersprungen, sobald sie an der Reihe waeren (winner_stays_skip_paused
  // in der DB), bis sie sich selbst wieder aktiv melden.
  const togglePaused = async (entry) => {
    // Pause waehrend ein Ergebnis feststeht: das Spiel waere sonst mitten in der Rotation verloren - es wird deshalb
    // zuerst gespeichert. Das wird ausdruecklich gesagt, weil es auch ein Fehlklick gewesen sein kann.
    if (!entry.is_paused && entry.queue_position <= 1 && canReport && sA !== sB) {
      const winner = sA > sB ? posA : posB;
      const ok = await appConfirm(t("Es steht {a}:{b} – {name} hat gewonnen. Wenn du jetzt pausierst, wird dieses Ergebnis gespeichert. Fortfahren?",
        { a: sA, b: sB, name: entryName(winner) }));
      if (!ok) return;
      if (!(await reportGame())) return;
    }
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
    if (!(await appConfirm(t("Das Turnier jetzt beenden? Für jede Zweier-Paarung wird jetzt ein gewertetes Match mit Protokoll gespeichert.")))) return;
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_finish_session", { p_session_id: sessionId });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Turnier beendet."));
    await load();
  };

  const deleteSession = async () => {
    if (!(await appConfirm(t("Dieses Turnier wirklich löschen?")))) return;
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_delete_session", { p_session_id: sessionId });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Turnier gelöscht."));
    onBack();
  };

  const renderEntryAvatars = (e, size) => (
    <span className="ws-entry-avatars">
      <Ball nick={e.player1?.nickname} color={colorOf(e.player1?.nickname)} label={initials(e.player1?.nickname)} badge={badgeOf(e.player1?.nickname)} photo={photoOf(e.player1?.nickname)} size={size} />
      {e.player2_id && <Ball nick={e.player2?.nickname} color={colorOf(e.player2?.nickname)} label={initials(e.player2?.nickname)} badge={badgeOf(e.player2?.nickname)} photo={photoOf(e.player2?.nickname)} size={size} />}
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
      {e.streak > 1 && <span className="streak" title={t("{n} in Folge", { n: e.streak })}><Emoji e="🔥" />{e.streak}</span>}
    </span>
  );

  // Pause: ein beschrifteter Zwei-Zustands-Schalter statt eines Kaffeetassen-
  // Symbols (Nutzer-Feedback 2026-10-10: nicht intuitiv, leicht zu uebersehen,
  // schwer erreichbar). Beide Zustaende stehen als Text da, der aktive ist
  // gefuellt: "Dabei" gruen, "Pause" gelb (--warn). compact = unter der Person
  // am Tisch, icon = nur Symbol in der Warteschlangen-Zeile (Pause/Play, nie
  // eine Tasse).
  const pauseSwitch = (entry, { small, icon } = {}) => {
    const paused = !!entry.is_paused;
    // Ein runder Knopf wie bei einem Musikplayer: gruen mit Play = dabei, rot mit Pause = pausiert. Antippen wechselt.
    const label = paused ? t("Pausiert - antippen: wieder dabei") : t("Dabei - antippen: Pause setzen");
    return (
      <button type="button" className={"ws-pp" + (paused ? " paused" : " playing") + (small ? " small" : "") + (icon ? " in-queue" : "")}
        disabled={busy} onClick={() => togglePaused(entry)} aria-pressed={!paused} aria-label={label} title={label}>
        {paused ? <Pause size={20} /> : <Play size={20} />}
      </button>
    );
  };

  // Wer stoesst das naechste Rack an (0 = Verteidiger, 1 = Herausforderer)? Winner-Break: der Sieger des letzten Racks, im ersten Rack der
  // Verteidiger (= Sieger der letzten Partie). Wechselbreak: abwechselnd, im ersten Rack der Herausforderer. Beim 14/1 gibt es das nicht.
  const breakRule = normalizeBreakRule(session.break_rule);
  const breakSide = breakApplies(session.discipline) && posA && posB && session.status === "running"
    ? nextBreaker(breakRule, breakRule === "winner" ? 0 : 1, [sA, sB], rackLog) : null;

  return (
    <div className="screen" ref={rootRef}>
      <div className="turnier-layout">
      <header className="screen-head with-back">
        <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
        <h2>{session.name}</h2>
        {/* Name in EINER Zeile, die Knoepfe darunter nebeneinander und gleich gross (.head-actions). */}
        <div className="head-actions">
          {session.status === "running" && !session.is_doubles && <TurnierQrButton tour={session} toast={toast} size={22} className="icon-btn tqr-top" kind="ws" />}
          <KeepAwakeButton on={keepAwake} onChange={onSetKeepAwake} toast={toast} />
          {isOrganizer && session.status === "running" && <EndTournamentButton disabled={busy} onClick={finishSession} />}
          {isOrganizer && canDelete && (
            <button type="button" className="icon-btn ws-b-del" disabled={busy} onClick={deleteSession}
              aria-label={t("Turnier löschen")} title={t("Turnier löschen")}>
              <Trash2 size={20} />
            </button>
          )}
        </div>
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
        <Ball nick={session.organizer?.nickname} color={colorOf(session.organizer?.nickname)} label={initials(session.organizer?.nickname)} badge={badgeOf(session.organizer?.nickname)} photo={photoOf(session.organizer?.nickname)} size={22} />
        <b>{session.organizer?.nickname || "?"}</b>
        <PlaceLink locationId={session.location_id} text={session.location_text} />
      </div>

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
            {pauseSwitch(myEntry)}
          </div>
        </section>
      )}

      {(!posA || !posB) ? (
        <section className="stat-block">
          <p className="hint" style={{ margin: 0 }}>{t("Noch nicht genug Teilnehmer - mindestens zwei nötig, um zu spielen.")}</p>
        </section>
      ) : (
        <>
          {/* Eingabe wie in jedem anderen Modus: dieselben Karten (.score-row/
              .score-col), dieselbe Zahl und dieselben runden -/+ Knoepfe wie bei
              "Neues Match" (MatchScreen, Schritt 2). Nutzer-Feedback 2026-10-10:
              die erste Fassung mit extragrossen Tippflaechen war "zu gross" -
              die Matcheingabe soll in jedem Modus gleich aussehen. */}
          {/* Scoreboard B1 (Nutzer-Wahl 2026-11-01, aeltere Vorgaben fuer diese Eingabe gelten nicht mehr): Person und Spielstand
              sind das Erste, was man sieht; Zaehler und Haken sind logisch angeordnet, aber leise. Hochformat: zwei Personen oben,
              die Zahlen gross in der Mitte, darunter die Zaehler und der Haken als breite Leiste. Querformat/PC: drei Spalten. */}
          <section className="stat-block ws-board">
            {[[posA, "A", "a", sA, t("Verteidigt")], [posB, "B", "b", sB, t("Herausforderer")]].map(([e, slot, k, val, role], sideIdx) => (
              <Fragment key={e.id}>
                <div className={"ws-b-person p" + k + (e.is_paused ? " is-paused" : "")}>
                  {/* Der Ring um den Avatar IST die Pause-Anzeige: gruen = dabei, rot = pausiert. Antippen wechselt (mit Rueckfrage,
                      wenn gerade ein Ergebnis feststeht, siehe togglePaused). */}
                  {canTogglePaused(e) ? (
                    <button type="button" className={"ws-b-av ring " + (e.is_paused ? "off" : "on")} disabled={busy} onClick={() => togglePaused(e)}
                      aria-pressed={!e.is_paused} aria-label={e.is_paused ? t("Pausiert - antippen: wieder dabei") : t("Dabei - antippen: Pause setzen")}
                      title={e.is_paused ? t("Pausiert - antippen: wieder dabei") : t("Dabei - antippen: Pause setzen")}>
                      <span className="sc-avatars" data-eid={e.id} data-slot={slot}>{renderEntryAvatars(e, boardAvatar)}</span>
                    </button>
                  ) : (
                    <span className={"ws-b-av ring " + (e.is_paused ? "off" : "on")}>
                      <span className="sc-avatars" data-eid={e.id} data-slot={slot}>{renderEntryAvatars(e, boardAvatar)}</span>
                    </span>
                  )}
                  <span className="ws-b-text">
                    <span className="ws-role">{role}</span>
                    <span className="score-name">{entryName(e)}</span>
                    {/* Statistik leise: Siege, Niederlagen, Serie - da, aber ohne Aufmerksamkeit zu ziehen. */}
                    <span className="ws-quiet">
                      <span>{e.wins} {t("S")}</span><span>{e.losses} {t("N")}</span>
                      {e.streak > 1 && <span><Emoji e="🔥" /> {e.streak}</span>}
                    </span>
                    {e.is_paused && <span className="ws-paused-pill"><Pause size={13} /> {t("pausiert")}</span>}
                    {/* Das Etikett ist bei BEIDEN Personen immer da (bei der anderen nur unsichtbar): so behalten beide Spalten dieselbe Hoehe und
                        nichts springt, wenn der Anstoss wechselt. */}
                    {breakSide != null && (
                      <span className={"ws-break-tag" + (breakSide === sideIdx ? "" : " off")} aria-hidden={breakSide !== sideIdx}
                        title={t("Diese Person stößt das nächste Rack an")}><BreakGlyph width={26} /> {t("Anstoß")}</span>
                    )}
                  </span>
                </div>
                {canReport && (
                  <div className={"ws-b-cap c" + k} role="group" aria-label={entryName(e)}>
                    <button type="button" disabled={val === 0} onClick={() => bumpScore(k, -1)} aria-label="minus"><Minus size={20} /></button>
                    <button type="button" onClick={() => bumpScore(k, 1)} aria-label="plus"><Plus size={20} /></button>
                  </div>
                )}
              </Fragment>
            ))}
            <div className="ws-b-score" aria-live="polite">
              {canReport ? (
                <>
                  <span className="score-num" key={"a" + sA}>{sA}</span>
                  <span className="ws-b-colon">:</span>
                  <span className="score-num" key={"b" + sB}>{sB}</span>
                </>
              ) : <span className="ws-b-colon">vs</span>}
              {/* Hinweis unter den Zahlen in einem festen, immer reservierten Streifen: er blendet nur ein und aus und verschiebt nichts. */}
              <span className="ws-b-note" role="status" aria-live="polite">
                {justSaved
                  ? <span className="saved-hint"><Check size={15} /> {justSaved}</span>
                  : (canReport && sA === sB && sA + sB > 0 ? <span className="ws-b-tie">{t("Unentschieden gibt's beim Billard nicht ;-)")}</span> : null)}
              </span>
            </div>
            {canReport && (
              <button type="button" className={"icon-btn primary ws-ok ws-b-ok" + (sA !== sB ? " ready" : "")} disabled={busy || sA === sB} onClick={reportGame}
                aria-label={t("Eintragen")} title={t("Eintragen")}>
                <Check size={26} />
              </button>
            )}
          </section>
        </>
      )}

      {/* Live-Stand und Warteschlange nebeneinander im Goldenen Schnitt (1,618 : 1), am Handy untereinander - beide in voller Breite. */}
      <div className="ws-lower">
      {waiting.length > 0 && (
        <section className="stat-block ws-queue-card">
          <div className="stat-block-head"><h3><Repeat size={17} /> {t("Warteschlange")}</h3></div>
          <div className="ws-queue">
            {waiting.map((e, i) => (
              <div key={e.id} className={"ws-queue-row" + (e.is_paused ? " is-paused" : "") + (e.id === myEntry?.id ? " is-me" : "")}>
                <span className="ws-queue-no">{i + 1}.</span>
                <span className="ws-queue-av" data-eid={e.id} data-slot={"Q" + i}>{renderEntryAvatars(e, 34)}</span>
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

      <section className="stat-block ws-rank-card">
        <div className="stat-block-head"><h3><Crown size={17} /> {t("Live-Rangliste")}</h3></div>
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
                      {e.queue_position <= 1 && <span className="ws-live-tag"><Emoji e="🎱" /> {t("Am Tisch")}</span>}
                      {e.is_paused && <span className="ws-paused-pill"><Pause size={12} /> {t("pausiert")}</span>}
                    </span>
                  </span>
                  <span className={"ws-rank-num" + alt}>{e.wins}</span>
                  <span className={"ws-rank-num" + alt}>{e.losses}</span>
                  <span className={"ws-rank-streak" + alt} title={e.streak > 1 ? t("{n} in Folge", { n: e.streak }) : undefined}>{e.streak > 1 ? <><Emoji e="🔥" />{e.streak}</> : ""}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
      </div>

      {games.length > 0 && (
        <section className="stat-block">
          <div className="stat-block-head"><h3><Repeat size={17} /> {t("Verlauf")}</h3></div>
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

      {/* Teilnehmer hinzufuegen: seltener gebraucht, steht deshalb ganz unten - wichtig sind Tafel, Live-Stand und Warteschlange. */}
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

      </div>
      <ImprintFooter />
    </div>
  );
}
