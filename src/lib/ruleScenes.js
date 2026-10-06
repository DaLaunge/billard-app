/* Regelkunde-Animationen (Prototyp, nur in der Verwaltung sichtbar).

   Eine Szene ist ein paar hundert Byte Daten, KEIN Video/GIF: der Player
   (widgets/RuleScene.jsx) zeichnet daraus einen SVG-Tisch und bewegt die
   Kugeln mit der Web Animations API (nur transform/opacity, keine JS-Schleife).
   Neue Streitfrage = ein neuer Eintrag in RULE_CASES, kein weiterer Code.

   Koordinaten: Spielflaeche x 10..210, y 10..110 (Tisch 2:1), Kugelradius
   BALL_R. Taschen: siehe POCKETS. Ein Schritt (steps[i]) ist, was der Nutzer
   mit "Weiter" auslost; steps[0] ist immer die Ausgangslage (keine moves).

   Schritt-Felder:
     text    Untertitel (Deutsch, wird im Player durch t() uebersetzt)
     focus   Kugel-ids, die einen Ring bekommen (z.B. "die niedrigste Kugel")
     aim     [[x1,y1],[x2,y2]] gestrichelte Ziellinie (ohne Bewegung)
     moves   [{id, to, via?, out?, dur?, delay?, after?}]
               via    Zwischenpunkte (Weisse trifft, laeuft dann weiter)
               out    Kugel faellt in die Tasche und verschwindet
               dur    ms; ohne Angabe aus der Weglaenge (konstante Geschwindigkeit)
               delay  zusaetzliche Verzoegerung in ms
               after  startet, wenn die Kugel mit dieser id ihren ERSTEN
                      Wegabschnitt beendet hat (= der Treffmoment)
     mark    {at:[x,y], kind:"foul"|"ok", after?}  Siegel am Treffpunkt
   Das Urteil der Variante (verdict) zeigt der Player erst im letzten Schritt,
   damit man vorher selbst raten kann.

   released: false = nur Verwaltung. Spaeter entscheidet dieses Flag (oder eine
   Tabelle), welche Faelle alle Nutzer sehen. */

export const BALL_R = 5.5;
export const POCKETS = [[10, 10], [110, 8], [210, 10], [10, 110], [110, 112], [210, 110]];
const SPEED = 0.14; // px pro ms

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

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

/* Zeitplan eines Schritts aus der Ausgangsposition: je Kugel Weg, Start,
   Dauer und Ende des ersten Abschnitts. Der Player animiert danach, und die
   automatische Wiedergabe weiss, wie lange sie warten muss. */
export function timeline(step, fromPos) {
  const tl = {};
  for (const m of step.moves || []) {
    const path = [fromPos[m.id], ...(m.via || []), m.to];
    const legs = path.slice(1).map((p, i) => dist(path[i], p));
    const total = legs.reduce((a, b) => a + b, 0) || 1;
    const dur = m.dur ?? Math.max(350, total / SPEED);
    const delay = (m.delay || 0) + (m.after && tl[m.after] ? tl[m.after].firstEnd : 0);
    tl[m.id] = { path, legs, total, dur, delay, out: !!m.out, firstEnd: delay + dur * (legs[0] / total) };
  }
  return tl;
}

export const stepMs = (scene, idx) => {
  if (idx === 0) return 0;
  const tl = timeline(scene.steps[idx], stateAt(scene, idx - 1).pos);
  return Math.max(0, ...Object.values(tl).map((m) => m.delay + m.dur));
};

/* ---- Faelle ------------------------------------------------------------
   Jeder Fall hat zwei Varianten mit kleinem Unterschied (Foul / kein Foul),
   die nebeneinander laufen. */

const w = (x, y) => ({ id: "w", n: 0, x, y });
const b = (n, x, y) => ({ id: String(n), n, x, y });

export const RULE_CASES = [
  {
    id: "erste-beruehrung",
    released: false,
    disc: "9 Ball",
    title: "Erste Berührung",
    rule: "Beim 9-Ball muss die Weiße zuerst die Kugel mit der niedrigsten Nummer berühren, die noch auf dem Tisch liegt. Berührt sie zuerst eine andere, ist es ein Foul – auch wenn danach die richtige Kugel getroffen oder eine Kugel versenkt wird. Danach muss eine Kugel versenkt werden oder eine Kugel die Bande berühren.",
    variants: [
      {
        label: "Fall A", verdict: "foul",
        reason: "Die 3 wurde vor der 1 berührt.",
        balls: [w(60, 60), b(1, 130, 45), b(3, 125, 80), b(2, 165, 62)],
        steps: [
          { text: "Ausgangslage: Die 1 ist die niedrigste Kugel auf dem Tisch.", focus: ["1"] },
          { text: "Die Weiße wird auf die 3 gespielt.", aim: [[60, 60], [125, 80]] },
          {
            text: "Die Weiße berührt zuerst die 3 – nicht die 1.",
            moves: [
              { id: "w", to: [116, 77.5] },
              { id: "3", to: [160, 98], after: "w" },
            ],
            mark: { at: [125, 80], kind: "foul", after: "w" },
          },
        ],
      },
      {
        label: "Fall B", verdict: "ok",
        reason: "Die 1 wurde zuerst berührt und läuft danach zur Bande.",
        balls: [w(60, 60), b(1, 130, 45), b(3, 125, 80), b(2, 165, 62)],
        steps: [
          { text: "Ausgangslage: Die 1 ist die niedrigste Kugel auf dem Tisch.", focus: ["1"] },
          { text: "Die Weiße wird auf die 1 gespielt.", aim: [[60, 60], [130, 45]] },
          {
            text: "Die Weiße berührt zuerst die 1, diese läuft danach an die Bande.",
            moves: [
              { id: "w", to: [119, 47.3] },
              { id: "1", to: [204, 29], after: "w" },
            ],
            mark: { at: [130, 45], kind: "ok", after: "w" },
          },
        ],
      },
    ],
  },
  {
    id: "weisse-versenkt",
    released: false,
    disc: "9 Ball",
    title: "Kugel und Weiße in der Tasche",
    rule: "Versenkt die Weiße (Scratch), ist es immer ein Foul – selbst wenn im selben Stoß eine Kugel regulär fällt. Die Kugel wird beim 9-Ball dann nicht gutgeschrieben bzw. die Gegnerin oder der Gegner hat Ball in Hand.",
    variants: [
      {
        label: "Fall A", verdict: "foul",
        reason: "Die Weiße ist mitgefallen – Scratch.",
        balls: [w(68, 17), b(5, 140, 64), b(9, 60, 90)],
        steps: [
          { text: "Ausgangslage: Die 5 liegt vor der Ecktasche." , focus: ["5"] },
          { text: "Die Weiße wird voll auf die 5 gespielt, mit Nachlauf.", aim: [[68, 17], [140, 64]] },
          {
            text: "Die 5 fällt, aber die Weiße läuft hinterher in dieselbe Tasche.",
            moves: [
              { id: "w", via: [[130.8, 58]], to: [207, 107], out: true },
              { id: "5", to: [207, 107], out: true, after: "w" },
            ],
            mark: { at: [200, 100], kind: "foul", after: "w" },
          },
        ],
      },
      {
        label: "Fall B", verdict: "ok",
        reason: "Die 5 ist gefallen, die Weiße bleibt auf dem Tisch.",
        balls: [w(68, 17), b(5, 140, 64), b(9, 60, 90)],
        steps: [
          { text: "Ausgangslage: Die 5 liegt vor der Ecktasche.", focus: ["5"] },
          { text: "Die Weiße wird voll auf die 5 gespielt, mit Rückläufer.", aim: [[68, 17], [140, 64]] },
          {
            text: "Die 5 fällt, die Weiße läuft zurück und bleibt liegen.",
            moves: [
              { id: "w", via: [[130.8, 58]], to: [118, 49] },
              { id: "5", to: [207, 107], out: true, after: "w" },
            ],
            mark: { at: [200, 100], kind: "ok", after: "w" },
          },
        ],
      },
    ],
  },
  {
    id: "keine-bande",
    released: false,
    disc: "8 Ball",
    title: "Nach dem Treffer: Bande oder Tasche",
    rule: "Nach dem Berühren einer Kugel muss entweder eine Kugel versenkt werden oder mindestens eine Kugel (Weiße oder Zielkugel) die Bande berühren. Passiert beides nicht, ist es ein Foul.",
    variants: [
      {
        label: "Fall A", verdict: "foul",
        reason: "Keine Kugel versenkt und keine Bande berührt.",
        balls: [w(50, 60), b(4, 110, 60), b(12, 150, 90)],
        steps: [
          { text: "Ausgangslage: Die Weiße spielt eine Kugel ihrer Gruppe an." , focus: ["4"] },
          { text: "Der Stoß geht gerade auf die 4.", aim: [[50, 60], [110, 60]] },
          {
            text: "Beide Kugeln bleiben mitten auf dem Tisch liegen.",
            moves: [
              { id: "w", to: [99, 60] },
              { id: "4", to: [140, 60], after: "w" },
            ],
            mark: { at: [140, 60], kind: "foul", after: "4" },
          },
        ],
      },
      {
        label: "Fall B", verdict: "ok",
        reason: "Die 4 berührt die Bande.",
        balls: [w(50, 60), b(4, 110, 60), b(12, 150, 90)],
        steps: [
          { text: "Ausgangslage: Die Weiße spielt eine Kugel ihrer Gruppe an.", focus: ["4"] },
          { text: "Der Stoß geht gerade auf die 4.", aim: [[50, 60], [110, 60]] },
          {
            text: "Die 4 läuft bis zur Bande.",
            moves: [
              { id: "w", to: [99, 60] },
              { id: "4", to: [204.5, 60], after: "w" },
            ],
            mark: { at: [204.5, 60], kind: "ok", after: "4" },
          },
        ],
      },
    ],
  },
];
