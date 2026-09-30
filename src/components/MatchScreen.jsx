import { useState, useMemo, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ChevronLeft, Check, X, Minus, Plus, Pencil, Search, QrCode, ArrowRight, Swords, Clock, UserPlus } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { winProb, initials } from "../lib/format";
import { LIST_COUNT_OPTIONS, DEFAULT_LIST_COUNT, DEFAULT_DISCIPLINES } from "../lib/constants";
import { useRevealOnScroll } from "../lib/useRevealOnScroll";
import { recentOpponentFreq } from "../lib/frequency";
import { minGhostSeconds } from "../lib/ghostTiming";
import { savePendingReport, isNetworkError } from "../lib/offlineReport";
import { saveMatchDraft, clearMatchDraft } from "../lib/matchDraft";
import Ball from "./Ball";
import StraightPoolScorer from "./StraightPoolScorer";
import InviteScreen from "./InviteScreen";
import KeepAwakeButton from "./widgets/KeepAwakeButton";
import FieldLabel from "./widgets/FieldLabel";
import DiscBall, { DiscPick, DiscPickRow, sortDisciplines } from "./widgets/DiscBall";
import { ModeTiles } from "./widgets/ModePick";
import { rpcRetry } from "../lib/rpcRetry";

export default function MatchScreen({ me, players, matches, disciplines, ratingOf, onDone, onCancel, onReload, toast, colorOf, badgeOf, photoOf, initialOpp, onChallenge, onOpenProtokoll, tournamentCtx, keepAwake, onSetKeepAwake, resumeDraft }) {
  // Fortgesetztes Match nach einem unfreiwilligen Neuladen (siehe lib/matchDraft.js):
  // Anfangswerte aus dem Entwurf statt leer. Spieler werden per id frisch aus
  // der Spielerliste geholt (der Entwurf hat nur eine Kopie von damals).
  const [draft] = useState(() => resumeDraft?.match || null);
  const fresh = (o) => (o ? players.find((p) => p.id === o.id) || o : null);
  const dv = (k, d) => (draft && draft[k] !== undefined ? draft[k] : d);
  // Die Disziplin steht schon im Formular (Schritt 0); der frueher eigene
  // Schritt 1 entfaellt. Alte Entwuerfe mit step 1 landen beim Ergebnis (2),
  // falls sie eine Disziplin hatten, sonst wieder im Formular.
  const matchDiscs = sortDisciplines((disciplines || DEFAULT_DISCIPLINES).filter((d) => d !== "Doppel" && d !== "Gesamt"));
  const lastDisc = () => {
    try { const d = localStorage.getItem("matchDisc"); if (d && matchDiscs.includes(d)) return d; } catch { /* Privatmodus */ }
    return matchDiscs[0] || DEFAULT_DISCIPLINES[0];
  };
  const rememberDisc = (d) => { try { localStorage.setItem("matchDisc", d); } catch { /* Privatmodus */ } };
  const savedStep = dv("step", tournamentCtx ? 2 : 0);
  const [step, setStep] = useState(savedStep === 1 ? (dv("disc", null) ? 2 : 0) : savedStep);
  const [opp, setOpp] = useState(draft ? fresh(draft.opp) : (initialOpp || null));
  const [showMyQr, setShowMyQr] = useState(false);
  const [mode, setMode] = useState(dv("mode", "single"));
  const [partner, setPartner] = useState(fresh(dv("partner", null)));
  const [opp2, setOpp2] = useState(fresh(dv("opp2", null)));
  const [s1, setS1] = useState(dv("s1", 0));
  const [s2, setS2] = useState(dv("s2", 0));
  const [disc, setDisc] = useState(dv("disc", tournamentCtx ? tournamentCtx.discipline : lastDisc()));
  const [hr, setHr] = useState(dv("hr", [null, null]));   // Höchstserie [ich, Gegner] (nur 14/1)
  const [def, setDef] = useState(dv("def", [null, null])); // aufgeholter Rückstand (nur 14/1)
  const [avg, setAvg] = useState(dv("avg", [null, null])); // Offensivschnitt (nur 14/1)
  const [tb, setTb] = useState(dv("tb", [null, null]));   // Zwei-Kugel-Räumungen (nur 14/1)
  const [runLog, setRunLog] = useState(dv("runLog", null));   // Aufnahme-Protokoll (nur 14/1) - fuers Speichern vorbereitet
  const [scoreLog, setScoreLog] = useState(dv("scoreLog", [[0, 0, Date.now()]])); // Punktestand + Zeitpunkt nach jedem Zaehler-Klick (alle anderen Disziplinen)
  const [savedMatch, setSavedMatch] = useState(null); // gerade gespeichertes Match, fuers direkte "Protokoll"-Ansehen
  const [confirmedNow, setConfirmedNow] = useState(false); // Turniermatch direkt nach dem Melden auf diesem Geraet bestaetigt (siehe confirmNow unten)
  const [oppQuery, setOppQuery] = useState("");
  const [pendingDisc, setPendingDisc] = useState(null);
  const [abortAsk, setAbortAsk] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offlineQueued, setOfflineQueued] = useState(false); // Match konnte mangels Verbindung nicht gemeldet werden, wartet lokal
  const [ghostStartedAt, setGhostStartedAt] = useState(dv("ghostStartedAt", null)); // gegen "Durchklicken" beim Ghost-Training
  const [nowTick, setNowTick] = useState(Date.now());
  const [guestBusy, setGuestBusy] = useState(false);
  const [oppCount, setOppCount] = useState(DEFAULT_LIST_COUNT); // Standard: nur die haeufigsten Mitspieler zeigen (Nutzer-Feedback: Liste wird lang)

  const is141 = disc === "14/1 Endlos";

  // Laufenden Stand bei jeder Aenderung sichern (Schritt 1-3 = Gegner gewaehlt,
  // noch nicht gemeldet), nach dem Melden (Schritt 4) loeschen. Den 14/1-Stand
  // liefert StraightPoolScorer ueber onStateChange; scorerStateRef haelt ihn,
  // resumeScorer gibt ihn EINMAL an den wiederhergestellten Scorer zurueck.
  const scorerStateRef = useRef(resumeDraft?.scorer || null);
  const [resumeScorer, setResumeScorer] = useState(() => resumeDraft?.scorer || null);
  const slim = (p) => (p ? { id: p.id, nickname: p.nickname, is_guest: !!p.is_guest, is_ghost: !!p.is_ghost } : null);
  const persistDraft = () => {
    if (step === 4) { clearMatchDraft(me.id); return; }
    if (step < 2 || !opp) return;
    saveMatchDraft(me.id, {
      step, mode, opp: slim(opp), partner: slim(partner), opp2: slim(opp2), s1, s2, disc,
      hr, def, avg, tb, runLog, scoreLog, ghostStartedAt, tournamentCtx: tournamentCtx || null,
    }, is141 ? scorerStateRef.current : null);
  };
  useEffect(persistDraft, [step, mode, opp, partner, opp2, s1, s2, disc, hr, def, avg, tb, runLog, scoreLog, ghostStartedAt]);
  const teamA = mode === "double" && partner ? `${me.nickname} & ${partner.nickname}` : me.nickname;
  const teamB = mode === "double" && opp2 ? `${opp?.nickname} & ${opp2.nickname}` : (opp?.nickname || "");
  const pickPlayer = (p) => {
    if (mode === "single") { setOpp(p); start(p); return; }
    if (partner?.id === p.id) { setPartner(null); return; }
    if (opp?.id === p.id) { setOpp(null); return; }
    if (opp2?.id === p.id) { setOpp2(null); return; }
    if (!partner) setPartner(p); else if (!opp) setOpp(p); else if (!opp2) setOpp2(p);
  };

  // Gewaehlte Spieler des Doppels bzw. der Gegner im Einzel als Platzreihe
  // ("Du VS Gegner"): gefuellt = Kugel + Name (Tipp entfernt wieder), leer =
  // gestrichelter Kreis mit Rolle darunter.
  const slot = (p, role, clear) => (p ? (
    <button type="button" className={"vs-slot filled" + (clear ? "" : " me")} onClick={clear || undefined}
      disabled={!clear} title={clear ? `${role} – ${t("Entfernen")}` : role}>
      <Ball color={colorOf(p.nickname)} label={initials(p.nickname)} badge={badgeOf(p.nickname)} photo={photoOf(p.nickname)} size={44} />
      <span>{p.nickname}</span>
    </button>
  ) : (
    <span className="vs-slot empty" title={role}>
      <span className="vs-empty-ball"><Plus size={16} /></span>
      <span>{role}</span>
    </span>
  ));
  const showStrip = mode === "double" || !!opp;
  const ready = mode === "double" ? !!(partner && opp && opp2) : !!opp;
  const chooseMode = (m) => {
    if (m === mode) return;
    setMode(m);
    if (m === "single") { setPartner(null); setOpp2(null); } else setOpp(null);
  };
  // Match beginnen: die Disziplin merken (naechstes Mal vorgewaehlt) und zum
  // Ergebnis. Beim Ghost startet ausserdem die Mindestdauer-Uhr.
  const start = (o) => {
    if (o?.is_ghost) setGhostStartedAt(Date.now());
    rememberDisc(disc);
    setStep(2);
  };

  // Wie oft habe ich in letzter Zeit gegen wen gespielt? (häufigste Gegner zuerst,
  // dieselbe Logik wie im PlayerPicker – siehe lib/frequency.js)
  const freqByNick = useMemo(() => recentOpponentFreq(matches, me), [matches, me]);

  const ghost = players.find((p) => p.is_ghost);
  // Alle passenden Gegner (haeufigste zuerst) - ungekuerzt, u.a. um zu wissen,
  // ob ueberhaupt noch mehr hinter "10"/"20"/"Alle" steckt.
  const allMatchingOpponents = players
    .filter((p) => p.id !== me.id && !p.is_ghost && !p.blocked)
    .filter((p) => p.nickname.toLowerCase().includes(oppQuery.trim().toLowerCase()))
    .sort((a, b) => (freqByNick[b.nickname] || 0) - (freqByNick[a.nickname] || 0) || a.nickname.localeCompare(b.nickname));
  // Ohne aktive Suche nur die Top-N zeigen (Nutzer-Feedback: Spielerliste
  // wird mit der Zeit sehr lang) - waehrend einer Suche wird IMMER die volle
  // Trefferliste gezeigt, sonst faende man jemanden mit wenigen gemeinsamen
  // Matches nie.
  const opponents = (!oppQuery.trim() && oppCount !== "all")
    ? allMatchingOpponents.slice(0, oppCount)
    : allMatchingOpponents;
  // Spielerkacheln blenden sich beim Hineinscrollen ein (nur stabile Werte als
  // Abhaengigkeit, siehe useRevealOnScroll).
  const formRef = useRevealOnScroll([step, opponents.length, oppQuery.trim() === "", mode, oppCount]);

  // Gast fuers normale Match hinzufuegen (Turniere haben dafuer schon
  // tournament_organizer_add_guest() - dies hier ist das Gegenstueck ohne
  // Turnierbezug, siehe add_guest_player()). Kein eigenes Namensfeld mehr -
  // die Suche IST die Namenseingabe: erst wenn sie niemanden findet
  // (Nutzer-Feedback: "zunaechst die Suche starten, erst wenn kein Spieler
  // gefunden wird, wird der Gast-Button klickbar"), erscheint die Karte mit
  // dem Suchbegriff als vorgeschlagenem Gast-Namen.
  const addGuest = async () => {
    const nick = oppQuery.trim();
    if (!nick) return;
    setGuestBusy(true);
    const { data, error } = await supabase.rpc("add_guest_player", { p_nickname: nick });
    setGuestBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    setOppQuery("");
    pickPlayer(data);
    onReload && onReload();
  };

  const myRating = ratingOf(me.nickname);
  const oppRating = opp ? ratingOf(opp.nickname) : 500;
  const prob = winProb(myRating, oppRating);
  const total = s1 + s2;
  // Drei Schritte: Match (Disziplin, Modus, Gegner) - Ergebnis - Pruefen.
  const steps = ["Match", "Ergebnis", "Pruefen"];
  const dotIdx = step === 0 ? 0 : step === 2 ? 1 : 2;

  // --- Punkte-Vorschau (#1) + Gegner-Vorschlag (#2) ---
  const fmtD = (x) => (x >= 0 ? "+" : "−") + Math.abs(Math.round(x));
  const previewFor = (dsc, oppNick) => {
    const ea = winProb(ratingOf(me.nickname, dsc), ratingOf(oppNick, dsc));
    const is141d = dsc === "14/1 Endlos";
    const D = is141d ? 50 : 4;
    const nf = (tot) => Math.min(tot, 16);
    return {
      ea, is141d,
      winMin: 4 * nf(2 * D - 1) * (D / (2 * D - 1) - ea),
      winMax: 4 * nf(D) * (1 - ea),
      lossMin: 4 * nf(2 * D - 1) * ((D - 1) / (2 * D - 1) - ea),
      lossMax: 4 * nf(D) * (0 - ea),
    };
  };
  const suggestions = opponents
    .filter((p) => !p.is_guest)
    .map((p) => ({ p, gain: previewFor("Gesamt", p.nickname).winMax }))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 2);

  const resetScores = () => { scorerStateRef.current = null; setResumeScorer(null); setS1(0); setS2(0); setHr([null, null]); setDef([null, null]); setAvg([null, null]); setTb([null, null]); setScoreLog([[0, 0, Date.now()]]); };

  // Disziplin wechseln (im Ergebnis-Schritt): zwischen 8/9/10 bleibt das
  // Ergebnis erhalten; ein Wechsel zu oder von 14/1 aendert das Punkteschema
  // -> nachfragen, sobald schon etwas gezaehlt wurde (beim laufenden 14/1
  // steckt der Stand im Scorer, s1/s2 sind dort noch 0 - daher is141).
  const switchDisc = (d) => {
    if (d === disc) return;
    const crosses141 = (disc === "14/1 Endlos") !== (d === "14/1 Endlos");
    if (crosses141 && (is141 || s1 > 0 || s2 > 0)) { setPendingDisc(d); return; }
    setDisc(d);
    rememberDisc(d);
    if (crosses141) resetScores();   // Schema-Wechsel ohne bisheriges Ergebnis: sauber starten
  };
  const confirmDiscChange = () => {
    setDisc(pendingDisc); rememberDisc(pendingDisc); resetScores(); setPendingDisc(null);
  };

  const isGhost = !!opp?.is_ghost;
  // Gast als Gegner ODER (beim Doppel) als EIGENER Partner oder Gegner 2 -
  // jede der vier Doppel-Positionen kann ein Gast sein, nicht nur Gegner 1
  // (frueher hier ein Bug: nur opp2 wurde geprueft, ein Gast als partner
  // fuehrte zur falschen "wartet auf Bestaetigung"-Anzeige, obwohl
  // report_doubles() serverseitig schon automatisch bestaetigt hatte, weil
  // v_has_guest dort alle vier Positionen prueft). Match wird server-seitig
  // sofort bestaetigt (siehe report_match()/report_doubles()) und zaehlt
  // nicht fuers Rating, genau wie ein Ghost-Training - der Gast selbst
  // MUSS nicht bestaetigen (kann er als Nicht-Account eh nicht), aber bei
  // einem Doppel muessen dann auch die ECHTEN Mitspieler nicht bestaetigen:
  // report_doubles() legt in dem Fall ueberhaupt keine
  // match_confirmations-Zeilen an (rebuild_elo() schliesst das Match
  // ausserdem komplett vom Rating aus).
  const isGuestMatch = !!(me.is_guest || opp?.is_guest
    || (mode === "double" && (partner?.is_guest || opp2?.is_guest)));

  // Mindestdauer gegen "Durchklicken" beim Ghost-Training (siehe lib/ghostTiming.js) -
  // ab Auswahl von Ghost tickt eine Sekundenuhr, "Training abschließen" bleibt bis
  // dahin gesperrt. Serverseitig wird dieselbe Mindestzeit in record_ghost_game()
  // nochmal durchgesetzt, falls diese Sperre umgangen wird.
  useEffect(() => {
    if (!isGhost || step !== 3 || !ghostStartedAt) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isGhost, step, ghostStartedAt]);
  const ghostRequiredSec = isGhost ? minGhostSeconds(disc, s1, s2) : 0;
  const ghostElapsedSec = ghostStartedAt ? Math.floor((nowTick - ghostStartedAt) / 1000) : 0;
  const ghostRemainingSec = Math.max(0, ghostRequiredSec - ghostElapsedSec);
  const ghostReady = !isGhost || ghostRemainingSec === 0;

  const save = async () => {
    if (mode === "double") {
      setBusy(true);
      const params = {
        p_partner_id: partner.id, p_opp1_id: opp.id, p_opp2_id: opp2.id,
        p_my_score: s1, p_opp_score: s2, p_discipline: disc,
        p_run_log: scoreLog.length > 1 ? scoreLog : null,
      };
      const { data, error } = await rpcRetry("report_doubles", params);
      setBusy(false);
      if (error) {
        if (isNetworkError(error)) {
          savePendingReport({ type: "double", params });
          setOfflineQueued(true); setStep(4); return;
        }
        toast(t("Fehler: ") + error.message); return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      setSavedMatch({ ...row, p1: { nickname: me.nickname }, p1b: { nickname: partner.nickname },
        p2: { nickname: opp.nickname }, p2b: { nickname: opp2.nickname } });
      setStep(4); return;
    }
    if (isGhost) {
      setBusy(true);
      const { error } = await rpcRetry("record_ghost_game", { p_discipline: disc, p_score1: s1, p_score2: s2 });
      setBusy(false);
      if (error) { toast(t("Fehler: ") + error.message); return; }
      setStep(4); return;
    }
    if (tournamentCtx) {
      setBusy(true);
      const rpc = "tournament_report_match";
      const params = {
        p_tournament_match_id: tournamentCtx.tournamentMatchId, p_my_score: s1, p_opp_score: s2,
        p_high_run_me: is141 ? hr[0] : null, p_high_run_opp: is141 ? hr[1] : null,
        p_deficit_me: is141 ? def[0] : null, p_deficit_opp: is141 ? def[1] : null,
        p_avg_me: is141 ? avg[0] : null, p_avg_opp: is141 ? avg[1] : null,
        p_twoball_me: is141 ? tb[0] : null, p_twoball_opp: is141 ? tb[1] : null,
        p_run_log: is141 ? runLog : (scoreLog.length > 1 ? scoreLog : null),
      };
      const { data, error } = await rpcRetry(rpc, params);
      setBusy(false);
      if (error) {
        if (isNetworkError(error)) {
          savePendingReport({ type: "tournament", rpc, params });
          setOfflineQueued(true); setStep(4); return;
        }
        toast(t("Fehler: ") + error.message); return;
      }
      const tRow = Array.isArray(data) ? data[0] : data;
      setSavedMatch({ ...tRow, p1: { nickname: me.nickname }, p2: { nickname: opp.nickname } });
      setStep(4); return;
    }
    setBusy(true);
    const params = {
      p_opponent_id: opp.id, p_my_score: s1, p_opp_score: s2, p_discipline: disc,
      p_high_run_me: is141 ? hr[0] : null, p_high_run_opp: is141 ? hr[1] : null,
      p_deficit_me: is141 ? def[0] : null, p_deficit_opp: is141 ? def[1] : null,
      p_avg_me: is141 ? avg[0] : null, p_avg_opp: is141 ? avg[1] : null,
      p_twoball_me: is141 ? tb[0] : null, p_twoball_opp: is141 ? tb[1] : null,
      p_run_log: is141 ? runLog : (scoreLog.length > 1 ? scoreLog : null),
    };
    const { data, error } = await rpcRetry("report_match", params);
    setBusy(false);
    if (error) {
      if (isNetworkError(error)) {
        savePendingReport({ type: "single", params });
        setOfflineQueued(true); setStep(4); return;
      }
      toast(t("Fehler: ") + error.message); return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setSavedMatch({ ...row, p1: { nickname: me.nickname }, p2: { nickname: opp.nickname } });
    setStep(4);
  };

  // Nur fuer Turniermatches (Nutzer-Feedback): direkt nach dem eigenen Melden
  // kann auf DEMSELBEN Geraet sofort bestaetigt werden, statt auf den
  // Gegner zu warten, der sein Handy vielleicht gar nicht dabei hat - Geraet
  // wird dafuer an ihn weitergereicht. Laeuft technisch weiter unter dem
  // eigenen Account (tournament_confirm_own_match() prueft serverseitig nur
  // reported_by = current_player_id()), eine bewusst in Kauf genommene
  // Unsicherheit zugunsten schneller/zuverlaessiger Turnier-Bestaetigungen -
  // gilt ausdruecklich NICHT fuer normale Matches (dort weiterhin nur ueber
  // confirm_match() durch den echten Gegner-Account).
  const confirmNow = async () => {
    if (!savedMatch?.id) return;
    setBusy(true);
    const { error } = await rpcRetry("tournament_confirm_own_match", { p_tournament_match_id: tournamentCtx.tournamentMatchId });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Match bestaetigt - Ranking wird neu berechnet."));
    setConfirmedNow(true);
    onReload && onReload();
  };

  // Siegchance + moeglicher Punktgewinn - wird sowohl bei der Match-Anlage
  // (Schritt "Disziplin") als auch waehrend der Aufzeichnung gezeigt.
  // Solange noch keine Disziplin feststeht, dient "Gesamt" als Grundlage.
  const PointPreview = ({ dsc }) => {
    if (mode !== "single" || !opp || isGuestMatch) return null;
    const pv = previewFor(dsc || "Gesamt", opp.nickname);
    return (
      <div className="pt-preview">
        <span className="pt-chance">{t("Siegchance")} <b>{Math.round(pv.ea * 100)}%</b></span>
        <span className="pt-range">{pv.is141d ? t("Bei Distanz 50") : t("Bei Race to 4")}: {t("Sieg")} {fmtD(pv.winMin)}…{fmtD(pv.winMax)} · {t("Niederlage")} {fmtD(pv.lossMin)}…{fmtD(pv.lossMax)}</span>
      </div>
    );
  };

  // Fortschrittspunkte: in den Auswahl-Schritten ganz oben (dort sind sie
  // Orientierung), waehrend der Aufzeichnung dagegen unten - da gehoert der
  // Spielstand an die erste Stelle (Nutzer-Feedback).
  const StepDots = ({ bottom }) => (
    <div className={"steps" + (bottom ? " bottom" : "")}>
      {steps.map((s, i) => (
        <div key={s} className={"step-dot" + (i === dotIdx ? " cur" : i < dotIdx ? " done" : "")}>
          <span>{i < dotIdx ? <Check size={12} /> : i + 1}</span>{t(s)}
        </div>
      ))}
    </div>
  );

  if (showInvite) {
    return <InviteScreen me={me} toast={toast}
      onBack={() => { setShowInvite(false); onReload && onReload(); }} />;
  }

  return (
    <div className="screen">
      <header className="screen-head with-back">
        <button className="back-btn" onClick={() => { if (step === 0 || step === 4) onCancel(); else setAbortAsk(true); }} aria-label={t("Zurueck")}>
          <ChevronLeft size={22} />
        </button>
        <h2>{t(tournamentCtx ? "Turnier-Ergebnis" : "Neues Match")}</h2>
        <KeepAwakeButton on={keepAwake} onChange={onSetKeepAwake} toast={toast} />
      </header>

      {step < 4 && step !== 2 && <StepDots />}

      {abortAsk && (
        <div className="modal-overlay" onClick={() => setAbortAsk(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{t("Match abbrechen?")}</h3>
            <p>{t("Alle Eingaben gehen verloren")}{is141 ? t(" – ein 14/1-Protokoll lässt sich nicht wiederherstellen") : ""}.</p>
            <div className="sp-controls">
              <button className="btn ghost warn" onClick={() => { setAbortAsk(false); onCancel(); }}>{t("Ja – beenden")}</button>
              <button className="btn primary" onClick={() => setAbortAsk(false)}>{t("Match fortführen")}</button>
            </div>
          </div>
        </div>
      )}

      {/* "Neues Match" ist der einfachere Bruder von "Neues Turnier"
          (Nutzer-Feedback 2026-09-30): dieselbe Reihenfolge (Disziplin als
          Kugeln zuerst, dann der Modus als Kacheln), dieselben Bausteine
          (FieldLabel, DiscPick, ModeTiles) und dieselbe Kartenoptik. Links
          das Match selbst, rechts die Spieler - am Handy untereinander. Der
          frühere Disziplin-Schritt entfaellt: die Disziplin ist vorgewaehlt
          (zuletzt gespielte) und wird hier oder waehrend der Aufzeichnung
          geaendert; ein Tipp auf den Gegner startet das Match sofort. */}
      {step === 0 && (
        <div className="match-split step-enter" ref={formRef}>
          <div className="match-selectors">
            <section className="stat-block">
              <div className="turnier-form">
                <FieldLabel label={t("Disziplin")} />
                <div className="disc-picks">
                  {matchDiscs.map((d) => (
                    <DiscPick key={d} disc={d} selected={disc === d} onSelect={() => setDisc(d)} />
                  ))}
                </div>

                <FieldLabel label={t("Modus")} />
                <ModeTiles value={mode} onChange={chooseMode} />

                {/* Wer gegen wen - gezeichnet statt beschrieben. Im Doppel
                    die drei Plaetze, die man nacheinander antippt; im Einzel
                    nur, wenn der Gegner schon feststeht (z.B. per QR-Code
                    oder Herausforderung). Klappt animiert auf. */}
                <div className={"collapsible" + (showStrip ? " open" : "")} inert={showStrip ? undefined : ""}>
                  <div className="collapsible-inner">
                    <div className="vs-strip">
                      <div className="vs-team">
                        {slot(me, t("Du"), null)}
                        {mode === "double" && slot(partner, t("Partner"), () => setPartner(null))}
                      </div>
                      <span className="vs-x">VS</span>
                      <div className="vs-team">
                        {slot(opp, mode === "double" ? t("Gegner 1") : t("Gegner"), () => setOpp(null))}
                        {mode === "double" && slot(opp2, t("Gegner 2"), () => setOpp2(null))}
                      </div>
                      <button type="button" className="icon-btn primary vs-go" disabled={!ready} onClick={() => start(opp)}
                        aria-label={t("Match starten")} title={t("Match starten")}>
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  </div>
                </div>
                {mode === "single" && opp && <PointPreview dsc={disc} />}
              </div>
            </section>
          </div>

          {/* Reihenfolge (Nutzer-Feedback): Empfehlung, Suche, wie viele
              Spieler, Spieler-Kacheln - und der Ghost ganz am Ende, weil
              Trainingsmatches der Sonderfall sind. */}
          <div className="match-players">
            <section className="stat-block">
              <div className="turnier-form match-list-form">
                <FieldLabel label={mode === "double" ? t("Spieler") : t("Gegner")}
                  info={mode === "double" ? t("Tippe drei Spieler an: zuerst deinen Partner, dann die beiden Gegner.") : undefined}
                  actions={mode === "single" ? (
                    <>
                      <button type="button" className={"icon-btn small" + (showMyQr ? " on" : "")} aria-pressed={showMyQr}
                        onClick={() => setShowMyQr((v) => !v)}
                        aria-label={showMyQr ? t("Code ausblenden") : t("Ihr trefft euch? Meinen Code zeigen")}
                        title={showMyQr ? t("Code ausblenden") : t("Ihr trefft euch? Meinen Code zeigen")}>
                        <QrCode size={15} />
                      </button>
                      {/* Einladen steht bewusst neben dem Code - beides dreht
                          sich darum, den anderen an den Tisch zu bekommen.
                          Zusaetzlich ueber das QR-Symbol auf der Profilkarte. */}
                      <button type="button" className="icon-btn small" onClick={() => setShowInvite(true)}
                        aria-label={t("Neues Mitglied? Jetzt einladen")} title={t("Neues Mitglied? Jetzt einladen")}>
                        <UserPlus size={15} />
                      </button>
                    </>
                  ) : undefined} />

                {mode === "single" && (
                  <div className={"collapsible" + (showMyQr ? " open" : "")} inert={showMyQr ? undefined : ""}>
                    <div className="collapsible-inner">
                      <div className="my-qr">
                        <div className="qr-box">
                          <QRCodeSVG value={`${window.location.origin}/?vs=${me.id}`} size={190} level="M"
                            bgColor="#F2EDE0" fgColor="#0A2B21" />
                        </div>
                        <p className="hint center">{t("Der andere scannt das mit der Handykamera und trägt danach das Ergebnis ein.")}</p>
                      </div>
                    </div>
                  </div>
                )}

                {mode === "single" && !oppQuery && suggestions.length > 0 && (
                  <div className="suggest-card reveal">
                    <div className="suggest-title">💡 {t("Empfehlung")}</div>
                    {suggestions.map(({ p, gain }) => (
                      <div key={p.id} className="suggest-row">
                        <button className="suggest-row-play" onClick={() => pickPlayer(p)}>
                          <Ball color={colorOf(p.nickname)} label={initials(p.nickname)} badge={badgeOf(p.nickname)} photo={photoOf(p.nickname)} size={34} />
                          <span className="suggest-name">{p.nickname}</span>
                          <span className="suggest-gain">{t("bis zu")} {fmtD(gain)}</span>
                        </button>
                        <button className="suggest-challenge-btn" onClick={() => onChallenge(p.id)} title={t("Herausfordern")} aria-label={t("Herausfordern")}>
                          <Swords size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="search-row">
                  <Search size={16} className="mail-ico" />
                  <input placeholder={t("Spieler suchen oder Gast eingeben …")} value={oppQuery} onChange={(e) => setOppQuery(e.target.value)} />
                  {oppQuery && <button className="clear-btn" onClick={() => setOppQuery("")} aria-label={t("Suche loeschen")}><X size={15} /></button>}
                </div>
                {oppQuery.trim() && opponents.length === 0 && (
                  <div className="guest-empty-card">
                    <div className="ghost-info">
                      <span className="ghost-name">🤔 {t('Niemand namens "{q}" gefunden', { q: oppQuery.trim() })}</span>
                      <span className="ghost-sub">{t("Für Personen ohne App - zählt nicht fürs Rating, braucht keine Bestätigung.")}</span>
                    </div>
                    <button className="btn primary" disabled={guestBusy} onClick={addGuest}>
                      <UserPlus size={16} /> {t('"{q}" als Gast hinzufügen', { q: oppQuery.trim() })}
                    </button>
                  </div>
                )}
                {!oppQuery.trim() && allMatchingOpponents.length > DEFAULT_LIST_COUNT && (
                  <div className="chips small">
                    {LIST_COUNT_OPTIONS.map((c) => (
                      <button key={c} className={"chip" + (oppCount === c ? " active" : "")} onClick={() => setOppCount(c)}>
                        {c === "all" ? t("Alle") : c}
                      </button>
                    ))}
                  </div>
                )}
                {!oppQuery.trim() && opponents.length === 0 && <p className="hint">{t("Kein Spieler gefunden.")}</p>}
                <div className="opp-grid">
                  {opponents.map((p, i) => {
                    const role = mode === "double"
                      ? (partner?.id === p.id ? t("Partner") : opp?.id === p.id ? t("Gegner 1") : opp2?.id === p.id ? t("Gegner 2") : null)
                      : (opp?.id === p.id ? "•" : null);
                    return (
                      <button key={p.id} className={"opp-card reveal" + (role ? " sel" : "")} style={{ "--i": i % 4 }} onClick={() => pickPlayer(p)}>
                        <Ball color={colorOf(p.nickname)} label={initials(p.nickname)} badge={badgeOf(p.nickname)} photo={photoOf(p.nickname)} size={48} />
                        <span>{p.nickname}{p.is_guest && <span className="guest-tag">{t("Gast")}</span>}</span>
                        {mode === "double" && role && <span className="dbl-role">{role}</span>}
                      </button>
                    );
                  })}
                  {/* Ghost: als letzte Kachel der Liste statt als breite Karte -
                      der Sonderfall (Training) soll nicht mehr Platz brauchen
                      als ein Mitspieler. Erklaerung im Tooltip. */}
                  {mode === "single" && ghost && !oppQuery && (
                    <button className="opp-card ghost-tile reveal" style={{ "--i": opponents.length % 4 }}
                      title={`${t("Training gegen Ghost")} – ${t("Übungsmatch – zählt nicht fürs Rating")}`}
                      onClick={() => { setOpp(ghost); start(ghost); }}>
                      <span className="ghost-ball">👻</span>
                      <span>{t("Ghost")}</span>
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {step === 2 && opp && disc && (
        <div className="match-score-step step-enter">
          {/* Reihenfolge bewusst so (Nutzer-Feedback): ganz oben das Match
              selbst (Zaehler bzw. 14/1-Scorer), darunter erst Siegchance,
              Disziplin-Umschalter und die Schrittpunkte. */}
          {is141 ? (
            <StraightPoolScorer me={me} opp={opp} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} toast={toast}
              sideNames={mode === "double" ? [teamA, teamB] : undefined}
              sideAvatars={mode === "double" ? [[me, partner], [opp, opp2]] : undefined}
              initialState={resumeScorer}
              onStateChange={(st) => { scorerStateRef.current = st; persistDraft(); }}
              onFinish={({ s1: a, s2: b, hr1, hr2, def1, def2, avg1, avg2, tb1, tb2, log }) => {
                setS1(a); setS2(b); setHr([hr1, hr2]); setDef([def1, def2]);
                setAvg([avg1, avg2]); setTb([tb1, tb2]); setRunLog(log); setStep(3);
              }} />
          ) : (
            <>
              <div className="score-row">
                {(mode === "double"
                  ? [{ members: [me, partner], name: teamA, v: s1, set: (nv) => { setS1(nv); setScoreLog((l) => [...l, [nv, s2, Date.now()]]); } },
                     { members: [opp, opp2], name: teamB, v: s2, set: (nv) => { setS2(nv); setScoreLog((l) => [...l, [s1, nv, Date.now()]]); } }]
                  : [{ members: [me], name: me.nickname, v: s1, set: (nv) => { setS1(nv); setScoreLog((l) => [...l, [nv, s2, Date.now()]]); } },
                     { members: [opp], name: opp.nickname, v: s2, set: (nv) => { setS2(nv); setScoreLog((l) => [...l, [s1, nv, Date.now()]]); } }]
                ).map(({ members, name, v, set }) => (
                  <div key={name} className="score-col">
                    <div className="sc-avatars">
                      {members.map((pl) => (
                        <Ball key={pl.id} color={colorOf(pl.nickname)} label={initials(pl.nickname)} badge={badgeOf(pl.nickname)} photo={photoOf(pl.nickname)} size={56} />
                      ))}
                    </div>
                    <span className="score-name">{name}</span>
                    <div className="score-num" key={v}>{v}</div>
                    <div className="score-btns">
                      <button className="round-btn" onClick={() => set(Math.max(0, v - 1))} aria-label="minus"><Minus size={20} /></button>
                      <button className="round-btn plus" onClick={() => set(v + 1)} aria-label="plus"><Plus size={20} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn primary" disabled={total === 0 || s1 === s2} onClick={() => setStep(3)}>
                {t("Weiter")} <ArrowRight size={18} />
              </button>
              {s1 === s2 && total > 0 && <p className="hint center">{t("Unentschieden gibt's beim Billard nicht ;-)")}</p>}
            </>
          )}
          <PointPreview dsc={disc} />
          {/* Disziplin waehrend der Aufzeichnung: dieselben Kugeln wie im
              Formular (statt eines Chips, der zurueck in einen eigenen Schritt
              fuehrte). Ein Wechsel zwischen 8/9/10 Ball behaelt das Ergebnis,
              von/zu 14/1 aendert das Punkteschema - siehe switchDisc. */}
          <div className="score-head">
            {tournamentCtx ? (
              <span className="disc-chip disc-chip-locked"><DiscBall disc={disc} size={22} /><span>{t(disc)}</span></span>
            ) : (
              <DiscPickRow discs={matchDiscs} value={disc} onChange={switchDisc} />
            )}
          </div>
          {pendingDisc && (
            <div className="confirm-box">
              {is141
                ? <p>{t("Ein 14/1-Spiel läuft. Beim Disziplinwechsel geht der aktuelle Spielstand verloren. Fortfahren?")}</p>
                : <p>{t("Wechsel zu bzw. von")} <b>{t("14/1 Endlos")}</b> {t("ändert das Punkteschema – das bisherige Ergebnis ({s1} : {s2}) geht dabei verloren. Fortfahren?", { s1, s2 })}</p>}
              <div className="sp-controls">
                <button className="btn ghost" onClick={() => setPendingDisc(null)}>{is141 ? t("Weiterspielen") : t("Abbrechen")}</button>
                <button className="btn primary" onClick={confirmDiscChange}>{is141 ? t("Disziplin wechseln") : t("Wechseln & zurücksetzen")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && opp && (
        <div className="match-center-step step-enter">
          <div className="summary">
            <div className="sum-vs">
              <div className="sum-side">
                {mode === "double" ? (
                  <div className="sum-avatars">
                    <Ball color={colorOf(me.nickname)} label={initials(me.nickname)} badge={badgeOf(me.nickname)} photo={photoOf(me.nickname)} size={40} />
                    <Ball color={colorOf(partner.nickname)} label={initials(partner.nickname)} badge={badgeOf(partner.nickname)} photo={photoOf(partner.nickname)} size={40} />
                  </div>
                ) : (
                  <Ball color={colorOf(me.nickname)} label={initials(me.nickname)} badge={badgeOf(me.nickname)} photo={photoOf(me.nickname)} size={52} />
                )}
                <span>{teamA}</span>
              </div>
              <div className="sum-score">{s1}<i>:</i>{s2}</div>
              <div className="sum-side">
                {mode === "double" ? (
                  <div className="sum-avatars">
                    <Ball color={colorOf(opp.nickname)} label={initials(opp.nickname)} badge={badgeOf(opp.nickname)} photo={photoOf(opp.nickname)} size={40} />
                    <Ball color={colorOf(opp2.nickname)} label={initials(opp2.nickname)} badge={badgeOf(opp2.nickname)} photo={photoOf(opp2.nickname)} size={40} />
                  </div>
                ) : (
                  <Ball color={colorOf(opp.nickname)} label={initials(opp.nickname)} badge={badgeOf(opp.nickname)} photo={photoOf(opp.nickname)} size={52} />
                )}
                <span>{teamB}</span>
              </div>
            </div>
            <div className="sum-disc">{t(disc)}{isGhost ? t(" · Training") : isGuestMatch ? t(" · Gast") : ""}</div>
            {is141 && (hr[0] != null || hr[1] != null) && (
              <div className="sum-141">
                {t("Höchstserie:")} {me.nickname} {hr[0]} · {opp.nickname} {hr[1]}
                {(avg[0] != null || avg[1] != null) && (
                  <><br />Ø pro Fehler-Aufnahme: {me.nickname} {avg[0] ?? "–"} · {opp.nickname} {avg[1] ?? "–"}</>
                )}
              </div>
            )}
            {isGhost ? (
              <p className="hint center" style={{ marginBottom: 0 }}>{t("Trainingsmatch – wird nicht gespeichert und zählt nicht fürs Rating.")}</p>
            ) : isGuestMatch ? (
              <p className="hint center" style={{ marginBottom: 0 }}>{t("Gast-Match – zählt nicht fürs Rating, braucht keine Bestätigung.")}</p>
            ) : (
              <div className="prob-wrap">
                <div className="prob-label">
                  <span>{t("Erwartung laut Rating ({a} : {b})", { a: myRating, b: oppRating })}</span>
                  <span>{Math.round(prob * 100)} % : {Math.round((1 - prob) * 100)} %</span>
                </div>
                <div className="prob-bar"><div style={{ width: `${prob * 100}%` }} /></div>
              </div>
            )}
          </div>
          <button className="btn primary" disabled={busy || !ghostReady} onClick={save}>
            {busy ? t("Speichere ...")
              : isGhost && !ghostReady ? <>
                  <Clock size={18} /> {t("Noch {time} …", { time: `${Math.floor(ghostRemainingSec / 60)}:${String(ghostRemainingSec % 60).padStart(2, "0")}` })}
                </>
              : isGhost ? <>{t("Training abschließen")} <Check size={18} /></> : <>{t("Match speichern")} <Check size={18} /></>}
          </button>
          {isGhost && !ghostReady && (
            <p className="hint center">{t("Ein echtes Training dauert länger – bitte warte, bis der Timer abgelaufen ist.")}</p>
          )}
          {!isGhost && !isGuestMatch && <p className="hint center">{mode === "double"
            ? t("Das Doppel zählt erst, wenn alle drei anderen bestätigt haben.")
            : t("Das Match fliesst erst ins Rating ein, wenn {name} es bestaetigt.", { name: opp.nickname })}</p>}
        </div>
      )}

      {step === 4 && opp && (
        <div className="saved match-center-step step-enter">
          <div className="sent-check big"><Check size={34} /></div>
          {offlineQueued ? (
            <>
              <h3>{t("Kein Internet")}</h3>
              <p>{t("Dein Ergebnis ({s1} : {s2}) ist auf diesem Gerät gespeichert und wird automatisch gemeldet, sobald wieder eine Verbindung besteht.", { s1, s2 })}<br />
                <b>{t("Bitte die App bis dahin nicht deinstallieren oder den Speicher leeren.")}</b></p>
            </>
          ) : isGhost ? (
            <>
              <h3>{t("Training beendet!")}</h3>
              <p>{t("Ergebnis gegen den Ghost:")} <b>{s1} : {s2}</b>.<br />
                {t("Trainingsmatches werden nicht gespeichert und beeinflussen dein Rating nicht.")}</p>
            </>
          ) : confirmedNow ? (
            <>
              <h3>{t("Bestätigt!")}</h3>
              <p>{t("Match bestaetigt - Ranking wird neu berechnet.")}</p>
            </>
          ) : isGuestMatch ? (
            <>
              <h3>{t("Gespeichert!")}</h3>
              <p>{t("Gast-Match – zählt nicht fürs Rating, braucht keine Bestätigung.")}</p>
            </>
          ) : (
            <>
              <h3>{t("Gespeichert!")}</h3>
              {mode === "double" ? (
                <p>{t("Wartet auf Bestätigung der drei anderen.")}<br />
                  <b>{t("Ohne Bestätigung zählt das Match nicht fürs Rating.")}</b></p>
              ) : (
                <p>{t("Wartet auf Bestaetigung von")} <b>{opp.nickname}</b>.<br />
                  <b>{t("Ohne Bestätigung zählt das Match nicht fürs Rating.")}</b></p>
              )}
            </>
          )}
          {/* Nur Turniermatches (Nutzer-Feedback, siehe confirmNow oben):
              sofortige Bestaetigung auf demselben Geraet statt auf den
              eigenen Gegner-Check spaeter zu warten. */}
          {tournamentCtx && !offlineQueued && !confirmedNow && mode !== "double" && (
            <>
              <p className="hint center">{t("Ist {name} noch da? Handy weiterreichen und direkt bestätigen.", { name: opp.nickname })}</p>
              <button className="btn primary" disabled={busy} onClick={confirmNow}>
                {busy ? t("Bestätige ...") : <>{t("Jetzt direkt bestätigen")} <Check size={18} /></>}
              </button>
            </>
          )}
          {savedMatch?.run_log?.length > 0 && (
            <button className="btn ghost" onClick={() => onOpenProtokoll(savedMatch)}>{t("Protokoll ansehen")}</button>
          )}
          <button className={"btn " + (tournamentCtx && !offlineQueued && !confirmedNow && mode !== "double" ? "ghost" : "primary")} onClick={onDone}>
            {t(tournamentCtx ? "Zurück zum Turnier" : "Zur Rangliste")}
          </button>
        </div>
      )}
      {/* Im Ergebnis-Schritt bleiben sie unten: oben steht dort das Match. */}
      {step === 2 && <StepDots bottom />}
    </div>
  );
}
