import { useState } from "react";
import { Calendar, Radio, BellRing } from "lucide-react";
import { t } from "../../lib/i18n";
import { getPlanRemind, storePlanRemind, LEAD_OPTIONS, LEAD_UNITS, MAX_LEAD, splitLead } from "../../lib/planRemind";
import InfoButton from "./InfoButton";

/* Lesbare Vorlaufzeit: 0 -> "Zum Start", 15 -> "15 Min", 120 -> "2 Std", 1440 -> "1 Tag" */
export function leadLabel(min) {
  if (min === 0) return t("Zum Start");
  const [n, u] = splitLead(min);
  if (u === "d") return n === 7 ? t("1 Woche") : n === 1 ? t("1 Tag") : t("{n} Tage", { n });
  if (u === "h") return t("{n} Std", { n });
  return t("{n} Min", { n });
}

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

/* Einstellung "Planung -> Live": wann die App fragt, ob aus einer Planung eine Live-Anzeige werden soll (pro Geraet).
   Wie der Ping-Radius: ein Schieberegler ueber die Outlook-Stufen (Aus, Zum Start, 5 Min ... 1 Woche) und rechts daneben ein Feld
   fuer eine eigene Zeit ("20", "20 min", "2 std", "1 tag"). */
const STOPS = [null, ...LEAD_OPTIONS]; // Reglerstellung 0 = Aus
const UNIT_TXT = { min: "min", h: "h", d: "d" };
const nearestStop = (lead) => {
  if (lead == null) return 0;
  let best = 1;
  LEAD_OPTIONS.forEach((m, i) => { if (Math.abs(m - lead) < Math.abs(LEAD_OPTIONS[best - 1] - lead)) best = i + 1; });
  return best;
};

export default function PlanRemindSetting() {
  const [v, setV] = useState(getPlanRemind);
  const [unit, setUnit] = useState(() => (v.lead ? splitLead(v.lead)[1] : "min"));
  const shown = (lead) => (lead == null ? "" : String(lead ? splitLead(lead)[0] : 0));
  const [txt, setTxt] = useState(() => shown(v.lead));
  const save = (next) => { setV(next); storePlanRemind(next); };
  const title = t("Erinnerung: Planung wird live");
  const apply = (lead, fromInput) => {
    save({ ...v, lead });
    if (!fromInput) { setTxt(shown(lead)); setUnit(lead ? splitLead(lead)[1] : "min"); }
  };
  const onInput = (e) => {
    const raw = e.target.value;
    setTxt(raw);
    const m = raw.trim().toLowerCase().match(/^(\d+)\s*(m|min|h|std|d|t|tag|tage)?$/);
    if (!m) return;
    const u = !m[2] ? unit : m[2][0] === "m" ? "min" : m[2][0] === "h" || m[2][0] === "s" ? "h" : "d";
    if (m[2]) setUnit(u);
    const lead = Number(m[1]) * LEAD_UNITS.find((q) => q[0] === u)[1];
    if (lead <= MAX_LEAD) save({ ...v, lead });
  };
  return (
    <div className="plr-box">
      <div className="switch-row" style={{ marginBottom: 4 }}>
        <span className="settings-switch-label" style={{ flex: 1 }}>{title}</span>
        <InfoButton title={title}>
          {t("Wenn der Zeitpunkt einer deiner Planungen (oder einer, bei der du interessiert bist) näher rückt, fragt dich die App, ob daraus eine Live-Anzeige werden soll. Der Regler reicht von „Aus“ bis eine Woche vorher, im Feld daneben kannst du eine eigene Zeit eingeben. Gilt nur auf diesem Gerät.")}
        </InfoButton>
      </div>
      <PlanLiveDemo lead={v.lead} />
      <div className="ping-radius-row">
        <input type="range" className="ping-slider" min={0} max={STOPS.length - 1} step={1} value={nearestStop(v.lead)}
          onChange={(e) => apply(STOPS[Number(e.target.value)])} aria-label={title} aria-valuetext={v.lead == null ? t("Aus") : leadLabel(v.lead)} />
        <label className="ping-km-field">
          <input type="text" inputMode="numeric" value={txt} placeholder="–" onChange={onInput}
            onBlur={() => { setTxt(shown(v.lead)); if (v.lead != null) setUnit(v.lead ? splitLead(v.lead)[1] : "min"); }} aria-label={t("Eigene Zeit")} />
          <span>{UNIT_TXT[unit]}</span>
        </label>
      </div>
      <div className="ping-radius-scale"><span>{t("Aus")}</span><b>{v.lead == null ? t("Aus") : leadLabel(v.lead)}</b><span>{t("1 Woche")}</span></div>
    </div>
  );
}
