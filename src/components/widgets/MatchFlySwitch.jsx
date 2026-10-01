import { useState } from "react";
import { t } from "../../lib/i18n";
import { getMatchFly, storeMatchFly } from "../../lib/uiPrefs";
import InfoButton from "./InfoButton";

/* Schalter "Kugel springt in die Aufstellung" (Profil bearbeiten -> Dieses Geraet).
   Haelt seinen Zustand selbst, weil er nur in localStorage lebt (lib/uiPrefs.js)
   und kein anderer Bildschirm ihn lebend braucht - das Match liest ihn bei jedem
   Flug neu. */
export default function MatchFlySwitch() {
  const [on, setOn] = useState(getMatchFly);
  const label = t("Kugel springt in die Aufstellung");
  return (
    <div className="switch-row">
      <label className="settings-switch">
        <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); storeMatchFly(e.target.checked); }} />
        <span className="settings-switch-track" aria-hidden="true"><span className="settings-switch-knob" /></span>
        <span className="settings-switch-label">{label}</span>
      </label>
      <InfoButton title={label}>
        {t("Wählst du bei „Neues Match“ einen Spieler, springt seine Kugel aus der Kachel in den freien Platz oben – beim Entfernen fliegt sie zurück. Gilt nur auf diesem Gerät und nicht, wenn dein Gerät „Bewegung reduzieren“ eingestellt hat.")}
      </InfoButton>
    </div>
  );
}
