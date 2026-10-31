import { Flag } from "lucide-react";
import { t } from "../../lib/i18n";

/* "Turnier beenden" - in JEDEM Turniermodus (Raster-Formate und Winner Stays) derselbe Knopf: gleiches Symbol, gleicher Text,
   gleiche Groesse. Eigener Knopf mit Symbol und Text, gut sichtbar, aber nicht vollbreit: beendet wird das GANZE Turnier, nicht ein einzelnes Match,
   deshalb steht "Turnier" im Text und nicht "Runde". Die Rueckfrage haengt der Aufrufer davor (appConfirm). */
export default function EndTournamentButton({ onClick, disabled }) {
  return (
    <button type="button" className="btn ghost tour-end" disabled={disabled} onClick={onClick}
      title={t("Das ganze Turnier beenden")}>
      <Flag size={18} /> {t("Turnier beenden")}
    </button>
  );
}
