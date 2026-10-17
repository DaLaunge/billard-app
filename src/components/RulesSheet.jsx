import { lazy, Suspense, useEffect } from "react";
import { X, BookOpen } from "lucide-react";
import { t } from "../lib/i18n";

const RuleHelp = lazy(() => import("./RuleHelp"));

/* Regelkunde als Vollbild-Blatt, geoeffnet aus dem Menue (AppDrawer). Frueher eine
   eigene Karte auf Live; dort schaut man zwar nach, wenn am Tisch etwas strittig
   ist, aber die Karte kostete jedem Live-Besuch Platz. */
export default function RulesSheet({ onClose, onViewRule, isAdmin }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="rules-sheet" role="dialog" aria-modal="true" aria-label={t("Regelkunde")}>
      <header className="rules-sheet-head">
        <h2><BookOpen size={19} /> {t("Regelkunde")}</h2>
        <button className="icon-btn" onClick={onClose} aria-label={t("Schließen")}><X size={20} /></button>
      </header>
      <div className="rules-sheet-body">
        <Suspense fallback={<p className="hint">{t("Lädt …")}</p>}>
          <RuleHelp onlyReleased={!isAdmin} onView={onViewRule} />
        </Suspense>
      </div>
    </div>
  );
}
