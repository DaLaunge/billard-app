import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, D141, tagSets } from "../meta.js";

/* Regel 3.7: Liegt die Weisse press an einer Kugel (der Schiedsrichter oder der Gegner hat es angesagt;
   der Spieler muss die Ansage einfordern), darf sie in Richtung dieser Kugel gespielt werden - die Kugel
   gilt dann als getroffen, auch wenn sich Weisse und Kugel kaum trennen. Spielt der Spieler von der Kugel
   weg, gilt sie als NICHT getroffen: wird dabei keine andere Kugel beruehrt, ist es ein Foul.
   Fall A: Stoss auf die 4 zu (die 4 laeuft an die Bande). Fall B: Stoss von der 4 weg an die Kopfbande. */
const T = [120, 60], W = [108.5, 60];
const toward = cut(W, { id: "4", at: T }, [204.5, 60]);
const away = { id: "w", via: [[15.5, 60]], to: [45, 60] };
const balls = () => [cue(...W), ball(4, ...T), ball(9, 60, 95)];
const SAY = "press angesagt";

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "Kein Foul – 4 gilt als getroffen",
    reason: "Die Weiße liegt press an der 4 und wird auf sie zu gespielt: die 4 gilt als getroffen, sie läuft danach an die Bande.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Die Weiße liegt press an der 4, der Schiedsrichter hat es angesagt.", say: SAY, sayIcon: "mouth", focus: ["4"] },
      { text: "Der Spieler stößt in Richtung der 4. Die 4 gilt als getroffen und läuft an die Bande – regelgerecht.", expectRail: true, moves: [toward.w, toward.obj], mark: { at: [204.5, 60], kind: "ok", after: "w", delay: 600 } },
    ],
  },
  {
    label: "Fall B", verdict: "foul", verdictLabel: "Foul – keine Kugel getroffen",
    reason: "Spielt der Spieler von der pressliegenden Kugel weg, gilt sie als nicht getroffen. Die Weiße berührt keine andere Kugel: Foul.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Die Weiße liegt press an der 4, der Schiedsrichter hat es angesagt.", say: SAY, sayIcon: "mouth", focus: ["4"] },
      { text: "Der Spieler stößt von der 4 weg an die Kopfbande. Die 4 gilt als nicht getroffen – es wird keine Kugel berührt: Foul.", moves: [away], mark: { at: [15.5, 60], kind: "foul", afterEnd: "w", delay: -300 } },
    ],
  },
];

export default {
  id: "weisse-press",
  released: false,
  discs: ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "weisse",
  ref: "3.7, 2.7",
  keywords: ["Weiße press an Kugel", "pressliegende Weiße", "Weiße liegt an der Kugel", "von der Kugel wegspielen", "Kugel gilt als getroffen", "Weiße anliegend"],
  title: "Weiße liegt press an einer Kugel",
  rule: "Liegt die Weiße press an einer Kugel, darf sie in Richtung dieser Kugel gespielt werden; die Kugel gilt dann als getroffen. Die Weiße gilt aber erst als press liegend, wenn der Schiedsrichter, der Gegner oder der Spieler es angesagt hat; der Spieler muss die Ansage einfordern. Spielt der Spieler von der Kugel weg, gilt sie als nicht getroffen. Berührt die Weiße dabei keine andere Kugel, ist es ein Foul.",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 4"],
    [D8, "Du spielst Volle"],
    [D141, "14/1 · Ansage: 4"],
  ]),
};

export const en = {
  "Weiße liegt press an einer Kugel": "Cue ball frozen to a ball",
  "Liegt die Weiße press an einer Kugel, darf sie in Richtung dieser Kugel gespielt werden; die Kugel gilt dann als getroffen. Die Weiße gilt aber erst als press liegend, wenn der Schiedsrichter, der Gegner oder der Spieler es angesagt hat; der Spieler muss die Ansage einfordern. Spielt der Spieler von der Kugel weg, gilt sie als nicht getroffen. Berührt die Weiße dabei keine andere Kugel, ist es ein Foul.": "If the cue ball is frozen to a ball it may be played towards that ball; the ball then counts as hit. The cue ball only counts as frozen once the referee, the opponent or the player has called it; the player must ask for the call. If the player shoots away from the ball it counts as not hit. If the cue ball touches no other ball it is a foul.",
  "Weiße press an Kugel": "cue ball frozen to ball",
  "pressliegende Weiße": "frozen cue ball",
  "Weiße liegt an der Kugel": "cue ball touching the ball",
  "von der Kugel wegspielen": "shoot away from the ball",
  "Kugel gilt als getroffen": "ball counts as hit",
  "Weiße anliegend": "cue ball adjacent",
  "Niedrigste Kugel: 4": "Lowest ball: 4",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 4": "14.1 · call: 4",
  "press angesagt": "frozen called",
  "Kein Foul – 4 gilt als getroffen": "No foul – the 4 counts as hit",
  "Foul – keine Kugel getroffen": "Foul – no ball hit",
  "Die Weiße liegt press an der 4 und wird auf sie zu gespielt: die 4 gilt als getroffen, sie läuft danach an die Bande.": "The cue ball is frozen to the 4 and played towards it: the 4 counts as hit and then runs to a cushion.",
  "Spielt der Spieler von der pressliegenden Kugel weg, gilt sie als nicht getroffen. Die Weiße berührt keine andere Kugel: Foul.": "If the player shoots away from the frozen ball it counts as not hit. The cue ball touches no other ball: foul.",
  "Ausgangslage: Die Weiße liegt press an der 4, der Schiedsrichter hat es angesagt.": "Starting position: the cue ball is frozen to the 4, the referee has called it.",
  "Der Spieler stößt in Richtung der 4. Die 4 gilt als getroffen und läuft an die Bande – regelgerecht.": "The player shoots towards the 4. The 4 counts as hit and runs to a cushion – legal.",
  "Der Spieler stößt von der 4 weg an die Kopfbande. Die 4 gilt als nicht getroffen – es wird keine Kugel berührt: Foul.": "The player shoots away from the 4 to the head cushion. The 4 counts as not hit – no ball is touched: foul.",
};
