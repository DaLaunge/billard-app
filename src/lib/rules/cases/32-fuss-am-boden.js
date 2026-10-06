import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, D141, tagSets } from "../meta.js";

/* Regel 3.4: Im Moment des Stosses muss mindestens ein Fuss den Boden beruehren. Der Stoss selbst
   ist in beiden Faellen regelgerecht (richtige Kugel, Kugel faellt) - nur die Fuesse unterscheiden
   sich, gezeigt in der Seitenansicht (`stance`). */
const T = [150, 50], P = [207, 13], W = [91.2, 88.2];
const shot = cut(W, { id: "4", at: T }, P, { out: true });
const balls = () => [cue(...W), ball(4, ...T), ball(9, 110, 95)];
const mk = (kind, stance, label, verdict, verdictLabel, reason, t2, t3) => ({
  label, verdict, verdictLabel, reason, balls: balls(),
  steps: [
    { text: "Ausgangslage: Der Spieler hat die angesagte 4 vor der Ecktasche.", focus: ["4"] },
    { text: t2, stance, aim: [W, shot.contact] },
    { text: t3, stance, expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind, after: "w", delay: 300 } },
  ],
});

const variants = [
  mk("foul", "air", "Fall A", "foul", "Foul – kein Fuß am Boden",
    "Im Moment des Stoßes berührt kein Fuß den Boden (hier: Knie auf dem Tisch). Das ist ein Foul, auch wenn der Stoß selbst richtig ist.",
    "Der Spieler stützt sich mit beiden Knien auf den Tisch, beide Füße sind in der Luft.",
    "Er stößt und versenkt die 4 – trotzdem ein Foul, weil kein Fuß den Boden berührt."),
  mk("ok", "ok", "Fall B", "ok", "Kein Foul",
    "Mindestens ein Fuß berührt den Boden: der Stoß ist regelgerecht.",
    "Der Spieler beugt sich über den Tisch, ein Fuß steht fest auf dem Boden, der andere ist angewinkelt.",
    "Er stößt und versenkt die 4 – kein Foul, ein Fuß war am Boden."),
];

export default {
  id: "fuss-am-boden",
  released: false,
  discs: ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "stoss",
  ref: "3.4",
  keywords: ["Fuß am Boden", "Füße", "Knie auf dem Tisch", "Stand beim Stoß", "kein Fuß auf dem Boden", "auf den Tisch setzen"],
  title: "Mindestens ein Fuß am Boden",
  rule: "Im Moment des Stoßes (Kontakt der Pomeranze mit der Weißen) muss mindestens ein Fuß des Spielers den Boden berühren. Sonst ist es ein Foul – auch wenn der Stoß sonst regelgerecht ist.",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 4"],
    [D8, "Du spielst Volle"],
    [D141, "14/1 · Ansage: 4"],
  ]),
};

export const en = {
  "Mindestens ein Fuß am Boden": "At least one foot on the floor",
  "Im Moment des Stoßes (Kontakt der Pomeranze mit der Weißen) muss mindestens ein Fuß des Spielers den Boden berühren. Sonst ist es ein Foul – auch wenn der Stoß sonst regelgerecht ist.": "At the moment of the stroke (tip contacting the cue ball) at least one foot of the player must touch the floor. Otherwise it is a foul – even if the shot is otherwise legal.",
  "Fuß am Boden": "foot on the floor",
  "Füße": "feet",
  "Knie auf dem Tisch": "knee on the table",
  "Stand beim Stoß": "stance when shooting",
  "kein Fuß auf dem Boden": "no foot on the floor",
  "auf den Tisch setzen": "sitting on the table",
  "Niedrigste Kugel: 4": "Lowest ball: 4",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 4": "14.1 · call: 4",
  "Foul – kein Fuß am Boden": "Foul – no foot on the floor",
  "Im Moment des Stoßes berührt kein Fuß den Boden (hier: Knie auf dem Tisch). Das ist ein Foul, auch wenn der Stoß selbst richtig ist.": "At the moment of the stroke no foot touches the floor (here: knees on the table). That is a foul even if the shot itself is right.",
  "Mindestens ein Fuß berührt den Boden: der Stoß ist regelgerecht.": "At least one foot touches the floor: the shot is legal.",
  "Ausgangslage: Der Spieler hat die angesagte 4 vor der Ecktasche.": "Starting position: the player has the called 4 in front of the corner pocket.",
  "Der Spieler stützt sich mit beiden Knien auf den Tisch, beide Füße sind in der Luft.": "The player rests both knees on the table, both feet are off the floor.",
  "Er stößt und versenkt die 4 – trotzdem ein Foul, weil kein Fuß den Boden berührt.": "He shoots and pockets the 4 – still a foul, because no foot touches the floor.",
  "Der Spieler beugt sich über den Tisch, ein Fuß steht fest auf dem Boden, der andere ist angewinkelt.": "The player leans over the table, one foot stands firmly on the floor, the other is bent.",
  "Er stößt und versenkt die 4 – kein Foul, ein Fuß war am Boden.": "He shoots and pockets the 4 – no foul, one foot was on the floor.",
};
