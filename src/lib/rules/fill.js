import { ball, stateAt, timeline, pathFrames, bubbleSpot, bubbleWidth } from "../ruleEngine.js";

/* Realismus: in einem echten Spiel liegt die 8 (beim 8 Ball ohnehin, aber auch beim 9/10 Ball, 14/1) noch auf dem
   Tisch, solange nicht gerade die 8 selbst das Thema ist (Nutzer-Feedback 2026-10-08: "Am Tisch liegt aber keine 8").
   Statt in 28 Faellen von Hand eine Kugel zu ergaenzen, setzt diese Funktion in jede Variante OHNE Kugel 8 eine
   dazu - an die freieste Stelle des Tisches, also moeglichst weit weg von allen Kugellagen UND allen Laufwegen
   der Szene (damit nichts durcheinanderlaeuft). Reine Funktion der Falldaten, node-tauglich (auch fuer
   scripts/checkRules.mjs); mehrfaches Aufrufen aendert nichts. Faelle, in denen die 8 gar nicht mitspielen soll,
   setzen `noEight: true` an der Variante. */
const CANDIDATES = [];
for (let x = 22; x <= 198; x += 10) for (let y = 22; y <= 98; y += 10) CANDIDATES.push([x, y]);

const pointsOf = (v) => {
  const pts = [];
  v.steps.forEach((_, i) => {
    const st = stateAt(v, i);
    Object.values(st.pos).forEach((p) => pts.push(p));
    if (i > 0) {
      const tl = timeline(v.steps[i], stateAt(v, i - 1).pos);
      Object.values(tl).forEach((m) => { if (m.path && !m.place) pathFrames(m, 30).forEach((f) => pts.push(f.p)); });
    }
  });
  return pts;
};

export function ensureEights(c) {
  const sets = c.sets || [{ variants: c.variants }];
  for (const s of sets) {
    for (const v of s.variants || []) {
      if (v.noEight || v.balls.some((b) => String(b.id) === "8")) continue;
      const pts = pointsOf(v);
      // Kandidaten nach Abstand zu allen Lagen/Wegen, die freieste zuerst; die erste, die auch die Sprechblasen
      // frei laesst (gleiche Pruefung wie im Skript), gewinnt.
      const ranked = CANDIDATES.map((cand) => ({ cand, d: Math.min(...pts.map((p) => Math.hypot(p[0] - cand[0], p[1] - cand[1]))) }))
        .sort((a, b) => b.d - a.d);
      let best = null;
      for (const { cand } of ranked.slice(0, 80)) {
        const test = { ...v, balls: [...v.balls, ball(8, ...cand)] };
        const ok = v.steps.every((st, i) => !st.say || bubbleSpot(test, i, bubbleWidth(st.say, st.sayIcon)).clear >= 2);
        if (ok) { best = cand; break; }
      }
      if (!best) best = ranked[0].cand;
      if (best) v.balls.push(ball(8, ...best));
    }
  }
  return c;
}
