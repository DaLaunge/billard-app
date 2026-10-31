import { Flag } from "lucide-react";
import { t } from "../../lib/i18n";

/* "Turnier beenden" - in JEDEM Turniermodus (Raster-Formate und Winner Stays) derselbe Knopf: gleiches Symbol, gleicher Text,
   gleiche Groesse. Bewusst klein und ruhig (kein breiter Knopf): beendet wird das GANZE Turnier, nicht ein einzelnes Match,
   deshalb steht "Turnier" im Text und nicht "Runde". Die Rueckfrage haengt der Aufrufer davor (appConfirm). */
export default function EndTournamentButton({ onClick, disabled }) {
  return (
    <button type="button" className="btn ghost small tour-tool end-tour" disabled={disabled} onClick={onClick}
      title={t("Das ganze Turnier beenden")}>
      <Flag size={15} /> {t("Turnier beenden")}
    </button>
  );
}
