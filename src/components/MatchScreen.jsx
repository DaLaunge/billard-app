import { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { ChevronLeft, Check, X, Minus, Plus, Pencil, Search, QrCode, ArrowRight, Swords, Clock, UserPlus, Share2, Copy, History, TrendingUp, ArrowDownAZ, ArrowUpDown, Star } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
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
import { myCodeLink } from "../lib/inviteLink";
import KeepAwakeButton from "./widgets/KeepAwakeButton";
import FieldLabel from "./widgets/FieldLabel";
import { useFunnel, FunnelButton, FunnelPanel } from "./widgets/FilterFunnel";
import DiscBall, { DiscPick, sortDisciplines } from "./widgets/DiscBall";
import { ModeTiles } from "./widgets/ModePick";
import ExtraCounters, { CountersSummary } from "./widgets/ExtraCounters";
import { emptyCounters, normalizeCounters, bumpCounter, hasCounters, saveMatchCounters } from "../lib/matchCounters";
import { rpcRetry } from "../lib/rpcRetry";
import { flyIn, flyBack, flyEnabled } from "../lib/flyBall";

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
  const [activeSlot, setActiveSlot] = useState(null); // Doppel: "partner" | "opp" | "opp2" - wohin der naechste Tipp geht
  const [nudge, setNudge] = useState(false);          // Spielerliste leuchtet kurz auf
  const playersRef = useRef(null);
  // Kugel-Flug (lib/flyBall.js): beim Antippen einer Kachel merkt sich queueFly den
  // Platz und den Rahmen der Kachel-Kugel; nach dem Rendern (der Platz ist dann
  // gefuellt) startet der Effekt unten die Animation.
  const flyRef = useRef(null);
  useLayoutEffect(() => {
    const f = flyRef.current;
    if (!f) return;
    flyRef.current = null;
    flyIn(document.querySelector(`.vs-slot[data-slot="${f.key}"] .ball`), f.rect);
  });
  const countFunnel = useFunnel();                    // Trichter im Kopf der Spielerliste: wie viele zeigen
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
  // Optionale Zusatzzaehler (Fluke/Runout/Scratch/Foul), siehe lib/matchCounters.js.
  // Gehoeren in den Entwurf, sonst gingen sie bei einem Neuladen verloren.
  const [counters, setCounters] = useState(() => normalizeCounters(dv("counters", null)));
  const bump = (key, side, delta) => setCounters((c) => bumpCounter(c, key, side, delta));
  const [savedMatch, setSavedMatch] = useState(null); // gerade gespeichertes Match, fuers direkte "Protokoll"-Ansehen
  const [confirmedNow, setConfirmedNow] = useState(false); // Turniermatch direkt nach dem Melden auf diesem Geraet bestaetigt (siehe confirmNow unten)
  const [oppQuery, setOppQuery] = useState("");
  const [pendingDisc, setPendingDisc] = useState(null);
  const [abortAsk, setAbortAsk] = useState(false);
  // EIN QR-Code fuer alles (siehe lib/inviteLink.js): Neue werden eingeladen,
  // Mitglieder starten ein Match gegen dich. Er klappt UNTER der Zeile "Gegner"
  // aus - wie ein verstecktes Menue, ohne den Screen zu verlassen (Nutzer-
  // Feedback 2026-10-01: besser als die eigene Seite, und im Doppel koennen
  // mehrere nacheinander scannen). Den Einladungscode holen wir erst beim
  // ersten Aufklappen; bis er da ist, gilt der Link allein fuer Mitglieder (?vs=).
  const [showMyQr, setShowMyQr] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  useEffect(() => {
    if (!showMyQr || inviteCode) return;
    let alive = true;
    supabase.rpc("get_or_create_my_invite").then(({ data, error }) => { if (alive && !error) setInviteCode(data); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMyQr]);
  const myLink = myCodeLink(inviteCode, me.id);
  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Break & Rank",
          text: t("{name} lädt dich zum Billard-Ranking ein! Tippe auf den Link, um mitzumachen:", { name: me.nickname }),
          url: myLink,
        });
      } catch { /* abgebrochen */ }
    } else copyLink();
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(myLink); toast(t("Link kopiert!")); }
    catch { toast(t("Kopieren nicht möglich – Link markieren und kopieren.")); }
  };
  const [busy, setBusy] = useState(false);
  const [offlineQueued, setOfflineQueued] = useState(false); // Match konnte mangels Verbindung nicht gemeldet werden, wartet lokal
  const [ghostStartedAt, setGhostStartedAt] = useState(dv("ghostStartedAt", null)); // gegen "Durchklicken" beim Ghost-Training
  const [nowTick, setNowTick] = useState(Date.now());
  const [guestBusy, setGuestBusy] = useState(false);
  // Sortierung der Gegnerliste (pro Geraet gemerkt): "freq" haeufig, "gain" Punkte, "name" A-Z.
  const [oppSort, setOppSort] = useState(() => {
    try { const v = localStorage.getItem("matchOppSort"); return ["freq", "gain", "name"].includes(v) ? v : "freq"; } catch { return "freq"; }
  });
  const chooseSort = (v) => { setOppSort(v); try { localStorage.setItem("matchOppSort", v); } catch { /* Privatmodus */ } };
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
      hr, def, avg, tb, runLog, scoreLog, counters, ghostStartedAt, tournamentCtx: tournamentCtx || null,
    }, is141 ? scorerStateRef.current : null);
  };
  useEffect(persistDraft, [step, mode, opp, partner, opp2, s1, s2, disc, hr, def, avg, tb, runLog, scoreLog, counters, ghostStartedAt]);
  const teamA = mode === "double" && partner ? `${me.nickname} & ${partner.nickname}` : me.nickname;
  const teamB = mode === "double" && opp2 ? `${opp?.nickname} & ${opp2.nickname}` : (opp?.nickname || "");
  // Spielerwahl. Einzel: der Tipp waehlt den Gegner (nochmal = abwaehlen), gestartet
  // wird mit dem immer sichtbaren "Match starten" - wie im Doppel (Nutzer-Feedback
  // 2026-10-01: konsistent, auch wenn es einen Klick mehr kostet). Doppel: der Tipp fuellt
  // den AKTIVEN Platz der Aufstellung (leerer Kreis antippen = dorthin
  // waehlen, sonst der naechste freie in der Reihenfolge Partner, Gegner 1,
  // Gegner 2); ein schon gewaehlter Spieler wird wieder entfernt und sein
  // Platz ist danach der aktive.
  const queueFly = (key, tile) => {
    const ball = tile?.querySelector(".ball");
    if (ball && flyEnabled()) flyRef.current = { key, rect: ball.getBoundingClientRect() };
  };
  // Rueckweg beim Entfernen: die Kugel im Platz fliegt zur Kachel des Spielers
  // (falls sie in der Liste steht und im Bild ist).
  const flyBackSlot = (key) => {
    const pid = slotVal[key]?.id;
    if (!pid || !flyEnabled()) return false;
    return flyBack(
      document.querySelector(`.vs-slot[data-slot="${key}"] .ball`),
      document.querySelector(`.opp-cell[data-pid="${pid}"] .opp-card .ball`),
    );
  };
  const pickPlayer = (p, tile) => {
    if (mode === "single") {
      if (opp?.id === p.id) { flyBackSlot("opp"); setOpp(null); return; }
      queueFly("opp", tile);
      setOpp(p);
      return;
    }
    const cur = SLOT_ORDER.find((k) => slotVal[k]?.id === p.id);
    if (cur) { flyBackSlot(cur); setSlot(cur, null); setActiveSlot(cur); return; }
    const target = activeKey;
    if (!target) return;
    queueFly(target, tile);
    setSlot(target, p);
    const after = { ...slotVal, [target]: p };
    setActiveSlot(SLOT_ORDER.find((k) => !after[k]) || null);
  };

  // Die Aufstellung ("Du VS Gegner") als Platzreihe: gefuellt = Kugel + Name
  // (Tipp entfernt wieder und macht den Platz zum aktiven), leer =
  // gestrichelter Kreis, den man antippt, um dort einen Spieler zu waehlen
  // (Nutzer-Feedback 2026-09-30: "wenn ich darauf klicke, erwarte ich, dass ich
  // einen Spieler auswaehle"). Der aktive leere Platz ist im Akzent umrandet,
  // und die Ueberschrift der Spielerliste nennt seine Rolle.
  const SLOT_ORDER = ["partner", "opp", "opp2"];
  const slotVal = { partner, opp, opp2 };
  const setSlot = (k, v) => (k === "partner" ? setPartner(v) : k === "opp" ? setOpp(v) : setOpp2(v));
  const activeKey = mode === "double"
    ? ((activeSlot && !slotVal[activeSlot]) ? activeSlot : (SLOT_ORDER.find((k) => !slotVal[k]) || null))
    : (opp ? null : "opp");
  const slotRole = { partner: t("Partner"), opp: mode === "double" ? t("Gegner 1") : t("Gegner"), opp2: t("Gegner 2") };
  // Zur Spielerliste springen und sie kurz aufleuchten lassen - am Handy liegt
  // sie unter der Aufstellung, am PC daneben.
  const nudgePlayers = (scroll = true) => {
    const card = playersRef.current;
    const scroller = card?.closest("main.content");
    let scrolled = false;
    if (card && scroller) {
      // Zielwert selbst berechnen statt scrollIntoView: zuverlaessig auch im
      // Scroll-Container der App, und nur dann scrollen, wenn die Karte nicht
      // ohnehin oben im Bild steht (am PC liegt sie neben der Aufstellung).
      const rel = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      // Der haftende Streifen oben (am Handy) verdeckt den Anfang der Karte:
      // seine Hoehe gehoert zum Abstand dazu.
      const dock = document.querySelector(".vs-dock");
      const dockH = dock && getComputedStyle(dock).position === "sticky" ? dock.offsetHeight : 0;
      if (scroll && (rel > 120 + dockH || rel < dockH)) {
        scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + rel - 12 - dockH), behavior: "smooth" });
        scrolled = true;
      }
    }
    setNudge(true);
    setTimeout(() => setNudge(false), 900);
    return scrolled;
  };
  const slot = (p, key) => {
    const role = key ? slotRole[key] : t("Du");
    if (p) {
      // Steht die Kachel des Spielers im Bild, fliegt die Kugel dorthin zurueck und die
      // Liste bleibt, wo sie ist (ein Scrollen wuerde das Ziel verschieben). Sonst wie
      // beim leeren Platz: zur Liste scrollen.
      const clear = key ? () => {
        nudgePlayers(!flyBackSlot(key));
        setSlot(key, null);
        setActiveSlot(key);
      } : null;
      return (
        <button type="button" className={"vs-slot filled" + (clear ? "" : " me")} data-slot={key || "me"} onClick={clear || undefined}
          disabled={!clear} title={clear ? `${role} – ${t("Entfernen")}` : role}>
          <Ball color={colorOf(p.nickname)} label={initials(p.nickname)} badge={badgeOf(p.nickname)} photo={photoOf(p.nickname)} size={44} />
          <span>{p.nickname}</span>
        </button>
      );
    }
    return (
      <button type="button" data-slot={key} className={"vs-slot empty" + (activeKey === key ? " active" : "")}
        onClick={() => { if (mode === "double") setActiveSlot(key); nudgePlayers(); }}
        title={`${role} – ${t("Spieler wählen")}`} aria-label={`${role} – ${t("Spieler wählen")}`}>
        <span className="vs-empty-ball"><Plus size={16} /></span>
        <span>{role}</span>
      </button>
    );
  };
  const ready = mode === "double" ? !!(partner && opp && opp2) : !!opp;
  const chooseMode = (m) => {
    if (m === mode) return;
    setMode(m);
    setActiveSlot(null);
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

  // --- Punkte-Vorschau ---
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

  const ghost = players.find((p) => p.is_ghost);
  // Moegliche Rating-Punkte bei einem Sieg je Gegner in der gewaehlten Disziplin
  // (nur im Einzel; Gaeste zaehlen nicht fuers Rating und haben keine). Grundlage
  // fuer die Anzeige auf JEDER Kachel, die Sortierung "Punkte" und die
  // Hervorhebung der Empfehlung (Nutzer-Feedback 2026-10-01).
  // Im Doppel zaehlt der Durchschnitt der beiden Teams (wie rebuild_elo(): beide
  // Partner bekommen dasselbe Delta, bewertet wird mit dem "Doppel"-Rating). Die
  // Kachel zeigt, was ein Sieg braeuchte, wenn dieser Spieler den gerade aktiven
  // Platz (Partner / Gegner 1 / Gegner 2) bekaeme; noch leere Plaetze zaehlen wie
  // im Rating selbst mit der Startwertung 500. Ein Gast im Match macht es
  // ungewertet - dann gibt es nirgends eine Zahl.
  const doublesGain = (p) => {
    if (!activeKey || p.is_guest) return null;
    const seats = { ...slotVal, [activeKey]: p };
    if (Object.values(seats).some((x) => x?.is_guest)) return null;
    const r = (x) => (x ? ratingOf(x.nickname, "Doppel") : 500);
    const tA = (ratingOf(me.nickname, "Doppel") + r(seats.partner)) / 2;
    const tB = (r(seats.opp) + r(seats.opp2)) / 2;
    const D = disc === "14/1 Endlos" ? 50 : 4;
    return 4 * Math.min(D, 16) * (1 - winProb(tA, tB));
  };
  const gainOf = (p) => (mode === "single"
    ? (p.is_guest ? null : previewFor(disc || "Gesamt", p.nickname).winMax)
    : doublesGain(p));
  const byFreq = (a, b) => (freqByNick[b.nickname] || 0) - (freqByNick[a.nickname] || 0) || a.nickname.localeCompare(b.nickname);
  const query = oppQuery.trim().toLowerCase();
  const matching = players
    .filter((p) => p.id !== me.id && !p.is_ghost && !p.blocked)
    .filter((p) => p.nickname.toLowerCase().includes(query))
    // Gaeste stehen NICHT in der Standardliste (Nutzer-Wunsch 2026-10-01: sie sollen
    // sich lieber selbst anmelden). Per Suche sind sie weiter zu finden, und ein neuer
    // Gast wird ueber die Suche angelegt.
    .filter((p) => query || !p.is_guest);
  // Empfehlung: die zwei Gegner mit dem hoechsten moeglichen Gewinn. Sie sind
  // KEINE eigene Karte mehr, sondern stehen als normale, nur hervorgehobene
  // Kacheln in der Liste.
  const recList = mode === "single"
    ? matching.filter((p) => !p.is_guest).sort((a, b) => gainOf(b) - gainOf(a)).slice(0, 2)
    : [];
  const recIds = new Set(recList.map((p) => p.id));
  // Sortierung: "freq" = haeufigste Gegner zuerst (wie bisher), "gain" = meiste
  // moegliche Punkte zuerst (nur Einzel), "name" = A-Z.
  const sortMode = oppSort;
  const cmp = sortMode === "name" ? (a, b) => a.nickname.localeCompare(b.nickname)
    : sortMode === "gain" ? (a, b) => (gainOf(b) ?? -Infinity) - (gainOf(a) ?? -Infinity) || byFreq(a, b)
    : byFreq;
  let allMatchingOpponents = [...matching].sort(cmp);
  // Bei "haeufig" stehen die Empfehlungen zuerst (sonst waeren sie unter vielen
  // Spielern ohne gemeinsame Matches nicht zu finden); bei "Punkte" ohnehin vorn.
  if (!query && sortMode === "freq") {
    allMatchingOpponents = [...recList, ...allMatchingOpponents.filter((p) => !recIds.has(p.id))];
  }
  // Ohne aktive Suche nur die Top-N zeigen (Nutzer-Feedback: Spielerliste
  // wird mit der Zeit sehr lang) - waehrend einer Suche wird IMMER die volle
  // Trefferliste gezeigt, sonst faende man jemanden mit wenigen gemeinsamen
  // Matches nie.
  const opponents = (!query && oppCount !== "all")
    ? allMatchingOpponents.slice(0, oppCount)
    : allMatchingOpponents;
  // Spielerkacheln blenden sich beim Hineinscrollen ein (nur stabile Werte als
  // Abhaengigkeit, siehe useRevealOnScroll). Auch die Sortierung gehoert dazu:
  // eine neue Reihenfolge baut die Kacheln neu auf.
  // Die ID-Reihenfolge gehoert in die Abhaengigkeiten: im Doppel haengt der moegliche
  // Gewinn (und damit bei "Punkte" die Auswahl der ersten N Kacheln) von den schon
  // gewaehlten Spielern ab. Jede Auswahl kann also neue Kacheln in die Liste bringen -
  // die tragen "reveal" ohne "is-in" und blieben unsichtbar, solange der Haken nicht neu
  // sucht (Bug-Meldung 2026-10-01: "einige moegliche Gegner verschwinden, sobald ich
  // einen angeklickt habe"). Ein String ist stabil, das Array selbst waere es nicht.
  const shownKey = opponents.map((p) => p.id).join(",");
  const formRef = useRevealOnScroll([step, shownKey, query === "", mode, oppCount, sortMode, disc]);

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

  const resetScores = () => { scorerStateRef.current = null; setResumeScorer(null); setS1(0); setS2(0); setHr([null, null]); setDef([null, null]); setAvg([null, null]); setTb([null, null]); setScoreLog([[0, 0, Date.now()]]); setCounters(emptyCounters()); };

  // Disziplin wechseln (im Ergebnis-Schritt): zwischen 8/9/10 bleibt das
  // Ergebnis erhalten; ein Wechsel zu oder von 14/1 aendert das Punkteschema
  // -> nachfragen, sobald schon etwas gezaehlt wurde (beim laufenden 14/1
  // steckt der Stand im Scorer, s1/s2 sind dort noch 0 - daher is141).
  //
  // Nachgefragt wird NUR, wenn dabei wirklich etwas verloren ginge (Nutzer-
  // Feedback 2026-10-01): im laufenden Match UND beim Wechsel zu/von 14/1 UND
  // erst, wenn schon etwas gezaehlt wurde. Ein 14/1-Scorer, der noch im Aufbau
  // steht (Zielpunkte waehlen, noch nichts gespielt), wird ohne Frage gewechselt.
  // In "Neues Match" vor dem Start und im Turnierformular gibt es nie eine Frage.
  const scorerHasProgress = () => {
    const st = scorerStateRef.current;
    return !!st && !!st.started && ((st.log?.length || 0) > 0 || ((st.sc?.[0] || 0) + (st.sc?.[1] || 0)) > 0);
  };
  const switchDisc = (d) => {
    if (d === disc) return;
    const crosses141 = (disc === "14/1 Endlos") !== (d === "14/1 Endlos");
    if (crosses141 && (is141 ? scorerHasProgress() : (s1 > 0 || s2 > 0))) { setPendingDisc(d); return; }
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
    // Nur mitschicken, wenn wirklich etwas gezaehlt wurde (alles optional).
    const cnt = hasCounters(counters) ? counters : undefined;
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
          savePendingReport({ type: "double", params, counters: cnt });
          setOfflineQueued(true); setStep(4); return;
        }
        toast(t("Fehler: ") + error.message); return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      await saveMatchCounters(row?.id, cnt);
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
          savePendingReport({ type: "tournament", rpc, params, counters: cnt });
          setOfflineQueued(true); setStep(4); return;
        }
        toast(t("Fehler: ") + error.message); return;
      }
      const tRow = Array.isArray(data) ? data[0] : data;
      await saveMatchCounters(tRow?.id, cnt);
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
        savePendingReport({ type: "single", params, counters: cnt });
        setOfflineQueued(true); setStep(4); return;
      }
      toast(t("Fehler: ") + error.message); return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    await saveMatchCounters(row?.id, cnt);
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

  // "Zurueck" im laufenden Match fuehrt zur MATCHAUSWAHL, nicht aus dem Screen
  // (Nutzer-Feedback 2026-10-01: den Knopf drueckt man meist, weil die
  // Konfiguration falsch war - dann gibt man aehnliche Angaben neu ein). Spieler,
  // Modus und Disziplin bleiben dabei vorbelegt, nur Ergebnis, Zaehler und
  // Protokoll werden verworfen. Nachgefragt wird nur, wenn etwas verloren ginge.
  // Turnierpartien starten ohne Auswahl im Ergebnis-Schritt: dort bleibt "Zurueck"
  // das Verlassen des Screens (zurueck zum Turnier).
  const hasEntered = () => s1 + s2 > 0 || hasCounters(counters) || scoreLog.length > 1 || (is141 && scorerHasProgress());
  const backToSelection = () => {
    clearMatchDraft(me.id);
    resetScores();
    setRunLog(null); setGhostStartedAt(null); setPendingDisc(null); setAbortAsk(false);
    setStep(0);
  };
  const onBackPress = () => {
    if (step === 0 || step === 4) { onCancel(); return; }
    if (tournamentCtx) { setAbortAsk(true); return; }
    if (hasEntered()) setAbortAsk(true); else backToSelection();
  };


  return (
    <div className="screen">
      {/* Kopfzeile: statt eines Titels "Neues Match" (Nutzer-Feedback
          2026-10-01: unnoetig, es ist klar, dass hier ein Match entsteht) steht
          die Disziplin ganz oben und zentriert - zur Wahl im Formular, danach als
          Kugel mit Name. */}
      <header className="screen-head with-back match-head">
        <button className="back-btn" onClick={onBackPress} aria-label={t("Zurueck")}>
          <ChevronLeft size={22} />
        </button>
        <div className="match-head-disc">
          {/* Wahl der Disziplin: im Formular und waehrend der Aufzeichnung
              (Ergebnis-Schritt) direkt hier oben - dort stand sie vorher ein
              zweites Mal unter dem Zaehler (Nutzer-Feedback 2026-10-01:
              "redundant"). Bei Turnierpartien ist sie vorgegeben, auf der
              Pruefseite und danach nur noch zur Anzeige. */}
          {(step === 0 || (step === 2 && !tournamentCtx))
            ? matchDiscs.map((d) => (
              <DiscPick key={d} disc={d} size={30} selected={disc === d}
                onSelect={() => (step === 0 ? setDisc(d) : switchDisc(d))} />
            ))
            : disc && (<><DiscBall disc={disc} size={34} /><span className="match-head-name">{t(disc)}</span></>)}
        </div>
        <KeepAwakeButton on={keepAwake} onChange={onSetKeepAwake} toast={toast} />
      </header>

      {abortAsk && (
        <div className="modal-overlay" onClick={() => setAbortAsk(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{tournamentCtx ? t("Match abbrechen?") : t("Zurück zur Auswahl?")}</h3>
            <p>{t("Alle Eingaben gehen verloren")}{is141 ? t(" – ein 14/1-Protokoll lässt sich nicht wiederherstellen") : ""}.</p>
            <div className="sp-controls">
              <button className="btn ghost warn" onClick={() => { if (tournamentCtx) { setAbortAsk(false); onCancel(); } else backToSelection(); }}>
                {tournamentCtx ? t("Ja – beenden") : t("Ja – zurück")}
              </button>
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
        <>
        <div className="match-split" ref={formRef}>
          <div className="match-selectors">
            <section className="stat-block">
              <div className="turnier-form">
                <FieldLabel label={t("Modus")} />
                <ModeTiles value={mode} onChange={chooseMode} />

                {mode === "single" && opp && <PointPreview dsc={disc} />}
              </div>
            </section>
            {/* Die Aufstellung bleibt beim Scrollen der Spielerliste OBEN am
                Bildschirm haengen (Nutzer-Feedback 2026-10-01: die gewaehlten
                Spieler sollen nie wegscrollen). Deshalb steht sie nicht in der
                Karte darueber: ein haftendes Element bleibt nur innerhalb
                seines Elternelements haften, und .match-selectors wird am Handy
                per display:contents aufgeloest, damit der Streifen Kind der
                hohen Seite ist. Am PC haftet stattdessen die ganze linke Spalte. */}
            <div className="vs-dock">
                    {/* Wer gegen wen - gezeichnet statt beschrieben, in BEIDEN Modi
                        sichtbar. Die leeren Kreise sind Knoepfe: antippen = dort
                        einen Spieler waehlen (springt zur Spielerliste). */}
                    <div className="vs-strip">
                      <div className="vs-team">
                        {slot(me, null)}
                        {mode === "double" && slot(partner, "partner")}
                      </div>
                      <span className="vs-x">VS</span>
                      <div className="vs-team">
                        {slot(opp, "opp")}
                        {mode === "double" && slot(opp2, "opp2")}
                      </div>
                    </div>
            </div>
          </div>

          {/* Reihenfolge (Nutzer-Feedback): Empfehlung, Suche, wie viele
              Spieler, Spieler-Kacheln - und der Ghost ganz am Ende, weil
              Trainingsmatches der Sonderfall sind. */}
          <div className="match-players" ref={playersRef}>
            <section className={"stat-block" + (nudge ? " nudge" : "")}>
              <div className="turnier-form match-list-form">
                {/* Die Ueberschrift nennt, FUER WEN gerade gewaehlt wird (Rolle des
                    aktiven Platzes). Rechts: Code, Einladen und - nur bei langer
                    Liste - der Trichter fuer die Anzahl (statt einer eigenen
                    Chip-Zeile mitten im Inhalt). */}
                <FieldLabel label={mode === "single" ? t("Gegner") : (activeKey ? slotRole[activeKey] : t("Spieler"))}
                  info={mode === "double" ? t("Tippe drei Spieler an: zuerst deinen Partner, dann die beiden Gegner.") : undefined}
                  actions={(
                    <>
                      <FunnelButton funnel={countFunnel} icon={ArrowUpDown} label={t("Sortieren & Anzahl")} />
                    </>
                  )} />
                <FunnelPanel funnel={countFunnel}>
                  {/* Sortierung - als Symbole mit Namen. "Punkte" gibt es nur im Einzel
                      (im Doppel gibt es keine einzelne Vorschau). */}
                  <div className="chips small">
                    {[["freq", t("Häufig"), History], ["gain", t("Punkte"), TrendingUp], ["name", t("A–Z"), ArrowDownAZ]].map(([key, label, Icon]) => (
                      <button key={key} className={"chip" + (sortMode === key ? " active" : "")} onClick={() => chooseSort(key)}>
                        <Icon size={14} style={{ marginRight: 4, verticalAlign: -2 }} />{label}
                      </button>
                    ))}
                  </div>
                  {allMatchingOpponents.length > DEFAULT_LIST_COUNT && (
                    <div className="chips small" style={{ marginTop: 8 }}>
                      {LIST_COUNT_OPTIONS.map((c) => (
                        <button key={c} className={"chip" + (oppCount === c ? " active" : "")} onClick={() => setOppCount(c)}>
                          {c === "all" ? t("Alle") : c}
                        </button>
                      ))}
                    </div>
                  )}
                </FunnelPanel>

                <div className="search-row">
                  <Search size={16} className="mail-ico" />
                  <input placeholder={t("Suchen, eingeben, scannen …")} value={oppQuery} onChange={(e) => setOppQuery(e.target.value)} />
                  {oppQuery && <button className="clear-btn" onClick={() => setOppQuery("")} aria-label={t("Suche loeschen")}><X size={15} /></button>}
                  {/* Das QR-Symbol gehoert zur Suche (Nutzer-Feedback 2026-10-01): einen
                      Spieler findet man per Suche, per Eingabe eines Gastes - oder indem
                      er den eigenen QR-Code scannt. */}
                  <button type="button" className={"icon-btn small" + (showMyQr ? " on" : "")} aria-pressed={showMyQr}
                    onClick={() => setShowMyQr((v) => !v)}
                    aria-label={t("QR-Code zeigen: Mitglieder werben und Match starten")}
                    title={t("QR-Code zeigen: Mitglieder werben und Match starten")}>
                    <QrCode size={15} />
                  </button>
                </div>
                {/* Aufklappbarer QR-Code (beide Modi). Zwei Funktionen in einem Code -
                    gezeichnet statt erklaert; Teilen/Kopieren als Symbole. */}
                <div className={"collapsible" + (showMyQr ? " open" : "")} inert={showMyQr ? undefined : ""}>
                  <div className="collapsible-inner">
                    <div className="my-qr">
                      <div className="qr-box">
                        <QRCodeSVG value={myLink} size={190} level="M" bgColor="#F2EDE0" fgColor="#0A2B21" />
                      </div>
                      <div className="qr-uses">
                        <span><UserPlus size={14} /> {t("Neu: Einladung")}</span>
                        <span><Swords size={14} /> {t("Mitglied: Match starten")}</span>
                      </div>
                      <div className="qr-share">
                        <button type="button" className="icon-btn small" onClick={shareLink}
                          aria-label={t("Einladung teilen")} title={t("Einladung teilen")}><Share2 size={15} /></button>
                        <button type="button" className="icon-btn small" onClick={copyLink}
                          aria-label={t("Link kopieren")} title={t("Link kopieren")}><Copy size={15} /></button>
                      </div>
                    </div>
                  </div>
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
                {!oppQuery.trim() && opponents.length === 0 && <p className="hint">{t("Kein Spieler gefunden.")}</p>}
                <div className="opp-grid">
                  {/* Die Einblend-Klasse "reveal" sitzt auf einem Wrapper mit FESTEM
                      Klassennamen, nicht auf der Karte: useRevealOnScroll setzt "is-in"
                      direkt am Element, und ein sich aenderndes className (Auswahl!)
                      schreibt React neu - dann war "is-in" weg und die Karte blieb
                      unsichtbar (Bug-Meldung 2026-10-01: gewaehlter Spieler
                      verschwindet und kommt nach dem Abwaehlen nicht wieder). */}
                  {opponents.map((p, i) => {
                    const role = mode === "double"
                      ? (partner?.id === p.id ? t("Partner") : opp?.id === p.id ? t("Gegner 1") : opp2?.id === p.id ? t("Gegner 2") : null)
                      : (opp?.id === p.id ? t("Gegner") : null);
                    const g = gainOf(p);
                    const isRec = recIds.has(p.id);
                    return (
                      <div key={p.id} data-pid={p.id} className="opp-cell reveal" style={{ "--i": i % 4 }}>
                        <button className={"opp-card" + (role ? " sel" : "") + (isRec ? " rec" : "")} onClick={(e) => pickPlayer(p, e.currentTarget)}>
                          <Ball color={colorOf(p.nickname)} label={initials(p.nickname)} badge={badgeOf(p.nickname)} photo={photoOf(p.nickname)} size={48} />
                          <span>{p.nickname}{p.is_guest && <span className="guest-tag">{t("Gast")}</span>}</span>
                          {/* Schon gewaehlt: bleibt in der Liste, Kugel abgedunkelt, die
                              Rolle steht dabei - antippen nimmt den Spieler wieder heraus.
                              Sonst: moegliche Punkte bei einem Sieg (Einzel). */}
                          {role
                            ? <span className="opp-role">{role}</span>
                            : g != null && (
                              <span className="opp-gain" title={`${t("bis zu")} ${fmtD(g)}`}>
                                <TrendingUp size={11} /> {fmtD(g)}
                              </span>
                            )}
                          {isRec && <span className="opp-rec" title={t("Empfehlung")}><Star size={11} fill="currentColor" /></span>}
                        </button>
                        {/* Herausfordern bleibt an den empfohlenen Gegnern erreichbar - als
                            kleines Symbol neben der Karte, nicht darin (ein Knopf im Knopf
                            ist ungueltig). */}
                        {isRec && (
                          <button type="button" className="opp-challenge" onClick={() => onChallenge(p.id)}
                            title={t("Herausfordern")} aria-label={t("Herausfordern")}><Swords size={13} /></button>
                        )}
                      </div>
                    );
                  })}
                  {/* Ghost: als letzte Kachel der Liste statt als breite Karte -
                      der Sonderfall (Training) soll nicht mehr Platz brauchen
                      als ein Mitspieler. Erklaerung im Tooltip. */}
                  {mode === "single" && ghost && !oppQuery && (
                    <div className="opp-cell reveal" style={{ "--i": opponents.length % 4 }}>
                      <button className={"opp-card ghost-tile" + (opp?.id === ghost.id ? " sel" : "")}
                        title={`${t("Training gegen Ghost")} – ${t("Übungsmatch – zählt nicht fürs Rating")}`}
                        onClick={() => setOpp(opp?.id === ghost.id ? null : ghost)}>
                        <span className="ghost-ball">👻</span>
                        <span>{t("Ghost")}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
        {/* "Match starten" bleibt unten am Bildschirmrand haengen, egal wie weit
            man in der Spielerliste gescrollt hat (Nutzer-Feedback 2026-10-01: muss
            immer gut erreichbar sein) - in BEIDEN Modi, inaktiv, bis der Gegner
            bzw. alle drei Plaetze feststehen. */}
        <div className="sticky-cta">
          <button className="btn primary" disabled={!ready} onClick={() => start(opp)}>
            <Swords size={18} /> {t("Match starten")}
          </button>
        </div>
        </>
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
              {/* Optionale Zusatzzaehler (Fluke/Runout/Scratch/Foul), zugeklappt.
                  Hier, waehrend des Spiels, nicht erst am Ende. */}
              {!isGhost && (
                <ExtraCounters value={counters} onBump={bump} names={[teamA, teamB]} />
              )}
              <div className="sticky-cta">
                <button className="btn primary" disabled={total === 0 || s1 === s2} onClick={() => setStep(3)}>
                  {t("Beenden")} <ArrowRight size={18} />
                </button>
              </div>
              {s1 === s2 && total > 0 && <p className="hint center">{t("Unentschieden gibt's beim Billard nicht ;-)")}</p>}
            </>
          )}
          <PointPreview dsc={disc} />
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
            {!isGhost && !is141 && <CountersSummary value={counters} />}
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
          {/* 14/1: der Scorer ist voll belegt, deshalb werden die Zusatzzaehler
              hier nachgetragen (die anderen Disziplinen zaehlen sie live). */}
          {!isGhost && is141 && (
            <ExtraCounters value={counters} onBump={bump} names={[teamA, teamB]} />
          )}
          <div className="sticky-cta">
            <button className="btn primary" disabled={busy || !ghostReady} onClick={save}>
              {busy ? t("Speichere ...")
                : isGhost && !ghostReady ? <>
                    <Clock size={18} /> {t("Noch {time} …", { time: `${Math.floor(ghostRemainingSec / 60)}:${String(ghostRemainingSec % 60).padStart(2, "0")}` })}
                  </>
                : isGhost ? <>{t("Training abschließen")} <Check size={18} /></> : <>{t("Match speichern")} <Check size={18} /></>}
            </button>
          </div>
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
    </div>
  );
}
