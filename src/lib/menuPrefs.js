/* Menue-Einstellungen dieses Geraets: Reihenfolge der Menuepunkte im Hamburger-Menue und welche davon
   in der Leiste unten angeheftet sind (immer genau MAX_PINNED, links und rechts vom runden "+").
   Wie die uebrigen Geraete-Einstellungen (lib/uiPrefs.js) nur lokal gespeichert. */
export const MENU_IDS = ["stats", "turnier", "live", "profil", "achievements", "mystats", "invite", "clubs", "regeln", "tutorial", "settings", "admin"];
export const DEFAULT_PINNED = ["stats", "turnier", "live", "profil"];
export const MAX_PINNED = 4;
const KEY = "menuPrefs";

export function sanitizeMenuPrefs(raw) {
  const order = Array.isArray(raw?.order) ? raw.order.filter((id) => MENU_IDS.includes(id)) : [];
  MENU_IDS.forEach((id) => { if (!order.includes(id)) order.push(id); });
  let pinned = Array.isArray(raw?.pinned) ? raw.pinned.filter((id, i, a) => MENU_IDS.includes(id) && a.indexOf(id) === i) : DEFAULT_PINNED;
  pinned = pinned.slice(0, MAX_PINNED);
  // Die Leiste hat immer genau MAX_PINNED Plaetze: fehlende werden mit den Standard-Punkten, dann der Reihe nach aufgefuellt.
  [...DEFAULT_PINNED, ...order].forEach((id) => { if (pinned.length < MAX_PINNED && !pinned.includes(id) && id !== "admin") pinned.push(id); });
  return { order: [...new Set(order)], pinned };
}

export function loadMenuPrefs() {
  try { return sanitizeMenuPrefs(JSON.parse(localStorage.getItem(KEY) || "null")); } catch { return sanitizeMenuPrefs(null); }
}

export function storeMenuPrefs(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

/* Welche Menuepunkte eine Seite sind, die man als Startseite waehlen kann (Wert von players.start_tab = Seiten-Schluessel in App.jsx). */
export const START_TAB_OF = { stats: "stats", turnier: "turnier", live: "live", profil: "profil", achievements: "erfolge", mystats: "zahlen", invite: "invite", clubs: "clubs", regeln: "regeln" };
export const START_TABS = Object.values(START_TAB_OF);
/* Die angehefteten Punkte in der Reihenfolge der Leiste (wie in App.jsx pinnedEntries). */
export const pinnedOrder = (prefs) => prefs.order.filter((id) => prefs.pinned.includes(id));
