import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronUp, User, X, Check, Pencil, Trophy, Award, ChevronDown, ChevronsDown, ChevronsUp, Lock, LockOpen, Swords, Shield, LogOut, RefreshCw, Share, Download, MessageCircle, Palette, Play, Clock, Search, Smartphone, Bell, LayoutGrid, Eye, AlignStartVertical, AlignCenterVertical, AlignEndVertical, Settings } from "lucide-react";
import { t } from "../lib/i18n";
import { computeStats } from "../lib/stats";
import { computeAchievementExtras, nextAchievementHint, badgeProgress } from "../lib/achievements";
import { useInstallPrompt } from "../lib/installPrompt";
import { initials, hashColor, BALL_PALETTE, fmtDate, fmtDuration } from "../lib/format";
import { computeSpeedStats } from "../lib/runLog";
import { THEME_CATALOG, THEME_KEYS, applyTheme } from "../lib/themes";
import { pushAvailability } from "../lib/notifications";
import Ball from "./Ball";
import PasswordSection from "./PasswordSection";
import AvatarPhotoField from "./AvatarPhotoField";
import MyFeedbackTickets from "./MyFeedbackTickets";
import HeadToHeadCard from "./widgets/HeadToHeadCard";
import RecordsCard from "./widgets/RecordsCard";
import IdentityCard from "./widgets/IdentityCard";
import AchievementsProgressCard from "./widgets/AchievementsProgressCard";
import ImprintFooter from "./widgets/ImprintFooter";
import CardMenuButton from "./widgets/CardMenuButton";
import ProgressBar from "./widgets/ProgressBar";
import ShowAllCardsButton from "./widgets/ShowAllCardsButton";
import CardSlot from "./widgets/CardSlot";
import { CARD_SCREENS, splitCardColumns } from "../lib/cardLayout";
import { useCardLayout } from "../lib/useCardLayout";

// Spaltenwahl in den Karten-Einstellungen: Symbol + Name je Spalte. Die
// Symbole zeigen einen Block links/mittig/rechts und damit direkt, wo die
// Karte am PC landet (welche Spalten es auf einem Bildschirm ueberhaupt
// gibt, steht im Katalog in cardLayout.js - Statistik und Live haben links
// eine feste Spalte und daher nur Mitte/Rechts).
const CARD_COLUMN_LABEL = { left: "Links", middle: "Mitte", right: "Rechts" };
const CARD_COLUMN_ICON = { left: AlignStartVertical, middle: AlignCenterVertical, right: AlignEndVertical };

export default function ProfilScreen({ nickname, matches, rangliste, onBack, isMe, onLogout, colorOf, badgeOf, photoOf,
  players, meRow, onSaveProfile, onOpenAdmin, onOpenTurniere, tourneyReadyCount, earnedBadges, onSelectBadge, catalog, onInvite, toast, lang, onLang, onOpenProfile,
  onChallenge, onStartMatch, challenges, updateInterval, onSetUpdateInterval, onCheckUpdate, keepAwake, onSetKeepAwake, hideTabbar, onSetHideTabbar, notifyMode, onSetNotifyMode, onSubmitFeedback, onDeleteAccount, onReload, onSetTheme, onSetStartTab,
  onResetCardLayout, onSetCardLayout, achievementCounters }) {
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
  const pfColumns = splitCardColumns(shownOrder, cards.columns, "profil");
  const cardHide = (id) => (isMe && onSetCardLayout ? () => cards.hideCard(id) : undefined);

  const catalogByCategory = useMemo(() => {
    const groups = {};
    [...catalog].sort((a, b) => a.sort - b.sort).forEach((b) => {
      (groups[b.category] ||= []).push(b);
    });
    return Object.entries(groups);
  }, [catalog]);
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
  // "Alle Erfolge ansehen" (unten bei AchievementsProgressCard) fokussiert
  // statt manuell zu scrollen den "Alle"-Filter-Chip selbst - ein natives
  // .focus() auf ein Nicht-Eingabefeld loest zuverlaessig (auch am Handy,
  // siehe Nutzer-Feedback - manuelles scrollIntoView({behavior:"smooth"})
  // griff dort nicht) das browsereigene Ins-Bild-Scrollen aus, OHNE dabei
  // wie bei einem <input> die Bildschirmtastatur zu oeffnen. Setzt den
  // Filter dabei gleich auf "Alle" - passt semantisch zum Button-Namen.
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
  }), [liveExtras, playerObj?.created_at, achievementCounters]);
  const achievementHint = useMemo(() => nextAchievementHint(catalog, extendedExtras, nickname, earnedBadges), [catalog, extendedExtras, nickname, earnedBadges]);

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

          <label className="field-label">{t("Profilfoto")}</label>
          <div className="swatch-preview">
            <Ball color={color || hashColor(cleanNick || nickname)} label={initials(cleanNick || nickname)}
              photo={photoOf(nickname)} size={56} />
            <AvatarPhotoField hasPhoto={!!photoOf(nickname)} onReload={onReload} toast={toast} />
          </div>
          <p className="hint">{t("Ohne Foto zeigt deine Kugel Initialen in deiner gewählten Farbe.")}</p>

          {meRow?.selected_badge && (
            <button className="btn ghost" style={{ marginBottom: 14 }} onClick={() => onSelectBadge(null)}>
              {t("Wieder meine Kugel zeigen")}
            </button>
          )}

          <label className="field-label">{t("Deine Kugel")}</label>
          <div className="swatch-row">
            <button className={"swatch auto" + (color === null ? " sel" : "")}
              onClick={() => pickColor(null)} aria-label={t("Automatische Farbe")}>{t("Auto")}</button>
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
          <div className="swatch-preview">
            <Ball color={color || hashColor(cleanNick || nickname)} label={initials(cleanNick || nickname)} size={56} />
            <span className="hint" style={{ marginTop: 0 }}>
              {t("So sehen dich die anderen.")}{color && !BALL_PALETTE.includes(color) ? ` ${t("Deine Farbe: {c}", { c: color.toUpperCase() })}` : ""}
            </span>
          </div>

          <label className="field-label" htmlFor="pmotto">{t("Motto (optional)")}</label>
          <div className="mail-row">
            <Pencil size={18} className="mail-ico" />
            <input id="pmotto" value={motto} maxLength={80}
              placeholder={t("z. B. 'Die 9 faellt immer'")} onChange={(e) => setMotto(e.target.value)}
              onBlur={() => { if (motto !== (meRow?.motto || "")) persist(); }} />
          </div>
        </section>

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
        <h3><LayoutGrid size={17} /> {t("Karten")}</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          {t("Reihenfolge, Spalte und Sichtbarkeit der Karten - fuer jeden Bildschirm. Ausgeblendete Karten holst du auch direkt auf dem jeweiligen Bildschirm ganz unten wieder zurueck.")}
        </p>
        {CARD_SCREENS.map(({ screen, label, cards }) => {
          const api = layoutByScreen[screen];
          const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
          const sichtbar = cards.length - api.hiddenCount;
          return (
            <div key={screen} className="card-vis-group">
              <div className="card-vis-group-head">
                <span className="card-vis-group-title">{t(label)}</span>
                <span className="card-vis-group-count">
                  {t("{n} von {m} sichtbar", { n: sichtbar, m: cards.length })}
                </span>
                <button className="chip chip-icon" onClick={api.showAll} disabled={!api.hiddenCount}
                  aria-label={t("Alle einblenden")} title={t("Alle einblenden")}>
                  <Eye size={15} />
                </button>
              </div>
              <div className="card-vis-list" style={{ "--card-vis-rows": Math.ceil(api.order.length / 2) }}>
                {api.order.map((id, i) => {
                  const c = byId[id];
                  if (!c) return null;
                  const shown = !api.isHidden(id);
                  const col = api.columns[id] || "middle";
                  const ColIcon = CARD_COLUMN_ICON[col] || AlignCenterVertical;
                  return (
                    <div key={id} className={"card-vis-row" + (shown ? "" : " is-hidden")}>
                      {/* Pfeile statt Ziehen: am Handy waere eine 36px hohe
                          Zeile ein schlechtes Ziehziel, und ein Fehlgriff
                          waere hier besonders aergerlich, weil direkt
                          daneben der Schalter zum Ausblenden sitzt. */}
                      <span className="card-vis-move">
                        <button type="button" className="card-vis-mini" disabled={i === 0}
                          onClick={() => api.moveCard(id, -1)}
                          aria-label={t("Nach oben")} title={t("Nach oben")}><ChevronUp size={14} /></button>
                        <button type="button" className="card-vis-mini" disabled={i === api.order.length - 1}
                          onClick={() => api.moveCard(id, 1)}
                          aria-label={t("Nach unten")} title={t("Nach unten")}><ChevronDown size={14} /></button>
                      </span>
                      {/* Der Schalter steckt in einem eigenen <label>, die
                          Knoepfe links und rechts davon bewusst DANEBEN und
                          nicht darin: ein Knopf innerhalb eines Labels loest
                          dessen Kaestchen mit aus - ein Klick auf "nach
                          oben" wuerde die Karte also gleich mit ausblenden.
                          Reihenfolge im Markup: Kaestchen, Schieber, Name -
                          der Schieber-Zustand haengt am Geschwister-
                          Selektor (input:checked + .settings-switch-track),
                          deshalb muss er direkt hinter dem input stehen.
                          Angezeigt wird trotzdem Name links / Schieber
                          rechts (order im CSS). */}
                      <label className="settings-switch card-vis-switch"
                        /* Nutzer-Feedback: "wenn ich eine Karte in den
                           Profileinstellungen deaktiviere, scrollt die App
                           automatisch ungewollt". Ein Klick aufs Label
                           fokussiert das unsichtbare Kaestchen (0x0 Pixel),
                           und der Browser scrollt jedes frisch fokussierte
                           Element ins Bild - bei 22 Zeilen liegt staendig
                           eine davon am Rand des Sichtfensters, und wegen
                           scroll-behavior:smooth auf .content ist die
                           Korrektur auch noch eine sichtbare Fahrt.
                           preventDefault auf mousedown unterbindet genau
                           diesen Fokus-Schritt; das Umschalten selbst haengt
                           am click bzw. change und funktioniert weiter. Mit
                           der Tastatur (Tab) wird weiterhin normal
                           fokussiert - dort IST das Scrollen erwuenscht. */
                        onMouseDown={(e) => e.preventDefault()}>
                        <input type="checkbox" checked={shown} onChange={() => api.toggleCard(id)} />
                        <span className="settings-switch-track" aria-hidden="true"><span className="settings-switch-knob" /></span>
                        {/* Bewusst NUR der Name, kein Auge/durchgestrichenes
                            Auge davor (Nutzer-Feedback: "es ist nicht noetig,
                            die Sichtbarkeit als durchgestrichenes Auge extra
                            zu betonen, der Schieberegler ist Information
                            genug") - das Symbol sagte dasselbe wie der
                            Schalter direkt daneben. */}
                        <span className="card-vis-name">
                          <span className="card-vis-label">{t(c.label)}</span>
                        </span>
                      </label>
                      {/* Spaltenwahl nur am PC (siehe .card-vis-col in
                          App.css) - am Handy steht ohnehin alles
                          untereinander, dort zaehlt allein die
                          Reihenfolge. */}
                      <button type="button" className="card-vis-mini card-vis-col"
                        onClick={() => api.cycleColumn(id)}
                        aria-label={t("Spalte wechseln")}
                        title={t("Spalte: {col}", { col: t(CARD_COLUMN_LABEL[col] || "Mitte") })}>
                        <ColIcon size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
        </div>

        <div className="pf-edit-side">
          <section className="stat-block">
            <label className="field-label">{t("Sprache")}</label>
            <div className="lang-row" style={{ marginBottom: 0 }}>
              <button className={"lang-btn" + (lang === "de" ? " active" : "")} onClick={() => onLang("de")} aria-label="Deutsch">
                <span className="flag">🇩🇪</span><span>Deutsch</span>
              </button>
              <button className={"lang-btn" + (lang === "en" ? " active" : "")} onClick={() => onLang("en")} aria-label="English">
                <span className="flag">🇬🇧</span><span>English</span>
              </button>
            </div>
          </section>

          <section className="stat-block">
            <h3><Palette size={17} /> {t("Design")}</h3>
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

          <section className="stat-block">
            <h3><Play size={17} /> {t("Startseite")}</h3>
            <p className="hint" style={{ marginTop: 0 }}>{t("Was soll beim Starten der App zuerst angezeigt werden?")}</p>
            <div className="chips">
              {[
                ["stats", t("Statistik")],
                ["turnier", t("Turniere")],
                ["live", t("Live")],
                ["profil", t("Profil")],
                ["last", t("Zuletzt geöffnet")],
              ].map(([v, label]) => (
                <button key={v} className={"chip" + (startTab === v ? " active" : "")}
                  disabled={busy} onClick={() => pickStartTab(v)}>
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="stat-block">
            <h3><Smartphone size={17} /> {t("Bildschirm")}</h3>
            {/* Standard ist an - waehrend eines Matches liegt das Handy meist
                unberuehrt am Tisch und soll sich nicht dauernd sperren. Wer das
                nicht will (Akku), schaltet es hier ab; die Einstellung gilt
                pro Geraet. */}
            <label className="settings-switch">
              <input type="checkbox" checked={keepAwake} onChange={(e) => onSetKeepAwake(e.target.checked)} />
              <span className="settings-switch-track" aria-hidden="true"><span className="settings-switch-knob" /></span>
              <span className="settings-switch-label">{t("Bildschirm während eines Matches anlassen")}</span>
            </label>
            <p className="hint">{t("Verhindert, dass sich das Handy mitten im Spiel sperrt. Gilt nur auf diesem Gerät und nur, solange ein Match oder eine Winner-Stays-Runde offen ist.")}</p>
            {/* Standard ist AUS (siehe lib/uiPrefs.js): eine Navigation, die
                von selbst verschwindet, soll niemand ungefragt bekommen. Wer
                den Platz will, schaltet es hier ein - am Handy sind es rund
                76px, die sonst dauerhaft ueber dem Inhalt liegen. */}
            <label className="settings-switch">
              <input type="checkbox" checked={hideTabbar} onChange={(e) => onSetHideTabbar(e.target.checked)} />
              <span className="settings-switch-track" aria-hidden="true"><span className="settings-switch-knob" /></span>
              <span className="settings-switch-label">{t("Menüleiste beim Scrollen ausblenden")}</span>
            </label>
            <p className="hint">{t("Beim Runterscrollen verschwindet die Leiste am unteren Rand, beim Hochscrollen kommt sie zurück. Mehr Platz für Ranglisten und Grafiken. Gilt nur auf diesem Gerät.")}</p>
          </section>

          <section className="stat-block">
            <h3><Bell size={17} /> {t("Benachrichtigungen")}</h3>
            {/* Eine Stufe fuer alle Ereignisse (Herausforderung, Match
                bestaetigen, du bist dran, Live/Planung/Zusagen). Gilt pro
                Geraet, weil auch die Push-Erlaubnis am Geraet haengt. Die
                Umstellung auf "Push" MUSS aus diesem Klick heraus
                passieren - iOS fragt die Erlaubnis sonst nicht ab. */}
            <div className="chips">
              {[
                ["off", t("Aus")],
                ["inapp", t("In der App")],
                ["push", t("Push")],
              ].map(([v, label]) => (
                <button key={v} className={"chip" + (notifyMode === v ? " active" : "")}
                  disabled={busy} onClick={async () => {
                    if (v === notifyMode) return;
                    setBusy(true);
                    try { await onSetNotifyMode(v); } finally { setBusy(false); }
                  }}>
                  {label}
                </button>
              ))}
            </div>
            <p className="hint">
              {notifyMode === "off" ? t("Keine Hinweise, auch kein „Du bist dran!“ bei Turnieren und Winner Stays.")
                : notifyMode === "inapp" ? t("Hinweise erscheinen nur, solange die App geöffnet ist.")
                : t("Push-Nachrichten kommen auch, wenn die App geschlossen ist. Ist sie offen, erscheint stattdessen ein Hinweis in der App.")}
              {" "}{t("Gilt nur auf diesem Gerät.")}
            </p>
            {notifyMode !== "push" && pushAvailability() === "ios-install" && (
              <p className="hint">📲 {t("Auf dem iPhone gehen Push-Nachrichten nur, wenn die App auf dem Home-Bildschirm installiert ist.")}</p>
            )}
          </section>

          <section className="stat-block">
            <h3><RefreshCw size={17} /> {t("App-Updates")}</h3>
            <label className="field-label" htmlFor="updateInterval">{t("Wie oft auf neue Version pruefen?")}</label>
            <select id="updateInterval" className="settings-select" value={updateInterval}
              onChange={(e) => onSetUpdateInterval(e.target.value)}>
              <option value="open">{t("Bei jedem Aufruf")}</option>
              <option value="30">{t("Alle 30 Minuten")}</option>
              <option value="60">{t("Alle 60 Minuten")}</option>
              <option value="manual">{t("Manuell")}</option>
            </select>
            <button className="btn ghost" onClick={() => { onCheckUpdate(); toast(t("Suche nach Updates …")); }}>
              <RefreshCw size={15} /> {t("Jetzt nach Updates suchen")}
            </button>
          </section>

          {/* Konto und Support. Bis 2026-09-25 waren "Anmeldung & Sicherheit",
              "Feedback" und "Meine Tickets" frei anordenbare Karten auf dem
              Profil selbst, und "Verwaltung"/"Abmelden" standen als Knoepfe
              darunter. Das Profil war damit zwei Dinge gleichzeitig: was ueber
              dich zu sagen ist (Erfolge, Ratings, Rekorde) UND ein
              Einstellungs-Sammelbecken. Jetzt liegt alles Zweite hier hinter
              dem Zahnrad, das Profil zeigt nur noch das Erste. */}
          <PasswordSection toast={toast} />
          <section className="stat-block">
            <h3><MessageCircle size={17} /> {t("Feedback")}</h3>
            {!feedbackOpen ? (
              <>
                <p className="hint" style={{ marginTop: 0 }}>{t("Bug gefunden oder eine Idee? Schreib's uns direkt.")}</p>
                <button className="btn ghost" onClick={() => setFeedbackOpen(true)}>
                  <MessageCircle size={15} /> {t("Feedback geben")}
                </button>
              </>
            ) : feedbackSent ? (
              <>
                <p className="hint" style={{ marginTop: 0 }}>{t("Danke fürs Feedback! Magst du zusätzlich direkt schreiben?")}</p>
                <div className="sp-controls">
                  <a className="btn ghost" href="https://t.me/+3MKzIVnJBblmZWVk" target="_blank" rel="noopener noreferrer">
                    {t("Per Telegram")}
                  </a>
                  <a className="btn ghost" href="mailto:dalaunge@gmx.at">{t("Per E-Mail")}</a>
                </div>
                <button className="btn ghost" style={{ marginTop: 8 }} onClick={closeFeedback}>{t("Fertig")}</button>
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
                <div className="sp-controls">
                  <button className="btn ghost" onClick={closeFeedback}>{t("Abbrechen")}</button>
                  <button className="btn primary" disabled={!feedbackMsg.trim() || feedbackBusy} onClick={sendFeedback}>
                    {feedbackBusy ? t("Speichere ...") : t("Absenden")}
                  </button>
                </div>
              </div>
            )}
          </section>
          <MyFeedbackTickets playerId={meRow.id} toast={toast} refreshKey={ticketsRefresh} />

          {/* Am Ende der Einstellungen, nicht dazwischen: das sind die
              Aktionen, die aus den Einstellungen herausfuehren. */}
          <div className="pf-account-actions">
            {meRow?.role === "admin" && (
              <button className="btn ghost" onClick={onOpenAdmin}><Shield size={16} /> {t("Verwaltung oeffnen")}</button>
            )}
            <button className="btn ghost" onClick={onLogout}><LogOut size={16} /> {t("Abmelden")}</button>
          </div>
        </div>
        </div>

        <div className="pf-edit-save">
          <button className="btn ghost" disabled={busy} onClick={resetDefaults}>
            {t("Zurücksetzen")}
          </button>
          <p className="hint">{t("Setzt Kugelfarbe, Design, Startseite sowie verschobene und ausgeblendete Karten auf die Standardeinstellungen zurück.")}</p>
        </div>

        {/* Nutzer-Feedback: "Konto löschen" soll in "Profil bearbeiten" und
            dort moeglichst unauffaellig sein - statt der bisherigen roten
            Warnkarte mit Dauertext jetzt nur ein kleiner, gedaempfter
            Text-Link ganz unten. Die ausfuehrliche Erklaerung, was beim
            Loeschen mit den Daten passiert, steht stattdessen im ersten
            Bestaetigungsdialog (siehe deleteStep === 1 unten) - wer nicht
            klickt, sieht sie also gar nicht erst. Label bleibt "Meine Daten
            löschen", weil genau dieser Text auch in der Datenschutz-
            erklaerung (LegalModal.jsx) als Fundstelle genannt wird. */}
        <div className="pf-edit-danger">
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
  const cardsById = {
    erfolgeFortschritt: (
        <AchievementsProgressCard catalog={catalog} extras={extendedExtras} earnedBadges={earnedBadges} nickname={nickname}
          onHide={cardHide("erfolgeFortschritt")}
          onOpenProfile={() => {
            // "Alle"-Filter-Chip fokussieren statt manuell zu scrollen (siehe
            // allFilterRef oben) - klappt bei fremden Profilen nicht (Chips
            // nur bei isMe gerendert), dort bleibt scrollIntoView als Ersatz.
            if (allFilterRef.current) { setBadgeStatus("all"); allFilterRef.current.focus(); }
            else document.getElementById("pf-achievements-full")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }} />
    ),
    ratings: (
        <section className="stat-block">
          <div className="stat-block-head roomy">
            <h3><Trophy size={17} /> {t("Ratings nach Disziplin")}</h3>
            {cardHide("ratings") && <div className="stat-block-head-actions"><CardMenuButton onHide={cardHide("ratings")} /></div>}
          </div>
          {myRows.map((r) => (
            <div key={r.discipline} className="stat-row">
              <span className="stat-name">{t(r.discipline)}</span>
              <span className="rank-meta" style={{ marginRight: 10 }}>{r.spiele} {t("Spiele")}</span>
              <span className="stat-val">{r.rating}</span>
            </div>
          ))}
          {myRows.length === 0 && <p className="hint">{t("Noch kein Rating - erst ein Match spielen!")}</p>}
        </section>
    ),
    rekorde: (
          <RecordsCard extras={liveExtras} catalog={catalog} earnedBadges={earnedBadges} onHide={cardHide("rekorde")} />
    ),
    headToHead: (
          <HeadToHeadCard nickname={nickname} matches={matches} rangliste={rangliste} onOpenProfile={onOpenProfile}
            colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onHide={cardHide("headToHead")} />
    ),
    erfolge: (
        <section className="stat-block" id="pf-achievements-full">
          <div className="stat-block-head roomy">
            <h3><Award size={17} /> {t("Erfolge")} ({earnedBadges.size} / {catalog.length})</h3>
            {cardHide("erfolge") && <div className="stat-block-head-actions"><CardMenuButton onHide={cardHide("erfolge")} /></div>}
          </div>
          {isMe && achievementHint && (
            <p className="hint-highlight" style={{ marginTop: 0, marginBottom: 10 }}>🎯 {achievementHint}</p>
          )}
          {isMe && (
            <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
              {t("Tippe einen freigeschalteten Erfolg an, um ihn als Avatar zu zeigen.")}
            </p>
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
                        return (
                          <button key={key}
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
        </section>
    ),
    tempo: (speedStats.avgGameMs != null || speedStats.avgBallMs != null) ? (
          <section className="stat-block">
            <div className="stat-block-head roomy">
              <h3><Clock size={17} /> {t("Spielgeschwindigkeit")}</h3>
              {cardHide("tempo") && <div className="stat-block-head-actions"><CardMenuButton onHide={cardHide("tempo")} /></div>}
            </div>
            {speedStats.avgGameMs != null && (
              <div className="stat-row"><span className="stat-name">{t("Ø Zeit pro Spiel")}</span>
                <span className="stat-val">{fmtDuration(speedStats.avgGameMs)}</span></div>
            )}
            {speedStats.avgBallMs != null && (
              <>
                <div className="stat-row"><span className="stat-name">{t("Ø Zeit pro Kugel (14/1)")}</span>
                  <span className="stat-val">{fmtDuration(speedStats.avgBallMs)}</span></div>
                <div className="stat-row"><span className="stat-name">{t("Hochgerechnet pro Rack")}</span>
                  <span className="stat-val">{fmtDuration(speedStats.avgRackMs)}</span></div>
              </>
            )}
          </section>
    ) : null,
  };
  // "order" = Platz in der Gesamtreihenfolge; am Handy ergibt das EINE
  // durchgehende Liste ueber alle drei Spalten hinweg (siehe CardSlot.jsx).
  const renderColumn = (col) => pfColumns[col].filter((id) => cardsById[id]).map((id) => (
    <CardSlot key={id} order={10 + shownOrder.indexOf(id)}>{cardsById[id]}</CardSlot>
  ));


  return (
    <div className="screen">
      <header className="screen-head with-back">
        {onBack && <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>}
        <div>
          <h2>{isMe ? t("Mein Profil") : t("Spielerprofil")}</h2>
          <span className="head-note">{isMe ? t("Deine Erfolge und Statistiken") : t("Erfolge und Statistiken dieses Spielers")}</span>
        </div>
        {/* Zahnrad statt des frueheren breiten "Profil bearbeiten"-Knopfs in
            der Identitaetskarte: Einstellungen liegen dort, wo sie jeder
            sucht (oben rechts), und die Karte gewinnt eine ganze Knopfzeile
            an Platz zurueck. */}
        {isMe && (
          <button className="back-btn pf-settings-btn" aria-label={t("Profil bearbeiten")} title={t("Profil bearbeiten")}
            onClick={() => { setNick(nickname); setColor(meRow?.avatar_color || null); setMotto(meRow?.motto || ""); setEdit(true); }}>
            <Settings size={20} />
          </button>
        )}
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
      {/* Nur noch der Weg zu den Turnieren - bewusst KEINE Karte (er traegt
          den "du bist dran"-Zaehler, den auszublenden eine Falle waere).
          "Verwaltung" und "Abmelden" standen bis 2026-09-25 hier daneben und
          liegen jetzt am Ende der Einstellungen hinter dem Zahnrad: sie
          gehoeren zum Konto, nicht zu dem, was dieses Profil ueber dich
          aussagt. */}
      {isMe && (
      <div className="pf-account-actions" style={{ order: 9999 }}>
        <button className="btn ghost tournament-ready-btn" onClick={onOpenTurniere}>
          <Trophy size={16} /> {t("Turniere")}
          {/* Bleibt sichtbar, bis das Match tatsaechlich gespielt/gemeldet
              wurde (tourneyReadyCount kommt direkt aus der DB, siehe
              checkTourneyReady in App.jsx) - anders als das "Du bist dran"-
              Popup NICHT per "Später" wegklickbar, damit eine bereite
              Turnierpaarung nicht in Vergessenheit geraet (Nutzer-Feedback). */}
          {tourneyReadyCount > 0 && <span className="badge tournament-ready-badge">{tourneyReadyCount}</span>}
        </button>
      </div>
      )}
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
