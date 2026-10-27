import { useState } from "react";
import { t } from "../../lib/i18n";
import { getListMode, storeListMode, getStickyHeads, storeStickyHeads } from "../../lib/uiPrefs";
import InfoButton from "./InfoButton";
import ListModeOption from "./ListModeOption";

/* Einstellungen "Listen und Kapitel" (Profil -> Einstellungen -> App-Verhalten, lib/uiPrefs.js):
   Ansicht (Doomscroller = eine lange Liste ohne Buttons / Tab-Freak = Kapitel-Buttons oben, ein Klick zeigt das Kapitel) und, nur beim Doomscroller, das Anpinnen der Kapitelkoepfe.
   Die Bildschirme lesen die Werte beim Aufbau, die Einstellung gilt also ab dem naechsten Oeffnen. */
export default function ListPrefs() {
  const [mode, setMode] = useState(getListMode);
  const [sticky, setSticky] = useState(getStickyHeads);
  const pickMode = (m) => { setMode(m); storeListMode(m); };
  const sw = (checked, onChange, label, info) => (
    <div className="switch-row">
      <label className="settings-switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="settings-switch-track" aria-hidden="true"><span className="settings-switch-knob" /></span>
        <span className="settings-switch-label">{label}</span>
      </label>
      <InfoButton title={label}>{info}</InfoButton>
    </div>
  );
  return (
    <>
      <div className="list-prefs-mode">
        <span className="list-prefs-label">{t("Ansicht der Listen")}<InfoButton title={t("Ansicht der Listen")}>{t("Doomscroller: alle Kapitel stehen als eine lange Liste untereinander, du scrollst durch. Tab-Freak: oben stehen Buttons für die Kapitel, ein Klick zeigt das Kapitel einzeln, wie ein Tab.")}</InfoButton></span>
        <div className="list-prefs-opts" role="group" aria-label={t("Ansicht der Listen")}>
          <ListModeOption mode="chapters" active={mode === "chapters"} onClick={() => pickMode("chapters")} />
          <ListModeOption mode="stacked" active={mode === "stacked"} onClick={() => pickMode("stacked")} />
        </div>
      </div>
      {mode === "stacked" && sw(sticky, (v) => { setSticky(v); storeStickyHeads(v); }, t("Kapitelköpfe beim Scrollen anzeigen"),
        t("Die Überschrift des Kapitels, in dem du gerade bist, bleibt beim Scrollen oben stehen, bis das nächste Kapitel kommt."))}
    </>
  );
}
