import { useEffect } from "react";
import { t } from "../lib/i18n";
import ListModeOption from "./widgets/ListModeOption";

/* Einmalige Auswahl "Wie liest du Listen?" (App.jsx): beim ersten Start auf einem Geraet und direkt nach "Alle Einstellungen
   zuruecksetzen". Tab-Freak (Kapitel als Buttons) ist der Standard und die empfohlene Wahl - wer das Fenster schliesst, bekommt ihn.
   Spaeter jederzeit unter Einstellungen -> Dieses Geraet aenderbar. */
export default function ListChoiceDialog({ onChoose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onChoose("chapters"); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onChoose]);
  return (
    <div className="modal-overlay" onClick={() => onChoose("chapters")}>
      <div className="modal-box list-choice" role="dialog" aria-modal="true" aria-label={t("Wie liest du Listen?")} onClick={(e) => e.stopPropagation()}>
        <h3>{t("Wie liest du Listen?")}</h3>
        <ListModeOption mode="chapters" recommended onClick={() => onChoose("chapters")} />
        <ListModeOption mode="stacked" onClick={() => onChoose("stacked")} />
        <p className="hint">{t("Das kannst du jederzeit unter Einstellungen ändern.")}</p>
      </div>
    </div>
  );
}
