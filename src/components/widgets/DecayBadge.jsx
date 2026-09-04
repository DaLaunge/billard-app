import { useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { t } from "../../lib/i18n";
import { decayDaysLeft, playerBadgeStatus, PROVISIONAL_GAMES } from "../../lib/format";

const LABEL = {
  decaying: () => t("Punkteverfall - mehr erfahren"),
  soon: () => t("Punkteverfall bald - mehr erfahren"),
  inactive: () => t("Laenger inaktiv - mehr erfahren"),
  provisional: () => t("Vorlaeufiges Rating - mehr erfahren"),
};

/* Gemeinsames Hinweis-Symbol + Erklaerungs-Popup fuer alles, was am Rating
   eines Spielers "dranhaengt" und sonst nirgends erklaert wird: drohender/
   aktiver Punkteverfall, laengere Inaktivitaet, vorlaeufiges Rating (siehe
   playerBadgeStatus() in lib/format.js fuer die Prioritaet - immer nur
   EIN Status gleichzeitig, da nur ein Icon-Platz zur Verfuegung steht).
   Von der Identitaets-Karte und der Rangliste gemeinsam genutzt, damit
   Schwellen und Erklaertexte an einer einzigen Stelle gepflegt werden.
   Bewusst ein <span role="button">, kein <button> - beide Einsatzorte
   liegen selbst schon in anklickbaren Bereichen (id-card-head-Button bzw.
   rank-row-Button), ein verschachteltes <button> waere ungueltiges HTML
   (siehe Kommentar in IdentityCard.jsx). stopPropagation verhindert, dass
   ein Klick zusaetzlich den umgebenden Button ausloest (Profil oeffnen).
   "player" ist eine Zeile der rangliste-View (oder das "Gesamt"-Aequivalent
   davon) - bringt alle noetigen Felder (aktiv, letzte_partie, vorlaeufig,
   rating, spiele) schon mit. */
export default function DecayBadge({ player, className, iconSize = 20, pulse = false }) {
  const [open, setOpen] = useState(false);
  const status = playerBadgeStatus(player);
  if (!status) return null;
  const { rating, spiele, letzte_partie } = player;
  const daysLeft = status === "soon" ? decayDaysLeft(letzte_partie) : null;
  const gamesLeft = status === "provisional" ? Math.max(0, PROVISIONAL_GAMES - (spiele ?? 0)) : null;
  // Verfall bewegt IMMER Richtung 500 - ein Rating darunter STEIGT dabei,
  // eins darueber sinkt. Nie pauschal "sinkt" behaupten (siehe Kommentar
  // bei decayStatus() in format.js).
  const richtung = rating > 500 ? t("sinkt") : rating < 500 ? t("steigt") : null;
  const Icon = status === "provisional" ? Info : AlertTriangle;
  const cls = [className, status !== "decaying" ? "warn-info" : "", pulse && status === "decaying" ? "warn-pulse" : ""]
    .filter(Boolean).join(" ");
  const activate = (e) => { e.stopPropagation(); setOpen(true); };
  const close = (e) => { e.stopPropagation(); setOpen(false); };
  return (
    <>
      <span className={cls} role="button" tabIndex={0} onClick={activate}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(e); } }}
        aria-label={LABEL[status]()} title={LABEL[status]()}>
        <Icon size={iconSize} />
      </span>
      {open && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {status === "decaying" && (
              <>
                <h3><AlertTriangle size={18} /> {t("Punkteverfall")}</h3>
                <p>{t("Ohne bestaetigte Matches bewegt sich ein Rating mit der Zeit wieder Richtung 500 (Startwert) - so bleibt die Rangliste auch bei laengeren Pausen aussagekraeftig.")}</p>
                {richtung && <p>{t("Aktuell {richtung} das Rating dadurch.", { richtung })}</p>}
                <p>{t("Einfach ein Match spielen und bestaetigen lassen, um den Verfall zu stoppen.")}</p>
              </>
            )}
            {status === "soon" && (
              <>
                <h3><AlertTriangle size={18} /> {t("Punkteverfall bald")}</h3>
                <p>{t("Noch {n} Tage, dann bewegt sich das Rating ohne ein neues Match wieder Richtung 500 (Startwert).", { n: daysLeft })}</p>
                <p>{t("Spiel rechtzeitig ein Match, um das zu verhindern.")}</p>
              </>
            )}
            {status === "inactive" && (
              <>
                <h3><AlertTriangle size={18} /> {t("Laenger inaktiv")}</h3>
                <p>{t("Seit ueber 180 Tagen kein bestaetigtes Match - dieser Spieler wird in der Rangliste standardmaessig ausgeblendet.")}</p>
                {richtung && <p>{t("Aktuell {richtung} das Rating dadurch.", { richtung })}</p>}
                <p>{t("Ein neues Match holt den Spieler zurueck in die aktive Rangliste.")}</p>
              </>
            )}
            {status === "provisional" && (
              <>
                <h3><Info size={18} /> {t("Vorlaeufiges Rating")}</h3>
                <p>{t("Mit weniger als 10 gewerteten Spielen gilt ein Rating noch als vorlaeufig - es kann sich pro Match noch deutlich staerker veraendern.")}</p>
                <p>{t("Noch {n} Spiele bis das Rating als gefestigt gilt.", { n: gamesLeft })}</p>
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
