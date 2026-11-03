import { Clock } from "lucide-react";
import { t } from "../../lib/i18n";

/* Uhrzeit-Auswahl mit zwei Listen (Stunde, Minute in 5er-Schritten) statt des Browser-Zeitfelds, das sich am Handy und am PC
   schlecht bedienen laesst. Der Wert ist immer eine gueltige "HH:MM"-Zeit - es gibt keinen leeren Zustand. */
const pad = (n) => String(n).padStart(2, "0");
export default function TimePicker({ value, onChange, label }) {
  const [hh, mm] = (value || "18:00").split(":").map(Number);
  const mins = Array.from({ length: 12 }, (_, i) => i * 5);
  if (!mins.includes(mm)) { mins.push(mm); mins.sort((a, b) => a - b); }
  return (
    <span className="time-picker" role="group" aria-label={label || t("Uhrzeit")}>
      <Clock size={15} className="mail-ico" />
      <select value={hh} aria-label={t("Stunde")} onChange={(e) => onChange(`${pad(e.target.value)}:${pad(mm)}`)}>
        {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{pad(h)}</option>)}
      </select>
      <b>:</b>
      <select value={mm} aria-label={t("Minute")} onChange={(e) => onChange(`${pad(hh)}:${pad(e.target.value)}`)}>
        {mins.map((m) => <option key={m} value={m}>{pad(m)}</option>)}
      </select>
    </span>
  );
}
