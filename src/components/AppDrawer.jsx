import { useState } from "react";
import { BarChart3, Trophy, Radio, User, Plus, Shield, GraduationCap, BookOpen, Settings, X, ChevronDown } from "lucide-react";
import { TUTORIAL_STEPS } from "../lib/tutorial/steps";
import Ball from "./Ball";
import { initials } from "../lib/format";
import { THEME_CATALOG, THEME_KEYS } from "../lib/themes";
import { t } from "../lib/i18n";

/* Menue-Drawer am Handy, feste Seitenleiste am PC (ab 900px, siehe .app-drawer
   in App.css). Alle Farben nur ueber die Theme-Variablen, damit Farbdesigns
   und eigener Akzent unveraendert greifen. Die vier Hauptpunkte stehen hier
   noch einmal, damit Seitenleiste und Leiste unten dieselben Ziele haben. */
export default function AppDrawer({
  open, onClose, tab, player, onGo, onTurniere, onNewMatch, onTutorial, onRules, onSettings, onSetTheme,
  colorOf, badgeOf, photoOf, badges = {}, isAdmin,
}) {
  const [tourOpen, setTourOpen] = useState(false);
  const themeKey = player?.theme_key || "green";
  const custom = player?.theme_custom;
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
        <button className="app-drawer-item" onClick={go(onRules)}>
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
        <div className="app-drawer-sep" />
        <div className="app-drawer-label">{t("Farbdesign")}</div>
        <div className="app-drawer-dots" role="group" aria-label={t("Farbdesign")}>
          {THEME_KEYS.map((key) => (
            <button key={key} className={"app-drawer-dot" + (themeKey === key ? " sel" : "")}
              style={{ background: THEME_CATALOG[key].accent }} title={THEME_CATALOG[key].name}
              aria-label={THEME_CATALOG[key].name} aria-pressed={themeKey === key}
              onClick={() => { if (themeKey !== key) onSetTheme(key, null); }} />
          ))}
          {themeKey === "custom" && custom?.accent && (
            <button className="app-drawer-dot sel" style={{ background: custom.accent }}
              title={t("Eigene")} aria-label={t("Eigene")} aria-pressed="true" />
          )}
        </div>
      </aside>
    </>
  );
}
