import { useState } from "react";
import { Info } from "lucide-react";
import { t } from "../../lib/i18n";

/* Kleines Info-Symbol rechts oben in einer Karte (siehe .stat-block-head)
   fuer Erklaerungen, die sonst als Dauertext unnoetig Platz wegnehmen
   wuerden (Nutzer-Feedback). Gleiches Popup-Muster wie DecayBadge
   (modal-overlay/modal-box), aber ohne Status-Logik - hier reicht ein
   fixer Titel + Erklaerungstext pro Karte. */
export default function InfoButton({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="card-info-btn" onClick={() => setOpen(true)}
        aria-label={t("Erklärung")} title={t("Erklärung")}>
        <Info size={16} />
      </button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3><Info size={18} /> {title}</h3>
            <p>{children}</p>
            <div className="sp-controls">
              <button className="btn primary" onClick={() => setOpen(false)}>{t("Verstanden")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
