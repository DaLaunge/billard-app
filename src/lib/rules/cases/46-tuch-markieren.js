import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, D141, tagSets } from "../meta.js";

/* Regel 3.16 (f) / OS19 3.42: Den Tisch zu markieren (Kreidestrich oder -punkt auf Tuch oder Bande als
   Zielhilfe) ist unsportlich bzw. ein Foul, wenn die Markierung beim Stoss noch da ist. Fall A: der Spieler
   setzt einen Kreidepunkt und stoesst, ohne ihn zu entfernen. Fall B: er wischt den Punkt vor dem Stoss
   weg. Der Stoss selbst ist beide Male regelgerecht (richtige Kugel, Kugel faellt). */
const T = [150, 50], P = [207, 13], W = [91.2, 88.2], DOT = [100, 40];
const shot = cut(W, { id: "4", at: T }, P, { out: true });
const balls = () => [cue(...W), ball(4, ...T), ball(9, 60, 100)];
const hand = { kind: "hand", angle: 180, from: [60, 40], at: [DOT[0] - 8, DOT[1]], dur: 600 };
const dot = { kind: "dot", at: DOT };

const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Foul – Tuch markiert",
    reason: "Der Kreidepunkt auf dem Tuch bleibt beim Stoß liegen: das Markieren des Tisches ist ein Foul bzw. unsportliches Verhalten.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Der Spieler hat die angesagte 4 vor der Ecktasche.", focus: ["4"] },
      { text: "Der Spieler setzt mit Kreide einen Punkt auf das Tuch, um besser zu zielen.", figs: [hand, dot] },
      { text: "Er lässt den Punkt liegen und stößt. Die 4 fällt, trotzdem ein Foul wegen der Markierung.", aim: [W, shot.contact], expectRail: true, figs: [dot], moves: [shot.w, shot.obj], mark: { at: DOT, kind: "foul", after: "w", delay: 200 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Kein Foul",
    reason: "Die Markierung wird vor dem Stoß entfernt: kein Foul.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Der Spieler hat die angesagte 4 vor der Ecktasche.", focus: ["4"] },
      { text: "Der Spieler hat einen Kreidepunkt gesetzt, wischt ihn aber vor dem Stoß wieder weg.", figs: [{ ...hand, at: [DOT[0] - 8, DOT[1]] }] },
      { text: "Der Spieler stößt, der Tisch ist sauber. Die 4 fällt, kein Foul.", aim: [W, shot.contact], expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: "ok", after: "w", delay: 300 } },
    ],
  },
];

export default {
  id: "tuch-markieren",
  released: true,
  discs: ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "tisch",
  tags: ["verhalten", "tisch", "foul"],
  ref: "3.16 f",
  keywords: ["Tuch markieren", "Kreidepunkt", "Kreidestrich", "Tisch markieren", "Markierung auf dem Tuch", "Zielhilfe markieren"],
  title: "Tuch oder Bande markieren",
  rule: "Es ist unsportlich, das Tuch oder die Bande zu markieren (zum Beispiel mit einem Kreidepunkt als Zielhilfe). Nach der Lehrunterlage ist es ein Foul, wenn die Markierung nicht vor dem Stoß entfernt wird. Der Spieler haftet für alles, was er an den Tisch bringt.",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 4"],
    [D8, "Du spielst Volle"],
    [D141, "14/1 · Ansage: 4"],
  ]),
};

export const en = {
  "Tuch oder Bande markieren": "Marking the cloth or cushion",
  "Es ist unsportlich, das Tuch oder die Bande zu markieren (zum Beispiel mit einem Kreidepunkt als Zielhilfe). Nach der Lehrunterlage ist es ein Foul, wenn die Markierung nicht vor dem Stoß entfernt wird. Der Spieler haftet für alles, was er an den Tisch bringt.": "It is unsportsmanlike to mark the cloth or cushion (for example with a chalk dot as an aiming aid). According to the training material it is a foul if the mark is not removed before the stroke. The player is liable for everything he brings to the table.",
  "Tuch markieren": "mark the cloth",
  "Kreidepunkt": "chalk dot",
  "Kreidestrich": "chalk line",
  "Tisch markieren": "mark the table",
  "Markierung auf dem Tuch": "mark on the cloth",
  "Zielhilfe markieren": "mark an aiming aid",
  "Niedrigste Kugel: 4": "Lowest ball: 4",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 4": "14.1 · call: 4",
  "Foul – Tuch markiert": "Foul – cloth marked",
  "Der Kreidepunkt auf dem Tuch bleibt beim Stoß liegen: das Markieren des Tisches ist ein Foul bzw. unsportliches Verhalten.": "The chalk dot stays on the cloth during the stroke: marking the table is a foul or unsportsmanlike conduct.",
  "Die Markierung wird vor dem Stoß entfernt: kein Foul.": "The mark is removed before the stroke: no foul.",
  "Ausgangslage: Der Spieler hat die angesagte 4 vor der Ecktasche.": "Starting position: the player has the called 4 in front of the corner pocket.",
  "Der Spieler setzt mit Kreide einen Punkt auf das Tuch, um besser zu zielen.": "The player puts a chalk dot on the cloth to aim better.",
  "Er lässt den Punkt liegen und stößt. Die 4 fällt, trotzdem ein Foul wegen der Markierung.": "He leaves the dot and shoots. The 4 falls, still a foul because of the mark.",
  "Der Spieler hat einen Kreidepunkt gesetzt, wischt ihn aber vor dem Stoß wieder weg.": "The player had put a chalk dot but wipes it away before the stroke.",
  "Der Spieler stößt, der Tisch ist sauber. Die 4 fällt, kein Foul.": "The player shoots, the table is clean. The 4 falls, no foul.",
};
