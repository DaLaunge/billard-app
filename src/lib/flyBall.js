import { getMatchFly } from "./uiPrefs";

/* Die Kugel eines Spielers "springt" bei der Auswahl aus der Spielerkachel in den
   freien Platz der Aufstellung (Neues Match) und loest sich beim Entfernen auf
   (Nutzer-Wunsch 2026-10-01). Technik: FLIP mit der Web Animations API - der Platz
   fuellt sich sofort ganz normal, die Kugel wird nur ZUSAETZLICH visuell an den
   Startpunkt verschoben und gleitet von dort an ihren Platz. Der Endzustand ist
   also immer der echte; faellt die Animation aus (Einstellung aus, "Bewegung
   reduzieren", kein Platz im Bild), passiert schlicht nichts.

   Der Rueckweg ist bewusst KEIN Rueckflug mehr: beim Entfernen verschiebt sich die
   Liste (Hervorhebung, Scrollen), das Ziel auf der Kachel war dann schon beim Start
   veraltet und die Kugel huepfte neben die Kachel. Stattdessen schrumpft und
   verblasst sie an ihrem Platz - das hat kein Ziel, das wandern koennte.

   Einstellung pro Geraet: uiPrefs.js (getMatchFly), Standard an. */
const DURATION = 520;
const LIFT = 34;    // Bogen: der Weg steigt in der Mitte um so viele px nach oben
const POP = 0.14;   // die Kugel wird in der Mitte des Sprungs um diesen Anteil groesser
const STEPS = 28;   // Stuetzpunkte der Bahn - dicht genug fuer eine glatte Kurve

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
// Sanftes Anfahren und Abbremsen als EINE Kurve fuer den ganzen Weg. Fruehere
// Fassung: je Teilstueck eine eigene Easing-Kurve - an jedem Zwischenpunkt kam die
// Kugel fast zum Stehen und fuhr neu an, das sah nach Ruckeln aus.
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Bahn vom Start (dx/dy relativ zum Ziel) zum Ziel, s = Start-/Zielgroesse. Alle
// Stuetzpunkte laufen linear ineinander; das Easing steckt in den Werten selbst.
function path(dx, dy, s) {
  const out = [];
  for (let i = 0; i <= STEPS; i += 1) {
    const u = i / STEPS;          // Zeit
    const e = ease(u);            // Fortschritt
    const arc = Math.sin(Math.PI * e);
    const x = dx * (1 - e);
    const y = dy * (1 - e) - LIFT * arc;
    const k = s + (1 - s) * e + POP * arc;
    out.push({ transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${k.toFixed(4)})`, offset: u });
  }
  return out;
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
  el.style.willChange = "transform";
  const anim = el.animate(path(a.x - b.x, a.y - b.y, from.width / to.width), { duration: DURATION, easing: "linear", fill: "backwards" });
  anim.onfinish = () => { el.style.willChange = ""; };
}

// Entfernen: eine Kopie der Kugel schrumpft an ihrem Platz und verblasst, waehrend
// der Platz darunter schon leer ist. Gibt true zurueck, wenn sie startete.
export function vanishBall(slotBall) {
  if (!slotBall || !flyEnabled()) return false;
  const from = slotBall.getBoundingClientRect();
  if (!inView(from)) return false;
  const ghost = slotBall.cloneNode(true);
  Object.assign(ghost.style, {
    position: "fixed", left: `${from.left}px`, top: `${from.top}px`, margin: "0",
    width: `${from.width}px`, height: `${from.height}px`, zIndex: "60", pointerEvents: "none",
    willChange: "transform, opacity", animation: "none",
  });
  document.body.appendChild(ghost);
  let done = false;
  const end = () => { if (done) return; done = true; ghost.remove(); };
  const anim = ghost.animate([
    { transform: "scale(1)", opacity: 1, offset: 0 },
    { transform: "scale(1.08)", opacity: 0.9, offset: 0.25 },
    { transform: "scale(0.2)", opacity: 0, offset: 1 },
  ], { duration: 280, easing: "cubic-bezier(.4, 0, .6, 1)", fill: "forwards" });
  anim.onfinish = end;
  anim.oncancel = end;
  // Sicherheitsnetz: pausiert der Browser die Animation (Tab im Hintergrund), soll
  // die Kopie nicht stehen bleiben.
  setTimeout(end, 900);
  return true;
}
