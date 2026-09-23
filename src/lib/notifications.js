import { supabase } from "../supabase";

/* Benachrichtigungen - drei Stufen, pro Geraet (wie die Browser-Erlaubnis):

   "off"   - gar nichts, auch nicht die "Du bist dran"-Popups.
   "inapp" - nur solange die App offen ist: die App fragt den Posteingang
             (Tabelle notifications) regelmaessig ab und zeigt Neues als
             Toast. Braucht keine Erlaubnis und kein Push-Abo. Standard.
   "push"  - zusaetzlich echte Push-Nachrichten, auch wenn die App zu ist.
             Braucht die Browser-Erlaubnis und ein Push-Abo, das in
             push_subscriptions liegt; verschickt wird serverseitig (siehe
             supabase/2026-09-23_push_notifications.sql + Edge Function
             send-push). Ist die App dabei offen, reicht der Service Worker
             die Nachricht als Toast an die App weiter (public/push-sw.js).

   Gespeichert wird nur ein "abweichend vom Standard", in localStorage wie
   keepScreenAwake (lib/wakeLock.js). */

const KEY = "notifyMode";
const MODES = ["off", "inapp", "push"];
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

export function getNotifyMode() {
  try {
    const v = localStorage.getItem(KEY);
    return MODES.includes(v) ? v : "inapp";
  } catch { return "inapp"; }
}

export function storeNotifyMode(mode) {
  try {
    if (mode === "inapp") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch { /* ignore */ }
}

export function isIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// "unsupported" | "ios-install" (iPhone, aber nicht vom Home-Bildschirm
// gestartet - dort gibt es Push erst nach der Installation) | "denied" |
// "ok"
export function pushAvailability() {
  if (isIos() && !isStandalone()) return "ios-install";
  if (!VAPID_PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return "ok";
}

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function saveSubscription(sub, lang) {
  const j = sub.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_lang: lang,
  });
  if (error) throw error;
}

// Muss direkt aus einem Klick heraus aufgerufen werden - iOS fragt die
// Erlaubnis sonst gar nicht erst ab. Wirft bei Ablehnung/Fehler.
export async function enablePush(lang) {
  const avail = pushAvailability();
  if (avail !== "ok") throw new Error(avail);
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("denied");
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  await saveSubscription(sub, lang);
}

// Abo beim Server UND im Browser loeschen - beim Abschalten und beim
// Abmelden (sonst bekaeme das Geraet weiter die Nachrichten des vorigen
// Nutzers).
export async function disablePush() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager?.getSubscription();
    if (!sub) return;
    await supabase.rpc("delete_push_subscription", { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  } catch { /* ignore */ }
}

// Beim Start / nach dem Anmelden / bei Sprachwechsel: das Abo dieses
// Geraets dem aktuell angemeldeten Spieler (und seiner Sprache) zuordnen.
// Liefert false, wenn Push hier nicht mehr geht (Erlaubnis entzogen) -
// dann faellt die App auf "inapp" zurueck.
export async function syncPush(lang) {
  if (pushAvailability() !== "ok" || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription())
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    await saveSubscription(sub, lang);
    return true;
  } catch { return false; }
}

// Ziele, die eine Benachrichtigung ansteuern darf - alles andere (auch
// manipulierte ?nav=-Links) wird ignoriert.
const NAV_TABS = ["stats", "live", "profil", "turnier", "turnierdetail", "winnerstays"];
export function safeNav(nav) {
  if (!nav || typeof nav !== "object" || !NAV_TABS.includes(nav.tab)) return null;
  const out = { tab: nav.tab };
  if (typeof nav.tournamentId === "string") out.tournamentId = nav.tournamentId;
  if (typeof nav.winnerStaysId === "string") out.winnerStaysId = nav.winnerStaysId;
  if (out.tab === "turnierdetail" && !out.tournamentId) return null;
  if (out.tab === "winnerstays" && !out.winnerStaysId) return null;
  return out;
}

// ?nav=... aus einem Klick auf eine Push-Nachricht bei geschlossener App.
export function readUrlNav() {
  try {
    const raw = new URLSearchParams(window.location.search).get("nav");
    return raw ? safeNav(JSON.parse(raw)) : null;
  } catch { return null; }
}

// Fuer diese Arten gibt es eigene, ausfuehrlichere Popups in App.jsx
// ("Du bist dran!") - dort kein zusaetzlicher Toast.
export const POPUP_KINDS = new Set(["tourney_ready", "ws_ready"]);
