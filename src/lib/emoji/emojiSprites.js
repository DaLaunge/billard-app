/* Laedt die Emoji-Vektorgrafiken (siehe scripts/buildEmojiSprite.mjs) erst, wenn das erste Emoji angezeigt wird, und
   merkt sie sich fuer die ganze App. Zwei Teile: KERN (Code, Erfolge) und HAEUFIG (nur fuer Nutzertexte, wird nur
   geladen, wenn ein Emoji nicht im Kern steckt). Fehlt etwas oder schlaegt das Laden fehl (offline, nie geladen), zeigt
   die App das normale Emoji des Geraets - es kann also nie ein leeres Feld entstehen. */
let core = null, common = null;
let coreState = "idle", commonState = "idle"; // idle | loading | ready | failed
const subs = new Set();
const notify = () => subs.forEach((f) => f());

export function loadCore() {
  if (coreState !== "idle") return;
  coreState = "loading";
  import("./sprite.js").then((m) => { core = m.default; coreState = "ready"; }).catch(() => { coreState = "failed"; }).then(notify);
}
function loadCommon() {
  if (commonState !== "idle") return;
  commonState = "loading";
  import("./spriteCommon.js").then((m) => { common = m.default; commonState = "ready"; }).catch(() => { commonState = "failed"; }).then(notify);
}

/* { markup, pending }: markup = SVG-Inhalt oder null; pending = es kann noch kommen (nicht anzeigen, aber auch nicht aufgeben). */
export function lookup(key) {
  if (coreState === "idle") loadCore();
  if (core && core[key]) return { markup: core[key], pending: false };
  if (coreState === "loading" || coreState === "idle") return { markup: null, pending: true };
  if (common && common[key]) return { markup: common[key], pending: false };
  if (commonState === "idle") loadCommon();
  return { markup: null, pending: commonState === "idle" || commonState === "loading" };
}
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
