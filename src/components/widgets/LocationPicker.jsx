import { useState } from "react";
import { MapPin, Plus, Pencil, Navigation } from "lucide-react";
import { t } from "../../lib/i18n";
import { useLocations, routeUrl } from "../../lib/locationStore";
import LocationForm from "./LocationForm";

/* Standort AUSWAEHLEN statt tippen. Kacheln mit allen freigegebenen Standorten (plus den eigenen Vorschlaegen),
   darunter Adresse, Routen-Knopf und - fuer alle Mitglieder - ein Stift zum Korrigieren. "Neu" oeffnet das Formular. */
export default function LocationPicker({ value, onChange, optional = false, toast, me }) {
  const { list } = useLocations();
  const [mode, setMode] = useState(null); // null | "new" | "edit"
  const visible = list.filter((l) => l.status === "approved" || l.created_by === me?.id || me?.role === "admin");
  const sel = list.find((l) => l.id === value);

  if (mode) {
    return (
      <LocationForm initial={mode === "edit" ? sel : null} toast={toast} onCancel={() => setMode(null)}
        onSaved={(id) => { setMode(null); if (id) onChange(id); }} />
    );
  }
  return (
    <div className="loc-picker">
      <div className="loc-chips">
        {optional && (
          <button type="button" className={"chip" + (!value ? " active" : "")} onClick={() => onChange(null)}>{t("Kein Ort")}</button>
        )}
        {visible.map((l) => (
          <button key={l.id} type="button" className={"chip" + (value === l.id ? " active" : "")} onClick={() => onChange(l.id)}>
            <MapPin size={13} /> {l.name}{l.status === "pending" ? " ⏳" : ""}
          </button>
        ))}
        <button type="button" className="chip" onClick={() => setMode("new")}><Plus size={14} /> {t("Neuer Standort")}</button>
      </div>
      {sel && (
        <div className="loc-sel">
          <div className="loc-sel-txt">
            <b>{sel.name}</b>
            {sel.address && <span className="rank-meta">{sel.address}</span>}
            {sel.status === "pending" && <span className="rank-meta">{t("wartet auf Freigabe – nur für dich sichtbar")}</span>}
          </div>
          <a className="icon-btn small" href={routeUrl(sel)} target="_blank" rel="noreferrer" aria-label={t("Route in Google Maps")} title={t("Route in Google Maps")}><Navigation size={16} /></a>
          <button type="button" className="icon-btn small" onClick={() => setMode("edit")} aria-label={t("Standort korrigieren")} title={t("Standort korrigieren")}><Pencil size={15} /></button>
        </div>
      )}
    </div>
  );
}
