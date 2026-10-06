import { cue, ball } from "../../ruleEngine.js";
import { ALL_DISCS } from "../meta.js";

export default {
  id: "weisse-versenkt",
  released: false,
  discs: ALL_DISCS,
  topic: "weisse",
  ref: "3.1, 4.9, 5.7, 6.9, 7.9",
  keywords: ["Scratch", "Weiße versenkt", "Weiße in der Tasche"],
  title: "Kugel und Weiße in der Tasche",
  rule: "Fällt die Weiße in eine Tasche oder springt sie vom Tisch, ist das immer ein Foul – auch wenn im selben Stoß eine Kugel regulär fällt. Beim 8-Ball, 9-Ball und 10-Ball bekommt der Gegner die Weiße in die Hand und darf sie überall auf dem Tisch platzieren. Beim 14/1 Endlos wird dem Spieler ein Punkt abgezogen, und der Gegner spielt die Weiße aus dem Kopffeld.",
  variants: [
    {
      label: "Fall A", verdict: "foul",
      reason: "Die Weiße ist mitgefallen – Scratch.",
      balls: [cue(68, 17), ball(5, 140, 64), ball(9, 60, 90)],
      steps: [
        { text: "Ausgangslage: Die 5 liegt vor der Ecktasche.", focus: ["5"] },
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
      balls: [cue(68, 17), ball(5, 140, 64), ball(9, 60, 90)],
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
};

export const en = {
  "Kugel und Weiße in der Tasche": "Object ball and cue ball pocketed",
  "Fällt die Weiße in eine Tasche oder springt sie vom Tisch, ist das immer ein Foul – auch wenn im selben Stoß eine Kugel regulär fällt. Beim 8-Ball, 9-Ball und 10-Ball bekommt der Gegner die Weiße in die Hand und darf sie überall auf dem Tisch platzieren. Beim 14/1 Endlos wird dem Spieler ein Punkt abgezogen, und der Gegner spielt die Weiße aus dem Kopffeld.":
    "If the cue ball falls into a pocket or leaves the table it is always a foul – even if an object ball is legally pocketed on the same shot. In 8-ball, 9-ball and 10-ball the opponent gets ball in hand and may place the cue ball anywhere on the table. In 14.1 continuous one point is deducted and the opponent plays the cue ball from the kitchen.",
  "Weiße versenkt": "Cue ball pocketed",
  "Weiße in der Tasche": "Cue ball in pocket",
  "Die Weiße ist mitgefallen – Scratch.": "The cue ball went in too – scratch.",
  "Die 5 ist gefallen, die Weiße bleibt auf dem Tisch.": "The 5 was pocketed, the cue ball stays on the table.",
  "Ausgangslage: Die 5 liegt vor der Ecktasche.": "Starting position: the 5 sits in front of the corner pocket.",
  "Die Weiße wird voll auf die 5 gespielt, mit Nachlauf.": "The cue ball is played full at the 5, with follow.",
  "Die 5 fällt, aber die Weiße läuft hinterher in dieselbe Tasche.": "The 5 drops, but the cue ball follows it into the same pocket.",
  "Die Weiße wird voll auf die 5 gespielt, mit Rückläufer.": "The cue ball is played full at the 5, with draw.",
  "Die 5 fällt, die Weiße läuft zurück und bleibt liegen.": "The 5 drops, the cue ball rolls back and stays on the table.",
};
