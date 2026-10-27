import { useState } from "react";
import { t } from "../../lib/i18n";
import { getShowTimes, storeShowTimes } from "../../lib/uiPrefs";
import InfoButton from "./InfoButton";

/* Schalter "Uhrzeit in Listen anzeigen" (Einstellungen -> App-Verhalten). Haelt seinen Zustand selbst, weil er nur in
   localStorage lebt (lib/uiPrefs.js); die Listen lesen ihn beim Rendern. */
export default function ShowTimesSwitch() {
  const [on, setOn] = useState(getShowTimes);
  const label = t("Uhrzeit in Listen anzeigen");
  return (
    <div className="switch-row">
      <label className="settings-switch">
        <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); storeShowTimes(e.target.checked); }} />
        <span className="settings-switch-track" aria-hidden="true"><span className="settings-switch-knob" /></span>
        <span className="settings-switch-label">{label}</span>
      </label>
      <InfoButton title={label}>
        {t("Zeigt in Listen wie „Letzte Matches“ und im Turnier-Spielverlauf zusätzlich zum Datum die Uhrzeit. Ausgeschaltet steht dort nur das Datum – die genaue Zeit findest du immer im Protokoll des Matches. Gilt nur auf diesem Gerät.")}
      </InfoButton>
    </div>
  );
}
