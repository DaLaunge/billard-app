/* Menue-Einstellungen dieses Geraets: Reihenfolge der Menuepunkte im Hamburger-Menue und welche davon
   in der Leiste unten angeheftet sind (max. MAX_PINNED, links und rechts vom runden "+").
   Wie die uebrigen Geraete-Einstellungen (lib/uiPrefs.js) nur lokal gespeichert. */
export const MENU_IDS = ["stats", "turnier", "live", "profil", "achievements", "mystats", "invite", "regeln", "tutorial", "settings", "admin"];
export const DEFAULT_PINNED = ["stats", "turnier", "live", "profil"];
export const MAX_PINNED = 4;
const KEY = "menuPrefs";

export function sanitizeMenuPrefs(raw) {
  const order = Array.isArray(raw?.order) ? raw.order.filter((id) => MENU_IDS.includes(id)) : [];
  MENU_IDS.forEach((id) => { if (!order.includes(id)) order.push(id); });
  let pinned = Array.isArray(raw?.pinned) ? raw.pinned.filter((id, i, a) => MENU_IDS.includes(id) && a.indexOf(id) === i) : DEFAULT_PINNED;
  pinned = pinned.slice(0, MAX_PINNED);
  if (pinned.length === 0) pinned = DEFAULT_PINNED;
  return { order: [...new Set(order)], pinned };
}

export function loadMenuPrefs() {
  try { return sanitizeMenuPrefs(JSON.parse(localStorage.getItem(KEY) || "null")); } catch { return sanitizeMenuPrefs(null); }
}

export function storeMenuPrefs(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
