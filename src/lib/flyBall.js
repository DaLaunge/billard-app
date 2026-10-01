import { getMatchFly } from "./uiPrefs";

/* Die Kugel eines Spielers "springt" bei der Auswahl aus der Spielerkachel in den
   freien Platz der Aufstellung (Neues Match) und beim Entfernen wieder zurueck
   (Nutzer-Wunsch 2026-10-01). Technik: FLIP mit der Web Animations API - der Platz
   fuellt sich sofort ganz normal, die Kugel wird nur ZUSAETZLICH visuell an den
   Startpunkt verschoben und gleitet von dort an ihren Platz. Der Endzustand ist
   also immer der echte; faellt die Animation aus (Einstellung aus, "Bewegung
   reduzieren", kein Platz im Bild), passiert schlicht nichts.

   Einstellung pro Geraet: uiPrefs.js (getMatchFly), Standard an. */
const DURATION = 440;
const LIFT = 26; // Bogen: der Weg steigt in der Mitte um so viele px nach oben

export function flyEnabled() {
  try {
    return getMatchFly()
      && typeof Element !== "undefined" && typeof Element.prototype.animate === "function"
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch { return false; }
}

const inView = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight
  && r.right > 0 && r.left < window.innerWidth;
const centerOf = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

// dx/dy = Startpunkt relativ zum Ziel (Mittelpunkte), s = Start-/Zielgroesse.
function frames(dx, dy, s, landing) {
  const t = (x, y, k) => `translate(${x}px, ${y}px) scale(${k})`;
  const ease = "cubic-bezier(.3, 0, .35, 1)";
  return [
    { transform: t(dx, dy, s), easing: ease, offset: 0 },
    { transform: t(dx / 2, dy / 2 - LIFT, (1 + s) / 2), easing: ease, offset: 0.45 },
    { transform: t(0, 0, landing), easing: "ease-out", offset: 0.82 },
    { transform: t(0, 0, 1), offset: 1 },
  ];
}

// Hinweg: "el" ist die Kugel im jetzt gefuellten Platz, "from" der Rahmen der
// Kugel auf der Kachel (vor dem Antippen gemessen).
export function flyIn(el, from) {
  if (!el || !from || !flyEnabled()) return;
  const to = el.getBoundingClientRect();
  if (!inView(from) || !inView(to)) return;
  const a = centerOf(from);
  const b = centerOf(to);
  // Die CSS-Einblendung der frisch gesetzten Kugel wuerde sonst mitlaufen.
  el.style.animation = "none";
  el.animate(frames(a.x - b.x, a.y - b.y, from.width / to.width, 1.12), { duration: DURATION, fill: "backwards" });
}

// Rueckweg: eine Kopie der Kugel im Platz fliegt zur Kachel; deren eigene Kugel
// bleibt bis zur Landung unsichtbar, damit sie nicht doppelt zu sehen ist.
// Gibt true zurueck, wenn der Flug gestartet wurde.
export function flyBack(slotBall, tileBall) {
  if (!slotBall || !tileBall || !flyEnabled()) return false;
  const from = slotBall.getBoundingClientRect();
  const to = tileBall.getBoundingClientRect();
  if (!inView(from) || !inView(to)) return false;
  const a = centerOf(from);
  const b = centerOf(to);
  const ghost = slotBall.cloneNode(true);
  Object.assign(ghost.style, {
    position: "fixed", left: `${from.left}px`, top: `${from.top}px`, margin: "0",
    width: `${from.width}px`, height: `${from.height}px`, zIndex: "60", pointerEvents: "none",
  });
  document.body.appendChild(ghost);
  const prev = tileBall.style.visibility;
  tileBall.style.visibility = "hidden";
  let done = false;
  const end = () => { if (done) return; done = true; ghost.remove(); tileBall.style.visibility = prev; };
  const s = to.width / from.width;
  const anim = ghost.animate([
    { transform: "translate(0px, 0px) scale(1)", easing: "cubic-bezier(.3, 0, .35, 1)", offset: 0 },
    { transform: `translate(${(b.x - a.x) / 2}px, ${(b.y - a.y) / 2 - LIFT}px) scale(${(1 + s) / 2})`, easing: "ease-out", offset: 0.55 },
    { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) scale(${s})`, offset: 1 },
  ], { duration: DURATION * 0.8, fill: "forwards" });
  anim.onfinish = end;
  anim.oncancel = end;
  // Sicherheitsnetz: pausiert der Browser die Animation (Tab im Hintergrund), soll die
  // Kachel-Kugel nicht unsichtbar bleiben.
  setTimeout(end, DURATION * 2);
  return true;
}
