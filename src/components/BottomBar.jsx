import { Plus } from "lucide-react";
import { t } from "../lib/i18n";

/* Schwebende Leiste unten: die angehefteten Menuepunkte (siehe lib/menuPrefs.js), das runde "+" immer in der
   Mitte - links ceil(n/2) Punkte, rechts der Rest. */
export default function BottomBar({ entries, onNewMatch, hidden }) {
  const split = Math.ceil(entries.length / 2);
  const btn = (e) => {
    const Icon = e.icon;
    return (
      <button key={e.id} data-tour={e.tour} className={"tab" + (e.on ? " on" : "")} onClick={e.run}>
        <Icon size={21} /><span>{t(e.label)}</span>
        {e.badge ? (
          <span className={"badge" + (e.id === "live" ? " live" : "")}
            aria-label={e.badge === "!" ? t("Offene Herausforderung") : undefined}
            title={e.badge === "!" ? t("Offene Herausforderung") : undefined}>{e.badge}</span>
        ) : null}
      </button>
    );
  };
  return (
    <nav className={"tabbar" + (hidden ? " tabbar-off" : "")}>
      {entries.slice(0, split).map(btn)}
      <button data-tour="tab-fab" className="tab fab" onClick={onNewMatch} aria-label={t("Neues Match")}>
        <span className="fab-shine" />
        <Plus size={26} className="fab-plus" />
      </button>
      {entries.slice(split).map(btn)}
    </nav>
  );
}
