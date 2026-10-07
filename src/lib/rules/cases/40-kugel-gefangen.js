import { cue, ball, cut } from "../../ruleEngine.js";
import { D141, SOURCE_OBERSCHIRI } from "../meta.js";

/* 14/1 (Lehrunterlage OS19 6.7 Nr. 5): Wer eine Kugel faengt, beruehrt oder behindert, die auf das
   Dreieck oder eine Tasche zulaeuft, begeht ein ABSICHTLICHES Foul: 1 + 15 = 16 Punkte Abzug; der
   Gegner uebernimmt mit Ball in Hand aus dem Kopffeld oder laesst neu aufbauen und den Spieler
   neu anstossen. Die Hand steht dort, wo die Kugel von selbst zum Stehen kommt - sie wird "gefangen".
   Fall B: der Spieler laesst die Kugel laufen, sie faellt (angesagt, 1 Punkt). */
const T = [150, 50], P = [207, 13], W = [140, 95];
const full = cut(W, { id: "5", at: T }, P, { out: true });
const unit = (() => { const l = Math.hypot(P[0] - T[0], P[1] - T[1]); return [(P[0] - T[0]) / l, (P[1] - T[1]) / l]; })();
const M = [Math.round((T[0] + unit[0] * 30) * 100) / 100, Math.round((T[1] + unit[1] * 30) * 100) / 100];
const stopped = cut(W, { id: "5", at: T }, M);
const hand = { kind: "hand", at: [M[0] + unit[0] * 15.5, M[1] + unit[1] * 15.5], angle: 180 + (Math.atan2(unit[1], unit[0]) * 180) / Math.PI, dur: 300 };
const balls = () => [cue(...W), ball(5, ...T), ball(9, 60, 90)];

const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Absichtliches Foul (−16)",
    reason: "Wer eine auf eine Tasche zulaufende Kugel fängt oder behindert, begeht ein absichtliches Foul: 1 Punkt und zusätzlich 15 Punkte Abzug.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Die angesagte 5 liegt vor der Ecktasche.", focus: ["5"] },
      { text: "Die Weiße spielt die 5 an, sie rollt auf die Tasche zu.", aim: [W, stopped.contact] },
      { text: "Der Spieler hält die rollende 5 mit der Hand auf, bevor sie die Tasche erreicht – ein absichtliches Foul.", expectRail: true, figs: [hand], moves: [stopped.w, stopped.obj], mark: { at: M, kind: "foul", after: "w", delay: 600 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "1 Punkt",
    reason: "Der Spieler lässt die Kugel laufen: sie fällt in die angesagte Tasche, ein Punkt.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Die angesagte 5 liegt vor der Ecktasche.", focus: ["5"] },
      { text: "Die Weiße spielt die 5 an, sie rollt auf die Tasche zu.", aim: [W, full.contact] },
      { text: "Der Spieler lässt die Kugel laufen, sie fällt in die angesagte Tasche – ein Punkt.", expectRail: true, moves: [full.w, full.obj], mark: { at: [200, 19], kind: "ok", after: "w", delay: 300 } },
    ],
  },
];

export default {
  id: "kugel-gefangen",
  released: true,
  src: SOURCE_OBERSCHIRI,
  discs: D141,
  topic: "stoss",
  tags: ["foul", "verhalten", "tasche"],
  ref: "6.7",
  bookRef: "7.5",
  keywords: ["Kugel gefangen", "Kugel aufhalten", "Kugel abfangen", "Hand ins Loch", "rollende Kugel behindert", "absichtliches Foul", "16 Punkte"],
  title: "Eine rollende Kugel fangen",
  rule: "Beim 14/1 darf ein Spieler keine Kugel fangen, berühren oder sonst behindern, die auf das Dreieck oder eine Tasche zuläuft (auch nicht mit der Hand in der Tasche). Das ist ein absichtliches Foul: ein Punkt Abzug und zusätzlich 15 Punkte. Der Gegner übernimmt die Lage mit Ball in Hand aus dem Kopffeld oder lässt neu aufbauen und den Spieler neu anstoßen.",
  sets: [{ discs: D141, tag: "14/1 · Ansage: 5", variants }],
};

export const en = {
  "Eine rollende Kugel fangen": "Catching a rolling ball",
  "Beim 14/1 darf ein Spieler keine Kugel fangen, berühren oder sonst behindern, die auf das Dreieck oder eine Tasche zuläuft (auch nicht mit der Hand in der Tasche). Das ist ein absichtliches Foul: ein Punkt Abzug und zusätzlich 15 Punkte. Der Gegner übernimmt die Lage mit Ball in Hand aus dem Kopffeld oder lässt neu aufbauen und den Spieler neu anstoßen.": "In 14.1 a player may not catch, touch or otherwise obstruct a ball that is running towards the triangle or a pocket (not even with the hand in the pocket). That is an intentional foul: one point deducted plus 15 points. The opponent takes over the position with ball in hand from the kitchen or has the balls re-racked and the player break again.",
  "Kugel gefangen": "ball caught",
  "Kugel aufhalten": "stop a ball",
  "Kugel abfangen": "intercept a ball",
  "Hand ins Loch": "hand in the pocket",
  "rollende Kugel behindert": "ball obstructed",
  "absichtliches Foul": "intentional foul",
  "16 Punkte": "16 points",
  "14/1 · Ansage: 5": "14.1 · call: 5",
  "Absichtliches Foul (−16)": "Intentional foul (−16)",
  "1 Punkt": "1 point",
  "Wer eine auf eine Tasche zulaufende Kugel fängt oder behindert, begeht ein absichtliches Foul: 1 Punkt und zusätzlich 15 Punkte Abzug.": "Anyone who catches or obstructs a ball running towards a pocket commits an intentional foul: 1 point and an additional 15 points deducted.",
  "Der Spieler lässt die Kugel laufen: sie fällt in die angesagte Tasche, ein Punkt.": "The player lets the ball run: it falls into the called pocket, one point.",
  "Ausgangslage: Die angesagte 5 liegt vor der Ecktasche.": "Starting position: the called 5 lies in front of the corner pocket.",
  "Die Weiße spielt die 5 an, sie rollt auf die Tasche zu.": "The cue ball plays the 5, it rolls towards the pocket.",
  "Der Spieler hält die rollende 5 mit der Hand auf, bevor sie die Tasche erreicht – ein absichtliches Foul.": "The player stops the rolling 5 with his hand before it reaches the pocket – an intentional foul.",
  "Der Spieler lässt die Kugel laufen, sie fällt in die angesagte Tasche – ein Punkt.": "The player lets the ball run, it falls into the called pocket – one point.",
};
