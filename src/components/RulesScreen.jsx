import { lazy, Suspense } from "react";
import { t } from "../lib/i18n";

const RuleHelp = lazy(() => import("./RuleHelp"));

/* Regelkunde als normaler Bildschirm (Menue -> Regelkunde), mit demselben Seitenwechsel wie alle anderen.
   Bis 411.11 war das ein Vollbild-Blatt ueber der aktuellen Seite - das wirkte wie eine Ueberblendung. */
export default function RulesScreen({ onViewRule, isAdmin }) {
  return (
    <div className="screen">
      <header className="screen-head">
        <h2>{t("Regelkunde")}</h2>
        <span className="head-note">{t("Regelfälle zum Nachschlagen")}</span>
      </header>
      <Suspense fallback={<p className="hint">{t("Lädt …")}</p>}>
        <RuleHelp onlyReleased={!isAdmin} onView={onViewRule} />
      </Suspense>
    </div>
  );
}
