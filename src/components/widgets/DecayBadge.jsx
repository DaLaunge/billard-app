import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { t } from "../../lib/i18n";
import { decayDaysLeft } from "../../lib/format";

/* Gemeinsames Warnsymbol + Erklaerungs-Popup fuer drohenden/aktiven
   Punkteverfall (siehe decayStatus()/decayDaysLeft() in lib/format.js) -
   von der Identitaets-Karte und der Rangliste gemeinsam genutzt, damit
   Schwellen und Erklaertexte an einer einzigen Stelle gepflegt werden.
   Bewusst ein <span role="button">, kein <button> - beide Einsatzorte
   liegen selbst schon in anklickbaren Bereichen (id-card-head-Button bzw.
   rank-row-Button), ein verschachteltes <button> waere ungueltiges HTML
   (siehe Kommentar in IdentityCard.jsx). stopPropagation verhindert, dass
   ein Klick zusaetzlich den umgebenden Button ausloest (Profil oeffnen). */
export default function DecayBadge({ status, letztePartie, className, iconSize = 20, pulse = false }) {
  const [open, setOpen] = useState(false);
  if (!status) return null;
  const daysLeft = status === "soon" ? decayDaysLeft(letztePartie) : null;
  const cls = [className, status === "soon" ? "warn-soon" : "", pulse && status === "decaying" ? "warn-pulse" : ""]
    .filter(Boolean).join(" ");
  const activate = (e) => { e.stopPropagation(); setOpen(true); };
  const close = (e) => { e.stopPropagation(); setOpen(false); };
  return (
    <>
      <span className={cls} role="button" tabIndex={0} onClick={activate}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(e); } }}
        aria-label={t("Punkteverfall - mehr erfahren")} title={t("Punkteverfall - mehr erfahren")}>
        <AlertTriangle size={iconSize} />
      </span>
      {open && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3><AlertTriangle size={18} /> {status === "soon" ? t("Punkteverfall bald") : t("Punkteverfall")}</h3>
            {status === "soon" ? (
              <>
                <p>{t("Noch {n} Tage, dann beginnt das Rating ohne ein neues Match Richtung 500 zu sinken.", { n: daysLeft })}</p>
                <p>{t("Spiel rechtzeitig ein Match, um das zu verhindern.")}</p>
              </>
            ) : (
              <>
                <p>{t("Ohne bestaetigte Matches sinkt ein Rating mit der Zeit wieder Richtung 500 (Startwert) - so bleibt die Rangliste auch bei laengeren Pausen aussagekraeftig.")}</p>
                <p>{t("Einfach ein Match spielen und bestaetigen lassen, um den Verfall zu stoppen.")}</p>
              </>
            )}
            <div className="sp-controls">
              <button className="btn primary" onClick={close}>{t("Verstanden")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
