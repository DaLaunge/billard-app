import { useState, useEffect } from "react";
import { User, X, Check, Pencil, Palette, Play, Smartphone, Shield, LogOut, MessageCircle, SlidersHorizontal, UserCog, MessageSquarePlus, RotateCcw, GraduationCap, Mail, Send } from "lucide-react";
import { t } from "../lib/i18n";
import Emoji from "./Emoji";
import { hashColor, initials, BALL_PALETTE } from "../lib/format";
import { THEME_CATALOG, THEME_KEYS, applyTheme } from "../lib/themes";
import { pushAvailability } from "../lib/notifications";
import Ball from "./Ball";
import PasswordSection from "./PasswordSection";
import MyFeedbackTickets from "./MyFeedbackTickets";
import ChangelogRow from "./widgets/ChangelogRow";
import InfoButton from "./widgets/InfoButton";
import MatchFlySwitch from "./widgets/MatchFlySwitch";
import ShowTimesSwitch from "./widgets/ShowTimesSwitch";
import PendingPopupSwitch from "./widgets/PendingPopupSwitch";
import FiltersOpenSwitch from "./widgets/FiltersOpenSwitch";
import ListPrefs from "./widgets/ListPrefs";
import PingRadiusSetting from "./widgets/PingRadiusSetting";
import FontScaleSlider from "./widgets/FontScaleSlider";
import { getFontScale, clearFontScale } from "../lib/uiPrefs";
import StartPagePicker from "./widgets/StartPagePicker";
import { appConfirm } from "../lib/confirmDialog";
import { useChapters, ChapterBar, Chap } from "../lib/useChapters";
import { useCardLayout } from "../lib/useCardLayout";
import { START_TABS } from "../lib/menuPrefs";
import ImprintFooter from "./widgets/ImprintFooter";

/* EINSTELLUNGEN als eigener Bildschirm (Tab "einstellungen", 417.5; vorher ein Zustand von ProfilScreen). Kapitel: Profil, Aussehen, Allgemein,
   App-Verhalten, Konto & Hilfe (lib/useChapters.jsx). Alle Auswahlen wirken sofort und werden sofort gespeichert. */
export default function SettingsScreen({ nickname, players, meRow, photoOf, toast, lang, onLang, onSaveProfile, onSelectBadge, onSetTheme, onSetStartTab,
  onResetCardLayout, onSetCardLayout, onResetMenu, onOpenAdmin, onLogout, onStartTutorial, updateInterval, onSetUpdateInterval, keepAwake, onSetKeepAwake,
  hideTabbar, onSetHideTabbar, pings, onFoundSanta, santaKnown, notifyMode, onSetNotifyMode, pendingPopup, onSetPendingPopup, onSubmitFeedback, onDeleteAccount }) {
  // Karten-Anordnung aller Bildschirme: nur fuer "Alle Einstellungen zuruecksetzen" (clearLocal haelt den lokalen Stand synchron)
  const layoutByScreen = {
    stats: useCardLayout("stats", meRow?.card_layout, onSetCardLayout, toast),
    live: useCardLayout("live", meRow?.card_layout, onSetCardLayout, toast),
    profil: useCardLayout("profil", meRow?.card_layout, onSetCardLayout, toast),
  };
  const [nick, setNick] = useState(nickname);
  const [color, setColor] = useState(meRow?.avatar_color || null);
  const [motto, setMotto] = useState(meRow?.motto || "");
  const [busy, setBusy] = useState(false);
  const [fontScale, setFontScale] = useState(getFontScale);
  // Kapitel der Einstellungen (Tab-Freak: Leiste + ein Kapitel, Doomscroller: alles untereinander, lib/useChapters.jsx)
  const editChap = useChapters("settings", [
    { id: "profil", label: t("Profil") },
    { id: "aussehen", label: t("Aussehen") },
    { id: "allgemein", label: t("Allgemein") },
    { id: "geraet", label: t("App-Verhalten") },
    { id: "konto", label: t("Konto & Hilfe") },
  ]);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCat, setFeedbackCat] = useState("bug");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0); // 0 versteckt, 1 erste Warnung, 2 Namen eintippen
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [ticketsRefresh, setTicketsRefresh] = useState(0);

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
  // letzte feste Wahl (beim Ausschalten von "Zuletzt geoeffnete Seite" kommt sie zurueck)
  const [startPick, setStartPick] = useState(() => { try { return localStorage.getItem("startPick") || (meRow?.start_tab && meRow.start_tab !== "last" ? meRow.start_tab : "stats"); } catch { return "stats"; } });
  useEffect(() => { if (startTab !== "last") { try { localStorage.setItem("startPick", startTab); } catch { /* ignore */ } } }, [startTab]);
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
    if (!(await appConfirm(t("Alle Einstellungen zurücksetzen? Kugelfarbe, Design, Schriftgröße, Startseite, Karten, Menü und Leiste gehen auf den Standard zurück.")))) return;
    setBusy(true);
    onResetMenu?.();
    clearFontScale();
    setFontScale(1);
    try { localStorage.removeItem("profilSeg"); } catch { /* ignore */ }
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


  return (
      <div className="screen">
        <header className="screen-head">
          <h2>{t("Einstellungen")}</h2>
        </header>

        <button type="button" className="pf-reset-all" disabled={busy} onClick={resetDefaults}>
          <RotateCcw size={18} />
          <span className="pf-reset-all-text">
            <strong>{t("Alle Einstellungen zurücksetzen")}</strong>
            <small>{t("Kugelfarbe, Design, Schriftgröße, Startseite, Karten, Menü und Leiste")}</small>
          </span>
        </button>

        {/* Der Update-Knopf (mit Versionsanzeige) wohnt seit 411.10 im Menue (AppDrawer). */}

        <ChapterBar c={editChap} label={t("Kapitel")} />
        <div className="pf-edit-layout">
        {/* Linke Spalte: Profilangaben + Karten-Sichtbarkeit. Beide stecken
            in EINEM Grid-Feld, das sie per Flexbox stapelt - sonst faengt
            die Karten-Sektion erst unterhalb der hoechsten Spalte der
            ersten Grid-Zeile an (siehe "CSS Grid cross-column height
            coupling" in CLAUDE.md). */}
        <div className="pf-edit-main">
        <Chap id="profil" c={editChap}>
        <section className="stat-block">
          <div className="stat-block-head"><h3><User size={17} /> {t("Profil")}</h3></div>
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
        </Chap>

        {/* Clubs (Tag im Profil): erscheint nur, wenn die Club-Tabellen existieren; ohne Club ist der Normalfall */}

        {/* Beide Farbwahlen in EINER Karte, direkt untereinander (Nutzer-Feedback
            2026-09-30: "sorge dafuer, dass die Farben nahe beisammen sind - die
            Auswahl fuer 'Meine Kugel' und 'Skin'"). Vorher stand die Kugelfarbe
            links bei den Profilangaben und das Design ganz rechts in der
            Seitenspalte, dazwischen Sprache, Karten usw. */}
        <Chap id="aussehen" c={editChap}>
        <section className="stat-block">
          <div className="stat-block-head">
            <h3><Palette size={17} /> {t("Aussehen")}</h3>
            <InfoButton title={t("Deine Kugel")}>
              {t("So sehen dich die anderen. Ohne Foto zeigt die Kugel deine Initialen in der gewählten Farbe; \"Auto\" wählt die Farbe selbst und zeigt wieder deine eigene Kugel statt eines Erfolgs.")}
            </InfoButton>
          </div>
          {/* Foto und Avatar-Erfolg stecken seit 411.22 im Profilbild-Fenster (Tipp auf die Kugel, AvatarSheet.jsx) -
              hier bleiben Kugelfarbe und Design. Frueher: EINE Kugel, gross und mittig, mit den Foto-Werkzeugen darunter -
              vorher gab es zwei kleine (eine beim Foto, eine bei der Farbe),
              die dasselbe zeigten (Nutzer-Feedback 2026-09-30). Die Kugel
              zeigt das fertige Ergebnis inklusive gewaehltem Erfolg-Avatar. */}
          <div className="avatar-stage">
            <Ball nick={nickname} color={color || hashColor(cleanNick || nickname)} label={initials(cleanNick || nickname)}
              photo={photoOf(nickname)} badge={meRow?.selected_badge || null} size={112} />
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
          <FontScaleSlider value={fontScale} onChange={setFontScale} />
        </section>
        </Chap>

        </div>

        <div className="pf-edit-side">
          {/* Drei Karten statt acht (Nutzer-Feedback 2026-09-30: "pruefe ob
              sich die anderen Karten zusammenfassen lassen"): was das KONTO
              betrifft (Sprache, Startseite), was nur DIESES GERAET betrifft
              (Bildschirm, Menueleiste, Benachrichtigungen, Updates) und
              Konto & Hilfe (Anmeldung, Feedback, Tickets, Abmelden). Alle
              Erklaertexte stehen hinter Info-Knoepfen, breite Textknoepfe sind
              runde Symbolknoepfe mit Namen in title/aria-label. */}
          <Chap id="allgemein" c={editChap}>
          <section className="stat-block">
            <div className="stat-block-head"><h3><SlidersHorizontal size={17} /> {t("Allgemein")}</h3></div>
            <div className="lang-row compact">
              <button className={"lang-btn" + (lang === "de" ? " active" : "")} onClick={() => onLang("de")} aria-label="Deutsch" title="Deutsch">
                <span className="flag"><Emoji e="🇩🇪" /></span>
              </button>
              <button className={"lang-btn" + (lang === "en" ? " active" : "")} onClick={() => onLang("en")} aria-label="English" title="English">
                <span className="flag"><Emoji e="🇬🇧" /></span>
              </button>
            </div>
            <div className="field-label">
              <span>{t("Startseite")}</span>
              <InfoButton title={t("Startseite")}>{t("Was soll beim Starten der App zuerst angezeigt werden?")}</InfoButton>
            </div>
            {/* Grafik der eigenen Menueleiste: antippen, welcher Punkt beim Start oeffnet (415.19). "Zuletzt geoeffnet" graut sie aus. */}
            <StartPagePicker value={startTab} onPick={(v) => { setStartPick(v); pickStartTab(v); }} disabled={busy} />
            <div className="switch-row">
              <label className="settings-switch">
                <input type="checkbox" checked={startTab === "last"} disabled={busy}
                  onChange={(e) => pickStartTab(e.target.checked ? "last" : (START_TABS.includes(startPick) ? startPick : "stats"))} />
                <span className="settings-switch-track" aria-hidden="true"><span className="settings-switch-knob" /></span>
                <span className="settings-switch-label">{t("Zuletzt geöffnete Seite")}</span>
              </label>
              <InfoButton title={t("Zuletzt geöffnete Seite")}>
                {t("Statt einer festen Startseite öffnet die App die Seite, auf der du zuletzt warst.")}
              </InfoButton>
            </div>
          </section>
          </Chap>

          <Chap id="geraet" c={editChap}>
          <section className="stat-block">
            <div className="stat-block-head"><h3><Smartphone size={17} /> {t("App-Verhalten")}</h3></div>
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
            <PingRadiusSetting pings={pings} meId={meRow?.id} toast={toast} onFoundSanta={onFoundSanta} santaKnown={santaKnown} />
            <MatchFlySwitch />
            <ShowTimesSwitch />
            <PendingPopupSwitch on={pendingPopup} onChange={onSetPendingPopup} />
            <FiltersOpenSwitch />
            <ListPrefs />
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
                        ? <> <Emoji e="📲" /> {t("Auf dem iPhone gehen Push-Nachrichten nur, wenn die App auf dem Home-Bildschirm installiert ist.")}</>
                        : ""}
                    </InfoButton>
                  </div>
                </>
              );
            })()}
          </section>
          </Chap>

          {/* Konto und Support. Bis 2026-09-25 waren "Anmeldung & Sicherheit",
              "Feedback" und "Meine Tickets" frei anordenbare Karten auf dem
              Profil selbst, danach drei eigene Karten hier, seit 2026-09-30
              Zeilen EINER Karte - mit "Verwaltung"/"Abmelden" als runden
              Symbolknoepfen darunter (aus den Einstellungen herausfuehrende
              Aktionen stehen am Ende). */}
          <Chap id="konto" c={editChap}>
          <section className="stat-block">
            <div className="stat-block-head"><h3><UserCog size={17} /> {t("Konto & Hilfe")}</h3></div>
            <PasswordSection toast={toast} />
            <ChangelogRow />
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
          </Chap>
        </div>
        </div>

      {/* Die Karten-Liste (Reihenfolge, Spalte, Sichtbarkeit) ist entfallen: mit Segment-Leiste und breiteren Karten
          braucht es sie nicht mehr. Ausgeblendet wird weiter direkt an der Karte (Kartenmenue), zurueckgeholt
          ueber "Alle Karten einblenden" ganz unten auf dem Bildschirm. */}

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
          <button className="pf-edit-danger-link" onClick={() => setDeleteStep(1)}>
            {t("Meine Daten löschen")}
          </button>
        </div>

        <ImprintFooter />

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
