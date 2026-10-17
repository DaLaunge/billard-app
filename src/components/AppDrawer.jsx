import { useState, useRef, useEffect } from "react";
import { BarChart3, Trophy, Radio, User, Plus, Shield, GraduationCap, BookOpen, Settings, X, ChevronDown, RefreshCw, Check } from "lucide-react";
import { TUTORIAL_STEPS } from "../lib/tutorial/steps";
import Ball from "./Ball";
import { initials } from "../lib/format";
import { t } from "../lib/i18n";
import { APP_VERSION } from "../lib/constants";

/* Menue-Drawer am Handy, feste Seitenleiste am PC (ab 900px, siehe .app-drawer
   in App.css). Alle Farben nur ueber die Theme-Variablen, damit Farbdesigns
   und eigener Akzent unveraendert greifen. Die vier Hauptpunkte stehen hier
   noch einmal, damit Seitenleiste und Leiste unten dieselben Ziele haben. */
export default function AppDrawer({
  open, onClose, tab, player, onGo, onTurniere, onNewMatch, onTutorial, onRules, onSettings, onCheckUpdate,
  colorOf, badgeOf, photoOf, badges = {}, isAdmin,
}) {
  const [tourOpen, setTourOpen] = useState(false);
  // Update-Zeile: idle | checking | found | current | error | unavailable (vorher im Profil)
  const [updState, setUpdState] = useState("idle");
  const updTimer = useRef(null);
  useEffect(() => () => clearTimeout(updTimer.current), []);
  const runUpdateCheck = async () => {
    clearTimeout(updTimer.current);
    setUpdState("checking");
    // Mindestens 1,2 s, sonst blitzt der Laufbalken nur kurz auf und man weiss nicht, ob geprueft wurde.
    const [res] = await Promise.all([onCheckUpdate(), new Promise((r) => setTimeout(r, 1200))]);
    setUpdState(res || "error");
    if (res !== "found") updTimer.current = setTimeout(() => setUpdState("idle"), 7000);
  };
  const go = (fn) => () => { onClose(); fn(); };
  const items = [
    { key: "stats", icon: BarChart3, label: "Statistik", on: tab === "stats" || tab === "fremdprofil", run: () => onGo("stats"), badge: badges.stats },
    { key: "turnier", icon: Trophy, label: "Turniere", on: tab === "turnier" || tab === "turnierdetail" || tab === "winnerstays", run: onTurniere, badge: badges.turnier },
    { key: "live", icon: Radio, label: "Live", on: tab === "live", run: () => onGo("live"), badge: badges.live },
    { key: "profil", icon: User, label: "Profil", on: tab === "profil", run: () => onGo("profil"), badge: badges.profil },
  ];
  return (
    <>
      {open && <div className="app-drawer-scrim" onClick={onClose} aria-hidden="true" />}
      <aside data-tour="burger" className={"app-drawer" + (open ? " open" : "")} aria-label={t("Menü")} aria-hidden={!open ? undefined : false}>
        <div className="app-drawer-top">
          <Ball color={colorOf(player?.nickname)} label={initials(player?.nickname)} badge={badgeOf(player?.nickname)}
            photo={photoOf(player?.nickname)} size={40} />
          <div className="app-drawer-who">
            <strong>{player?.nickname}</strong>
          </div>
          <button className="app-drawer-close" onClick={onClose} aria-label={t("Schließen")}><X size={18} /></button>
        </div>
        <nav className="app-drawer-nav">
          {items.map(({ key, icon: Icon, label, on, run, badge }) => (
            <button key={key} data-tour={"tab-" + key} className={"app-drawer-item" + (on ? " on" : "")} onClick={go(run)}>
              <Icon size={19} /><span>{t(label)}</span>
              {badge > 0 && <em className="app-drawer-badge">{badge}</em>}
            </button>
          ))}
          <button data-tour="tab-fab" className="app-drawer-item app-drawer-new" onClick={go(onNewMatch)}>
            <Plus size={19} /><span>{t("Neues Match")}</span>
          </button>
        </nav>
        <div className="app-drawer-sep" />
        <button className={"app-drawer-item" + (tab === "regeln" ? " on" : "")} onClick={go(onRules)}>
          <BookOpen size={19} /><span>{t("Regelkunde")}</span>
        </button>
        <button className={"app-drawer-item" + (tourOpen ? " on" : "")} onClick={() => setTourOpen((v) => !v)} aria-expanded={tourOpen}>
          <GraduationCap size={19} /><span>{t("Tutorial")}</span>
          <ChevronDown size={16} className={"app-drawer-chev" + (tourOpen ? " up" : "")} />
        </button>
        {tourOpen && (
          <div className="app-drawer-sub">
            <button className="app-drawer-item" onClick={go(() => onTutorial(null))}><span>{t("Ganze Tour")}</span></button>
            {TUTORIAL_STEPS.filter((st) => st.id !== "welcome").map((st) => (
              <button key={st.id} className="app-drawer-item" onClick={go(() => onTutorial(st.id))}><span>{t(st.title)}</span></button>
            ))}
          </div>
        )}
        {isAdmin && (
          <button className="app-drawer-item" onClick={go(() => onGo("admin"))}>
            <Shield size={19} /><span>{t("Verwaltung")}</span>
          </button>
        )}
        <button className="app-drawer-item" onClick={go(onSettings)}>
          <Settings size={19} /><span>{t("Einstellungen")}</span>
        </button>
        <button type="button" className={"app-drawer-update " + updState} data-tour="update-btn"
          disabled={updState === "checking" || updState === "found"} onClick={runUpdateCheck}>
          {updState === "found" || updState === "current" ? <Check size={18} /> : <RefreshCw size={17} className={updState === "checking" ? "spin" : ""} />}
          <span className="app-drawer-update-text" aria-live="polite">
            <strong>
              {updState === "checking" ? t("Suche nach Updates …")
                : updState === "found" ? t("Update gefunden – wird installiert …")
                : updState === "current" ? t("Du hast die neueste Version.")
                : updState === "error" ? t("Prüfung fehlgeschlagen – bist du online?")
                : updState === "unavailable" ? t("Updates können hier nicht geprüft werden.")
                : t("Nach Updates suchen")}
            </strong>
            <small>{t("Version")} {APP_VERSION}</small>
          </span>
        </button>
      </aside>
    </>
  );
}
