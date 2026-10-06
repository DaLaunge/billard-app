import { cue, ball, cut } from "../../ruleEngine.js";
import { D141 } from "../meta.js";
import { hiddenRack14, placeRack14, HEAD } from "../racks.js";

/* 14/1: Nur die Weisse liegt im Dreieck und behindert den Neuaufbau.
   Fall A: die 15. Kugel liegt ausserhalb des Kopffelds - die Weisse wird mit Ball in
   Hand aus dem Kopffeld gespielt. Fall B: die 15. Kugel liegt im Kopffeld - die
   Weisse kommt auf den Kopfpunkt. */
const W = [184, 66];
const table = { headLine: true, triangle: true };
// Fall B: Die Weisse steht auf dem Kopfpunkt, die 15. liegt im Kopffeld und darf direkt angespielt werden.
const K15 = [36, 28];
const direct = cut(HEAD, { id: "15", at: K15 }, [15.5, 24]);

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "Weiße: Ball in Hand (Kopffeld)",
    reason: "Die 15. Kugel liegt außerhalb des Kopffelds: die Weiße wird aus dem Kopffeld gespielt.",
    table,
    balls: [cue(...W), ...hiddenRack14(), ball(15, 122, 38)],
    steps: [
      { text: "Ausgangslage: Die 14. Kugel fällt. Die Weiße liegt im Dreieck, die 15. Kugel außerhalb des Kopffelds.", focus: ["15"] },
      {
        text: "Die Weiße behindert den Aufbau. Sie wird mit Ball in Hand aus dem Kopffeld gespielt.",
        say: "Ball in Hand",
        moves: [...placeRack14(), { id: "w", to: [36, 62], place: true, delay: 400 }],
        mark: { at: [36, 62], kind: "ok", delay: 900 },
      },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Weiße: Kopfpunkt",
    reason: "Die 15. Kugel liegt im Kopffeld: die Weiße kommt auf den Kopfpunkt. Das ist keine Lageverbesserung aus dem Kopffeld, deshalb darf der Spieler die 15. Kugel im Kopffeld direkt anspielen.",
    table,
    balls: [cue(...W), ...hiddenRack14(), ball(15, ...K15)],
    steps: [
      { text: "Ausgangslage: Die 14. Kugel fällt. Die Weiße liegt im Dreieck, die 15. Kugel im Kopffeld.", focus: ["15"] },
      {
        text: "Die Weiße behindert den Aufbau. Sie wird auf den Kopfpunkt gelegt.",
        moves: [...placeRack14(), { id: "w", to: HEAD, place: true, delay: 400 }],
        mark: { at: HEAD, kind: "ok", delay: 900 },
      },
      { text: "Der Spieler darf die 15. Kugel im Kopffeld direkt anspielen – die Weiße muss das Kopffeld nicht erst verlassen (Regel 3.11 gilt hier nicht).", say: "kein Ball in Hand", aim: [HEAD, direct.contact], expectRail: true, moves: [direct.w, direct.obj], mark: { at: K15, kind: "ok", after: "w", delay: 200 } },
    ],
  },
];

export default {
  id: "neuaufbau-weisse-behindert",
  released: false,
  discs: D141,
  topic: "ablauf",
  ref: "7.8d",
  keywords: ["Neuaufbau", "Rack", "Weiße im Dreieck", "Weiße behindert", "Kopfpunkt", "Ball in Hand", "Kopffeld", "Kugel im Kopffeld anspielen", "darf ich die Kugel im Kopffeld spielen"],
  title: "14/1: Weiße behindert den Neuaufbau",
  rule: "Liegt nur die Weiße im Dreieck (oder ragt hinein) und behindert den Aufbau, hängt es von der 15. Kugel ab: Liegt die 15. Kugel außerhalb des Kopffelds oder genau auf der Kopflinie, wird die Weiße mit Ball in Hand aus dem Kopffeld gespielt. Liegt die 15. Kugel im Kopffeld, kommt die Weiße auf den Kopfpunkt, bei besetztem Kopfpunkt auf den Mittelpunkt. Der Spieler darf danach jede Kugel zuerst anspielen. Liegt die 15. Kugel im Kopffeld und steht die Weiße auf dem Kopfpunkt, hat der Spieler keine Lageverbesserung aus dem Kopffeld: er darf die Kugel im Kopffeld direkt anspielen (auch nach hinten), Regel 3.11 gilt dann nicht. Hat er dagegen Ball in Hand aus dem Kopffeld, muss die Weiße das Kopffeld erst verlassen, bevor sie eine Kugel im Kopffeld berührt.",
  sets: [{ discs: D141, tag: "14/1 · Neuaufbau", variants }],
};

export const en = {
  "14/1: Weiße behindert den Neuaufbau": "14.1: cue ball obstructs the re-rack",
  "Liegt nur die Weiße im Dreieck (oder ragt hinein) und behindert den Aufbau, hängt es von der 15. Kugel ab: Liegt die 15. Kugel außerhalb des Kopffelds oder genau auf der Kopflinie, wird die Weiße mit Ball in Hand aus dem Kopffeld gespielt. Liegt die 15. Kugel im Kopffeld, kommt die Weiße auf den Kopfpunkt, bei besetztem Kopfpunkt auf den Mittelpunkt. Der Spieler darf danach jede Kugel zuerst anspielen. Liegt die 15. Kugel im Kopffeld und steht die Weiße auf dem Kopfpunkt, hat der Spieler keine Lageverbesserung aus dem Kopffeld: er darf die Kugel im Kopffeld direkt anspielen (auch nach hinten), Regel 3.11 gilt dann nicht. Hat er dagegen Ball in Hand aus dem Kopffeld, muss die Weiße das Kopffeld erst verlassen, bevor sie eine Kugel im Kopffeld berührt.":
    "If only the cue ball lies in the triangle (or overlaps it) and obstructs the rack, it depends on the 15th ball: if the 15th ball lies outside the kitchen or exactly on the head string, the cue ball is played from the kitchen with ball in hand. If the 15th ball lies in the kitchen, the cue ball is placed on the head spot, or on the center spot if the head spot is taken. The player may then play any ball first. If the 15th ball lies in the kitchen and the cue ball stands on the head spot, the player does not have ball in hand from the kitchen: he may play the ball in the kitchen directly (also backwards), rule 3.11 does not apply. With ball in hand from the kitchen, however, the cue ball must first leave the kitchen before it touches a ball in the kitchen.",
  "Neuaufbau": "re-rack",
  "Rack": "Rack",
  "Weiße im Dreieck": "cue ball in the triangle",
  "Weiße behindert": "cue ball obstructs",
  "Kopfpunkt": "head spot",
  "Ball in Hand": "ball in hand",
  "Kopffeld": "kitchen",
  "Kugel im Kopffeld anspielen": "play a ball in the kitchen",
  "darf ich die Kugel im Kopffeld spielen": "may I play the ball in the kitchen",
  "kein Ball in Hand": "no ball in hand",
  "Der Spieler darf die 15. Kugel im Kopffeld direkt anspielen – die Weiße muss das Kopffeld nicht erst verlassen (Regel 3.11 gilt hier nicht).": "The player may play the 15th ball in the kitchen directly – the cue ball does not have to leave the kitchen first (rule 3.11 does not apply here).",
  "14/1 · Neuaufbau": "14.1 · re-rack",
  "Weiße: Ball in Hand (Kopffeld)": "Cue ball: ball in hand (kitchen)",
  "Weiße: Kopfpunkt": "Cue ball: head spot",
  "Die 15. Kugel liegt außerhalb des Kopffelds: die Weiße wird aus dem Kopffeld gespielt.": "The 15th ball lies outside the kitchen: the cue ball is played from the kitchen.",
  "Die 15. Kugel liegt im Kopffeld: die Weiße kommt auf den Kopfpunkt. Das ist keine Lageverbesserung aus dem Kopffeld, deshalb darf der Spieler die 15. Kugel im Kopffeld direkt anspielen.": "The 15th ball lies in the kitchen: the cue ball goes on the head spot. That is not ball in hand from the kitchen, so the player may play the 15th ball in the kitchen directly.",
  "Ausgangslage: Die 14. Kugel fällt. Die Weiße liegt im Dreieck, die 15. Kugel außerhalb des Kopffelds.": "Starting position: the 14th ball falls. The cue ball lies in the triangle, the 15th ball outside the kitchen.",
  "Die Weiße behindert den Aufbau. Sie wird mit Ball in Hand aus dem Kopffeld gespielt.": "The cue ball obstructs the rack. It is played from the kitchen with ball in hand.",
  "Ausgangslage: Die 14. Kugel fällt. Die Weiße liegt im Dreieck, die 15. Kugel im Kopffeld.": "Starting position: the 14th ball falls. The cue ball lies in the triangle, the 15th ball in the kitchen.",
  "Die Weiße behindert den Aufbau. Sie wird auf den Kopfpunkt gelegt.": "The cue ball obstructs the rack. It is placed on the head spot.",
};
