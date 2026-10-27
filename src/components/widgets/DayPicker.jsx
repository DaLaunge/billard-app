import { useRef } from "react";
import { CalendarSearch } from "lucide-react";
import { t, getLang } from "../../lib/i18n";

/* Tagesauswahl statt des Browser-Datumsfelds (Nutzer-Feedback 424.2: Feld liess sich nicht bedienen, war viel zu lang und
   zeigte keinen Wochentag). Die naechsten 14 Tage als Kacheln mit Wochentag + Tag, darunter steht das gewaehlte Datum
   ausgeschrieben; weiter entfernte Tage ueber das Kalender-Symbol (natives Feld, versteckt, per showPicker). */
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

export default function DayPicker({ value, onChange, days = 14, maxDays = 120 }) {
  const loc = getLang() === "en" ? "en-US" : "de-AT";
  const inputRef = useRef(null);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const list = Array.from({ length: days }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i); return d; });
  const max = new Date(today); max.setDate(max.getDate() + maxDays);
  const wd = (d) => d.toLocaleDateString(loc, { weekday: "short" }).replace(".", "");
  const full = value ? parse(value).toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
  const openNative = () => { const el = inputRef.current; if (!el) return; try { el.showPicker(); } catch { el.focus(); el.click(); } };
  return (
    <div className="day-picker">
      <div className="day-row">
        {list.map((d) => {
          const v = iso(d);
          return (
            <button key={v} type="button" className={"day-chip" + (value === v ? " sel" : "")} aria-pressed={value === v}
              onClick={() => onChange(v)}>
              <span className="day-wd">{wd(d)}</span>
              <b>{d.getDate()}</b>
              <span className="day-mon">{d.toLocaleDateString(loc, { month: "short" }).replace(".", "")}</span>
            </button>
          );
        })}
        <span className="day-more">
          <button type="button" className="day-chip" onClick={openNative} aria-label={t("Anderes Datum")} title={t("Anderes Datum")}>
            <CalendarSearch size={20} />
          </button>
          <input ref={inputRef} type="date" tabIndex={-1} aria-hidden="true" value={value} min={iso(today)} max={iso(max)}
            onChange={(e) => e.target.value && onChange(e.target.value)} />
        </span>
      </div>
      {full && <div className="day-full">{full}</div>}
    </div>
  );
}
