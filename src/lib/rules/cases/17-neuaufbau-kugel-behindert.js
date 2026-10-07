import { cue, ball, cut } from "../../ruleEngine.js";
import { D141 } from "../meta.js";
import { hiddenRack14, placeRack14, HEAD, CENTER } from "../racks.js";

/* 14/1: Die 15. Kugel liegt im Dreieck und behindert den Neuaufbau (nur sie, die
   Weisse nicht). Sie kommt auf den Kopfpunkt - blockiert die Weisse den Kopfpunkt,
   auf den Mittelpunkt. */
const L15 = [176, 60];
const table = { headLine: true, triangle: true };
// Danach darf jede Kugel zuerst angespielt werden - hier die 15. Kugel auf dem Kopfpunkt bzw. Mittelpunkt
const WA = [100, 84];
const shotA = cut(WA, { id: "15", at: HEAD }, [44, 15.5]);
const shotB = cut(HEAD, { id: "15", at: CENTER }, [125, 104.5]);

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "15. Kugel: Kopfpunkt",
    reason: "Nur die 15. Kugel behindert den Aufbau: sie kommt auf den Kopfpunkt.",
    table,
    balls: [cue(100, 84), ...hiddenRack14(), ball(15, ...L15)],
    steps: [
      { text: "Ausgangslage: Die 14. Kugel fällt. Die 15. Kugel liegt im Dreieck, die Weiße frei.", focus: ["15"] },
      {
        text: "Die 15. Kugel behindert den Aufbau und kommt auf den Kopfpunkt. Die 14 anderen werden aufgebaut.",
        moves: [...placeRack14(), { id: "15", to: HEAD, place: true, delay: 400 }],
        mark: { at: HEAD, kind: "ok", delay: 900 },
      },
      { text: "Danach darf der Spieler jede Kugel zuerst anspielen – auch die 15. Kugel im Kopffeld, denn die Weiße wurde nicht mit Ball in Hand aus dem Kopffeld gespielt.", say: "jede Kugel erlaubt", aim: [WA, shotA.contact], expectRail: true, moves: [shotA.w, shotA.obj] },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "15. Kugel: Mittelpunkt",
    reason: "Die Weiße blockiert den Kopfpunkt: die 15. Kugel kommt auf den Mittelpunkt.",
    table,
    balls: [cue(...HEAD), ...hiddenRack14(), ball(15, ...L15)],
    steps: [
      { text: "Ausgangslage: Die 14. Kugel fällt. Die 15. Kugel liegt im Dreieck, die Weiße auf dem Kopfpunkt.", focus: ["15"] },
      {
        text: "Der Kopfpunkt ist durch die Weiße besetzt. Die 15. Kugel kommt deshalb auf den Mittelpunkt.",
        moves: [...placeRack14(), { id: "15", to: CENTER, place: true, delay: 400 }],
        mark: { at: CENTER, kind: "ok", delay: 900 },
      },
      { text: "Danach darf der Spieler jede Kugel zuerst anspielen – hier die 15. Kugel auf dem Mittelpunkt.", say: "jede Kugel erlaubt", aim: [HEAD, shotB.contact], expectRail: true, moves: [shotB.w, shotB.obj] },
    ],
  },
];

export default {
  id: "neuaufbau-kugel-behindert",
  released: true,
  discs: D141,
  topic: "ablauf",
  ref: "7.8c",
  keywords: ["Neuaufbau", "Rack", "15. Kugel im Dreieck", "Kopfpunkt", "Mittelpunkt", "letzte Kugel liegt im Weg", "Kugel behindert"],
  title: "14/1: Neuaufbau, 15. Kugel behindert",
  rule: "Liegt die 15. Kugel innerhalb der Dreiecksmarkierung oder ragt sie hinein, behindert sie den Aufbau der 14 anderen Kugeln. Behindert nur sie (nicht die Weiße), wird sie auf den Kopfpunkt gelegt, oder auf den Mittelpunkt, wenn die Weiße den Kopfpunkt blockiert. Der Schiedsrichter sagt, ob eine Kugel im Dreieck liegt. Die Weiße bleibt, wo sie liegt.",
  sets: [{ discs: D141, tag: "14/1 · Neuaufbau", variants }],
};

export const en = {
  "jede Kugel erlaubt": "any ball allowed",
  "Danach darf der Spieler jede Kugel zuerst anspielen – auch die 15. Kugel im Kopffeld, denn die Weiße wurde nicht mit Ball in Hand aus dem Kopffeld gespielt.": "Afterwards the player may play any ball first – also the 15th ball in the kitchen, because the cue ball was not played from the kitchen with ball in hand.",
  "Danach darf der Spieler jede Kugel zuerst anspielen – hier die 15. Kugel auf dem Mittelpunkt.": "Afterwards the player may play any ball first – here the 15th ball on the center spot.",
  "14/1: Neuaufbau, 15. Kugel behindert": "14.1: re-rack, 15th ball obstructs",
  "Liegt die 15. Kugel innerhalb der Dreiecksmarkierung oder ragt sie hinein, behindert sie den Aufbau der 14 anderen Kugeln. Behindert nur sie (nicht die Weiße), wird sie auf den Kopfpunkt gelegt, oder auf den Mittelpunkt, wenn die Weiße den Kopfpunkt blockiert. Der Schiedsrichter sagt, ob eine Kugel im Dreieck liegt. Die Weiße bleibt, wo sie liegt.":
    "If the 15th ball lies inside the triangle marking or overlaps it, it obstructs the racking of the other 14 balls. If only it obstructs (not the cue ball), it is placed on the head spot, or on the center spot if the cue ball blocks the head spot. The referee tells whether a ball is in the triangle. The cue ball stays where it is.",
  "Neuaufbau": "re-rack",
  "Rack": "Rack",
  "15. Kugel im Dreieck": "15th ball in the triangle",
  "Kopfpunkt": "head spot",
  "Mittelpunkt": "center spot",
  "letzte Kugel liegt im Weg": "last ball is in the way",
  "Kugel behindert": "ball obstructs",
  "14/1 · Neuaufbau": "14.1 · re-rack",
  "15. Kugel: Kopfpunkt": "15th ball: head spot",
  "15. Kugel: Mittelpunkt": "15th ball: center spot",
  "Nur die 15. Kugel behindert den Aufbau: sie kommt auf den Kopfpunkt.": "Only the 15th ball obstructs the rack: it goes on the head spot.",
  "Die Weiße blockiert den Kopfpunkt: die 15. Kugel kommt auf den Mittelpunkt.": "The cue ball blocks the head spot: the 15th ball goes on the center spot.",
  "Ausgangslage: Die 14. Kugel fällt. Die 15. Kugel liegt im Dreieck, die Weiße frei.": "Starting position: the 14th ball falls. The 15th ball lies in the triangle, the cue ball is free.",
  "Die 15. Kugel behindert den Aufbau und kommt auf den Kopfpunkt. Die 14 anderen werden aufgebaut.": "The 15th ball obstructs the rack and goes on the head spot. The other 14 are racked.",
  "Ausgangslage: Die 14. Kugel fällt. Die 15. Kugel liegt im Dreieck, die Weiße auf dem Kopfpunkt.": "Starting position: the 14th ball falls. The 15th ball lies in the triangle, the cue ball on the head spot.",
  "Der Kopfpunkt ist durch die Weiße besetzt. Die 15. Kugel kommt deshalb auf den Mittelpunkt.": "The head spot is taken by the cue ball. The 15th ball therefore goes on the center spot.",
};
