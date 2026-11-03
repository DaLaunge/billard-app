import { useState } from "react";
import { Calendar, Radio, BellRing } from "lucide-react";
import { t } from "../../lib/i18n";
import { getPlanRemind, storePlanRemind, LEAD_OPTIONS, LEAD_UNITS, splitLead } from "../../lib/planRemind";
import InfoButton from "./InfoButton";

/* Lesbare Vorlaufzeit: 0 -> "Zum Start", 15 -> "15 Min", 120 -> "2 Std", 1440 -> "1 Tag" */
export function leadLabel(min) {
  if (min === 0) return t("Zum Start");
  const [n, u] = splitLead(min);
  if (u === "d") return n === 7 ? t("1 Woche") : n === 1 ? t("1 Tag") : t("{n} Tage", { n });
  if (u === "h") return t("{n} Std", { n });
  return t("{n} Min", { n });
}
const label1w = 10080;

/* Kleine Animation: der Planungs-Knopf wird zum Live-Knopf (mit Glocke und Vorlaufzeit).
   Ruhezustand ohne Animation: beide Knoepfe nebeneinander mit Pfeil - es fehlt also nie Inhalt. */
function PlanLiveDemo({ lead }) {
  return (
    <div className="plr-demo" aria-hidden="true">
      <span className="plr-bell"><BellRing size={15} /><b>{lead == null ? "–" : lead === 0 ? "0" : `−${leadLabel(lead)}`}</b></span>
      <span className="plr-morph">
        <span className="plr-btn plan"><Calendar size={15} /> {t("Planung")}</span>
        <span className="plr-arrow">→</span>
        <span className="plr-btn live"><Radio size={15} /> {t("Live")}</span>
      </span>
    </div>
  );
}

/* Einstellung "Planung -> Live": wann die App fragt, ob aus einer Planung eine Live-Anzeige werden soll (Pro Geraet). */
export default function PlanRemindSetting() {
  const [v, setV] = useState(getPlanRemind);
  const [num, setNum] = useState("");
  const [unit, setUnit] = useState("min");
  const save = (next) => { setV(next); storePlanRemind(next); };
  const title = t("Erinnerung: Planung wird live");
  const custom = v.lead != null && !LEAD_OPTIONS.includes(v.lead);
  const applyCustom = (n, u) => {
    const x = Math.round(Number(n));
    if (!Number.isFinite(x) || x < 0) return;
    save({ ...v, lead: Math.min(x * LEAD_UNITS.find((q) => q[0] === u)[1], 60 * 24 * 60) });
  };
  return (
    <div className="plr-box">
      <div className="switch-row" style={{ marginBottom: 4 }}>
        <span className="settings-switch-label" style={{ flex: 1 }}>{title}</span>
        <InfoButton title={title}>
          {t("Wenn der Zeitpunkt einer deiner Planungen (oder einer, bei der du interessiert bist) näher rückt, fragt dich die App, ob daraus eine Live-Anzeige werden soll. Hier stellst du ein, wie lange vorher. Planungen ohne Uhrzeit gelten ab der Standard-Uhrzeit. Gilt nur auf diesem Gerät.")}
        </InfoButton>
      </div>
      <PlanLiveDemo lead={v.lead} />
      <div className="chips small plr-chips" role="group" aria-label={title}>
        <button type="button" className={"chip" + (v.lead == null ? " active" : "")} onClick={() => save({ ...v, lead: null })}>{t("Aus")}</button>
        {LEAD_OPTIONS.map((m) => (
          <button key={m} type="button" className={"chip" + (v.lead === m ? " active" : "")} onClick={() => save({ ...v, lead: m })}>{m === label1w ? t("1 Woche") : leadLabel(m)}</button>
        ))}
      </div>
      <div className="plr-custom">
        <span className="rank-meta">{t("Eigene Zeit")}</span>
        <input type="number" min="0" inputMode="numeric" placeholder={custom ? String(splitLead(v.lead)[0]) : "20"} value={num} aria-label={t("Eigene Zeit")}
          onChange={(e) => { setNum(e.target.value); if (e.target.value !== "") applyCustom(e.target.value, unit); }} />
        <select value={unit} aria-label={t("Einheit")} onChange={(e) => { setUnit(e.target.value); if (num !== "") applyCustom(num, e.target.value); }}>
          <option value="min">{t("Minuten")}</option>
          <option value="h">{t("Stunden")}</option>
          <option value="d">{t("Tage")}</option>
        </select>
        <span className="rank-meta">{t("vorher")}</span>
        {custom && <span className="plr-now">= {leadLabel(v.lead)}</span>}
      </div>
      <div className="plr-custom">
        <span className="rank-meta">{t("Planung ohne Uhrzeit gilt ab")}</span>
        <input type="time" value={v.time} aria-label={t("Standard-Uhrzeit")} onChange={(e) => e.target.value && save({ ...v, time: e.target.value })} />
      </div>
    </div>
  );
}
