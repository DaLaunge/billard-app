import { cue, ball } from "../../ruleEngine.js";
import { D141 } from "../meta.js";
import { hiddenRack14, placeRack14, FOOT, reRackBreak } from "../racks.js";

/* 14/1: Die 15. Kugel und die Weisse behindern beide den Aufbau (Fall A), oder die
   15. wurde mit der 14. versenkt und die Weisse liegt im Dreieck (Fall B). In
   beiden Faellen: alle 15 Kugeln neu aufbauen, Weisse mit Ball in Hand aus dem
   Kopffeld. */
const W = [188, 72];
const table = { headLine: true, triangle: true };
const nextShot = { text: "Die Weiße kommt aus dem Kopffeld, im Kopffeld liegt keine Kugel: der Spieler darf jede Kugel anspielen – hier bricht er das neue Dreieck.", say: "jede Kugel erlaubt", aim: [[36, 62], [149, 60]], expectRail: true, moves: reRackBreak([6, 1]) };
const moves = () => [
  ...placeRack14(),
  { id: "15", to: FOOT, place: true, delay: 14 * 25 },
  { id: "w", to: [36, 62], place: true, delay: 14 * 25 + 150 },
];

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "15 Kugeln, Weiße aus dem Kopffeld",
    reason: "Beide behindern: alle 15 Kugeln werden aufgebaut, die Weiße aus dem Kopffeld gespielt.",
    table,
    balls: [cue(...W), ...hiddenRack14(), ball(15, 174, 58)],
    steps: [
      { text: "Ausgangslage: Die 14. Kugel fällt. Die 15. Kugel und die Weiße liegen beide im Dreieck.", focus: ["15"] },
      { text: "Alle 15 Kugeln werden aufgebaut. Die Weiße wird mit Ball in Hand aus dem Kopffeld gespielt.", say: "Ball in Hand", moves: moves(), mark: { at: [36, 62], kind: "ok", delay: 1300 } },
      nextShot,
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "15 Kugeln, Weiße aus dem Kopffeld",
    reason: "Die 15. Kugel fiel mit der 14., die Weiße liegt im Dreieck: dasselbe Ergebnis.",
    table,
    balls: [cue(...W), ...hiddenRack14(), { id: "15", n: 15, x: FOOT[0], y: FOOT[1], hidden: true }],
    steps: [
      { text: "Ausgangslage: Die 15. Kugel fällt zusammen mit der 14., die Weiße liegt im Dreieck." },
      { text: "Alle 15 Kugeln werden aufgebaut. Die Weiße wird mit Ball in Hand aus dem Kopffeld gespielt.", say: "Ball in Hand", moves: moves(), mark: { at: [36, 62], kind: "ok", delay: 1300 } },
      nextShot,
    ],
  },
];

export default {
  id: "neuaufbau-beide",
  released: true,
  discs: D141,
  topic: "ablauf",
  tags: ["aufbau", "weisse", "kopffeld"],
  ref: "7.8a, 7.8b",
  keywords: ["Neuaufbau", "Rack", "Weiße im Dreieck", "15. Kugel im Dreieck", "beide behindern", "Ball in Hand", "Fußpunkt"],
  title: "14/1: Neuaufbau, 15. Kugel und Weiße behindern",
  rule: "Behindern die 15. Kugel und die Weiße beide den Aufbau, werden alle 15 Kugeln zu einem Dreieck aufgebaut (die 15. Kugel liegt dann an der Spitze auf dem Fußpunkt) und die Weiße wird mit Ball in Hand aus dem Kopffeld gespielt. Dasselbe gilt, wenn die 15. Kugel zusammen mit der 14. versenkt wurde und die Weiße im Dreieck liegt. Der Spieler darf danach jede Kugel zuerst anspielen.",
  sets: [{ discs: D141, tag: "14/1 · Neuaufbau", variants }],
};

export const en = {
  "jede Kugel erlaubt": "any ball allowed",
  "Die Weiße kommt aus dem Kopffeld, im Kopffeld liegt keine Kugel: der Spieler darf jede Kugel anspielen – hier bricht er das neue Dreieck.": "The cue ball is played from the kitchen, no ball lies in the kitchen: the player may play any ball – here he breaks the new triangle.",
  "14/1: Neuaufbau, 15. Kugel und Weiße behindern": "14.1: re-rack, 15th ball and cue ball obstruct",
  "Behindern die 15. Kugel und die Weiße beide den Aufbau, werden alle 15 Kugeln zu einem Dreieck aufgebaut (die 15. Kugel liegt dann an der Spitze auf dem Fußpunkt) und die Weiße wird mit Ball in Hand aus dem Kopffeld gespielt. Dasselbe gilt, wenn die 15. Kugel zusammen mit der 14. versenkt wurde und die Weiße im Dreieck liegt. Der Spieler darf danach jede Kugel zuerst anspielen.":
    "If the 15th ball and the cue ball both obstruct the rack, all 15 balls are racked in a triangle (the 15th ball then sits at the apex on the foot spot) and the cue ball is played from the kitchen with ball in hand. The same applies if the 15th ball was pocketed together with the 14th and the cue ball lies in the triangle. The player may then play any ball first.",
  "Neuaufbau": "re-rack",
  "Rack": "Rack",
  "Weiße im Dreieck": "cue ball in the triangle",
  "15. Kugel im Dreieck": "15th ball in the triangle",
  "beide behindern": "both obstruct",
  "Ball in Hand": "ball in hand",
  "Fußpunkt": "foot spot",
  "14/1 · Neuaufbau": "14.1 · re-rack",
  "15 Kugeln, Weiße aus dem Kopffeld": "15 balls, cue ball from the kitchen",
  "Beide behindern: alle 15 Kugeln werden aufgebaut, die Weiße aus dem Kopffeld gespielt.": "Both obstruct: all 15 balls are racked, the cue ball is played from the kitchen.",
  "Die 15. Kugel fiel mit der 14., die Weiße liegt im Dreieck: dasselbe Ergebnis.": "The 15th ball fell with the 14th and the cue ball lies in the triangle: the same result.",
  "Ausgangslage: Die 14. Kugel fällt. Die 15. Kugel und die Weiße liegen beide im Dreieck.": "Starting position: the 14th ball falls. The 15th ball and the cue ball both lie in the triangle.",
  "Alle 15 Kugeln werden aufgebaut. Die Weiße wird mit Ball in Hand aus dem Kopffeld gespielt.": "All 15 balls are racked. The cue ball is played from the kitchen with ball in hand.",
  "Ausgangslage: Die 15. Kugel fällt zusammen mit der 14., die Weiße liegt im Dreieck.": "Starting position: the 15th ball falls together with the 14th, the cue ball lies in the triangle.",
};
