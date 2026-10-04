import { t } from "../../lib/i18n";
import InfoButton from "./InfoButton";

/* Schalter "Popup bei offener Bestaetigung" (Profil bearbeiten -> Dieses Geraet).
   Der Zustand lebt in App.jsx (pendingPopupOn), weil das Popup dort haengt. */
export default function PendingPopupSwitch({ on, onChange }) {
  const label = t("Popup bei offener Bestätigung");
  return (
    <div className="switch-row">
      <label className="settings-switch">
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
        <span className="settings-switch-track" aria-hidden="true"><span className="settings-switch-knob" /></span>
        <span className="settings-switch-label">{label}</span>
      </label>
      <InfoButton title={label}>
        {t("Sobald jemand ein Match gegen dich einträgt, erscheint sofort ein Popup, in dem du es bestätigen oder zurückweisen kannst – oder mit „Später“ wegschiebst. Ausgeschaltet bestätigst du wie gewohnt im Profil. Gilt nur auf diesem Gerät.")}
      </InfoButton>
    </div>
  );
}
