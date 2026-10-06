import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, D141, ALL_DISCS, tagSets } from "../meta.js";

/* Duenner Treffer auf die 5: die Weisse laeuft tangential weiter (90-Grad-Regel).
   Fall A: in einem steilen Winkel - sie rollt in die Ecktasche (Scratch).
   Fall B: flacherer Winkel - sie laeuft weniger weit und bleibt liegen. */
const T = [165, 55], OBJ = [198.8, 104.5];
const A0 = [90.1, 32.5], B0 = [93.4, 21.2];
const a = cut(A0, { id: "5", at: T }, OBJ);
a.w.to = [207, 13];
a.w.out = true;
const b = cut(B0, { id: "5", at: T }, OBJ);

const variants = [
  {
    label: "Fall A", verdict: "foul",
    reason: "Die Weiße ist in die Tasche gelaufen – Scratch.",
    balls: [cue(...A0), ball(5, ...T), ball(9, 60, 95)],
    steps: [
      { text: "Ausgangslage: Die Weiße liegt links oben, die 5 vor der Ecktasche.", focus: ["5"] },
      { text: "Die Weiße trifft die 5 nur dünn.", aim: [A0, a.contact] },
      { text: "Die 5 läuft an die untere Bande, die Weiße rollt in die Ecktasche – Scratch, trotz richtiger Kugel und Bande.", expectRail: true, moves: [a.w, a.obj], mark: { at: [200, 19], kind: "foul", afterEnd: "w", delay: -250 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok",
    reason: "Die Weiße bleibt auf dem Tisch.",
    balls: [cue(...B0), ball(5, ...T), ball(9, 60, 95)],
    steps: [
      { text: "Ausgangslage: Die Weiße liegt links oben, die 5 vor der Ecktasche.", focus: ["5"] },
      { text: "Die Weiße trifft die 5 unter einem anderen Winkel.", aim: [B0, b.contact] },
      { text: "Die 5 läuft an die untere Bande, die Weiße läuft aus und bleibt liegen – kein Foul.", expectRail: true, moves: [b.w, b.obj], mark: { at: T, kind: "ok", after: "w" } },
    ],
  },
];

export default {
  id: "weisse-versenkt",
  released: false,
  discs: ALL_DISCS,
  topic: "weisse",
  ref: "3.1, 4.9, 5.7, 6.9, 7.9",
  keywords: ["Scratch", "Weiße versenkt", "Weiße in der Tasche", "Weiße gefallen", "Weiße im Loch", "Ball in Hand"],
  title: "Weiße in der Tasche (Scratch)",
  rule: "Fällt die Weiße in eine Tasche oder springt sie vom Tisch, ist das immer ein Foul – auch wenn im selben Stoß eine Kugel regulär fällt. Beim 8-Ball, 9-Ball und 10-Ball bekommt der Gegner die Weiße in die Hand und darf sie überall auf dem Tisch platzieren. Beim 14/1 Endlos wird dem Spieler ein Punkt abgezogen, und der Gegner spielt die Weiße aus dem Kopffeld.",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 5"],
    [D8, "Du spielst Volle"],
    [D141, "14/1 · Sicherheit angesagt"],
  ]),
};

export const en = {
  "Weiße in der Tasche (Scratch)": "Cue ball in the pocket (scratch)",
  "Fällt die Weiße in eine Tasche oder springt sie vom Tisch, ist das immer ein Foul – auch wenn im selben Stoß eine Kugel regulär fällt. Beim 8-Ball, 9-Ball und 10-Ball bekommt der Gegner die Weiße in die Hand und darf sie überall auf dem Tisch platzieren. Beim 14/1 Endlos wird dem Spieler ein Punkt abgezogen, und der Gegner spielt die Weiße aus dem Kopffeld.":
    "If the cue ball falls into a pocket or leaves the table it is always a foul – even if an object ball is legally pocketed on the same shot. In 8-ball, 9-ball and 10-ball the opponent gets ball in hand and may place the cue ball anywhere on the table. In 14.1 continuous one point is deducted and the opponent plays the cue ball from the kitchen.",
  "Weiße versenkt": "Cue ball pocketed",
  "Weiße in der Tasche": "Cue ball in pocket",
  "Weiße gefallen": "cue ball dropped",
  "Weiße im Loch": "cue ball in the hole",
  "Ball in Hand": "ball in hand",
  "Niedrigste Kugel: 5": "Lowest ball: 5",
  "Du spielst Volle": "You play solids",
  "14/1 · Sicherheit angesagt": "14.1 · safety announced",
  "Die Weiße ist in die Tasche gelaufen – Scratch.": "The cue ball ran into the pocket – scratch.",
  "Die Weiße bleibt auf dem Tisch.": "The cue ball stays on the table.",
  "Ausgangslage: Die Weiße liegt links oben, die 5 vor der Ecktasche.": "Starting position: the cue ball is at the top left, the 5 in front of the corner pocket.",
  "Die Weiße trifft die 5 nur dünn.": "The cue ball hits the 5 only thinly.",
  "Die 5 läuft an die untere Bande, die Weiße rollt in die Ecktasche – Scratch, trotz richtiger Kugel und Bande.": "The 5 runs to the lower cushion, the cue ball rolls into the corner pocket – scratch, despite the right ball and a cushion.",
  "Die Weiße trifft die 5 unter einem anderen Winkel.": "The cue ball hits the 5 at a different angle.",
  "Die 5 läuft an die untere Bande, die Weiße läuft aus und bleibt liegen – kein Foul.": "The 5 runs to the lower cushion, the cue ball rolls out and stays – no foul.",
};
