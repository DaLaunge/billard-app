import { getLang } from "./i18n";

/* Zeitpunkt eines Turniers (planned_at, timestamptz): Eingabe als Datum + Uhrzeit (lokal), Anzeige kurz ("Fr 19:00", in fernerer Zukunft/Vergangenheit
   mit Datum). Alles lokal in der Zeitzone des Geraets - der Server speichert nur den Zeitpunkt. */
const pad = (n) => String(n).padStart(2, "0");

export const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Vorgabe fuer ein neues Turnier: heute 18:00, ist das schon vorbei, morgen 18:00 (wie bei der Planung).
export function defaultPlanned(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return { date: toDateInput(d), time: toTimeInput(d) };
}

// "2026-11-07" + "19:00" -> ISO-String (oder null, wenn eines fehlt/ungueltig)
export function plannedToIso(date, time) {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isoToParts(iso) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? { date: "", time: "" } : { date: toDateInput(d), time: toTimeInput(d) };
}

// Kurzanzeige: innerhalb von 6 Tagen "Fr 19:00", sonst "Fr 07.11. 19:00"
export function fmtPlanned(iso, now = new Date()) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const loc = getLang() === "en" ? "en-US" : "de-AT";
  const wd = d.toLocaleDateString(loc, { weekday: "short" }).replace(".", "");
  const time = toTimeInput(d);
  const days = Math.abs(d.getTime() - now.getTime()) / 86400000;
  if (days < 6) return `${wd} ${time}`;
  return `${wd} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${time}`;
}
