/* Erinnerung "Planung wird aktuell -> live gehen?" (428.1). Pro Geraet in localStorage `planRemind`:
   - lead: Minuten VOR dem geplanten Zeitpunkt (0 = zur Startzeit), null = keine Erinnerung.
   - time: Standard-Uhrzeit fuer Planungen ohne eigene Uhrzeit ("HH:MM").
   Die Auswahl lehnt sich an die Outlook-Erinnerungen an (0/5/10/15/30 Min, 1/2/3/4/8/12 Std, 1/2 Tage, 1 Woche),
   dazu ein freies Feld (Zahl + Einheit). */
const KEY = "planRemind";
const SEEN_KEY = "planRemindSeen";
export const DEFAULT_REMIND = { lead: 15, time: "18:00" };

export const LEAD_OPTIONS = [0, 5, 10, 15, 30, 60, 120, 240, 480, 720, 1440, 2880, 10080];
export const MAX_LEAD = 60 * 24 * 60; // 60 Tage
export const LEAD_UNITS = [["min", 1], ["h", 60], ["d", 1440]];

const okTime = (s) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export function getPlanRemind() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (!v) return DEFAULT_REMIND;
    const lead = v.lead === null ? null : Number.isFinite(v.lead) && v.lead >= 0 && v.lead <= MAX_LEAD ? Math.round(v.lead) : DEFAULT_REMIND.lead;
    return { lead, time: okTime(v.time) ? v.time : DEFAULT_REMIND.time };
  } catch { return DEFAULT_REMIND; }
}
export function storePlanRemind(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

/* "15 Min", "2 Std", "1 Tag" ... als [Zahl, Einheit]; t() uebersetzt der Aufrufer */
export function splitLead(min) {
  if (min % 1440 === 0 && min > 0) return [min / 1440, "d"];
  if (min % 60 === 0 && min > 0) return [min / 60, "h"];
  return [min, "min"];
}

const seenMap = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || {}; } catch { return {}; } };
export const planSig = (p, time) => `${p.planned_date} ${time}`;
export function isPlanSeen(p, time) { return seenMap()[p.id] === planSig(p, time); }
export function markPlanSeen(p, time) {
  const m = seenMap();
  m[p.id] = planSig(p, time);
  // alte Eintraege wegraeumen: es bleiben nur die juengsten 40
  const keys = Object.keys(m);
  if (keys.length > 40) keys.slice(0, keys.length - 40).forEach((k) => delete m[k]);
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

/* Beginn der Planung als Date (lokale Zeit) */
export function planStart(p, time) {
  const [y, m, d] = String(p.planned_date).split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/* Faellig: ab (Start - Vorlauf) bis 3 Std nach dem Start - wer spaeter oeffnet, wird nicht mehr an Vergangenes erinnert */
export function isPlanDue(p, time, lead, now = new Date()) {
  if (lead == null) return false;
  const start = planStart(p, time);
  return now >= new Date(start.getTime() - lead * 60000) && now < new Date(start.getTime() + 3 * 3600000);
}
