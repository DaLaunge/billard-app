import { useState } from "react";
import { List, Rows3 } from "lucide-react";
import { t } from "../../lib/i18n";
import {
  getListMode, storeListMode, getStickyHeads, storeStickyHeads, getChapterButtons, storeChapterButtons,
} from "../../lib/uiPrefs";
import InfoButton from "./InfoButton";

/* Einstellungen "Listen und Kapitel" (Profil -> Einstellungen -> Dieses Geraet, lib/uiPrefs.js):
   Ansicht (eine lange Liste / Kapitel einzeln), Kapitelkoepfe beim Scrollen anpinnen, Kapitel-Buttons oben.
   Die Bildschirme lesen die Werte beim Aufbau, die Einstellung gilt also ab dem naechsten Oeffnen. */
export default function ListPrefs() {
  const [mode, setMode] = useState(getListMode);
  const [sticky, setSticky] = useState(getStickyHeads);
  const [buttons, setButtons] = useState(getChapterButtons);
  const pickMode = (m) => { setMode(m); storeListMode(m); };
  const sw = (checked, onChange, label, info, disabled = false) => (
    <div className="switch-row">
      <label className="settings-switch">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="settings-switch-track" aria-hidden="true"><span className="settings-switch-knob" /></span>
        <span className="settings-switch-label">{label}</span>
      </label>
      <InfoButton title={label}>{info}</InfoButton>
    </div>
  );
  return (
    <>
      <div className="list-prefs-mode">
        <span className="list-prefs-label">{t("Ansicht der Listen")}<InfoButton title={t("Ansicht der Listen")}>{t("Doomscroller: alle Kapitel stehen als eine lange Liste untereinander. Tab-Freak: oben wählst du per Button ein Kapitel, es zeigt sich einzeln.")}</InfoButton></span>
        <div className="list-prefs-chips" role="group" aria-label={t("Ansicht der Listen")}>
          <button type="button" className={"chip" + (mode === "stacked" ? " active" : "")} title={t("Eine lange Liste: einfach nach unten scrollen")} aria-pressed={mode === "stacked"} onClick={() => pickMode("stacked")}>
            <List size={15} /> {t("Doomscroller")}
          </button>
          <button type="button" className={"chip" + (mode === "chapters" ? " active" : "")} title={t("Ein Kapitel nach dem anderen per Button")} aria-pressed={mode === "chapters"} onClick={() => pickMode("chapters")}>
            <Rows3 size={15} /> {t("Tab-Freak")}
          </button>
        </div>
      </div>
      {sw(sticky, (v) => { setSticky(v); storeStickyHeads(v); }, t("Kapitelköpfe beim Scrollen anzeigen"),
        t("Die Überschrift des Kapitels, in dem du gerade bist, bleibt beim Scrollen oben stehen, bis das nächste Kapitel kommt."))}
      {sw(mode === "chapters" || buttons, (v) => { setButtons(v); storeChapterButtons(v); }, t("Kapitel-Buttons oben"),
        t("Buttons oben auf der Seite für jedes Kapitel. In der langen Liste springen sie zum Kapitel, bei „Tab-Freak“ sind sie immer da und schalten das Kapitel um."), mode === "chapters")}
    </>
  );
}
