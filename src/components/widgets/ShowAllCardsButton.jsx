import { Eye } from "lucide-react";
import { t } from "../../lib/i18n";

/* "Alle Karten einblenden" - steht auf jedem Bildschirm mit ausblendbaren
   Karten ganz unten (Vorgabe: "Setze diesen Button ganz nach unten"), also
   nach dem letzten Modul und vor dem Impressum. Bleibt auch dann sichtbar,
   wenn gerade nichts ausgeblendet ist (dann nur deaktiviert): so ist der
   Weg zurueck immer an derselben, vorhersehbaren Stelle - sonst muesste man
   sich merken, wo der Knopf war, als noch etwas ausgeblendet war. */
export default function ShowAllCardsButton({ hiddenCount, onShowAll }) {
  return (
    <div className="cards-restore-row">
      <button className="btn ghost" disabled={!hiddenCount} onClick={onShowAll}>
        <Eye size={15} /> {t("Alle Karten einblenden")}{hiddenCount > 0 ? ` (${hiddenCount})` : ""}
      </button>
    </div>
  );
}
