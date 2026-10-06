import { cue, ball, touch } from "../../ruleEngine.js";
import { ALL_DISCS } from "../meta.js";

const W = [60, 50], B6 = [130, 56];

export default {
  id: "kugel-vom-tisch",
  released: false,
  discs: ALL_DISCS,
  topic: "tisch",
  ref: "3.5, 2.6",
  keywords: ["vom Tisch gesprungen", "Kugel springt", "Sprung", "Boden"],
  title: "Kugel springt vom Tisch",
  rule: "Springt eine Objektkugel vom Tisch, ist das ein Foul. Wieder aufgebaut wird nur: beim 8-Ball die 8 (nur beim Anstoß), beim 9-Ball die 9, beim 10-Ball die 10, beim 14/1 jede Objektkugel. Eine Kugel, die nur an der Bande entlangläuft oder wieder auf den Tisch zurückfällt, ist kein Foul.",
  variants: [
    {
      label: "Fall A", verdict: "foul",
      reason: "Die 6 ist über die Bande vom Tisch gesprungen.",
      balls: [cue(...W), ball(6, ...B6)],
      steps: [
        { text: "Ausgangslage: Die Weiße wird hart auf die 6 gespielt.", focus: ["6"] },
        { text: "Der Stoß ist sehr hart.", aim: [W, B6] },
        {
          text: "Die 6 springt über die Bande vom Tisch – Foul.",
          moves: [
            { id: "w", to: touch(W, B6) },
            { id: "6", to: [226, 62.5], out: true, after: "w" },
          ],
          mark: { at: [204.5, 61.5], kind: "foul", after: "w", delay: 220 },
        },
      ],
    },
    {
      label: "Fall B", verdict: "ok",
      reason: "Die 6 bleibt auf dem Tisch.",
      balls: [cue(...W), ball(6, ...B6)],
      steps: [
        { text: "Ausgangslage: Die Weiße wird hart auf die 6 gespielt.", focus: ["6"] },
        { text: "Der gleiche Stoß.", aim: [W, B6] },
        {
          text: "Die 6 prallt an die Bande und bleibt auf dem Tisch – kein Foul.",
          moves: [
            { id: "w", to: touch(W, B6) },
            { id: "6", via: [[204.5, 62.4]], to: [168, 59.5], after: "w" },
          ],
          mark: { at: [204.5, 62.4], kind: "ok", after: "6" },
        },
      ],
    },
  ],
};

export const en = {
  "Kugel springt vom Tisch": "Ball jumps off the table",
  "Springt eine Objektkugel vom Tisch, ist das ein Foul. Wieder aufgebaut wird nur: beim 8-Ball die 8 (nur beim Anstoß), beim 9-Ball die 9, beim 10-Ball die 10, beim 14/1 jede Objektkugel. Eine Kugel, die nur an der Bande entlangläuft oder wieder auf den Tisch zurückfällt, ist kein Foul.":
    "If an object ball jumps off the table it is a foul. Only these balls are re-spotted: in 8-ball the 8 (on the break only), in 9-ball the 9, in 10-ball the 10, in 14.1 every object ball. A ball that only runs along the cushion or drops back onto the table is no foul.",
  "vom Tisch gesprungen": "jumped off the table",
  "Kugel springt": "ball jumps",
  "Sprung": "jump",
  "Boden": "floor",
  "Die 6 ist über die Bande vom Tisch gesprungen.": "The 6 jumped over the cushion off the table.",
  "Die 6 bleibt auf dem Tisch.": "The 6 stays on the table.",
  "Ausgangslage: Die Weiße wird hart auf die 6 gespielt.": "Starting position: the cue ball is played hard at the 6.",
  "Der Stoß ist sehr hart.": "The shot is very hard.",
  "Die 6 springt über die Bande vom Tisch – Foul.": "The 6 jumps over the cushion off the table – foul.",
  "Der gleiche Stoß.": "The same shot.",
  "Die 6 prallt an die Bande und bleibt auf dem Tisch – kein Foul.": "The 6 rebounds off the cushion and stays on the table – no foul.",
};
