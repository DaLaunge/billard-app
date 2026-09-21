import { EyeOff } from "lucide-react";
import { t } from "../../lib/i18n";

/* Ausblenden-Knopf einer einzelnen Karte (Nutzer-Feedback: "es werden
   mittlerweile so viele Karten, dass es unuebersichtlich ist") - sitzt im
   Kartenkopf neben Info-/Einklapp-/Spalten-Knopf (siehe
   .stat-block-head-actions in App.css). Anders als das Einklappen
   (CardCollapseButton) ist das eine dauerhafte, am Profil gespeicherte
   Entscheidung: die Karte verschwindet ganz, zurueck kommt sie ueber
   "Alle Karten einblenden" ganz unten auf demselben Bildschirm oder
   einzeln in den Einstellungen (Profil bearbeiten -> Karten). */
export default function CardHideButton({ onHide }) {
  if (!onHide) return null;
  return (
    <button type="button" className="card-hide-btn" onClick={onHide}
      aria-label={t("Karte ausblenden")} title={t("Karte ausblenden")}>
      <EyeOff size={16} />
    </button>
  );
}
