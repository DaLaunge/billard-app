import { Type } from "lucide-react";
import { t } from "../../lib/i18n";
import { FONT_SCALE_MIN, FONT_SCALE_MAX, FONT_SCALE_STEP, storeFontScale } from "../../lib/uiPrefs";
import InfoButton from "./InfoButton";

/* Regler fuer die Schriftgroesse (gilt pro Geraet). Der Wert gehoert SettingsScreen, damit "Alle Einstellungen
   zuruecksetzen" ihn mitziehen kann. Wirkt sofort und wird sofort gespeichert. */
export default function FontScaleSlider({ value, onChange }) {
  const change = (v) => { const s = Math.round(v * 100) / 100; onChange(s); storeFontScale(s); };
  return (
    <div className="font-scale">
      <div className="field-label">
        <span>{t("Schriftgröße")} · {Math.round(value * 100)} %</span>
        <InfoButton title={t("Schriftgröße")}>
          {t("Macht alle Texte der App größer oder kleiner. Gilt nur auf diesem Gerät.")}
        </InfoButton>
      </div>
      <div className="font-scale-row">
        <Type size={13} aria-hidden="true" />
        <input type="range" min={FONT_SCALE_MIN} max={FONT_SCALE_MAX} step={FONT_SCALE_STEP} value={value}
          onChange={(e) => change(parseFloat(e.target.value))} aria-label={t("Schriftgröße")} />
        <Type size={20} aria-hidden="true" />
      </div>
    </div>
  );
}
