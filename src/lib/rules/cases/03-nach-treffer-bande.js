import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, D141, ALL_DISCS, tagSets } from "../meta.js";

const W = [50, 60], P4 = [110, 60];
const a = cut(W, { id: "4", at: P4 }, [140, 60]);
const b = cut(W, { id: "4", at: P4 }, [204.5, 60]);
const balls = () => [cue(...W), ball(4, ...P4), ball(9, 150, 92)];

const variants = [
  {
    label: "Fall A", verdict: "foul",
    reason: "Keine Kugel versenkt und keine Bande berührt.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Die Weiße spielt die 4 an.", focus: ["4"] },
      { text: "Der Stoß geht gerade auf die 4.", aim: [W, P4] },
      { text: "Beide Kugeln bleiben mitten auf dem Tisch liegen.", expectRail: false, moves: [a.w, a.obj], mark: { at: [140, 60], kind: "foul", afterEnd: "4" } },
    ],
  },
  {
    label: "Fall B", verdict: "ok",
    reason: "Die 4 berührt die Bande.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Die Weiße spielt die 4 an.", focus: ["4"] },
      { text: "Der Stoß geht gerade auf die 4.", aim: [W, P4] },
      { text: "Die 4 läuft bis zur Bande.", expectRail: true, moves: [b.w, b.obj], mark: { at: [204.5, 60], kind: "ok", afterEnd: "4" } },
    ],
  },
];

export default {
  id: "nach-treffer-bande",
  released: false,
  discs: ALL_DISCS,
  topic: "bande",
  ref: "3.3, 2.7",
  keywords: ["Bande", "Tasche", "kein Bandenkontakt", "keine Bande", "No Rail", "Kugel bleibt liegen", "Bande nach dem Treffer"],
  title: "Nach dem Treffer: Bande oder Tasche",
  rule: "Wird bei einem Stoß keine Kugel versenkt, muss die Weiße eine Objektkugel berühren, und danach muss mindestens eine Kugel (Weiße oder Objektkugel) eine Bande anlaufen. Sonst ist es ein Foul. Eine versenkte Kugel zählt dabei als Bandenberührung. Die Regel gilt bei 8-Ball, 9-Ball, 10-Ball und 14/1 Endlos, beim Push Out entfällt sie. Folgen: wie beim Scratch (Ball in Hand bzw. ein Punkt Abzug beim 14/1).",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 4"],
    [D8, "Du spielst Volle"],
    [D141, "14/1 · Sicherheit angesagt"],
  ]),
};

export const en = {
  "Nach dem Treffer: Bande oder Tasche": "After contact: cushion or pocket",
  "Wird bei einem Stoß keine Kugel versenkt, muss die Weiße eine Objektkugel berühren, und danach muss mindestens eine Kugel (Weiße oder Objektkugel) eine Bande anlaufen. Sonst ist es ein Foul. Eine versenkte Kugel zählt dabei als Bandenberührung. Die Regel gilt bei 8-Ball, 9-Ball, 10-Ball und 14/1 Endlos, beim Push Out entfällt sie. Folgen: wie beim Scratch (Ball in Hand bzw. ein Punkt Abzug beim 14/1).":
    "If no ball is pocketed on a shot, the cue ball must touch an object ball, and afterwards at least one ball (cue ball or object ball) must reach a cushion. Otherwise it is a foul. A pocketed ball counts as touching a cushion. The rule applies in 8-ball, 9-ball, 10-ball and 14.1 continuous; it does not apply on a push out. Consequences: as for a scratch (ball in hand, or one point deducted in 14.1).",
  "Bande": "Cushion",
  "Tasche": "Pocket",
  "kein Bandenkontakt": "no cushion contact",
  "keine Bande": "no cushion",
  "No Rail": "No Rail",
  "Bande nach dem Treffer": "cushion after contact",
  "Kugel bleibt liegen": "ball stays put",
  "Niedrigste Kugel: 4": "Lowest ball: 4",
  "Du spielst Volle": "You play solids",
  "14/1 · Sicherheit angesagt": "14.1 · safety announced",
  "Keine Kugel versenkt und keine Bande berührt.": "No ball pocketed and no cushion touched.",
  "Die 4 berührt die Bande.": "The 4 touches the cushion.",
  "Ausgangslage: Die Weiße spielt die 4 an.": "Starting position: the cue ball plays the 4.",
  "Der Stoß geht gerade auf die 4.": "The shot goes straight at the 4.",
  "Beide Kugeln bleiben mitten auf dem Tisch liegen.": "Both balls stay in the middle of the table.",
  "Die 4 läuft bis zur Bande.": "The 4 runs to the cushion.",
};
