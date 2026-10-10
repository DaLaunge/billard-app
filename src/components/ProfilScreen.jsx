import { RULES_TOTAL } from "../lib/rulesTotal";
import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronUp, User, X, Check, Pencil, Trophy, Award, ChevronDown, ChevronsDown, ChevronsUp, Lock, LockOpen, Swords, Shield, LogOut, RefreshCw, Share, Download, MessageCircle, Palette, Play, Search, Smartphone, LayoutGrid, Layers, Eye, SlidersHorizontal, UserCog, MessageSquarePlus, RotateCcw, GraduationCap, Mail, Send, History, BarChart3, Radio, AlignStartVertical, AlignCenterVertical, AlignEndVertical } from "lucide-react";
import { t } from "../lib/i18n";
import { APP_VERSION, FEATURES } from "../lib/constants";
import { computeStats } from "../lib/stats";
import { computeAchievementExtras, badgeProgress } from "../lib/achievements";
import { useInstallPrompt } from "../lib/installPrompt";
import { initials, hashColor, BALL_PALETTE } from "../lib/format";
import { computeSpeedStats } from "../lib/runLog";
import { THEME_CATALOG, THEME_KEYS, applyTheme } from "../lib/themes";
import { pushAvailability } from "../lib/notifications";
import Ball from "./Ball";
import PasswordSection from "./PasswordSection";
import AvatarPhotoField from "./AvatarPhotoField";
import MyFeedbackTickets from "./MyFeedbackTickets";
import IdentityCard from "./widgets/IdentityCard";
import AchievementsProgressCard from "./widgets/AchievementsProgressCard";
import ImprintFooter from "./widgets/ImprintFooter";
import InfoButton from "./widgets/InfoButton";
import MatchFlySwitch from "./widgets/MatchFlySwitch";
import PendingPopupSwitch from "./widgets/PendingPopupSwitch";
import FiltersOpenSwitch from "./widgets/FiltersOpenSwitch";
import CardMenuButton from "./widgets/CardMenuButton";
import ProgressBar from "./widgets/ProgressBar";
import ShowAllCardsButton from "./widgets/ShowAllCardsButton";
import CardSlot from "./widgets/CardSlot";
import CardDeck from "./widgets/CardDeck";
import NumbersDeck from "./widgets/NumbersDeck";
import { CARD_SCREENS, screenUnits, deckIds, splitCardColumns, foldedDeck, withoutFolded, deckColumn, phoneSlotOrder } from "../lib/cardLayout";
import { useCardLayout } from "../lib/useCardLayout";

// Welche Karten des Profils sich je EINE Karte mit Reitern teilen (siehe
// DECKS weiter unten und CardDeck.jsx). Hier oben, weil die Spaltenwahl
// schon vor dem Aufbau der Karten feststehen muss.
// Erfolge ist seit 2026-10-03 EINE Karte (kein Reiter-Deck mehr), steht hier aber weiter
// als Ein-Teil-Gruppe, damit Spalte und Anker wie bei den anderen Karten laufen.
const PROFIL_DECK_IDS = [["erfolge"], deckIds("profil", "zahlen")];

// Spaltenwahl in den Karten-Einstellungen: Symbol + Name je Spalte. Die
// Symbole zeigen einen Block links/mittig/rechts und damit direkt, wo die
// Karte am PC landet (welche Spalten es auf einem Bildschirm ueberhaupt
// gibt, steht im Katalog in cardLayout.js - Statistik und Live haben links
// eine feste Spalte und daher nur Mitte/Rechts).
const CARD_COLUMN_LABEL = { left: "Links", middle: "Mitte", right: "Rechts" };
const CARD_COLUMN_ICON = { left: AlignStartVertical, middle: AlignCenterVertical, right: AlignEndVertical };

// Eine Zeile der Karten-Liste in den Einstellungen: Pfeile links, Name +
// Schalter in der Mitte, optional die Spaltenwahl rechts. Der Schalter steckt
// in einem eigenen <label>, die Knoepfe bewusst DANEBEN und nicht darin: ein
// Knopf innerhalb eines Labels loest dessen Kaestchen mit aus - ein Klick auf
// "nach oben" wuerde die Karte also gleich mit ausblenden. Reihenfolge im
// Markup: Kaestchen, Schieber, Name (der Schieber-Zustand haengt am
// Geschwister-Selektor input:checked + .settings-switch-track); angezeigt
// wird trotzdem Name links / Schieber rechts (order im CSS).
function CardVisRow({ shown, label, icon, meta, className = "", canUp, canDown, onUp, onDown, onToggle, col }) {
  const ColIcon = col ? (CARD_COLUMN_ICON[col.value] || AlignCenterVertical) : null;
  return (
    <div className={"card-vis-row" + (shown ? "" : " is-hidden") + (className ? " " + className : "")}>
      {/* Pfeile statt Ziehen: am Handy waere eine 36px hohe Zeile ein
          schlechtes Ziehziel, und ein Fehlgriff waere hier besonders
          aergerlich, weil direkt daneben der Schalter zum Ausblenden sitzt. */}
      <span className="card-vis-move">
        <button type="button" className="card-vis-mini" disabled={!canUp} onClick={onUp}
          aria-label={t("Nach oben")} title={t("Nach oben")}><ChevronUp size={14} /></button>
        <button type="button" className="card-vis-mini" disabled={!canDown} onClick={onDown}
          aria-label={t("Nach unten")} title={t("Nach unten")}><ChevronDown size={14} /></button>
      </span>
      <label className="settings-switch card-vis-switch"
        /* Nutzer-Feedback: "wenn ich eine Karte in den Profileinstellungen
           deaktiviere, scrollt die App automatisch ungewollt". Ein Klick aufs
           Label fokussiert das unsichtbare Kaestchen (0x0 Pixel), und der
           Browser scrollt jedes frisch fokussierte Element ins Bild - wegen
           scroll-behavior:smooth auf .content ist die Korrektur auch noch
           eine sichtbare Fahrt. preventDefault auf mousedown unterbindet
           genau diesen Fokus-Schritt; das Umschalten selbst haengt am
           click bzw. change und funktioniert weiter. Mit der Tastatur (Tab)
           wird weiterhin normal fokussiert - dort IST das Scrollen
           erwuenscht. */
        onMouseDown={(e) => e.preventDefault()}>
        <input type="checkbox" checked={shown} onChange={onToggle} />
        <span className="settings-switch-track" aria-hidden="true"><span className="settings-switch-knob" /></span>
        {/* Bewusst kein Auge/durchgestrichenes Auge (Nutzer-Feedback: der
            Schieberegler ist Information genug). */}
        <span className="card-vis-name">
          {icon}
          <span className="card-vis-label">{label}</span>
          {meta}
        </span>
      </label>
      {/* Spaltenwahl nur am PC (siehe .card-vis-col in App.css) - am Handy
          steht ohnehin alles untereinander, dort zaehlt allein die
          Reihenfolge. */}
      {col ? (
        <button type="button" className="card-vis-mini card-vis-col" onClick={col.onCycle}
          aria-label={t("Spalte wechseln")}
          title={t("Spalte: {col}", { col: t(CARD_COLUMN_LABEL[col.value] || "Mitte") })}>
          <ColIcon size={14} />
        </button>
      ) : <span className="card-vis-col-gap" />}
    </div>
  );
}

export default function ProfilScreen({ nickname, matches, rangliste, onBack, isMe, onLogout, colorOf, badgeOf, photoOf,
  players, meRow, onSaveProfile, onOpenAdmin, earnedBadges, onSelectBadge, catalog, onInvite, toast, lang, onLang, onOpenProfile,
  onChallenge, onStartMatch, challenges, updateInterval, onSetUpdateInterval, onCheckUpdate, keepAwake, onSetKeepAwake, hideTabbar, onSetHideTabbar, notifyMode, onSetNotifyMode, pendingPopup, onSetPendingPopup, onSubmitFeedback, onDeleteAccount, onReload, onSetTheme, onSetStartTab,
  onResetCardLayout, onSetCardLayout, achievementCounters, onStartTutorial }) {
  // Anordnung (Reihenfolge + Spalte) und Sichtbarkeit der Karten. Drei
  // Haken, weil die Karten-Einstellungen unter "Profil bearbeiten" ALLE
  // Bildschirme abdecken, nicht nur das Profil selbst - dort ist die eine
  // Stelle, an der man ohne Bildschirmwechsel sieht und aendert, was
  // ueberall in welcher Reihenfolge steht und was ausgeblendet ist.
  const layoutByScreen = {
    stats: useCardLayout("stats", meRow?.card_layout, onSetCardLayout, toast),
    live: useCardLayout("live", meRow?.card_layout, onSetCardLayout, toast),
    profil: useCardLayout("profil", meRow?.card_layout, onSetCardLayout, toast),
  };
  const cards = layoutByScreen.profil;
  // Auf einem FREMDEN Profil sind dieselben Karten der ganze Inhalt der
  // Seite: dort bleibt alles sichtbar (die Ausblend-Entscheidung gilt der
  // eigenen Uebersicht) und es gibt keinen Ausblenden-Knopf (onHide
  // undefined => CardMenuButton rendert nichts). Die REIHENFOLGE gilt
  // dagegen auch dort - sie ist die Vorliebe dessen, der gerade schaut.
  const shownOrder = isMe ? cards.visibleOrder : cards.order;
  // Die zusammengelegten Karten (siehe DECKS weiter unten) zaehlen am
  // Desktop als EINE Karte und brauchen daher EINE Spalte - sonst haengt
  // ihr Platz davon ab, welcher Teil gerade der erste sichtbare ist.
  const pfDeckColumns = {};
  PROFIL_DECK_IDS.forEach((ids) => {
    const col = deckColumn(cards.columns, ids, "profil");
    ids.forEach((id) => { pfDeckColumns[id] = col; });
  });
  const pfColumns = splitCardColumns(shownOrder, { ...cards.columns, ...pfDeckColumns }, "profil");
  const cardHide = (id) => (isMe && onSetCardLayout ? () => cards.hideCard(id) : undefined);
  // Offener Reiter je Deck-Karte (siehe DECKS weiter unten), geschluesselt
  // nach deren Anker-id. Eine reine Anzeige-Gewohnheit dieses Geraets, also
  // localStorage statt Profil - genau wie collapsedCards.
  const [deckTab, setDeckTab] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pfDeckTab") || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem("pfDeckTab", JSON.stringify(deckTab)); } catch { /* Privatmodus */ }
  }, [deckTab]);

  const catalogByCategory = useMemo(() => {
    const groups = {};
    // Heyball-Erfolge nur zeigen, solange die Disziplin eingeschaltet ist (Admin-Schalter).
    [...catalog].filter((b) => FEATURES.heyball || b.category !== "Heyball").sort((a, b) => a.sort - b.sort).forEach((b) => {
      (groups[b.category] ||= []).push(b);
    });
    return Object.entries(groups);
  }, [catalog, FEATURES.heyball]);
  // Kategorien mit mind. 1 erreichten Erfolg sind anfangs aufgeklappt, der Rest zugeklappt.
  const [openCats, setOpenCats] = useState(() => {
    try { const s = localStorage.getItem("badgeCats"); if (s) return new Set(JSON.parse(s)); } catch { /* ignore */ }
    return new Set();  // Standard: alles eingeklappt
  });
  useEffect(() => {
    try { localStorage.setItem("badgeCats", JSON.stringify([...openCats])); } catch { /* ignore */ }
  }, [openCats]);
  const toggleCat = (cat) => setOpenCats((prev) => {
    const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n;
  });
  const expandAll = () => setOpenCats(new Set(catalogByCategory.map(([c]) => c)));
  const collapseAll = () => setOpenCats(new Set());
  // Suche/Status-Filter fuer die Erfolgsliste (144 Eintraege sind ohne
  // Suchmoeglichkeit schwer zu durchsuchen).
  const [badgeQuery, setBadgeQuery] = useState("");
  const [badgeStatus, setBadgeStatus] = useState("all"); // "all" | "earned" | "locked"
  const badgeFiltering = badgeQuery.trim() !== "" || badgeStatus !== "all";
  // Bis 2026-09-30 sprang "Alle Erfolge ansehen" von der Fortschritts-Karte
  // hierher (per .focus() auf diesen Chip statt scrollIntoView, weil das am
  // Handy zuverlaessiger ins Bild scrollt, ohne die Tastatur zu oeffnen).
  // Der Knopf ist weg, seit beide Teile EINE Karte mit Reitern sind - die
  // volle Liste ist jetzt der Nachbar-Reiter. Der Ref bleibt als Anker fuer
  // den "Alle"-Chip erhalten.
  const allFilterRef = useRef(null);
  // Welche Erfolge pro Kategorie beim aktuellen Filter sichtbar sind - fuer
  // die Liste unten UND fuers Auto-Aufklappen (siehe Effekt darunter).
  const visibleByCategory = useMemo(() => {
    const q = badgeQuery.trim().toLowerCase();
    return catalogByCategory.map(([cat, items]) => {
      // eigenes Profil: ALLE Erfolge zeigen (gesperrte gedimmt) -> Symbole + korrekte Gesamtzahl.
      // fremde Profile: nur erreichte zeigen. Suche/Status filtern zusaetzlich.
      const visible = items.filter((b) => {
        const earned = earnedBadges.has(b.badge_key);
        if (!isMe) { if (!earned) return false; }
        else if (badgeStatus === "earned" && !earned) return false;
        else if (badgeStatus === "locked" && earned) return false;
        if (q && !(t(b.name) + " " + t(b.description)).toLowerCase().includes(q)) return false;
        return true;
      });
      return [cat, items, visible];
    });
  }, [catalogByCategory, earnedBadges, isMe, badgeStatus, badgeQuery]);
  // Beim Tippen/Filtern Kategorien mit Treffern automatisch aufklappen,
  // damit Treffer nicht in einer zugeklappten Kategorie verborgen bleiben -
  // aber nur EINMAL je Suchtext/Status-Aenderung (Abhaengigkeiten bewusst
  // nur badgeQuery/badgeStatus, NICHT visibleByCategory), sonst wuerde ein
  // beliebiges Neuladen der Daten (z.B. earnedBadges nach einem Match) eine
  // gerade manuell zugeklappte Kategorie wieder aufzwingen. Vorher war
  // "offen" waehrend des Filterns komplett erzwungen (unabhaengig von
  // openCats) - dadurch griffen "Alles auf-/zuklappen" nur in der
  // ungefilterten "Alle"-Ansicht (Nutzer-Feedback).
  useEffect(() => {
    if (!badgeFiltering) return;
    setOpenCats((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const [cat, , visible] of visibleByCategory) {
        if (visible.length > 0 && !next.has(cat)) { next.add(cat); changed = true; }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badgeQuery, badgeStatus]);
  const [challengeForm, setChallengeForm] = useState(false);
  const [challengeMsg, setChallengeMsg] = useState("");
  const installPrompt = useInstallPrompt();
  const [edit, setEdit] = useState(false);
  const [nick, setNick] = useState(nickname);
  const [color, setColor] = useState(meRow?.avatar_color || null);
  const [motto, setMotto] = useState(meRow?.motto || "");
  const [busy, setBusy] = useState(false);
  // Update-Zeile: idle | checking | found | current | error | unavailable
  const [updState, setUpdState] = useState("idle");
  const [updCheckedAt, setUpdCheckedAt] = useState("");
  const updTimer = useRef(null);
  useEffect(() => () => clearTimeout(updTimer.current), []);
  const runUpdateCheck = async () => {
    clearTimeout(updTimer.current);
    setUpdState("checking");
    // Mindestens 1,2 s, sonst blitzt der Laufbalken nur kurz auf, wenn die
    // Pruefung sofort fertig ist - und man weiss nicht, ob ueberhaupt geprueft wurde.
    const [res] = await Promise.all([onCheckUpdate(), new Promise((r) => setTimeout(r, 1200))]);
    setUpdState(res || "error");
    if (res !== "found") {
      setUpdCheckedAt(new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }));
      updTimer.current = setTimeout(() => setUpdState("idle"), 7000);
    }
  };
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCat, setFeedbackCat] = useState("bug");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0); // 0 versteckt, 1 erste Warnung, 2 Namen eintippen
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [ticketsRefresh, setTicketsRefresh] = useState(0);
  const heroPhoto = photoOf(nickname);

  // Farbthema und Startseite: jede Auswahl wird sofort live angewendet
  // (applyTheme) UND sofort gespeichert - kein separater Speichern-Schritt.
  const [themeKey, setThemeKey] = useState(meRow?.theme_key || "green");
  const [customBg, setCustomBg] = useState(meRow?.theme_custom?.bg || "#0A2B21");
  const [customAccent, setCustomAccent] = useState(meRow?.theme_custom?.accent || "#7CC1E8");
  const pickPresetTheme = async (key) => {
    setThemeKey(key);
    applyTheme(key);
    setBusy(true);
    await onSetTheme(key, null);
    setBusy(false);
  };
  const pickCustomTheme = async (bg, accent) => {
    setCustomBg(bg); setCustomAccent(accent); setThemeKey("custom");
    applyTheme("custom", { bg, accent });
    setBusy(true);
    await onSetTheme("custom", { bg, accent });
    setBusy(false);
  };

  const [startTab, setStartTabLocal] = useState(meRow?.start_tab || "stats");
  const pickStartTab = async (value) => {
    setStartTabLocal(value);
    setBusy(true);
    await onSetStartTab(value);
    setBusy(false);
  };

  const sendFeedback = async () => {
    if (!feedbackMsg.trim()) return;
    setFeedbackBusy(true);
    const ok = await onSubmitFeedback(feedbackCat, feedbackMsg.trim());
    setFeedbackBusy(false);
    if (ok) { setFeedbackMsg(""); setFeedbackSent(true); setTicketsRefresh((n) => n + 1); }
  };
  const closeFeedback = () => { setFeedbackOpen(false); setFeedbackSent(false); setFeedbackMsg(""); setFeedbackCat("bug"); };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    await onDeleteAccount();
    setDeleteBusy(false);
  };

  const stats = useMemo(() => computeStats(matches)[nickname], [matches, nickname]);

  // Zusatzkennzahlen (Serien, Zu-Null-Siege, Rekorde, geworbene Spieler, ...),
  // geteilt mit MatchScreen fuer den Fortschritts-Hinweis dort.
  const liveExtras = useMemo(
    () => computeAchievementExtras(nickname, matches, players, challenges),
    [matches, players, nickname, challenges]
  );
  const playerObj = players.find((p) => p.nickname === nickname);
  // liveExtras + alles, was NICHT aus matches/players/challenges ableitbar ist
  // (Mitgliedschaftsdauer aus players.created_at, Ghost-Spiele/Turnierplatzierungen
  // aus my_achievement_counters() - siehe App.jsx loadData) - fuer Fortschritts-
  // anzeige und Naechste-Erfolge-Vorschlaege auch in diesen drei Kategorien, die
  // sonst als einzige gar keinen "das hast du schon" zeigen (Nutzer-Feedback).
  const extendedExtras = useMemo(() => ({
    ...liveExtras,
    joinedAt: playerObj?.created_at ?? null,
    ghostGames: achievementCounters?.ghost_games ?? null,
    tournamentWins: achievementCounters?.tournament_wins ?? null,
    tournament2nd: achievementCounters?.tournament_2nd ?? null,
    tournament3rd: achievementCounters?.tournament_3rd ?? null,
    rulesViewed: achievementCounters?.rules_viewed ?? null,
    rulesTotal: RULES_TOTAL,
  }), [liveExtras, playerObj?.created_at, achievementCounters]);

  // Live-Stand je Erfolgs-Familie: an den (unübersetzten) Beschreibungstexten der
  // Katalog-Einträge erkannt, nicht an der Kategorie - Kategorien kommen aus der DB
  // und ihre Zuordnung ist der App nicht fix bekannt.
  const catLiveStat = (items, extras) => {
    const has = (re) => items.some((b) => re.test(b.description));
    const parts = [];
    if (has(/Siege in Folge$/)) {
      const curTxt = extras.streak > 0 ? `+${extras.streak}` : `${extras.streak}`;
      parts.push(`${t("Serie aktuell: {n}", { n: curTxt })} · ${t("Beste Serie: {n}", { n: extras.longestStreak })}`);
    }
    if (has(/^\d+ Siege insgesamt$/)) parts.push(t("{n} Siege insgesamt", { n: extras.siege }));
    if (has(/zu null gewonnen/)) parts.push(t("{n} Zu-Null-Siege", { n: extras.shutoutWins }));
    if (has(/Matches gegen denselben Gegner/)) parts.push(t("Rekord gegen 1 Gegner: {n} Matches", { n: extras.maxVsOpponent }));
    if (has(/Matches an einem Tag/)) parts.push(t("Rekord an 1 Tag: {n} Matches", { n: extras.maxPerDay }));
    if (has(/14\/1: Höchstserie/)) parts.push(t("Höchstserie: {n}", { n: extras.highRun }));
    if (has(/Spieler geworben/)) parts.push(t("{n} Spieler geworben", { n: extras.recruitedCount }));
    if (has(/Herausforderung(en)? angenommen/)) parts.push(t("{n} Herausforderungen angenommen", { n: extras.challengesAccepted }));
    if (has(/Siege in Folge gegen denselben Gegner$/)) parts.push(t("Laufende Serie gegen 1 Gegner: {n}", { n: extras.maxOpponentStreak }));
    // Ghost/Turniere/Mitgliedschaft: Rohdaten kommen aus my_achievement_counters()
    // bzw. players.created_at (extendedExtras, siehe oben), nicht aus
    // matches/players/challenges wie der Rest hier - deshalb eigene Zeilen statt
    // has()-Erkennung allein. Nur wenn die Zaehler auch tatsaechlich geladen sind
    // (RPC eingespielt) - sonst greift der Fallback weiter unten.
    if (extras.ghostGames != null && has(/Spiele? gegen den Ghost$/)) {
      parts.push(t("{n} Spiele gegen den Ghost", { n: extras.ghostGames }));
    }
    if (extras.rulesViewed != null && has(/Regeln? angesehen$/)) parts.push(t("{n} Regeln angesehen", { n: extras.rulesViewed }));
    if (extras.tournamentWins != null && (has(/Turniere? gewonnen$/) || has(/Turnier-Zweiter$/) || has(/Turnier-Dritter$/))) {
      const bits = [];
      if (has(/Turniere? gewonnen$/)) bits.push(t("{n}× Platz 1", { n: extras.tournamentWins }));
      if (has(/Turnier-Zweiter$/)) bits.push(t("{n}× Platz 2", { n: extras.tournament2nd }));
      if (has(/Turnier-Dritter$/)) bits.push(t("{n}× Platz 3", { n: extras.tournament3rd }));
      parts.push(bits.join(" · "));
    }
    if (extras.joinedAt && has(/dabei$/)) {
      const days = Math.floor((Date.now() - new Date(extras.joinedAt)) / 86400000);
      parts.push(t("Dabei seit {n} Tagen", { n: days }));
    }
    // Fallback fuer Kategorien ohne lokal berechenbare Live-Kennzahl UND ohne
    // geladene Zaehler oben (z.B. Migration noch nicht eingespielt): zeigt
    // zumindest, was in der Kategorie schon erreicht wurde, statt gar nichts -
    // sonst bleibt z.B. "1 Turnier gewonnen" fuer den Spieler unsichtbar,
    // obwohl das fuer die Motivation zum naechsten Erfolg wichtig ist.
    if (parts.length === 0) {
      if (has(/dabei$/)) {
        // Mitgliedschaft ist eine einzelne Leiter: jede erreichte Stufe
        // schliesst die vorherigen automatisch mit ein, nur die hoechste zeigen.
        const earned = items.filter((b) => earnedBadges.has(b.badge_key));
        if (earned.length) {
          const top = earned[earned.length - 1];
          parts.push(t("Aktuell: {name} ({desc})", { name: t(top.name), desc: t(top.description) }));
        }
      } else {
        // Sonst je Schwellenwert-Familie (Praefix vor der Endziffer, z.B.
        // "ghost10" -> "ghost", "tournament_win3" -> "tournament_win") nur die
        // jeweils hoechste erreichte Stufe zeigen - mehrere unabhaengige
        // Familien pro Kategorie moeglich (z.B. Turniersieg/2./3. Platz).
        const fams = {};
        items.forEach((b) => { (fams[b.badge_key.replace(/\d+$/, "")] ||= []).push(b); });
        Object.values(fams).forEach((fam) => {
          const earned = fam.filter((b) => earnedBadges.has(b.badge_key));
          if (earned.length) parts.push(t(earned[earned.length - 1].description));
        });
      }
    }
    return parts.length ? parts.join(" · ") : null;
  };

  const myRows = rangliste.filter((r) => r.nickname === nickname);
  const gesamt = myRows.find((r) => r.discipline === "Gesamt");
  const speedStats = useMemo(() => computeSpeedStats(matches, playerObj?.id), [matches, playerObj?.id]);

  const cleanNick = nick.trim();
  const taken = players.some(
    (p) => p.nickname.toLowerCase() === cleanNick.toLowerCase() && p.nickname !== nickname
  );
  const nickValid = cleanNick.length >= 2 && cleanNick.length <= 30 && !taken;

  // Nickname/Kugelfarbe/Motto haengen an derselben RPC (update_profile nimmt
  // alle drei zusammen) - persist() schreibt daher bei jeder einzelnen
  // Aenderung (Farbklick, Verlassen des Nickname-/Motto-Felds) den aktuellen
  // Stand aller drei Felder. Ist der Nickname-Entwurf gerade ungueltig (zu
  // kurz, vergeben), wird stattdessen der zuletzt gespeicherte Name
  // mitgeschickt, damit z.B. ein Farbklick waehrend des Tippens nicht an
  // einem noch unfertigen Nickname scheitert.
  const persist = async (overrides = {}) => {
    const n = nickValid ? cleanNick : nickname;
    const c = overrides.color !== undefined ? overrides.color : color;
    const m = overrides.motto !== undefined ? overrides.motto : motto;
    setBusy(true);
    await onSaveProfile(n, c, m);
    setBusy(false);
  };
  const pickColor = (c) => { setColor(c); persist({ color: c }); };
  // "Auto" ist zugleich der Weg zurueck zur eigenen Kugel: ein als Avatar
  // gewaehlter Erfolg wird mit zurueckgesetzt (ersetzt den frueheren Knopf
  // "Wieder meine Kugel zeigen", Nutzer-Feedback 2026-09-30).
  const pickAuto = () => { pickColor(null); if (meRow?.selected_badge) onSelectBadge(null); };

  const resetDefaults = async () => {
    setBusy(true);
    await Promise.all([
      onSaveProfile(nickValid ? cleanNick : nickname, null, motto),
      onSetTheme("green", null),
      onSetStartTab("stats"),
      onResetCardLayout(),
    ]);
    // reset_card_layout() hat serverseitig den ganzen card_layout-Eintrag
    // geloescht, also Reihenfolge, Spalte UND ausgeblendete Karten - der
    // lokale Stand der drei Haken muss daher mitziehen, sonst zeigt die
    // Liste darueber bis zum naechsten Neuaufbau noch den alten Stand.
    Object.values(layoutByScreen).forEach((api) => api.clearLocal());
    setColor(null);
    setThemeKey("green");
    applyTheme("green");
    setStartTabLocal("stats");
    setBusy(false);
    toast(t("Standardeinstellungen wiederhergestellt."));
  };

  if (edit) {
    return (
      <div className="screen">
        <header className="screen-head with-back">
          <button className="back-btn" onClick={() => setEdit(false)} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
          <h2>{t("Profil bearbeiten")}</h2>
        </header>

        {/* Update-Knopf: ueber dem Layout und OHNE Karte, damit er weder
            ausgeblendet noch verschoben werden kann (kein Eintrag in
            CARD_SCREENS, kein Schalter). Nutzerwunsch 2026-10-03: "gut
            sichtbar, darf niemals ausgeblendet werden koennen, der einzige
            Button, der eine ganze Zeile einnehmen darf". */}
        <button type="button" className={"update-row " + updState} data-tour="update-btn"
          disabled={updState === "checking" || updState === "found"} onClick={runUpdateCheck}>
          <span className="update-row-ico" aria-hidden="true">
            {updState === "found" || updState === "current" ? <Check size={22} />
              : updState === "error" || updState === "unavailable" ? <X size={22} />
              : <RefreshCw size={20} className={updState === "checking" ? "spin" : ""} />}
          </span>
          <span className="update-row-text" aria-live="polite">
            <strong>
              {updState === "checking" ? t("Suche nach Updates …")
                : updState === "found" ? t("Update gefunden – wird installiert …")
                : updState === "current" ? t("Du hast die neueste Version.")
                : updState === "error" ? t("Prüfung fehlgeschlagen – bist du online?")
                : updState === "unavailable" ? t("Updates können hier nicht geprüft werden.")
                : t("Nach Updates suchen")}
            </strong>
            <small>
              {t("Version")} {APP_VERSION}
              {updCheckedAt && updState !== "checking" && updState !== "found" ? ` · ${t("geprüft um {time}", { time: updCheckedAt })}` : ""}
            </small>
          </span>
          {(updState === "checking" || updState === "found") && (
            <span className={"update-bar" + (updState === "found" ? " full" : "")} aria-hidden="true"><span /></span>
          )}
        </button>

        <div className="pf-edit-layout">
        {/* Linke Spalte: Profilangaben + Karten-Sichtbarkeit. Beide stecken
            in EINEM Grid-Feld, das sie per Flexbox stapelt - sonst faengt
            die Karten-Sektion erst unterhalb der hoechsten Spalte der
            ersten Grid-Zeile an (siehe "CSS Grid cross-column height
            coupling" in CLAUDE.md). */}
        <div className="pf-edit-main">
        <section className="stat-block">
          <label className="field-label" htmlFor="pnick">{t("Nickname")}</label>
          <div className="mail-row">
            <User size={18} className="mail-ico" />
            <input id="pnick" value={nick} maxLength={30} onChange={(e) => setNick(e.target.value)}
              onBlur={() => { if (nickValid && cleanNick !== nickname) persist(); }} />
          </div>
          {taken && <p className="nick-status err"><X size={14} /> {t("Dieser Name ist schon vergeben.")}</p>}
          {!taken && cleanNick !== nickname && nickValid && (
            <p className="nick-status ok"><Check size={14} /> "{cleanNick}" {t("ist verfügbar.")}</p>
          )}
          {cleanNick !== nickname && nickValid && (
            <p className="hint">{t("Hinweis: Dein Name aendert sich ueberall - auch in alten Matches und der Rangliste.")}</p>
          )}

          <label className="field-label" htmlFor="pmotto">{t("Motto (optional)")}</label>
          <div className="mail-row">
            <Pencil size={18} className="mail-ico" />
            <input id="pmotto" value={motto} maxLength={80}
              placeholder={t("z. B. 'Die 9 faellt immer'")} onChange={(e) => setMotto(e.target.value)}
              onBlur={() => { if (motto !== (meRow?.motto || "")) persist(); }} />
          </div>
        </section>

        {/* Beide Farbwahlen in EINER Karte, direkt untereinander (Nutzer-Feedback
            2026-09-30: "sorge dafuer, dass die Farben nahe beisammen sind - die
            Auswahl fuer 'Meine Kugel' und 'Skin'"). Vorher stand die Kugelfarbe
            links bei den Profilangaben und das Design ganz rechts in der
            Seitenspalte, dazwischen Sprache, Karten usw. */}
        <section className="stat-block">
          <div className="stat-block-head">
            <h3><Palette size={17} /> {t("Aussehen")}</h3>
            <InfoButton title={t("Deine Kugel")}>
              {t("So sehen dich die anderen. Ohne Foto zeigt die Kugel deine Initialen in der gewählten Farbe; \"Auto\" wählt die Farbe selbst und zeigt wieder deine eigene Kugel statt eines Erfolgs.")}
            </InfoButton>
          </div>
          {/* EINE Kugel, gross und mittig, mit den Foto-Werkzeugen darunter -
              vorher gab es zwei kleine (eine beim Foto, eine bei der Farbe),
              die dasselbe zeigten (Nutzer-Feedback 2026-09-30). Die Kugel
              zeigt das fertige Ergebnis inklusive gewaehltem Erfolg-Avatar. */}
          <div className="avatar-stage">
            <Ball color={color || hashColor(cleanNick || nickname)} label={initials(cleanNick || nickname)}
              photo={photoOf(nickname)} badge={meRow?.selected_badge || null} size={112} />
            <AvatarPhotoField hasPhoto={!!photoOf(nickname)} onReload={onReload} toast={toast} />
          </div>
          <div className="swatch-row">
            <button className={"swatch auto" + (color === null && !meRow?.selected_badge ? " sel" : "")}
              onClick={pickAuto} title={t("Automatische Farbe")} aria-label={t("Automatische Farbe")}>{t("Auto")}</button>
            {BALL_PALETTE.map((c) => (
              <button key={c} className={"swatch" + (color === c ? " sel" : "")}
                style={{ background: c }} onClick={() => pickColor(c)} aria-label={t("Farbe {c}", { c })}>
                {color === c && <Check size={16} />}
              </button>
            ))}
            {/* Eigene Wunschfarbe per Farb-Picker */}
            <label className={"swatch picker" + (color && !BALL_PALETTE.includes(color) ? " sel" : "")}
              style={color && !BALL_PALETTE.includes(color) ? { background: color } : undefined}
              title={t("Eigene Farbe wählen")}>
              {color && !BALL_PALETTE.includes(color)
                ? <Check size={16} />
                : <Pencil size={15} />}
              <input type="color" className="color-input"
                value={color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : hashColor(cleanNick || nickname)}
                onChange={(e) => pickColor(e.target.value)}
                aria-label={t("Eigene Kugelfarbe wählen")} />
            </label>
          </div>
          <label className="field-label">{t("Design")}</label>
          <div className="theme-grid">
            {THEME_KEYS.map((key) => {
              const th = THEME_CATALOG[key];
              return (
                <button key={key} className={"theme-swatch" + (themeKey === key ? " sel" : "")}
                  style={{ background: th.felt, borderColor: themeKey === key ? th.accent : "transparent" }}
                  onClick={() => pickPresetTheme(key)} disabled={busy}>
                  <span className="theme-dot" style={{ background: th.accent }} />
                  {t(th.name)}
                  {themeKey === key && <Check size={14} />}
                </button>
              );
            })}
            <button className={"theme-swatch" + (themeKey === "custom" ? " sel" : "")}
              style={{ background: customBg, borderColor: themeKey === "custom" ? customAccent : "transparent" }}
              onClick={() => pickCustomTheme(customBg, customAccent)} disabled={busy}>
              <span className="theme-dot" style={{ background: customAccent }} />
              {t("Eigenes")}
              {themeKey === "custom" && <Check size={14} />}
            </button>
          </div>
          {themeKey === "custom" && (
            <div className="theme-custom-row">
              <label className="theme-color-field">
                {t("Hintergrund")}
                <input type="color" value={customBg} onChange={(e) => pickCustomTheme(e.target.value, customAccent)} />
              </label>
              <label className="theme-color-field">
                {t("Akzent")}
                <input type="color" value={customAccent} onChange={(e) => pickCustomTheme(customBg, e.target.value)} />
              </label>
            </div>
          )}
        </section>

        </div>

        <div className="pf-edit-side">
          {/* Drei Karten statt acht (Nutzer-Feedback 2026-09-30: "pruefe ob
              sich die anderen Karten zusammenfassen lassen"): was das KONTO
              betrifft (Sprache, Startseite), was nur DIESES GERAET betrifft
              (Bildschirm, Menueleiste, Benachrichtigungen, Updates) und
              Konto & Hilfe (Anmeldung, Feedback, Tickets, Abmelden). Alle
              Erklaertexte stehen hinter Info-Knoepfen, breite Textknoepfe sind
              runde Symbolknoepfe mit Namen in title/aria-label. */}
          <section className="stat-block">
            <h3><SlidersHorizontal size={17} /> {t("Allgemein")}</h3>
            <div className="lang-row compact">
              <button className={"lang-btn" + (lang === "de" ? " active" : "")} onClick={() => onLang("de")} aria-label="Deutsch" title="Deutsch">
                <span className="flag">🇩🇪</span>
              </button>
              <button className={"lang-btn" + (lang === "en" ? " active" : "")} onClick={() => onLang("en")} aria-label="English" title="English">
                <span className="flag">🇬🇧</span>
              </button>
            </div>
            <div className="field-label">
              <span>{t("Startseite")}</span>
              <InfoButton title={t("Startseite")}>{t("Was soll beim Starten der App zuerst angezeigt werden?")}</InfoButton>
            </div>
            {/* Dieselben Symbole wie in der Menueleiste unten - so muss man
                die Woerter nicht lesen. */}
            <div className="chips start-icons">
              {[
                ["stats", t("Statistik"), <BarChart3 size={18} />],
                ["turnier", t("Turniere"), <Trophy size={18} />],
                ["live", t("Live"), <Radio size={18} />],
                ["profil", t("Profil"), <User size={18} />],
                ["last", t("Zuletzt geöffnet"), <History size={18} />],
              ].map(([v, label, icon]) => (
                <button key={v} className={"chip chip-icon seg" + (startTab === v ? " active" : "")}
                  disabled={busy} onClick={() => pickStartTab(v)} aria-label={label} title={label}>
                  {icon}
                </button>
              ))}
            </div>
          </section>

          <section className="stat-block">
            <h3><Smartphone size={17} /> {t("Dieses Gerät")}</h3>
            {/* Standard ist an - waehrend eines Matches liegt das Handy meist
                unberuehrt am Tisch und soll sich nicht dauernd sperren. Wer das
                nicht will (Akku), schaltet es hier ab; die Einstellung gilt
                pro Geraet. */}
            <div className="switch-row">
              <label className="settings-switch">
                <input type="checkbox" checked={keepAwake} onChange={(e) => onSetKeepAwake(e.target.checked)} />
                <span className="settings-switch-track" aria-hidden="true"><span className="settings-switch-knob" /></span>
                <span className="settings-switch-label">{t("Bildschirm während eines Matches anlassen")}</span>
              </label>
              <InfoButton title={t("Bildschirm während eines Matches anlassen")}>
                {t("Verhindert, dass sich das Handy mitten im Spiel sperrt. Gilt nur auf diesem Gerät und nur, solange ein Match oder eine Winner-Stays-Runde offen ist.")}
              </InfoButton>
            </div>
            {/* Standard ist AUS (siehe lib/uiPrefs.js): eine Navigation, die
                von selbst verschwindet, soll niemand ungefragt bekommen. Wer
                den Platz will, schaltet es hier ein - am Handy sind es rund
                76px, die sonst dauerhaft ueber dem Inhalt liegen. */}
            <div className="switch-row">
              <label className="settings-switch">
                <input type="checkbox" checked={hideTabbar} onChange={(e) => onSetHideTabbar(e.target.checked)} />
                <span className="settings-switch-track" aria-hidden="true"><span className="settings-switch-knob" /></span>
                <span className="settings-switch-label">{t("Menüleiste beim Scrollen ausblenden")}</span>
              </label>
              <InfoButton title={t("Menüleiste beim Scrollen ausblenden")}>
                {t("Beim Runterscrollen verschwindet die Leiste am unteren Rand, beim Hochscrollen kommt sie zurück. Mehr Platz für Ranglisten und Grafiken. Gilt nur auf diesem Gerät.")}
              </InfoButton>
            </div>
            <MatchFlySwitch />
            <PendingPopupSwitch on={pendingPopup} onChange={onSetPendingPopup} />
            <FiltersOpenSwitch />
            {/* Updates: Schalter + Symbolknopf "jetzt suchen" in EINER Zeile
                statt Schalter, Absatz und Textknopf ueber die volle Breite. */}
            <div className="switch-row">
              <label className="settings-switch">
                <input type="checkbox" checked={updateInterval !== "manual"}
                  onChange={(e) => onSetUpdateInterval(e.target.checked ? "auto" : "manual")} />
                <span className="settings-switch-track" aria-hidden="true"><span className="settings-switch-knob" /></span>
                <span className="settings-switch-label">{t("Automatisch aktualisieren")}</span>
              </label>
              <InfoButton title={t("App-Updates")}>
                {updateInterval !== "manual"
                  ? t("Sucht bei jedem Öffnen der App nach einer neuen Version und spielt sie unauffällig ein – nie mitten in einem Match.")
                  : t("Neue Versionen gibt es nur über den Knopf „Nach Updates suchen“ ganz oben.")}
              </InfoButton>
            </div>
            {/* Eine Stufe fuer alle Ereignisse (Herausforderung, Match
                bestaetigen, du bist dran, Live/Planung/Zusagen). Gilt pro
                Geraet, weil auch die Push-Erlaubnis am Geraet haengt. Drei
                Stufen (aus / in der App / Push) als ZWEI Regler wie alle
                anderen Einstellungen hier (Nutzer-Feedback 2026-09-30: "Regler
                zeigen intuitiv, dass es sich um Einstellungsoptionen
                handelt"): der erste schaltet Hinweise ueberhaupt ein, der zweite
                dazu Push. Jede der drei Stufen hat ihre Erklaerung hinter einem
                Info-Knopf. Die Umstellung auf "Push" MUSS aus diesem Klick
                heraus passieren - iOS fragt die Erlaubnis sonst nicht ab. */}
            {(() => {
              const setMode = async (v) => {
                if (v === notifyMode) return;
                setBusy(true);
                try { await onSetNotifyMode(v); } finally { setBusy(false); }
              };
              return (
                <>
                  <div className="switch-row">
                    <label className="settings-switch">
                      <input type="checkbox" checked={notifyMode !== "off"} disabled={busy}
                        onChange={(e) => setMode(e.target.checked ? "inapp" : "off")} />
                      <span className="settings-switch-track" aria-hidden="true"><span className="settings-switch-knob" /></span>
                      <span className="settings-switch-label">{t("Benachrichtigungen")}</span>
                    </label>
                    <InfoButton title={t("Benachrichtigungen")}>
                      {t("In der App")}: {t("Hinweise erscheinen nur, solange die App geöffnet ist.")}
                      {" "}{t("Aus")}: {t("Keine Hinweise, auch kein „Du bist dran!“ bei Turnieren und Winner Stays.")}
                    </InfoButton>
                  </div>
                  <div className="switch-row">
                    <label className="settings-switch">
                      <input type="checkbox" checked={notifyMode === "push"} disabled={busy}
                        onChange={(e) => setMode(e.target.checked ? "push" : "inapp")} />
                      <span className="settings-switch-track" aria-hidden="true"><span className="settings-switch-knob" /></span>
                      <span className="settings-switch-label">{t("Push")}</span>
                    </label>
                    <InfoButton title={t("Push")}>
                      {t("Push-Nachrichten kommen auch, wenn die App geschlossen ist. Ist sie offen, erscheint stattdessen ein Hinweis in der App.")}
                      {notifyMode !== "push" && pushAvailability() === "ios-install"
                        ? " 📲 " + t("Auf dem iPhone gehen Push-Nachrichten nur, wenn die App auf dem Home-Bildschirm installiert ist.")
                        : ""}
                    </InfoButton>
                  </div>
                </>
              );
            })()}
          </section>

          {/* Konto und Support. Bis 2026-09-25 waren "Anmeldung & Sicherheit",
              "Feedback" und "Meine Tickets" frei anordenbare Karten auf dem
              Profil selbst, danach drei eigene Karten hier, seit 2026-09-30
              Zeilen EINER Karte - mit "Verwaltung"/"Abmelden" als runden
              Symbolknoepfen darunter (aus den Einstellungen herausfuehrende
              Aktionen stehen am Ende). */}
          <section className="stat-block">
            <h3><UserCog size={17} /> {t("Konto & Hilfe")}</h3>
            <PasswordSection toast={toast} />
            {onStartTutorial && (
              <div className="acct-sub">
                <div className="acct-row">
                  <GraduationCap size={16} className="acct-ico" />
                  <span className="acct-text">{t("Tutorial")}</span>
                  <button type="button" className="icon-btn" onClick={onStartTutorial}
                    aria-label={t("Tutorial ansehen")} title={t("Tutorial ansehen")}>
                    <Play size={18} />
                  </button>
                  <InfoButton title={t("Tutorial")}>{t("Die kurze Tour durch die App – jederzeit wieder abrufbar. Nach einem Update zeigt sie dir automatisch nur die neuen Funktionen.")}</InfoButton>
                </div>
              </div>
            )}
            <div className="acct-sub">
              <div className="acct-row">
                <MessageCircle size={16} className="acct-ico" />
                <span className="acct-text">{t("Feedback")}</span>
                {!feedbackOpen && (
                  <button type="button" className="icon-btn" onClick={() => setFeedbackOpen(true)}
                    aria-label={t("Feedback geben")} title={t("Feedback geben")}>
                    <MessageSquarePlus size={18} />
                  </button>
                )}
                <InfoButton title={t("Feedback")}>{t("Bug gefunden oder eine Idee? Schreib's uns direkt.")}</InfoButton>
              </div>
              {feedbackOpen && (feedbackSent ? (
                <>
                  <p className="hint" style={{ marginTop: 6 }}>{t("Danke fürs Feedback! Magst du zusätzlich direkt schreiben?")}</p>
                  <div className="acct-actions">
                    <a className="icon-btn" href="https://t.me/+3MKzIVnJBblmZWVk" target="_blank" rel="noopener noreferrer"
                      aria-label={t("Per Telegram")} title={t("Per Telegram")}><Send size={18} /></a>
                    <a className="icon-btn" href="mailto:dalaunge@gmx.at" aria-label={t("Per E-Mail")} title={t("Per E-Mail")}><Mail size={18} /></a>
                    <button type="button" className="icon-btn primary" onClick={closeFeedback}
                      aria-label={t("Fertig")} title={t("Fertig")}><Check size={18} /></button>
                  </div>
                </>
              ) : (
                <div className="challenge-form">
                  <div className="chips small" style={{ paddingBottom: 0, marginBottom: 8 }}>
                    {[["bug", t("Bug")], ["idea", t("Idee")], ["other", t("Sonstiges")]].map(([v, label]) => (
                      <button key={v} className={"chip" + (feedbackCat === v ? " active" : "")} onClick={() => setFeedbackCat(v)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="search-row" style={{ marginBottom: 8 }}>
                    <textarea rows={3} placeholder={t("Was ist los?")} value={feedbackMsg} maxLength={1000}
                      style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--ivory)", fontSize: 14, padding: "11px 0", fontFamily: "inherit", resize: "vertical" }}
                      onChange={(e) => setFeedbackMsg(e.target.value)} />
                  </div>
                  <div className="acct-actions">
                    <button type="button" className="icon-btn" onClick={closeFeedback}
                      aria-label={t("Abbrechen")} title={t("Abbrechen")}><X size={18} /></button>
                    <button type="button" className="icon-btn primary" disabled={!feedbackMsg.trim() || feedbackBusy} onClick={sendFeedback}
                      aria-label={feedbackBusy ? t("Speichere ...") : t("Absenden")} title={feedbackBusy ? t("Speichere ...") : t("Absenden")}>
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <MyFeedbackTickets playerId={meRow.id} toast={toast} refreshKey={ticketsRefresh} />
            <div className="acct-sub acct-actions">
              {meRow?.role === "admin" && (
                <button type="button" className="icon-btn" onClick={onOpenAdmin}
                  aria-label={t("Verwaltung oeffnen")} title={t("Verwaltung oeffnen")}><Shield size={18} /></button>
              )}
              <button type="button" className="icon-btn" onClick={onLogout}
                aria-label={t("Abmelden")} title={t("Abmelden")}><LogOut size={18} /></button>
            </div>
          </section>
        </div>
        </div>

      {/* Karten-Anordnung + -Sichtbarkeit fuer ALLE Bildschirme an einer
          Stelle (Vorgabe: "Lasse dem User in den Usersettings die Anzeige
          der Karten definieren", spaeter: "in jedem Menuepunkt die
          Anordnung der Karten durch den User veraenderbar ... vielleicht
          laesst sich das mit dem Ein- und Ausblenden in der
          User-Konfiguration kombinieren"). Je Zeile eine Karte, und zwar
          genau in der Reihenfolge, in der sie auf ihrem Bildschirm steht:
          links die Pfeile zum Verschieben, dann Name + Schalter, rechts
          (nur am PC) die Spaltenwahl.

          Diese Liste ist die EINZIGE Stelle, an der sich die Reihenfolge
          auf Live und Profil aendern laesst - auf der Statistik geht es
          zusaetzlich per Drag & Drop direkt an der Karte, wie bisher.
          Hier sieht man ausserdem, was auf einem Bildschirm ausgeblendet
          ist, den man gerade gar nicht offen hat.

          Steht in der BREITEN linken Spalte, nicht in der 340px schmalen
          rechten (Nutzer-Feedback: "die Auswahlbuttons fuer die Karten
          schiebe nach links, mache es uebersichtlicher, damit man sofort
          weiss, welche Karte man gerade bearbeitet"). Und eine Zeile pro
          Karte statt einer Chip-Wolke: bei 22 gleich aussehenden Pillen
          ueber drei Bildschirme war beim Antippen nicht auf einen Blick
          klar, welche Karte man gerade erwischt. Am PC laufen die Zeilen
          zweispaltig, damit die drei Listen zusammen nicht die halbe
          Einstellungsseite fuellen - dort aber spaltenweise von oben nach
          unten (grid-auto-flow: column, siehe --card-vis-rows), sonst
          wuerde ein Klick auf "nach oben" die Karte optisch nach rechts
          springen lassen. */}
      <section className="stat-block">
        <div className="stat-block-head">
          <h3><LayoutGrid size={17} /> {t("Karten")}</h3>
          <InfoButton title={t("Karten")}>
            {t("Reihenfolge, Spalte und Sichtbarkeit der Karten - fuer jeden Bildschirm. Ausgeblendete Karten holst du auch direkt auf dem jeweiligen Bildschirm ganz unten wieder zurueck.")}
          </InfoButton>
        </div>
        {CARD_SCREENS.map(({ screen, label, cards }) => {
          const api = layoutByScreen[screen];
          const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
          // Was auf dem Bildschirm als EINE Karte erscheint: Einzelkarten und
          // Reiter-Karten (siehe screenUnits) - nicht mehr jeder Katalog-
          // Eintrag einzeln.
          const units = screenUnits(screen, api.order);
          const unitOn = (u) => u.ids.some((id) => !api.isHidden(id));
          const sichtbar = units.filter(unitOn).length;
          return (
            <div key={screen} className="card-vis-group">
              <div className="card-vis-group-head">
                <span className="card-vis-group-title">{t(label)}</span>
                <span className="card-vis-group-count">
                  {t("{n} von {m} sichtbar", { n: sichtbar, m: units.length })}
                </span>
                <button className="chip chip-icon" onClick={api.showAll} disabled={!api.hiddenCount}
                  aria-label={t("Alle einblenden")} title={t("Alle einblenden")}>
                  <Eye size={15} />
                </button>
              </div>
              <div className="card-vis-list">
                {units.map((u, i) => {
                  const col = u.deck ? deckColumn(api.columns, u.deck.ids, screen) : (api.columns[u.ids[0]] || "middle");
                  const colProps = { value: col, onCycle: () => api.cycleColumn(u.ids) };
                  if (!u.deck) {
                    const c = byId[u.ids[0]];
                    if (!c) return null;
                    return (
                      <div key={u.key} className="card-vis-unit">
                        <CardVisRow shown={!api.isHidden(c.id)} label={t(c.label)}
                          canUp={i > 0} canDown={i < units.length - 1}
                          onUp={() => api.moveUnit(u.ids, -1)} onDown={() => api.moveUnit(u.ids, 1)}
                          onToggle={() => api.toggleCard(c.id)} col={colProps} />
                      </div>
                    );
                  }
                  const on = unitOn(u);
                  const nShown = u.ids.filter((id) => !api.isHidden(id)).length;
                  return (
                    <div key={u.key} className="card-vis-unit is-deck">
                      {/* Reiter-Karte: die Kopfzeile ordnet, spaltet und
                          blendet die GANZE Karte; darunter, eingerueckt, die
                          Reiter mit eigener Reihenfolge und eigenem Schalter.
                          Symbol + Zaehler ersetzen den frueheren Erklaertext
                          ("bilden zusammen EINE Karte ..."). */}
                      <CardVisRow className="card-vis-deckrow" shown={on} label={t(u.deck.label)}
                        icon={<Layers size={14} className="card-vis-deck-icon" aria-label={t("Karte mit Reitern")} />}
                        meta={<span className="card-vis-parts-count" title={t("Karte mit Reitern")}>{nShown}/{u.ids.length}</span>}
                        canUp={i > 0} canDown={i < units.length - 1}
                        onUp={() => api.moveUnit(u.ids, -1)} onDown={() => api.moveUnit(u.ids, 1)}
                        onToggle={() => api.setDeckHidden(u.ids, on)} col={colProps} />
                      <div className="card-vis-parts">
                        {u.ids.map((id, j) => byId[id] && (
                          <CardVisRow key={id} className="card-vis-partrow" shown={!api.isHidden(id)} label={t(byId[id].label)}
                            canUp={j > 0} canDown={j < u.ids.length - 1}
                            onUp={() => api.moveInDeck(id, u.deck.ids, -1)} onDown={() => api.moveInDeck(id, u.deck.ids, 1)}
                            onToggle={() => api.toggleCard(id)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

        {/* Fussleiste: "Zurücksetzen" als Symbolknopf (die Erklaerung, was
            genau zurueckgesetzt wird, im Info-Knopf) und die Kontoloeschung als
            kleiner, gedaempfter Text-Link.

            Nutzer-Feedback: "Konto löschen" soll in "Profil bearbeiten" und
            dort moeglichst unauffaellig sein - statt der bisherigen roten
            Warnkarte mit Dauertext nur ein kleiner Text-Link ganz unten. Die
            ausfuehrliche Erklaerung, was beim Loeschen mit den Daten
            passiert, steht im ersten Bestaetigungsdialog (siehe deleteStep
            === 1 unten). Label bleibt "Meine Daten löschen", weil genau
            dieser Text auch in der Datenschutzerklaerung (LegalModal.jsx) als
            Fundstelle genannt wird. */}
        <div className="pf-edit-foot">
          <span className="pf-edit-reset">
            <button type="button" className="icon-btn" disabled={busy} onClick={resetDefaults}
              aria-label={t("Zurücksetzen")} title={t("Zurücksetzen")}>
              <RotateCcw size={18} />
            </button>
            <InfoButton title={t("Zurücksetzen")}>
              {t("Setzt Kugelfarbe, Design, Startseite sowie verschobene und ausgeblendete Karten auf die Standardeinstellungen zurück.")}
            </InfoButton>
          </span>
          <button className="pf-edit-danger-link" onClick={() => setDeleteStep(1)}>
            {t("Meine Daten löschen")}
          </button>
        </div>

        {deleteStep === 1 && (
          <div className="modal-overlay" onClick={() => setDeleteStep(0)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <h3>{t("Wirklich alle Daten löschen?")}</h3>
              <p>{t("Das entfernt dein Login und deine persönlichen Daten unwiderruflich. Das kann nicht rückgängig gemacht werden.")}</p>
              <p className="hint">
                {t("Entfernt unwiderruflich all deine persönlichen Daten (Login, Name, Profilfarbe, Motto, Nachrichten). Reine Ergebniszahlen bereits gespielter Matches bleiben anonymisiert bestehen, damit die Statistik der übrigen Mitglieder korrekt bleibt.")}
              </p>
              <div className="sp-controls">
                <button className="btn primary" onClick={() => setDeleteStep(0)}>{t("Abbrechen")}</button>
                <button className="btn ghost warn" onClick={() => setDeleteStep(2)}>{t("Ja, fortfahren")}</button>
              </div>
            </div>
          </div>
        )}
        {deleteStep === 2 && (
          <div className="modal-overlay" onClick={() => { setDeleteStep(0); setDeleteConfirmText(""); }}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <h3>{t("Letzte Bestätigung")}</h3>
              <p>{t("Tippe deinen Namen \"{name}\" ein, um die endgültige Löschung zu bestätigen.", { name: nickname })}</p>
              <div className="mail-row" style={{ marginBottom: 14 }}>
                <User size={18} className="mail-ico" />
                <input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} autoFocus />
              </div>
              <div className="sp-controls">
                <button className="btn primary" onClick={() => { setDeleteStep(0); setDeleteConfirmText(""); }}>{t("Abbrechen")}</button>
                <button className="btn ghost warn" disabled={deleteConfirmText.trim() !== nickname || deleteBusy}
                  onClick={confirmDelete}>
                  {deleteBusy ? t("Speichere ...") : t("Endgültig löschen")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Registry aller frei anordenbaren Karten dieses Bildschirms - WELCHE
  // Karte in welcher Spalte und an welcher Stelle steht, entscheidet allein
  // der Nutzer (Reihenfolge/Spalte aus useCardLayout, geaendert unter
  // "Profil bearbeiten" -> "Karten"); hier steht nur noch, was drin ist.
  // Eine Karte, die es gerade ueberhaupt nicht gibt (Tempo ohne
  // Protokolldaten, die Konto-Karten auf einem fremden Profil), fehlt hier
  // schlicht - renderColumn ueberspringt sie dann.
  // Sprung von den drei naechsten Erfolgen (oben in der Karte) zum echten Erfolg in der
  // Liste darunter: Filter zuruecksetzen, Kategorie aufklappen, hinscrollen, kurz markieren.
  const openBadge = (key) => {
    const b = catalog.find((x) => x.badge_key === key);
    if (!b) return;
    setBadgeQuery(""); setBadgeStatus("all");
    setOpenCats((prev) => new Set(prev).add(b.category));
    let tries = 0;
    const go = () => {
      const el = document.querySelector(`[data-badge-key="${key}"]`);
      if (!el) { if (++tries < 20) setTimeout(go, 50); return; }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 2200);
    };
    setTimeout(go, 50);
  };
  const cardsById = {
    erfolge: (
        <>
          {isMe && (
            <div className="ach-next">
              <AchievementsProgressCard embedded catalog={catalog} extras={extendedExtras}
                earnedBadges={earnedBadges} nickname={nickname} onOpenBadge={openBadge} />
            </div>
          )}
          <div className="search-row" style={{ marginBottom: 8 }}>
            <Search size={16} className="mail-ico" />
            <input placeholder={t("Erfolge durchsuchen …")} value={badgeQuery} onChange={(e) => setBadgeQuery(e.target.value)} />
            {badgeQuery && <button className="clear-btn" onClick={() => setBadgeQuery("")} aria-label={t("Suche loeschen")}><X size={15} /></button>}
          </div>
          {isMe && (
            // Alle 5 Werkzeuge (Status-Filter + Auf-/Zuklappen) auf einer
            // Ebene statt zweier getrennter Zeilen (Nutzer-Feedback) - eine
            // gemeinsame Flex-Zeile, die Auf-/Zuklappen-Buttons rechtsbuendig
            // per margin-left:auto auf dem ersten der beiden. Erreicht/Gesperrt
            // als Icon-Chips (Schloss offen/zu) statt Textlabels - kompakter
            // (behebt auch den Zeilenumbruch am Handy, Nutzer-Feedback) und
            // selbsterklaerend passend zum "Erfolge freischalten"-Thema.
            <div className="chips small" style={{ marginBottom: 8 }}>
              <button ref={allFilterRef} className={"chip" + (badgeStatus === "all" ? " active" : "")} onClick={() => setBadgeStatus("all")}>{t("Alle")}</button>
              <button className={"chip chip-icon" + (badgeStatus === "earned" ? " active" : "")} onClick={() => setBadgeStatus("earned")}
                aria-label={t("Erreicht")} title={t("Erreicht")}><LockOpen size={16} /></button>
              <button className={"chip chip-icon" + (badgeStatus === "locked" ? " active" : "")} onClick={() => setBadgeStatus("locked")}
                aria-label={t("Gesperrt")} title={t("Gesperrt")}><Lock size={16} /></button>
              <button className="chip chip-icon" style={{ marginLeft: "auto" }} onClick={expandAll}
                aria-label={t("Alles aufklappen")} title={t("Alles aufklappen")}><ChevronsDown size={16} /></button>
              <button className="chip chip-icon" onClick={collapseAll}
                aria-label={t("Alles zuklappen")} title={t("Alles zuklappen")}><ChevronsUp size={16} /></button>
            </div>
          )}
          {(() => {
            let anyVisible = false;
            const rows = visibleByCategory.map(([cat, items, visible]) => {
              if (visible.length === 0) return null;
              anyVisible = true;
              // Zähler immer gegen die ECHTE Gesamtzahl der Kategorie (items.length).
              const earnedCount = items.filter((b) => earnedBadges.has(b.badge_key)).length;
              const open = openCats.has(cat);
              const liveStat = isMe ? catLiveStat(items, extendedExtras) : null;
              return (
                <div key={cat} className="badge-cat">
                  <button className="badge-cat-head" onClick={() => toggleCat(cat)}>
                    <div className="badge-cat-head-row">
                      <span className="badge-cat-title">{t(cat)}</span>
                      <span className="badge-cat-count">{earnedCount} / {items.length}</span>
                      <ChevronDown size={16} className={"cat-chev" + (open ? " open" : "")} />
                    </div>
                    <ProgressBar current={earnedCount} target={items.length} />
                    {liveStat && <span className="badge-cat-live">{liveStat}</span>}
                  </button>
                  {open && (
                    <div className="badge-grid">
                      {visible.map((b) => {
                        const key = b.badge_key;
                        const earned = earnedBadges.has(key);
                        const selected = meRow?.selected_badge === key && isMe;
                        const progress = isMe && !earned ? badgeProgress(b.description, extendedExtras) : null;
                        // "Derselbe Gegner": der Gegner, bei dem der Stand gerade am hoechsten ist.
                        const oppNick = progress
                          ? (/Siege in Folge gegen denselben Gegner$/.test(b.description) ? extendedExtras.maxOpponentStreakNick
                            : /Matches gegen denselben Gegner/.test(b.description) ? extendedExtras.maxVsOpponentNick : null)
                          : null;
                        return (
                          <button key={key} data-badge-key={key}
                            className={"badge-chip" + (earned ? " earned" : " locked") + (selected ? " selected" : "")}
                            disabled={!isMe || !earned}
                            onClick={() => isMe && earned && onSelectBadge(selected ? null : key)}
                            title={t(b.description)}>
                            <span className={"badge-emoji" + (earned ? "" : " locked-emoji")}>{b.emoji}</span>
                            <span className="badge-name">{t(b.name)}</span>
                            <span className="badge-desc">{t(b.description)}</span>
                            {progress && (
                              <>
                                <span className="badge-progress">
                                  {t("Fortschritt: {cur} / {target} {unit}", { cur: progress.current, target: progress.target, unit: progress.unit })}
                                </span>
                                <ProgressBar current={progress.current} target={progress.target} />
                                {oppNick && <span className="badge-progress">{t("Aktuell gegen: {name}", { name: oppNick })}</span>}
                              </>
                            )}
                            {selected && <span className="badge-active">{t("Als Avatar aktiv")}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
            return (
              <>
                {rows}
                {!anyVisible && badgeFiltering && <p className="hint">{t("Keine passenden Erfolge gefunden.")}</p>}
              </>
            );
          })()}
          {!isMe && !badgeFiltering && earnedBadges.size === 0 && <p className="hint">{t("Noch keine Erfolge freigeschaltet.")}</p>}
        </>
    ),
  };

  // Zwei Karten buendeln mehrere Katalog-Eintraege zu je EINER Karte mit
  // Reitern (siehe CardDeck.jsx; die zweite, "Meine Zahlen", ist NumbersDeck) - das Profil hatte zuletzt zwei Karten mit
  // demselben Titel "Erfolge (20 / 149)" untereinander und daneben vier
  // kurze Karten, die alle dasselbe beantworten: "was sagen meine Zahlen".
  // Jeder Teil bleibt einzeln ausblend- und sortierbar; "cardsById" liefert
  // ab hier nur noch die Inhalte, Rahmen und Kopf kommen von der Deck-Karte.
  const DECKS = [
    {
      ids: PROFIL_DECK_IDS[0],
      icon: <Award size={17} />,
      title: `${t("Erfolge")} (${earnedBadges.size} / ${catalog.length})`,
      soloTitle: false,
      domId: "pf-achievements-full",
      tabs: {
        // Der Satz stand bis 2026-09-30 als Dauertext ueber der Liste -
        // jetzt im Info-Knopf des Reiters (Nutzer-Vorgabe).
        erfolge: { tab: t("Alle"), title: t("Erfolge"), icon: <Award size={15} />,
          info: isMe ? t("Tippe einen freigeschalteten Erfolg an, um ihn als Avatar zu zeigen.") : undefined },
      },
    },
    {
      // "Meine Zahlen" ist keine Deck-Karte aus cardsById-Koerpern mehr,
      // sondern die gemeinsame Komponente NumbersDeck - dieselbe, die am PC
      // die linke Spalte auf Statistik und Live baut (Nutzer-Feedback: die
      // Spalte soll ueberall gleich sein). Hier haengt nur noch das
      // Ausblenden und Sortieren der Reiter dran.
      ids: PROFIL_DECK_IDS[1],
      numbers: true,
    },
  ];
  let deckOrder = shownOrder;
  let deckColumns = pfColumns;
  const hasTempoData = speedStats.avgGameMs != null || speedStats.avgBallMs != null;
  DECKS.forEach((deck) => {
    // Ein Teil ohne Inhalt (Tempo ohne Protokolldaten) taucht gar nicht
    // erst als Reiter auf - sonst fuehrte der Reiter ins Leere.
    const ids = deck.numbers
      ? deck.ids.filter((id) => id !== "tempo" || hasTempoData)
      : deck.ids.filter((id) => cardsById[id]);
    const { parts, anchor } = foldedDeck(deckOrder, ids);
    if (anchor && deck.numbers) {
      cardsById[anchor] = (
        <NumbersDeck nickname={nickname} isMe={isMe} parts={parts} matches={matches} rangliste={rangliste}
          players={players} challenges={challenges} catalog={catalog} earnedBadges={earnedBadges}
          onOpenProfile={onOpenProfile} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
          onHidePart={isMe && onSetCardLayout ? (id) => cards.hideCard(id) : undefined} />
      );
    } else if (anchor) {
      const activeId = parts.includes(deckTab[anchor]) ? deckTab[anchor] : parts[0];
      const bodies = Object.fromEntries(parts.map((id) => [id, cardsById[id]]));
      cardsById[anchor] = (
        <CardDeck roomy id={deck.domId} icon={deck.icon} title={deck.title} soloTitle={deck.soloTitle}
          tabs={parts.map((id) => ({ id, ...deck.tabs[id], render: () => bodies[id] }))}
          activeId={activeId} onActive={(id) => setDeckTab((d) => ({ ...d, [anchor]: id }))}
          onHide={cardHide(activeId)} />
      );
    }
    deckOrder = withoutFolded(deckOrder, deck.ids, anchor);
    Object.keys(deckColumns).forEach((col) => {
      deckColumns = { ...deckColumns, [col]: withoutFolded(deckColumns[col], deck.ids, anchor) };
    });
  });
  // "order" = Platz in der Gesamtreihenfolge; am Handy ergibt das EINE
  // durchgehende Liste ueber alle drei Spalten hinweg (siehe CardSlot.jsx).
  const renderColumn = (col) => deckColumns[col].filter((id) => cardsById[id]).map((id) => (
    <CardSlot key={id} order={phoneSlotOrder(col, deckOrder.indexOf(id))}>{cardsById[id]}</CardSlot>
  ));


  return (
    <div className="screen">
      <header className="screen-head with-back">
        {onBack && <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>}
        <div>
          <h2>{isMe ? t("Mein Profil") : t("Spielerprofil")}</h2>
          <span className="head-note">{isMe ? t("Deine Erfolge und Statistiken") : t("Erfolge und Statistiken dieses Spielers")}</span>
        </div>
      </header>

      <div className="pf-layout">
      {/* Drei frei befuellbare Spalten (am Handy per display:contents EINE
          durchgehende Liste, siehe App.css): duenn - breit - duenn, wie auf
          Statistik und Live. Fest sind nur die Identitaetskarte ganz oben
          links (sie ist der Kopf des Bildschirms, kein Modul unter vielen)
          und die Konto-Knoepfe ganz unten rechts. Eine Spalte, in der keine
          Karte mehr steht, verschwindet per CSS ganz, statt eine Luecke zu
          hinterlassen (Nutzer-Feedback: "die Luecken zwischen den Karten
          sind unnoetig gross, wenn manche dazwischen ausgeblendet sind"). */}
      <div className="pf-col left">
      <div className="pf-identity" style={{ order: 0 }}>
      <IdentityCard nickname={nickname} gesamt={gesamt} motto={playerObj?.motto} since={playerObj?.created_at}
        stats={stats} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
        onHeadClick={heroPhoto ? () => setPhotoViewerOpen(true) : undefined}
        onInvite={isMe ? onInvite : undefined}
        onSettings={isMe ? () => { setNick(nickname); setColor(meRow?.avatar_color || null); setMotto(meRow?.motto || ""); setEdit(true); } : undefined}
        actions={<>
          {!isMe && playerObj && !challengeForm && (
            <div className="sp-controls" style={{ marginBottom: 14 }}>
              <button className="btn primary" onClick={() => onStartMatch(playerObj)}>
                <Play size={15} /> {t("Match starten")}
              </button>
              <button className="btn primary" onClick={() => setChallengeForm(true)}>
                <Swords size={15} /> {t("Herausfordern")}
              </button>
            </div>
          )}
          {!isMe && playerObj && challengeForm && (
            <div className="challenge-form">
              <div className="search-row" style={{ marginBottom: 8 }}>
                <input placeholder={t("z. B. 'Hast du heute Abend Zeit?'")} value={challengeMsg}
                  maxLength={200} onChange={(e) => setChallengeMsg(e.target.value)} />
              </div>
              <div className="sp-controls">
                <button className="btn ghost" onClick={() => { setChallengeForm(false); setChallengeMsg(""); }}>
                  {t("Abbrechen")}
                </button>
                <button className="btn primary" onClick={() => {
                  onChallenge(playerObj.id, challengeMsg); setChallengeForm(false); setChallengeMsg("");
                }}>
                  <Swords size={15} /> {t("Herausfordern")}
                </button>
              </div>
            </div>
          )}
        </>} />
      </div>
      {renderColumn("left")}
      </div>

      <div className="pf-col middle">{renderColumn("middle")}</div>

      <div className="pf-col right">
      {renderColumn("right")}
      </div>
      </div>

      {isMe && onSetCardLayout && (
        <ShowAllCardsButton hiddenCount={cards.hiddenCount} onShowAll={cards.showAll} />
      )}
      <ImprintFooter />
      {photoViewerOpen && heroPhoto && (
        <div className="modal-overlay photo-viewer" onClick={() => setPhotoViewerOpen(false)}>
          <img src={heroPhoto} alt={nickname} className="photo-viewer-img" />
        </div>
      )}

      {isMe && installPrompt.canShow && (
        <section className="stat-block install-block">
          {installPrompt.isIos ? (
            <p className="hint center">
              📲 {t("Installiere Break & Rank auf deinem Home-Bildschirm")} — <Share size={13} style={{ verticalAlign: "-2px" }} /> {t("Tippe unten auf Teilen, dann \"Zum Home-Bildschirm\"")}
            </p>
          ) : installPrompt.hasPrompt ? (
            <button className="btn ghost" onClick={installPrompt.install}>
              <Download size={16} /> {t("App installieren")}
            </button>
          ) : (
            <p className="hint center">
              💻 {t("Kein Installations-Dialog verfuegbar. Schon installiert, aber kein Symbol mehr sichtbar? Oeffne chrome://apps oder suche im Startmenue nach \"Break & Rank\". Noch nicht installiert? Browser-Menue (⋮) -> \"App installieren\".")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
