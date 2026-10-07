import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, tagSets } from "../meta.js";

/* Regel 3.15 (Foul mit der Aufbauhilfe): Die nach dem Anstoss entfernte Aufbauhilfe liegt auf der Bande.
   Beruehrt sie eine Kugel, ist das ein Foul. Beide Stoesse sind sonst regelgerecht (richtige Kugel,
   Kugel laeuft an die Bande); nur der Bandenpunkt der Kugel unterscheidet sich: Fall A trifft die
   Aufbauhilfe, Fall B laeuft daran vorbei. Beim 14/1 gibt es keine Aufbauhilfe. */
const T = [140, 60], W = [150, 100];
const TEMPLATE = { kind: "template", at: [120, 5.5] };
const a = cut(W, { id: "4", at: T }, [122, 15.5]);
const b = cut(W, { id: "4", at: T }, [165, 15.5]);
const balls = () => [cue(...W), ball(4, ...T), ball(9, 60, 70)];
const mk = (label, verdict, verdictLabel, reason, t3, shot, markAt) => ({
  label, verdict, verdictLabel, reason, balls: balls(),
  steps: [
    { text: "Ausgangslage: Nach dem Anstoß wurde die Aufbauhilfe entfernt und liegt auf der oberen Bande.", figs: [TEMPLATE], focus: ["4"] },
    { text: "Der Spieler spielt die 4 an.", figs: [TEMPLATE], aim: [W, shot.contact] },
    { text: t3, figs: [TEMPLATE], expectRail: true, moves: [shot.w, shot.obj], mark: { at: markAt, kind: verdict, after: "w", delay: 600 } },
  ],
});
const variants = [
  mk("Fall A", "foul", "Foul – Aufbauhilfe berührt",
    "Die 4 berührt die auf der Bande liegende Aufbauhilfe: Foul.",
    "Die 4 läuft an die Bande und berührt dabei die Aufbauhilfe – Foul.", a, [122, 15.5]),
  mk("Fall B", "ok", "Kein Foul",
    "Die 4 läuft an der Aufbauhilfe vorbei und berührt sie nicht.",
    "Die 4 läuft an die Bande, aber an der Aufbauhilfe vorbei – kein Foul.", b, [165, 15.5]),
];

export default {
  id: "aufbauhilfe-foul",
  released: true,
  discs: ["8 Ball", "9 Ball", "10 Ball"],
  topic: "tisch",
  tags: ["foul", "aufbau", "bande"],
  ref: "3.15",
  keywords: ["Aufbauhilfe auf der Bande", "Kugel berührt Aufbauhilfe", "Tappen", "Aufbauhilfe-Foul"],
  title: "Hilfsmittel auf der Bande berührt",
  rule: "Nach dem Anstoß wird die Aufbauhilfe vom Schiedsrichter möglichst schnell vom Tisch genommen; liegt sie danach auf der Bande, ist es ein Foul, wenn eine Kugel sie berührt. Die Aufbauhilfe darf nur entfernt werden, wenn sie von höchstens zwei Kugeln blockiert wird. Beim 14/1 wird ohne Aufbauhilfe aufgebaut.",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 4"],
    [D8, "Du spielst Volle"],
  ]),
};

export const en = {
  "Hilfsmittel auf der Bande berührt": "Aid on the cushion touched",
  "Nach dem Anstoß wird die Aufbauhilfe vom Schiedsrichter möglichst schnell vom Tisch genommen; liegt sie danach auf der Bande, ist es ein Foul, wenn eine Kugel sie berührt. Die Aufbauhilfe darf nur entfernt werden, wenn sie von höchstens zwei Kugeln blockiert wird. Beim 14/1 wird ohne Aufbauhilfe aufgebaut.": "After the break the referee removes the rack template from the table as quickly as possible; if it then lies on the cushion it is a foul if a ball touches it. The template may only be removed if it is blocked by at most two balls. In 14.1 the balls are racked without a template.",
  "Aufbauhilfe auf der Bande": "template on the cushion",
  "Kugel berührt Aufbauhilfe": "ball touches template",
  "Tappen": "tapping",
  "Aufbauhilfe-Foul": "template foul",
  "Niedrigste Kugel: 4": "Lowest ball: 4",
  "Du spielst Volle": "You play solids",
  "Foul – Aufbauhilfe berührt": "Foul – template touched",
  "Die 4 berührt die auf der Bande liegende Aufbauhilfe: Foul.": "The 4 touches the template lying on the cushion: foul.",
  "Die 4 läuft an der Aufbauhilfe vorbei und berührt sie nicht.": "The 4 runs past the template and does not touch it.",
  "Ausgangslage: Nach dem Anstoß wurde die Aufbauhilfe entfernt und liegt auf der oberen Bande.": "Starting position: after the break the template was removed and lies on the top cushion.",
  "Der Spieler spielt die 4 an.": "The player plays the 4.",
  "Die 4 läuft an die Bande und berührt dabei die Aufbauhilfe – Foul.": "The 4 runs to the cushion and touches the template – foul.",
  "Die 4 läuft an die Bande, aber an der Aufbauhilfe vorbei – kein Foul.": "The 4 runs to the cushion but past the template – no foul.",
};
