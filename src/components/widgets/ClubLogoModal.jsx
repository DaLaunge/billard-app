import { useState } from "react";
import { X } from "lucide-react";
import { t } from "../../lib/i18n";
import { clubLogoUrl } from "../../lib/clubLogo";
import ClubTag, { clubColor, inkFor } from "./ClubTag";

/* Club-Logo gross ansehen: Fenster mit dem Logo (so gross wie der Bildschirm es zulaesst, hoechstens 280 px), Clubname und Tag.
   Geoeffnet wird es per Tipp auf das Wappen an der Kugel (IdentityCard) bzw. auf die Logo-Vorschau in der Club-Karte. Die Datei
   selbst ist klein gehalten (siehe clubLogo.js), vergroessert wirkt sie entsprechend weich - fuer ein Logo reicht das. */
export default function ClubLogoModal({ club, clubs = [], onClose }) {
  // Mehrere Clubs mit Logo (Person ist in mehreren Clubs): die uebrigen stehen als antippbare Tags darunter
  const [cur, setCur] = useState(club);
  if (!cur) return null;
  const others = clubs.filter((c) => c.id !== cur.id);
  const src = clubLogoUrl(cur);
  const close = (e) => { e?.stopPropagation(); onClose(); };
  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal-box club-logo-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={cur.name}>
        {src
          ? <img className="club-logo-big" src={src} alt={cur.name} />
          : <span className="club-logo-big club-logo-none" style={{ background: clubColor(cur), color: inkFor(clubColor(cur)) }}>{cur.tag}</span>}
        <h3>{cur.name}</h3>
        <ClubTag club={cur} />
        {others.length > 0 && (
          <div className="club-tags">
            {others.map((c) => (
              <button key={c.id} type="button" className="club-tag-btn" onClick={() => setCur(c)} aria-label={c.name}><ClubTag club={c} /></button>
            ))}
          </div>
        )}
        <div className="sp-controls">
          <button className="btn primary" onClick={close}><X size={16} /> {t("Schließen")}</button>
        </div>
      </div>
    </div>
  );
}
