/* ============================================================
   HELFER
   ============================================================ */
import { t } from "./i18n";

export const BALL_PALETTE = ["#E8B321", "#2B5DA8", "#C0392B", "#6C4AB0", "#E07B2F", "#2E7D4F", "#8B3A2E", "#B0578D"];
export const hashColor = (name = "") => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return BALL_PALETTE[h % BALL_PALETTE.length];
};
export const initials = (name = "?") => {
  const parts = String(name).trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : String(name).slice(0, 2)).toUpperCase();
};
export const winProb = (ra, rb) => 1 / (1 + Math.pow(2, (rb - ra) / 100));
export const fmtDate = (d) => {
  if (!d) return "-";
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, "0")}.${String(x.getMonth() + 1).padStart(2, "0")}.${x.getFullYear()}`;
};
export const fmtDateTime = (d) => {
  if (!d) return "-";
  const x = new Date(d);
  const hh = String(x.getHours()).padStart(2, "0");
  const mm = String(x.getMinutes()).padStart(2, "0");
  return `${fmtDate(x)} ${hh}:${mm}`;
};
export const fmtTime = (ms) => {
  if (typeof ms !== "number") return "-";
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
// Dauer in ms als lesbaren Text ("1 Std 12 Min", "8 Min 34 Sek", "42 Sek").
export const fmtDuration = (ms) => {
  if (typeof ms !== "number" || !isFinite(ms) || ms < 0) return "–";
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return t("{h} Std {m} Min", { h, m });
  if (m > 0) return t("{m} Min {s} Sek", { m, s });
  return t("{s} Sek", { s });
};
export const fmtAgo = (d) => {
  if (!d) return t("nie");
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (days <= 0) return t("heute");
  if (days === 1) return t("gestern");
  if (days === 2) return t("vorgestern");
  return t("vor {n} Tagen", { n: days });
};
// Punkteverfall (rebuild_elo() in Postgres): ohne Match verfaellt ein Rating
// erst nach GRACE=30 Tagen Richtung 500. Muss exakt zu diesem Grace-Zeitraum
// in der SQL-Funktion passen, sonst zeigt die App den Verfall zu frueh/spaet
// an. Einzige Quelle fuer diese Schwellen - von IdentityCard und Rangliste
// gleichermassen genutzt, damit beide immer denselben Stand zeigen.
// WARN_DAYS: ab wie vielen Tagen VOR Ablauf der Frist schon (ruhig) gewarnt
// wird, damit ein Spieler noch reagieren kann, bevor tatsaechlich Punkte
// verloren gehen - nicht erst, wenn es schon passiert.
export const DECAY_GRACE_DAYS = 30;
export const DECAY_WARN_DAYS = 5;
// Unter dieser Spielanzahl gilt ein Rating als "vorlaeufig" (siehe
// "vorlaeufig"-Flag der rangliste-View bzw. den Footnote-Text auf der
// Uebersicht) - nur fuer die "noch X Spiele"-Anzeige hier gebraucht, das
// Flag selbst kommt fertig aus der DB.
export const PROVISIONAL_GAMES = 10;
// null = kein Hinweis noetig, "soon" = Frist laeuft bald ab (noch kein
// Verfall), "decaying" = Rating bewegt sich bereits aktiv Richtung 500.
// Wichtig: das ist KEIN reines Sinken - ein Rating UNTER 500 steigt beim
// Verfall (siehe playerBadgeStatus()/DecayBadge.jsx fuer die Richtung).
export const decayStatus = (letztePartie) => {
  if (!letztePartie) return null;
  const days = Math.floor((Date.now() - new Date(letztePartie)) / 86400000);
  if (days > DECAY_GRACE_DAYS) return "decaying";
  if (days > DECAY_GRACE_DAYS - DECAY_WARN_DAYS) return "soon";
  return null;
};
// Nur sinnvoll/aufgerufen im "soon"-Status - Resttage bis der Verfall beginnt.
export const decayDaysLeft = (letztePartie) => {
  const days = Math.floor((Date.now() - new Date(letztePartie)) / 86400000);
  return Math.max(0, DECAY_GRACE_DAYS - days);
};
// Ein einziger Hinweis-Status pro Spieler - Prioritaet nach Dringlichkeit,
// weil Karte/Rangliste nur einen Icon-Platz dafuer haben (siehe
// widgets/DecayBadge.jsx). "inactive" gewinnt vor "decaying"/"soon", obwohl
// 180 Tage Inaktivitaet praktisch immer auch schon aktiven Verfall bedeuten
// (180 > 30) - der eigentliche Grund (laengst kein Match mehr, aus der
// Standard-Rangliste ausgeblendet) ist die relevantere Info. "provisional"
// ist am wenigsten dringend (reine Kalibrierungs-Info) und kommt nur zum
// Zug, wenn sonst nichts zutrifft.
export const playerBadgeStatus = ({ aktiv, letzte_partie, vorlaeufig } = {}) => {
  if (aktiv === false) return "inactive";
  const decay = decayStatus(letzte_partie);
  if (decay) return decay;
  if (vorlaeufig) return "provisional";
  return null;
};
export const isDoubles = (m) => !!m.player1b_id;
// Wie mSide, aber als Namens-Array statt fertigem String - fuer Stellen, an
// denen jeder Name einzeln anklickbar sein soll (z. B. Letzte Matches).
export const sideNames = (m, s) => {
  const a = s === 1 ? m.p1?.nickname : m.p2?.nickname;
  const b = s === 1 ? m.p1b?.nickname : m.p2b?.nickname;
  return [a, b].filter(Boolean);
};
export const mSide = (m, s) => {
  const a = s === 1 ? m.p1?.nickname : m.p2?.nickname;
  const b = s === 1 ? m.p1b?.nickname : m.p2b?.nickname;
  return b ? `${a} & ${b}` : (a || "?");
};
export const timeAgo = (d) => {
  const m = Math.round((Date.now() - new Date(d)) / 60000);
  if (m < 1) return t("gerade eben");
  if (m < 60) return t("vor {n} Min", { n: m });
  return t("vor {n} Std", { n: Math.round(m / 60) });
};
export const timeLeft = (d) => {
  const m = Math.max(0, Math.round((new Date(d) - Date.now()) / 60000));
  if (m < 60) return t("noch {n} Min", { n: m });
  const h = Math.round(m / 60);
  if (h < 48) return t("noch ca. {n} Std", { n: h });
  return t("noch ca. {n} Tage", { n: Math.round(h / 24) });
};

/* Wahrgenommene Helligkeit einer Hex-Farbe (0 = dunkel, 1 = hell).
   Nach WCAG-Luminanz-Näherung. */
export function luminance(hex) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return 0.5;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
