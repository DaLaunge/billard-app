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
     sayIcon "mouth" = jemand SPRICHT/ruft an (Ansage, Foul, Schiedsrichter), "hand" = jemand/etwas
             greift ein (Stoerung von aussen); das Symbol steht links in der Blase
     focus   Kugel-ids, die einen Ring bekommen (z.B. "die niedrigste Kugel")
     aim     [[x,y], ...] gestrichelte Ziellinie (mehrere Punkte = Knick an der Bande)
     moves   [{id, to, via?, out?, delay?, after?, hitLeg?, place?}]
               from    Startpunkt, der von der Lage des vorigen Schritts abweicht
                       (Ball in Hand: die Weisse wird dort hingelegt und rollt dann)
               place   Kugel wird hingelegt statt gerollt (Neuaufbau des Racks, Ball in
                       Hand): sie blendet am Ziel ein. Ein Ball kann in `balls` mit
                       hidden: true beginnen (liegt noch nicht auf dem Tisch).
               via     Zwischenpunkte; ein Knick ohne Treffer ist eine Bande
               out     Kugel verschwindet am Ziel (Tasche, oder ausserhalb des
                       Tisches = vom Tisch gesprungen)
               delay   zusaetzliche Verzoegerung in ms
               after   startet im Treffmoment der Kugel mit dieser id
               hitLeg  an welchem Wegabschnitt-Ende diese Kugel trifft (Standard 0)
             Tempo und Dauer folgen aus der Physik (FRICTION), nicht aus Zeitangaben.
     figs    [{kind:"cue"|"hand"|"template"|"dot", at:[x,y], from?:[x,y], angle?:grad, until?:"hit"|dur ms, delay?}]
               Figur (Queue: at = Spitze; Hand: at = Handmitte, Finger zeigen in Blickrichtung angle).
               Sie gleitet von `from` nach `at`; until:"hit" = bis zum Treffmoment der Weissen
               (Schieben). Gehoert nicht zur Physik und wird von den Pruefungen nicht beachtet.
     stance  "ok"|"air"  Seitenansicht des Spielers (Fuesse am Boden, Regel 3.4) in einem Kasten ueber dem Tisch.
     shot    {n, of, who?}  Stossfolge: "Stoss n von of · who" als Chip ueber dem Tisch (nicht im SVG,
               verdeckt also nie eine Kugel). Jeder Schritt mit moves IST ein Stoss; die Zuege des
               Gegners dazwischen werden uebersprungen (die Weisse kommt per hand/from neu hin).
     count   {label, n, of}  Zaehler als Punkte (z.B. Fouls 2/3); bei n >= of rot.
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
export function posAt(m, time) {
  const starts = [];
  let acc = 0;
  m.times.forEach((tt) => { starts.push(acc); acc += tt; });
  if (time <= 0) return m.path[0];
  if (time >= m.dur) return m.path[m.path.length - 1];
  let i = m.legs.length - 1;
  while (i > 0 && time < starts[i]) i--;
  const tau = Math.max(0, time - starts[i]);
  const sDone = Math.min(m.legs[i], m.vs[i] * tau - FRICTION * tau * tau / 2);
  const f = m.legs[i] ? sDone / m.legs[i] : 1;
  return [m.path[i][0] + (m.path[i + 1][0] - m.path[i][0]) * f, m.path[i][1] + (m.path[i + 1][1] - m.path[i][1]) * f];
}

export function pathFrames(m, n = 24) {
  const starts = [];
  let acc = 0;
  m.times.forEach((tt) => { starts.push(acc); acc += tt; });
  const ts = new Set();
  for (let k = 0; k <= n; k++) ts.add((k / n) * m.dur);
  starts.slice(1).forEach((t0) => ts.add(t0));
  return [...ts].sort((a, b) => a - b).map((time) => ({ p: posAt(m, time), offset: Math.min(1, time / m.dur) }));
}

/* Zustand nach Schritt idx: Position und "in der Tasche" je Kugel. */
export function stateAt(scene, idx) {
  const pos = {}, out = {};
  scene.balls.forEach((b) => { pos[b.id] = [b.x, b.y]; if (b.hidden) out[b.id] = true; });
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
    if (m.place) {
      // Platzieren statt Rollen (Neuaufbau, Ball in Hand): die Kugel erscheint am Ziel (Einblenden im Player).
      return (info[m.id] = { path: [m.to, m.to], legs: [0], vs: [0], ve: [0], times: [350], hitLeg: 0, dur: 350, place: true });
    }
    const path = [m.from || fromPos[m.id], ...(m.via || []), m.to];
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

/* Uhr: ein Schritt kann `clock: {to: Sekunden}` tragen. Der Player zaehlt dann
   mit einer Uhr bis zu diesem Wert hoch, je Sekunde CLOCK_MS (kein Echtzeit-Warten:
   fuenf Sekunden dauern in der Animation gut zwei). Der Wert gilt bis zum naechsten
   Schritt mit eigener Uhr weiter. Bewegungen, die auf die Uhr warten sollen
   (Kugel faellt nach 5 s), bekommen `delay` = Sekunden * CLOCK_MS. */
export const CLOCK_MS = 450;
export const clockAt = (scene, idx) => {
  let v = 0;
  for (let i = 0; i <= idx; i++) if (scene.steps[i].clock) v = scene.steps[i].clock.to;
  return v;
};
export const hasClock = (scene) => scene.steps.some((s) => s.clock);

export const stepMs = (scene, idx) => {
  if (idx === 0) return 0;
  const tl = timeline(scene.steps[idx], stateAt(scene, idx - 1).pos);
  const mv = Math.max(0, ...Object.values(tl).map((m) => m.delay + m.dur));
  const clk = Math.max(0, clockAt(scene, idx) - clockAt(scene, idx - 1)) * CLOCK_MS;
  return Math.max(mv, clk);
};

/* Wohin mit der Sprechblase (step.say)? Sie darf keine Kugel verdecken: von vier
   Ecken im Tuch wird die mit dem groessten Abstand zu allen sichtbaren Kugeln
   gewaehlt (Stand vor und nach dem Schritt). clear = Abstand zur naechsten Kugel
   (Kugelrand), der Check verlangt mindestens 2. */
export function bubbleSpot(scene, idx, w, h = 11) {
  const balls = [];
  for (const i of [Math.max(0, idx - 1), idx]) {
    const st = stateAt(scene, i);
    for (const b of scene.balls) if (!st.out[b.id]) balls.push(st.pos[b.id]);
  }
  const cands = [[207 - w, 13], [13, 13], [207 - w, 107 - h], [13, 107 - h]];
  let best = cands[0], bestD = -Infinity;
  for (const [x, y] of cands) {
    let d = Infinity;
    for (const p of balls) {
      const dx = Math.max(x - p[0], 0, p[0] - (x + w)), dy = Math.max(y - p[1], 0, p[1] - (y + h));
      d = Math.min(d, Math.hypot(dx, dy) - BALL_R);
    }
    if (d > bestD + 0.01) { bestD = d; best = [x, y]; }
  }
  return { x: best[0], y: best[1], clear: bestD };
}
export const bubbleWidth = (text, icon) => String(text).length * 4.4 + 8 + (icon ? 10 : 0);

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

/* Naturlicher Stoss mit Winkel (Schnitt). Trifft die Weisse eine Kugel nicht
   voll, geht die Objektkugel entlang der MITTELPUNKTSLINIE weg (Richtung
   target -> objTo), die Weisse laeuft tangential weiter (90-Grad-Regel, ohne
   Effet): sie behaelt die Geschwindigkeitskomponente quer zur Mittelpunkts-
   linie, also v_Weisse = v_Treffer * sin(phi) = v_Objekt * tan(phi). Aus dem
   Weg der Objektkugel folgt damit auch, wie weit die Weisse weiterlaeuft:
   L = v_Objekt^2 * tan(phi)^2 / (2 * FRICTION). Bei vollem Treffer (phi ~ 0)
   bleibt sie stehen (Stoppball). Stoesst die Weisse unterwegs an eine Bande,
   wird sie dort mit CUSHION-Verlust reflektiert.
     from    Startpunkt der Weissen
     target  {id, at:[x,y]} getroffene Kugel
     objTo   Ziel der Objektkugel (legt die Mittelpunktslinie fest)
     opts    {out: Objektkugel faellt, delay: ms Verzoegerung der Weissen,
              striker: id der stossenden Kugel (Standard "w"; fuer Ketten wie 3 trifft 1),
              strikerAfter: deren `after`, hand: true = Ball in Hand (Weisse wird bei `from` hingelegt), bank: Bandenpunkt VOR dem Treffer (siehe bankPoint)}
   Liefert {contact, w, obj, rail}: die beiden moves, den Treffpunkt und, falls
   die Weisse nach dem Treffer an eine Bande laeuft, deren Punkt. */
const LO = 15.5, HI_X = 204.5, HI_Y = 104.5;
export function cut(from, target, objTo, opts = {}) {
  const n = unit(target.at, objTo);
  const g = 2 * BALL_R;
  const contact = [r2(target.at[0] - n[0] * g), r2(target.at[1] - n[1] * g)];
  const inc = unit(from, contact);
  const cos = Math.max(0.2, Math.min(1, inc[0] * n[0] + inc[1] * n[1]));
  const sin = Math.sqrt(1 - cos * cos);
  const ve = opts.out ? POCKET_V : 0;
  const vo2 = ve * ve + 2 * FRICTION * dist(target.at, objTo);
  const len = (vo2 * (sin / cos) ** 2) / (2 * FRICTION);
  const side = Math.sign(-n[1] * inc[0] + n[0] * inc[1]) || 1;
  let dir = [-n[1] * side, n[0] * side];
  const w = { id: opts.striker || "w", to: contact };
  if (opts.delay) w.delay = opts.delay;
  if (opts.strikerAfter) w.after = opts.strikerAfter;
  if (opts.hand) w.from = from; // Ball in Hand: die Weisse wird an `from` gelegt
  const wId = w.id;
  let rail = null;
  if (len >= 3) {
    // Weg der Weissen nach dem Treffer, mit hoechstens einer Bandenreflexion.
    const t = (p, d) => {
      const tx = d[0] > 0 ? (HI_X - p[0]) / d[0] : d[0] < 0 ? (LO - p[0]) / d[0] : Infinity;
      const ty = d[1] > 0 ? (HI_Y - p[1]) / d[1] : d[1] < 0 ? (LO - p[1]) / d[1] : Infinity;
      return Math.min(tx, ty);
    };
    const th = t(contact, dir);
    w.via = [contact];
    if (th >= len) w.to = [r2(contact[0] + dir[0] * len), r2(contact[1] + dir[1] * len)];
    else {
      const hit = [r2(contact[0] + dir[0] * th), r2(contact[1] + dir[1] * th)];
      rail = hit;
      const refl = Math.abs(dir[0] * th) > 0 && hit[0] <= LO + 0.01 || hit[0] >= HI_X - 0.01 ? [-dir[0], dir[1]] : [dir[0], -dir[1]];
      const rest = (len - th) * CUSHION * CUSHION;
      w.via = [contact, hit];
      const end = [hit[0] + refl[0] * rest, hit[1] + refl[1] * rest];
      w.to = [r2(Math.min(HI_X, Math.max(LO, end[0]))), r2(Math.min(HI_Y, Math.max(LO, end[1])))];
      // Die Reflexion ist nur beim Verlassen der Bande gueltig; eine zweite Bande wird abgeschnitten (clamp).
    }
  }
  if (opts.bank) {
    // Weisse prallt erst an die Bande (bank = Bandenpunkt) und trifft dann: Treffer am Ende von Abschnitt 1.
    w.via = [opts.bank, ...(w.via || [])];
    w.hitLeg = 1;
  }
  const obj = { id: target.id, to: objTo, after: wId };
  if (opts.out) obj.out = true;
  return { contact, w, obj, rail, phi: Math.acos(cos), cueLen: len };
}

/* Naturlichkeits-Check fuer Szenen (scripts/checkRules.mjs). Prueft fuer jeden
   Treffer, ob er physikalisch stimmt:
   1. Die Objektkugel muss entlang der Mittelpunktslinie (Treffpunkt -> ihr
      Mittelpunkt) weglaufen; weicht ihre Laufrichtung mehr als 6 Grad ab, sieht
      der Kontakt "falsch" aus.
   2. Trifft die Weisse unter Winkel und bleibt einfach stehen, obwohl sie
      tangential weiterlaufen muesste, ist das unnatuerlich.
   Beides loest cut() (siehe oben). Eine Kugel, die an der Bande liegt und von der Weissen in
   die Bande gedrueckt wird, prallt zurueck (rebound: true am move der Objektkugel) und laeuft
   dann nicht auf der Mittelpunktslinie. Ein Stoss kann mit `stop: true` am move der
   Weissen als bewusster Halt (z.B. Doppeltreffer) von der Pruefung ausgenommen
   werden. Liefert eine Liste von Fehlern {kind, ...}. */
export function contactErrors(step, fromPos) {
  const out = [];
  for (const m of step.moves || []) {
    const obj = (step.moves || []).find((o) => o.after === m.id);
    if (!obj || m.stop) continue;
    const hitLeg = m.hitLeg ?? 0;
    const path = [m.from || fromPos[m.id], ...(m.via || []), m.to];
    const a = path[hitLeg], c = path[hitLeg + 1];
    const nrm = unit(c, fromPos[obj.id]);
    const od = unit(fromPos[obj.id], (obj.via && obj.via[0]) || obj.to);
    const dev = (Math.acos(Math.max(-1, Math.min(1, nrm[0] * od[0] + nrm[1] * od[1]))) * 180) / Math.PI;
    if (dev > 6 && !obj.rebound) out.push({ kind: "objekt", id: obj.id, dev: Math.round(dev) });
    if (m.id === "w" && !(m.via && m.via.length) && hitLeg === 0) {
      const inc = unit(a, c);
      const cos = Math.max(0.2, Math.min(1, inc[0] * nrm[0] + inc[1] * nrm[1]));
      const ve = obj.out ? POCKET_V : 0;
      const vo2 = ve * ve + 2 * FRICTION * dist(fromPos[obj.id], obj.to);
      const need = (vo2 * (Math.sqrt(1 - cos * cos) / cos) ** 2) / (2 * FRICTION);
      if (need > 4) out.push({ kind: "weisse", need: Math.round(need), phi: Math.round((Math.acos(cos) * 180) / Math.PI) });
    }
  }
  return out;
}

/* Bandenpunkt fuer einen Stoss ueber eine Bande: die Weisse laeuft von `from`
   an die Bande `rail` ("top" | "bottom" | "left" | "right") und von dort so,
   dass sie `contact` erreicht (Spiegelungstrick, Einfallswinkel = Ausfallswinkel). */
export function bankPoint(from, contact, rail) {
  const wall = { top: ["y", LO], bottom: ["y", HI_Y], left: ["x", LO], right: ["x", HI_X] }[rail];
  if (wall[0] === "y") {
    const mc = [contact[0], 2 * wall[1] - contact[1]];
    const t = (wall[1] - from[1]) / (mc[1] - from[1]);
    return [r2(from[0] + (mc[0] - from[0]) * t), wall[1]];
  }
  const mc = [2 * wall[1] - contact[0], contact[1]];
  const t = (wall[1] - from[0]) / (mc[0] - from[0]);
  return [wall[1], r2(from[1] + (mc[1] - from[1]) * t)];
}

/* Wie cut(), aber der Schnitt wird als Winkel vorgegeben statt als Zielpunkt:
   die Objektkugel laeuft `len` weit in der Richtung, die um `deg` Grad (positiv =
   im Uhrzeigersinn auf dem Bildschirm) von der Linie Weisse -> Kugel abweicht.
   Praktisch, wenn der Ort der Weissen aus vorigen Stoessen folgt. */
export function cutAngle(from, target, deg, len, opts = {}) {
  const d = unit(from, target.at);
  const a = (deg * Math.PI) / 180;
  const dir = [d[0] * Math.cos(a) - d[1] * Math.sin(a), d[0] * Math.sin(a) + d[1] * Math.cos(a)];
  const objTo = [r2(target.at[0] + dir[0] * len), r2(target.at[1] + dir[1] * len)];
  return cut(from, target, objTo, opts);
}

/* Beruehrt nach dem Erstkontakt irgendeine Kugel (Weisse oder Objektkugel) eine Bande
   oder faellt in eine Tasche? Genau das fragt die Regel 3.3 - und genau das muss die
   Szene wirklich zeigen, wenn ihr Text "keine Bande" oder "laeuft an die Bande" sagt
   (step.expectRail). Gezaehlt wird nur ab dem Treffer: die Weisse vor dem Treffer
   (Stoss ueber die Bande) zaehlt nicht, der Startpunkt einer an der Bande liegenden
   Kugel auch nicht. Liefert null, wenn der Schritt keinen Treffer enthaelt. */
export function railAfterContact(step, fromPos) {
  const moves = step.moves || [];
  if (!moves.some((m) => m.after)) return null;
  const onWall = (p) => p[0] <= 16.1 || p[0] >= 203.9 || p[1] <= 16.1 || p[1] >= 103.9;
  const tl = timeline(step, fromPos);
  for (const m of moves) {
    const x = tl[m.id];
    if (!x) continue;
    if (x.out && m.id !== "w") return true; // eine versenkte Weisse (Scratch) erfuellt 3.3 nicht
    const striker = moves.some((o) => o.after === m.id);
    const first = striker ? x.hitLeg + 1 : 1; // erster Wegpunkt nach dem Treffer (Weisse) bzw. nach dem Start (Objektkugel)
    // Eine Kugel, die schon press an einer Bande lag, muss eine ANDERE Bande anlaufen (Regel 2.7, 3.37):
    // Punkte auf derselben Bande zaehlen nicht.
    const st = x.path[0];
    const sameWall = (p) => (st[0] <= 16.1 && p[0] <= 16.1) || (st[0] >= 203.9 && p[0] >= 203.9) || (st[1] <= 16.1 && p[1] <= 16.1) || (st[1] >= 103.9 && p[1] >= 103.9);
    for (let i = first; i < x.path.length; i++) if (onWall(x.path[i]) && !(m.id !== "w" && sameWall(x.path[i]))) return true;
  }
  return false;
}
