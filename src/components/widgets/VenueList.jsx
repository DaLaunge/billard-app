import { useState } from "react";
import { MapPin, Search, Radio, Calendar } from "lucide-react";
import { t } from "../../lib/i18n";
import { useLocations } from "../../lib/locationStore";
import RouteButton from "./RouteButton";

/* Alle Lokale auf einen Blick, mit Suche: Der schnelle Weg zu einer Planung ueber den ORT. Pro Lokal zwei Knoepfe
   ("Live" / "Planung"), die das jeweilige Formular mit diesem Lokal vorbelegt oeffnen. Der andere Weg (erst Live/Planung,
   Lokal dort optional waehlen) bleibt in den Formularen selbst. */
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const SHOWN = 30;

export default function VenueList({ me, onLive, onPlan, liveBusy }) {
  const { list } = useLocations();
  const [q, setQ] = useState("");
  const visible = list
    .filter((l) => l.status === "approved" || l.created_by === me?.id || me?.role === "admin")
    .sort((a, b) => a.name.localeCompare(b.name));
  const nq = norm(q);
  const found = nq ? visible.filter((l) => norm(`${l.name} ${l.address || ""}`).includes(nq)) : visible;
  const rows = found.slice(0, SHOWN);

  return (
    <>
      <div className="search-row">
        <Search size={16} className="mail-ico" />
        <input placeholder={t("Lokal suchen …")} value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} />
      </div>
      {visible.length === 0 && <p className="hint center">{t("Noch kein Lokal eingetragen – leg das erste bei „Live“ oder „Planung“ an.")}</p>}
      {visible.length > 0 && found.length === 0 && <p className="hint center">{t("Kein Lokal gefunden.")}</p>}
      <div className="venue-list">
        {rows.map((l) => (
          <div key={l.id} className="venue-row">
            <div className="loc-sel-txt">
              <b><MapPin size={14} /> {l.name}{l.status === "pending" ? " ⏳" : ""}</b>
              {l.address && <span className="rank-meta">{l.address}</span>}
            </div>
            <RouteButton place={l} size={15} />
            {onLive && !liveBusy && (
              <button type="button" className="chip-btn" onClick={() => onLive(l.id)} title={t("Hier live gehen")} aria-label={t("Hier live gehen")}>
                <Radio size={14} /> {t("Live")}
              </button>
            )}
            {onPlan && (
              <button type="button" className="chip-btn" onClick={() => onPlan(l.id)} title={t("Hier einen Termin planen")} aria-label={t("Hier einen Termin planen")}>
                <Calendar size={14} /> {t("Planung")}
              </button>
            )}
          </div>
        ))}
      </div>
      {found.length > SHOWN && <p className="hint center">{t("{n} weitere – Suche eingrenzen.", { n: found.length - SHOWN })}</p>}
    </>
  );
}
