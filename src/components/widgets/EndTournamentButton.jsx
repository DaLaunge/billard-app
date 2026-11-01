import { t } from "../../lib/i18n";
import CheckeredFlag from "./CheckeredFlag";

/* "Turnier beenden" - in JEDEM Turniermodus (Raster-Formate und Winner Stays) derselbe Knopf: karierte Flagge, gleiche Groesse wie die
   anderen Knoepfe der Kopfzeile (QR, Bildschirm-an, Loeschen). Beendet wird das GANZE Turnier, nicht ein einzelnes Match - das sagt der
   Tooltip. Die Rueckfrage haengt der Aufrufer davor (appConfirm). */
export default function EndTournamentButton({ onClick, disabled }) {
  const label = t("Turnier beenden");
  return (
    <button type="button" className="icon-btn end-flag" disabled={disabled} onClick={onClick} aria-label={label} title={label}>
      <CheckeredFlag size={22} />
    </button>
  );
}
