import { cue, ball, cut } from "../../ruleEngine.js";
import { D141 } from "../meta.js";
import { hiddenRack14, placeRack14, FOOT, reRackBreak } from "../racks.js";

/* 14/1, 14. Kugel faellt: bleibt nur noch die Weisse (und die 15.) auf dem Tisch,
   wird neu aufgebaut. Fall A: die 15. Kugel faellt zusammen mit der 14. - alle 15
   Kugeln kommen ins Dreieck. Fall B: nur die 14. faellt, die 15. liegt ausserhalb
   des Dreiecks und bleibt liegen. */
const W = [96, 76];
const L15 = [118, 36];
const table = { headLine: true, triangle: true };
// Fall B: die 15. wird direkt angespielt und laeuft an die obere Bande
const direct15 = cut(W, { id: "15", at: L15 }, [130, 15.5]);

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "15 Kugeln im Dreieck",
    reason: "Wurde die 15. Kugel zusammen mit der 14. versenkt, werden alle 15 Kugeln aufgebaut.",
    table,
    balls: [cue(...W), ...hiddenRack14(), { id: "15", n: 15, x: FOOT[0], y: FOOT[1], hidden: true }],
    steps: [
      { text: "Ausgangslage: Die 14. und die 15. Kugel fallen im selben Stoß. Auf dem Tisch liegt nur noch die Weiße." },
      {
        text: "Alle 15 Kugeln werden zu einem Dreieck aufgebaut, die Weiße bleibt liegen.",
        moves: [...placeRack14(), { id: "15", to: FOOT, place: true, delay: 14 * 25 }],
        mark: { at: FOOT, kind: "ok", delay: 700 },
      },
      { text: "Danach darf der Spieler jede Kugel zuerst anspielen – hier bricht er das neue Dreieck.", say: "jede Kugel erlaubt", aim: [W, [149, 60]], expectRail: true, moves: reRackBreak([6, 1]) },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "14 Kugeln, die 15. bleibt",
    reason: "Fällt nur die 14. Kugel und die 15. behindert den Aufbau nicht, bleibt sie liegen.",
    table,
    balls: [cue(...W), ...hiddenRack14(), ball(15, ...L15)],
    steps: [
      { text: "Ausgangslage: Nur die 14. Kugel fällt. Die 15. Kugel und die Weiße liegen außerhalb des Dreiecks.", focus: ["15"] },
      {
        text: "14 Kugeln werden aufgebaut, die Spitze bleibt frei. Die 15. Kugel bleibt liegen, wo sie ist.",
        moves: placeRack14(),
        mark: { at: L15, kind: "ok", delay: 700 },
      },
      { text: "Danach darf der Spieler jede Kugel zuerst anspielen – hier die 15. Kugel, die er an die Bande spielt.", say: "jede Kugel erlaubt", aim: [W, direct15.contact], expectRail: true, moves: [direct15.w, direct15.obj] },
    ],
  },
];

export default {
  id: "neuaufbau-fuenfzehnte",
  released: true,
  discs: D141,
  topic: "ablauf",
  tags: ["aufbau"],
  ref: "7.4, 7.6, 7.8a",
  keywords: ["Neuaufbau", "Rack", "letzte Kugel", "14. Kugel", "15. Kugel", "zwei Kugeln liegen", "eine Kugel liegt", "aufbauen"],
  title: "14/1: Neuaufbau, 15. Kugel mit der 14. versenkt",
  rule: "Sind 14 Kugeln regelgerecht versenkt, wird das Spiel angehalten, bis die Kugeln wieder aufgebaut sind, und der Spieler setzt seine Aufnahme fort. Fällt die 15. Kugel gleichzeitig mit der 14., werden alle 15 Kugeln zu einem Dreieck aufgebaut. Fällt nur die 14. Kugel, werden 14 Kugeln aufgebaut und die Spitze bleibt frei; die 15. Kugel bleibt liegen, solange sie das Dreieck nicht behindert (dann gelten die nächsten Fälle). Der Spieler darf danach jede Kugel zuerst anspielen.",
  sets: [{ discs: D141, tag: "14/1 · Neuaufbau", variants }],
};

export const en = {
  "jede Kugel erlaubt": "any ball allowed",
  "Danach darf der Spieler jede Kugel zuerst anspielen – hier bricht er das neue Dreieck.": "Afterwards the player may play any ball first – here he breaks the new triangle.",
  "Danach darf der Spieler jede Kugel zuerst anspielen – hier die 15. Kugel, die er an die Bande spielt.": "Afterwards the player may play any ball first – here the 15th ball, which he plays to the cushion.",
  "14/1: Neuaufbau, 15. Kugel mit der 14. versenkt": "14.1: re-rack, 15th ball pocketed with the 14th",
  "Sind 14 Kugeln regelgerecht versenkt, wird das Spiel angehalten, bis die Kugeln wieder aufgebaut sind, und der Spieler setzt seine Aufnahme fort. Fällt die 15. Kugel gleichzeitig mit der 14., werden alle 15 Kugeln zu einem Dreieck aufgebaut. Fällt nur die 14. Kugel, werden 14 Kugeln aufgebaut und die Spitze bleibt frei; die 15. Kugel bleibt liegen, solange sie das Dreieck nicht behindert (dann gelten die nächsten Fälle). Der Spieler darf danach jede Kugel zuerst anspielen.":
    "When 14 balls have been legally pocketed, play stops until the balls are re-racked and the player continues his inning. If the 15th ball falls at the same time as the 14th, all 15 balls are racked in a triangle. If only the 14th ball falls, 14 balls are racked and the apex stays empty; the 15th ball stays where it is as long as it does not obstruct the triangle (otherwise the next cases apply). The player may then play any ball first.",
  "Neuaufbau": "re-rack",
  "Rack": "Rack",
  "letzte Kugel": "last ball",
  "14. Kugel": "14th ball",
  "15. Kugel": "15th ball",
  "zwei Kugeln liegen": "two balls left",
  "eine Kugel liegt": "one ball left",
  "aufbauen": "rack up",
  "14/1 · Neuaufbau": "14.1 · re-rack",
  "15 Kugeln im Dreieck": "15 balls in the triangle",
  "14 Kugeln, die 15. bleibt": "14 balls, the 15th stays",
  "Wurde die 15. Kugel zusammen mit der 14. versenkt, werden alle 15 Kugeln aufgebaut.": "If the 15th ball was pocketed together with the 14th, all 15 balls are racked.",
  "Fällt nur die 14. Kugel und die 15. behindert den Aufbau nicht, bleibt sie liegen.": "If only the 14th ball falls and the 15th does not obstruct the rack, it stays where it is.",
  "Ausgangslage: Die 14. und die 15. Kugel fallen im selben Stoß. Auf dem Tisch liegt nur noch die Weiße.": "Starting position: the 14th and 15th ball fall on the same shot. Only the cue ball is left on the table.",
  "Alle 15 Kugeln werden zu einem Dreieck aufgebaut, die Weiße bleibt liegen.": "All 15 balls are racked in a triangle, the cue ball stays where it is.",
  "Ausgangslage: Nur die 14. Kugel fällt. Die 15. Kugel und die Weiße liegen außerhalb des Dreiecks.": "Starting position: only the 14th ball falls. The 15th ball and the cue ball lie outside the triangle.",
  "14 Kugeln werden aufgebaut, die Spitze bleibt frei. Die 15. Kugel bleibt liegen, wo sie ist.": "14 balls are racked, the apex stays empty. The 15th ball stays where it is.",
};
