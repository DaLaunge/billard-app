import { cue, ball, cut } from "../../ruleEngine.js";
import { D8, D141 } from "../meta.js";
import { rack14 } from "../racks.js";

/* Weisse mit Ball in Hand im Kopffeld (links der Kopflinie, x < 60).
   Fall A: die erste getroffene Kugel liegt ebenfalls im Kopffeld, die Weisse
   verlaesst es vorher nicht - Foul. Fall B: die Kugel liegt ausserhalb, die
   Weisse ueberquert die Kopflinie - ok. */
const W = [32, 62];
const A7 = [50, 38], B7 = [118, 52];
const a = cut(W, { id: "7", at: A7 }, [56, 15.5]);
const b = cut(W, { id: "7", at: B7 }, [150, 15.5]);
/* Die uebrigen Kugeln muessen zum Spiel passen: beim 8 Ball liegt die 8 noch auf dem Tisch (neben eigenen und gegnerischen
   Kugeln), beim 14/1 liegt der Rest noch im Dreieck. Beim 9/10 Ball gibt es diese Regel nicht (Ball in Hand auf dem ganzen Tisch). */
const others8 = () => [ball(8, 172, 96), ball(3, 100, 96), ball(12, 128, 100), ball(13, 186, 62)];
const others141 = () => rack14().filter((x) => x.n !== 7).map((x) => ball(x.n, ...x.p));

const build = (others) => [
  {
    label: "Fall A", verdict: "foul",
    reason: "Die erste Kugel lag im Kopffeld, die Weiße hat es vorher nicht verlassen.",
    table: { headLine: true },
    balls: [cue(...W), ball(7, ...A7), ...others()],
    steps: [
      { text: "Ausgangslage: Die Weiße liegt im Kopffeld, die 7 ebenfalls.", focus: ["7"] },
      { text: "Die Weiße wird auf die 7 gespielt.", aim: [W, A7] },
      { text: "Die Weiße berührt die 7, ohne vorher das Kopffeld zu verlassen – Foul.", expectRail: true, moves: [a.w, a.obj], mark: { at: A7, kind: "foul", after: "w" } },
    ],
  },
  {
    label: "Fall B", verdict: "ok",
    reason: "Die Weiße hat die Kopflinie überquert, bevor sie die Kugel traf.",
    table: { headLine: true },
    balls: [cue(...W), ball(7, ...B7), ...others()],
    steps: [
      { text: "Ausgangslage: Die Weiße liegt im Kopffeld, die 7 außerhalb.", focus: ["7"] },
      { text: "Die Weiße wird auf die 7 gespielt.", aim: [W, B7] },
      { text: "Die Weiße überquert die Kopflinie und trifft die 7, die danach an die Bande läuft – regelgerecht.", expectRail: true, moves: [b.w, b.obj], mark: { at: B7, kind: "ok", after: "w" } },
    ],
  },
];

export default {
  id: "spiel-aus-dem-kopffeld",
  released: true,
  discs: ["8 Ball", "14/1 Endlos"],
  topic: "weisse",
  tags: ["foul", "kopffeld"],
  ref: "3.11, 4.9, 7.9",
  keywords: ["Kopffeld", "Kopflinie", "Ball in Hand Kopffeld", "Weiße verlässt Kopffeld", "Kugel im Kopffeld"],
  title: "Spiel aus dem Kopffeld",
  rule: "Muss die Weiße mit Ball in Hand aus dem Kopffeld gespielt werden und liegt die erste angespielte Kugel ebenfalls im Kopffeld, ist das ein Foul – es sei denn, die Weiße hat das Kopffeld verlassen, bevor sie diese Kugel berührt. Die Weiße muss also entweder die Kopflinie überqueren oder eine Kugel außerhalb des Kopffeldes treffen. Spielt der Spieler das absichtlich, gilt es als unsportliches Verhalten. Beim 14/1 bekommt der Gegner nach dem Foul die Weiße im Kopffeld.",
  sets: [
    { discs: D8, tag: "Du spielst Volle", variants: build(others8) },
    { discs: D141, tag: "14/1 · Ansage: 7", variants: build(others141) },
  ],
};

export const en = {
  "Spiel aus dem Kopffeld": "Playing from the kitchen",
  "Muss die Weiße mit Ball in Hand aus dem Kopffeld gespielt werden und liegt die erste angespielte Kugel ebenfalls im Kopffeld, ist das ein Foul – es sei denn, die Weiße hat das Kopffeld verlassen, bevor sie diese Kugel berührt. Die Weiße muss also entweder die Kopflinie überqueren oder eine Kugel außerhalb des Kopffeldes treffen. Spielt der Spieler das absichtlich, gilt es als unsportliches Verhalten. Beim 14/1 bekommt der Gegner nach dem Foul die Weiße im Kopffeld.":
    "If the cue ball has to be played from the kitchen with ball in hand and the first ball played is also in the kitchen, it is a foul – unless the cue ball has left the kitchen before touching that ball. So the cue ball must either cross the head string or hit a ball outside the kitchen. If the player does this on purpose it counts as unsportsmanlike conduct. In 14.1 the opponent gets the cue ball in the kitchen after the foul.",
  "Kopffeld": "kitchen",
  "Kopflinie": "head string",
  "Ball in Hand Kopffeld": "ball in hand in the kitchen",
  "Weiße verlässt Kopffeld": "cue ball leaves the kitchen",
  "Kugel im Kopffeld": "ball in the kitchen",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 7": "14.1 · call: 7",
  "Die erste Kugel lag im Kopffeld, die Weiße hat es vorher nicht verlassen.": "The first ball lay in the kitchen, the cue ball did not leave it beforehand.",
  "Die Weiße hat die Kopflinie überquert, bevor sie die Kugel traf.": "The cue ball crossed the head string before hitting the ball.",
  "Ausgangslage: Die Weiße liegt im Kopffeld, die 7 ebenfalls.": "Starting position: the cue ball is in the kitchen, and so is the 7.",
  "Ausgangslage: Die Weiße liegt im Kopffeld, die 7 außerhalb.": "Starting position: the cue ball is in the kitchen, the 7 is outside.",
  "Die Weiße wird auf die 7 gespielt.": "The cue ball is played at the 7.",
  "Die Weiße berührt die 7, ohne vorher das Kopffeld zu verlassen – Foul.": "The cue ball touches the 7 without leaving the kitchen first – foul.",
  "Die Weiße überquert die Kopflinie und trifft die 7, die danach an die Bande läuft – regelgerecht.": "The cue ball crosses the head string and hits the 7, which then runs to the cushion – legal.",
};
