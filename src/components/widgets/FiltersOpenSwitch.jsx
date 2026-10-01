import { useState } from "react";
import { t } from "../../lib/i18n";
import { getFiltersOpen, storeFiltersOpen } from "../../lib/uiPrefs";
import InfoButton from "./InfoButton";

/* Schalter "Filter immer anzeigen" (Profil bearbeiten -> Dieses Geraet).
   Bestimmt nur den Anfangszustand der Trichter-Felder (useFunnel in
   FilterFunnel.jsx); ein- und ausklappen geht weiter per Trichter. */
export default function FiltersOpenSwitch() {
  const [on, setOn] = useState(getFiltersOpen);
  const label = t("Filter immer anzeigen");
  return (
    <div className="switch-row">
      <label className="settings-switch">
        <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); storeFiltersOpen(e.target.checked); }} />
        <span className="settings-switch-track" aria-hidden="true"><span className="settings-switch-knob" /></span>
        <span className="settings-switch-label">{label}</span>
      </label>
      <InfoButton title={label}>
        {t("Die Filter (Trichter-Symbol) sind beim Öffnen eines Bildschirms gleich aufgeklappt, statt zugeklappt. Mit dem Trichter lassen sie sich weiterhin ein- und ausklappen. Gilt nur auf diesem Gerät und ab dem nächsten Öffnen des Bildschirms.")}
      </InfoButton>
    </div>
  );
}
