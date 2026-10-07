import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, D141, tagSets } from "../meta.js";

/* Eine Kugel liegt press an der Bande (vom Schiedsrichter angesagt). Wird sie getroffen, muss
   danach eine Kugel in die Tasche fallen oder an eine ANDERE Bande laufen (nur von der eigenen
   Bande abprallen genuegt nicht). Fall A: Die 4 prallt nur von ihrer Bande ab und bleibt auf
   dem Tisch - Foul. Fall B: derselbe Treffer, die 4 laeuft nach dem Abprall an die rechte
   Bande - regelgerecht. */
const W = [70, 90], T = [120, 104.5], P9 = [160, 40];
const N = [0.97, 0.24]; // Mittelpunktslinie: die Weisse druckt die 4 leicht in die Bande
const aim = [T[0] + N[0] * 20, T[1] + N[1] * 20];
const a = cut(W, { id: "4", at: T }, aim);
a.obj.to = [149.1, 97.3]; a.obj.rebound = true;
const b = cut(W, { id: "4", at: T }, aim);
b.obj.to = [204.5, 83.6]; b.obj.rebound = true;
const balls = () => [cue(...W), ball(4, ...T), ball(9, ...P9)];

const variants = [
  {
    label: "Fall A", verdict: "foul",
    reason: "Nach dem Treffer berührt keine Kugel eine andere Bande: die 4 ist nur von ihrer eigenen Bande abgeprallt.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Die 4 liegt press an der unteren Bande, der Schiedsrichter hat das angesagt.", say: "press an der Bande", sayIcon: "mouth", focus: ["4"] },
      { text: "Die Weiße trifft die 4 und drückt sie leicht in die Bande.", aim: [W, a.contact] },
      { text: "Die 4 prallt von der Bande ab und bleibt auf dem Tisch. Keine Kugel berührt eine andere Bande – Foul.", expectRail: false, moves: [a.w, a.obj], mark: { at: T, kind: "foul", after: "w" } },
    ],
  },
  {
    label: "Fall B", verdict: "ok",
    reason: "Die 4 läuft nach dem Abprall an eine andere Bande: die Bedingung ist erfüllt.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Die 4 liegt press an der unteren Bande, der Schiedsrichter hat das angesagt.", say: "press an der Bande", sayIcon: "mouth", focus: ["4"] },
      { text: "Die Weiße trifft die 4 und drückt sie leicht in die Bande.", aim: [W, b.contact] },
      { text: "Die 4 prallt ab und läuft bis zur rechten Bande – einer anderen als der, an der sie lag. Regelgerecht.", expectRail: true, moves: [b.w, b.obj], mark: { at: T, kind: "ok", after: "w" } },
    ],
  },
];

export default {
  id: "press-bande",
  released: true,
  discs: ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "bande",
  tags: ["bande", "tisch"],
  ref: "2.7, 3.3, 3.7",
  keywords: ["press an der Bande", "pressliegende Kugel", "Kugel an der Bande", "anliegende Kugel", "Bandenkontakt", "andere Bande", "abprallen", "Roll-up"],
  title: "Kugel liegt press an der Bande",
  rule: "Eine Bandenberührung zählt nur, wenn die Kugel die Bande vor dem Stoß nicht berührt hat. Liegt eine Kugel zu Beginn des Stoßes press an einer Bande, muss sie diese Bande zuerst verlassen und dann diese oder eine andere Bande erneut anlaufen, sonst zählt es nicht als Bandenberührung – nach der Lehrunterlage genügt dafür nicht, dass die Kugel nur von der Bande abprallt, an der sie lag. Nach dem Treffer einer press liegenden Kugel muss deshalb eine Kugel fallen, die Weiße eine Bande anlaufen oder diese beziehungsweise eine andere Kugel eine Bande anlaufen, an der sie nicht press lag. Eine Kugel gilt erst als press liegend, wenn der Schiedsrichter (oder der Gegner) sie angesagt hat; der Spieler darf die Prüfung vor dem Stoß verlangen. Spielt der Spieler von einer press liegenden Kugel weg, gilt sie als nicht getroffen. Eine Kugel, die gefallen oder vom Tisch gesprungen ist, gilt als hätte sie eine Bande berührt.",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 4"],
    [D8, "Du spielst Volle"],
    [D141, "14/1 · Ansage: 4"],
  ]),
};

export const en = {
  "Kugel liegt press an der Bande": "Ball frozen to the cushion",
  "Eine Bandenberührung zählt nur, wenn die Kugel die Bande vor dem Stoß nicht berührt hat. Liegt eine Kugel zu Beginn des Stoßes press an einer Bande, muss sie diese Bande zuerst verlassen und dann diese oder eine andere Bande erneut anlaufen, sonst zählt es nicht als Bandenberührung – nach der Lehrunterlage genügt dafür nicht, dass die Kugel nur von der Bande abprallt, an der sie lag. Nach dem Treffer einer press liegenden Kugel muss deshalb eine Kugel fallen, die Weiße eine Bande anlaufen oder diese beziehungsweise eine andere Kugel eine Bande anlaufen, an der sie nicht press lag. Eine Kugel gilt erst als press liegend, wenn der Schiedsrichter (oder der Gegner) sie angesagt hat; der Spieler darf die Prüfung vor dem Stoß verlangen. Spielt der Spieler von einer press liegenden Kugel weg, gilt sie als nicht getroffen. Eine Kugel, die gefallen oder vom Tisch gesprungen ist, gilt als hätte sie eine Bande berührt.":
    "A cushion contact only counts if the ball did not touch that cushion before the shot. If a ball is frozen to a cushion at the start of the shot, it must first leave that cushion and then reach this or another cushion again, otherwise it does not count as a cushion contact – according to the training material it is not enough for the ball to merely rebound off the cushion it lay on. After hitting a frozen ball, therefore, a ball must be pocketed, the cue ball must reach a cushion, or this or another ball must reach a cushion it was not frozen to. A ball only counts as frozen once the referee (or the opponent) has called it; the player may ask for the check before the shot. If the player plays away from a frozen ball it counts as not hit. A ball that has been pocketed or has jumped off the table counts as having touched a cushion.",
  "press an der Bande": "frozen to the cushion",
  "pressliegende Kugel": "frozen ball",
  "Kugel an der Bande": "ball on the cushion",
  "anliegende Kugel": "adjacent ball",
  "Bandenkontakt": "cushion contact",
  "andere Bande": "other cushion",
  "abprallen": "rebound",
  "Roll-up": "roll-up",
  "Niedrigste Kugel: 4": "Lowest ball: 4",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 4": "14.1 · call: 4",
  "Nach dem Treffer berührt keine Kugel eine andere Bande: die 4 ist nur von ihrer eigenen Bande abgeprallt.": "After the hit no ball touches another cushion: the 4 only rebounded off its own cushion.",
  "Die 4 läuft nach dem Abprall an eine andere Bande: die Bedingung ist erfüllt.": "After the rebound the 4 runs to another cushion: the condition is met.",
  "Ausgangslage: Die 4 liegt press an der unteren Bande, der Schiedsrichter hat das angesagt.": "Starting position: the 4 is frozen to the lower cushion, the referee has called it.",
  "Die Weiße trifft die 4 und drückt sie leicht in die Bande.": "The cue ball hits the 4 and presses it slightly into the cushion.",
  "Die 4 prallt von der Bande ab und bleibt auf dem Tisch. Keine Kugel berührt eine andere Bande – Foul.": "The 4 rebounds off the cushion and stays on the table. No ball touches another cushion – foul.",
  "Die 4 prallt ab und läuft bis zur rechten Bande – einer anderen als der, an der sie lag. Regelgerecht.": "The 4 rebounds and runs to the right cushion – a different one from the one it lay on. Legal.",
};
