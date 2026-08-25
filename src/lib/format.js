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
export const fmtAgo = (d) => {
  if (!d) return t("nie");
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (days <= 0) return t("heute");
  if (days === 1) return t("gestern");
  if (days === 2) return t("vorgestern");
  return t("vor {n} Tagen", { n: days });
};
export const isDoubles = (m) => !!m.player1b_id;
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
