import { ball, BALL_R } from "../ruleEngine.js";

/* Racks und Break-Bewegung, gemeinsam fuer die Anstoss-Faelle (cases/09, 12, 13).
   Racks stehen am Fusspunkt (160, 60). 8 Ball, 10 Ball, 14/1: die Spitze liegt AUF dem
   Fusspunkt. 9 Ball (Regel 5.2, seit 2026): die 9 in der Mitte der Raute liegt auf dem
   Fusspunkt, die Spitze (1) davor - die Raute ist also nach vorn verschoben. */
const X0 = 160, DX = 2 * BALL_R * 0.866, DY = BALL_R;
const W = [70, 60], HIT = [149, 60];
const r2 = (n) => Math.round(n * 100) / 100;

const R9 = [[1], [2, 3], [4, 9, 5], [6, 7], [8]];
const tipX = (rows) => (rows === R9 ? r2(X0 - 2 * DX) : X0);
/* Der Treffpunkt der Weissen an der Spitze des Racks. */
const hitOf = (rows) => [r2(tipX(rows) - 2 * BALL_R), 60];
/* shift verschiebt das ganze Rack in x (nur fuer fehlerhaft aufgebaute Racks). */
const rack = (rows, shift = 0) => rows.flatMap((row, r) => row.map((n, k) => ({ n, p: [r2(tipX(rows) + shift + r * DX), r2(60 + (k - (row.length - 1) / 2) * 2 * DY)] })));

/* Der Break: nur die Kugeln am RAND des Racks laufen los, und zwar radial vom
   Schwerpunkt weg - so kreuzen sich ihre Wege nie. Die Kugeln im Inneren und die
   Spitzenkugel bleiben liegen (bei einem echten Break verlassen die hinteren
   Kugeln das Rack ohnehin oft kaum). Wer eine Bande erreichen soll (rails), laeuft
   bis zur ersten Bande und bleibt dort (= Bandenkontakt); alle anderen laufen
   hoechstens 26 Einheiten und bleiben mindestens 6 vor der Bande. Kugeln direkt
   neben der Spitze drehen so ab, dass sie sich nicht auf sie zubewegen. */
const wallT = (p, d) => {
  const tx = d[0] > 0.001 ? (204.5 - p[0]) / d[0] : d[0] < -0.001 ? (15.5 - p[0]) / d[0] : Infinity;
  const ty = d[1] > 0.001 ? (104.5 - p[1]) / d[1] : d[1] < -0.001 ? (15.5 - p[1]) / d[1] : Infinity;
  return Math.min(tx, ty);
};
const brake = (rows, balls, rails) => {
  const cx = balls.reduce((a, b) => a + b.p[0], 0) / balls.length;
  const cy = balls.reduce((a, b) => a + b.p[1], 0) / balls.length;
  const rim = new Set();
  rows.forEach((row, r) => row.forEach((n, k) => { if (r > 0 && (k === 0 || k === row.length - 1 || r === rows.length - 1)) rim.add(n); }));
  const tip = [tipX(rows), 60];
  const moves = [{ id: "w", to: hitOf(rows), stop: true }];
  balls.filter((b) => rim.has(b.n)).forEach((b, i) => {
    let d = [b.p[0] - cx, b.p[1] - cy];
    let l = Math.hypot(...d);
    if (l < 1) return;
    d = [d[0] / l, d[1] / l];
    const v = [b.p[0] - tip[0], b.p[1] - tip[1]], vl = Math.hypot(...v) || 1, vh = [v[0] / vl, v[1] / vl];
    const dot = d[0] * vh[0] + d[1] * vh[1];
    if (dot < 0) { d = [d[0] - dot * vh[0], d[1] - dot * vh[1]]; l = Math.hypot(...d) || 1; d = [d[0] / l, d[1] / l]; }
    const wall = wallT(b.p, d);
    const t = rails.includes(b.n) ? wall : Math.max(0, Math.min(26, wall - 6));
    if (t < 1) return;
    moves.push({ id: String(b.n), to: [r2(b.p[0] + d[0] * t), r2(b.p[1] + d[1] * t)], after: "w", delay: (i % 5) * 10 });
  });
  return moves;
};


export const R15 = [[1], [9, 2], [3, 8, 10], [11, 4, 5, 12], [6, 13, 7, 14, 15]];
export const R10 = [[1], [2, 3], [4, 10, 5], [6, 7, 8, 9]];

/* Kugeln eines Racks als Szenen-Kugeln. */
export const rackBalls = (rows) => rack(rows).map((b) => ball(b.n, ...b.p));
export { R9, rack, brake, hitOf, X0, W, HIT };

/* 14/1: 14 Kugeln (1-14) im Dreieck, die Spitze am Fusspunkt bleibt fuer die 15. frei. */
export const R14 = [[null], [9, 2], [3, 8, 10], [11, 4, 5, 12], [6, 13, 7, 14, 1]];
export const rack14 = () => rack(R14).filter((b) => b.n != null);
/* Die 14 Kugeln als anfangs versteckte Szenen-Kugeln und die move-Liste, die sie hinlegt. */
export const hiddenRack14 = () => rack14().map((b) => ({ id: String(b.n), n: b.n, x: b.p[0], y: b.p[1], hidden: true }));
export const placeRack14 = () => rack14().map((b, i) => ({ id: String(b.n), to: b.p, place: true, delay: i * 25 }));
export const FOOT = [160, 60], HEAD = [60, 60], CENTER = [110, 60];
