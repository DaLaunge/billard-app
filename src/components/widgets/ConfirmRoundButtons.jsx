import { Check, X } from "lucide-react";
import { t } from "../../lib/i18n";

/* Zustimmen / Ablehnen als zwei runde Symbolknoepfe (gruen mit Haken, roter
   Kreis mit Kreuz) - dieselbe Bedienung wie die runden Knoepfe im Match
   (.round-btn). Die Worte stehen nur in title/aria-label; was zu tun ist,
   erklaert die Ueberschrift darueber. Genutzt fuer jede Match-Bestaetigung
   (Popup, Hinweis in Statistik, Turnierspiel). */
export default function ConfirmRoundButtons({ onYes, onNo, disabled, yesLabel, noLabel }) {
  const yes = yesLabel || t("Passt");
  const no = noLabel || t("Falsch");
  return (
    <>
      <button type="button" className="confirm-round no" disabled={disabled} onClick={onNo}
        aria-label={no} title={no}><X size={26} strokeWidth={2.6} /></button>
      <button type="button" className="confirm-round yes" disabled={disabled} onClick={onYes}
        aria-label={yes} title={yes}><Check size={26} strokeWidth={2.6} /></button>
    </>
  );
}
