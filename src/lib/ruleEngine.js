/* Regelkunde-Engine: zeichnet nichts und kennt keine Regeln - sie beschreibt nur,
   wie sich Kugeln bewegen. Die Faelle selbst liegen als eigene Dateien in
   src/lib/rules/cases/ (siehe rules/index.js), der Player ist
   components/widgets/RuleScene.jsx.

   Koordinaten: Spielflaeche x 10..210, y 10..110 (Tisch 2:1), Kugelradius
   BALL_R, also Kugelmittelpunkte zwischen 15.5 und 204.5 bzw. 104.5 (an der
   Bande). Taschen: POCKETS. Ein Schritt (steps[i]) ist, was der Nutzer mit
   "Weiter" ausloest; steps[0] ist immer die Ausgangslage (keine moves).

   Schritt-Felder:
     text    Untertitel (Deutsch, wird im Player durch t() uebersetzt)
     say     kurzes Sprechblasen-Etikett im Bild (z.B. "Push Out")
     focus   Kugel-ids, die einen Ring bekommen (z.B. "die niedrigste Kugel")
     aim     [[x,y], ...] gestrichelte Ziellinie (mehrere Punkte = Knick an der Bande)
     moves   [{id, to, via?, out?, delay?, after?, hitLeg?}]
               via     Zwischenpunkte; ein Knick ohne Treffer ist eine Bande
               out     Kugel verschwindet am Ziel (Tasche, oder ausserhalb des
                       Tisches = vom Tisch gesprungen)
               delay   zusaetzliche Verzoegerung in ms
               after   startet im Treffmoment der Kugel mit dieser id
               hitLeg  an welchem Wegabschnitt-Ende diese Kugel trifft (Standard 0)
             Tempo und Dauer folgen aus der Physik (FRICTION), nicht aus Zeitangaben.
     mark    {at:[x,y], kind:"foul"|"ok", after?, afterEnd?, delay?}
               Siegel am Ort; after = im Treffmoment dieser Kugel, afterEnd = wenn
               ihre Bewegung endet, delay = zusaetzliche ms.
   Das Urteil der Variante (verdict) zeigt der Player erst im letzten Schritt. */

export const BALL_R = 5.5;
export const POCKETS = [[10, 10], [110, 8], [210, 10], [10, 110], [110, 112], [210, 110]];

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const unit = (a, b) => { const d = dist(a, b) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; };

/* Physik in Kurzform. Alle Kugeln haben dieselbe Rollreibung: gleichmaessige
   Verzoegerung FRICTION (px/ms^2). Eine Kugel mit Anfangstempo v laeuft also
   v^2 / (2*FRICTION) weit - und umgekehrt: aus der Strecke, die eine Kugel
   laufen soll, folgt ihr Anfangstempo.
   - Eine gestossene Kugel startet mit dem Tempo, das ihre Strecke verlangt.
   - Die stossende Kugel muss im Treffmoment genau so schnell sein, dass die
     getroffene dieses Tempo bekommt: v_Treffer = v_Ziel / cos(Schnittwinkel)
     (nur die Komponente entlang der Mittelpunktslinie wird uebertragen;
     voller Treffer: cos = 1, gleiche Masse = gleiches Tempo).
   - Hat die stossende Kugel nur einen Abschnitt, bleibt sie am Treffpunkt
     stehen (Stoppball); mit Zwischenpunkt (via) laeuft sie danach mit dem
     Tempo weiter, das ihre restliche Strecke verlangt (Nachlauf/Rueckläufer).
   - Kugeln, die in die Tasche fallen, haben dort noch POCKET_V.
   - Ein Knick ohne Treffer ist eine Bande: danach 85 % des Tempos. */
const FRICTION = 0.0003;
const POCKET_V = 0.05;
const CUSHION = 0.85;

/* Keyframes einer Bewegung: gleichmaessig verteilte Zeitpunkte plus exakt die
   Eckpunkte, Position aus der Bremskurve je Abschnitt. Der Player spielt sie
   mit easing "linear" ab - ein Easing je Abschnitt liesse die Kugel an jedem
   Knick fast stehen bleiben (siehe lib/flyBall.js). */
export function pathFrames(m, n = 24) {
  const starts = [];
  let acc = 0;
  m.times.forEach((tt) => { starts.push(acc); acc += tt; });
  const at = (time) => {
    let i = m.legs.length - 1;
    while (i > 0 && time < starts[i]) i--;
    const tau = Math.max(0, time - starts[i]);
    const sDone = Math.min(m.legs[i], m.vs[i] * tau - FRICTION * tau * tau / 2);
    const f = m.legs[i] ? sDone / m.legs[i] : 1;
    return [m.path[i][0] + (m.path[i + 1][0] - m.path[i][0]) * f, m.path[i][1] + (m.path[i + 1][1] - m.path[i][1]) * f];
  };
  const ts = new Set();
  for (let k = 0; k <= n; k++) ts.add((k / n) * m.dur);
  starts.slice(1).forEach((t0) => ts.add(t0));
  return [...ts].sort((a, b) => a - b).map((time) => ({ p: at(time), offset: Math.min(1, time / m.dur) }));
}

/* Zustand nach Schritt idx: Position und "in der Tasche" je Kugel. */
export function stateAt(scene, idx) {
  const pos = {}, out = {};
  scene.balls.forEach((b) => { pos[b.id] = [b.x, b.y]; });
  for (let i = 1; i <= idx; i++) {
    for (const m of scene.steps[i].moves || []) {
      pos[m.id] = m.to;
      out[m.id] = !!m.out;
    }
  }
  return { pos, out };
}

/* Zeitplan eines Schritts aus der Ausgangsposition: je Kugel Weg, Tempo je
   Abschnitt, Start, Dauer und Ende des ersten Abschnitts (= Treffmoment). Der
   Player animiert danach, die automatische Wiedergabe weiss, wie lange sie
   warten muss. */
export function timeline(step, fromPos) {
  const moves = step.moves || [];
  const info = {};
  const speeds = (m) => {
    if (info[m.id]) return info[m.id];
    const path = [fromPos[m.id], ...(m.via || []), m.to];
    const legs = path.slice(1).map((p, i) => dist(path[i], p));
    const last = legs.length - 1;
    // Tempo im Treffmoment, wenn diese Kugel eine andere anstoesst. Der Treffer
    // liegt am Ende des Abschnitts hitLeg (Standard 0 = erster Abschnitt; mit
    // hitLeg: 1 prallt die Kugel erst an eine Bande und trifft dann).
    const hitLeg = m.hitLeg ?? 0;
    const obj = moves.find((o) => o.after === m.id);
    let hit = null;
    if (obj) {
      const d1 = unit(path[hitLeg], path[hitLeg + 1]), nrm = unit(path[hitLeg + 1], fromPos[obj.id]);
      const cos = Math.min(1, Math.max(0.25, d1[0] * nrm[0] + d1[1] * nrm[1]));
      hit = speeds(obj).vs[0] / cos;
    }
    const vs = [], ve = [];
    ve[last] = hit != null && last === hitLeg ? hit : (m.out ? POCKET_V : 0);
    for (let i = last; i >= 0; i--) {
      vs[i] = Math.sqrt(ve[i] * ve[i] + 2 * FRICTION * legs[i]);
      if (i > 0) ve[i - 1] = i - 1 === hitLeg && hit != null ? hit : vs[i] / CUSHION;
    }
    const times = legs.map((_, i) => (vs[i] - ve[i]) / FRICTION);
    return (info[m.id] = { path, legs, vs, ve, times, hitLeg, dur: times.reduce((a, b) => a + b, 0) });
  };
  const tl = {};
  for (const m of moves) {
    const sp = speeds(m);
    const delay = (m.delay || 0) + (m.after && tl[m.after] ? tl[m.after].firstEnd : 0);
    const toHit = sp.times.slice(0, sp.hitLeg + 1).reduce((a, b) => a + b, 0);
    tl[m.id] = { ...sp, delay, out: !!m.out, firstEnd: delay + toHit };
  }
  return tl;
}

export const stepMs = (scene, idx) => {
  if (idx === 0) return 0;
  const tl = timeline(scene.steps[idx], stateAt(scene, idx - 1).pos);
  return Math.max(0, ...Object.values(tl).map((m) => m.delay + m.dur));
};


/* ---- Zeichenhilfen fuer die Faelle --------------------------------------- */
const hypot = Math.hypot;
const r2 = (n) => Math.round(n * 100) / 100;
/** Kugelmittelpunkt, an dem eine von `from` kommende Kugel die Kugel bei `target` gerade beruehrt. */
export const touch = (from, target) => {
  const d = hypot(target[0] - from[0], target[1] - from[1]) || 1;
  const g = 2 * BALL_R;
  return [r2(target[0] - ((target[0] - from[0]) / d) * g), r2(target[1] - ((target[1] - from[1]) / d) * g)];
};
/** Punkt im Abstand `len` von `from` in Richtung `to` (Verlaengerung einer Linie). */
export const along = (from, to, len) => {
  const d = hypot(to[0] - from[0], to[1] - from[1]) || 1;
  return [r2(from[0] + ((to[0] - from[0]) / d) * len), r2(from[1] + ((to[1] - from[1]) / d) * len)];
};
/** Begrenzt einen Kugelmittelpunkt auf den Tisch (an der Bande = Bandenberuehrung). */
export const clampTable = (p) => [Math.min(204.5, Math.max(15.5, p[0])), Math.min(104.5, Math.max(15.5, p[1]))].map(r2);
export const ball = (n, x, y) => ({ id: n === 0 ? "w" : String(n), n, x, y });
export const cue = (x, y) => ball(0, x, y);
