import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, D141, tagSets } from "../meta.js";

/* Regel 3.6: Jede Beruehrung einer Kugel ausser dem Stoss mit dem Queue ist ein Foul - auch mit der
   Hand oder dem Aermel, auch beim Abstuetzen. Die Hand kommt von unten an die 9 heran: in Fall A
   streift sie die Kugel (sie bewegt sich ein Stueck), in Fall B bleibt sie knapp davor. Der
   anschliessende Stoss auf die 4 ist in beiden Faellen regelgerecht. */
const T = [150, 50], P = [207, 13], W = [91.2, 88.2], N9 = [110, 95], N9m = [110, 91.5];
const shot = cut(W, { id: "4", at: T }, P, { out: true });
const balls = () => [cue(...W), ball(4, ...T), ball(9, ...N9)];
const hand = (y) => ({ kind: "hand", angle: -90, from: [N9[0], 130], at: [N9[0], y], dur: 650 });
const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Foul – Kugel berührt",
    reason: "Die Hand berührt die 9 und bewegt sie: jede Berührung einer Kugel außer dem Stoß mit dem Queue ist ein Foul.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Der Spieler hat die angesagte 4 vor der Ecktasche, die 9 liegt unten.", focus: ["4"] },
      { text: "Beim Hinüberbeugen streift die Hand die 9 und schiebt sie ein Stück weiter.", figs: [hand(108)], moves: [{ id: "9", to: N9m, stop: true, delay: 520 }] },
      { text: "Der Spieler spielt die 4 an und versenkt sie – trotzdem ein Foul wegen der berührten 9.", aim: [W, shot.contact], expectRail: true, moves: [shot.w, shot.obj], mark: { at: N9m, kind: "foul", after: "w", delay: 200 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Kein Foul",
    reason: "Die Hand bleibt knapp vor der 9 und berührt sie nicht: der Stoß ist regelgerecht.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Der Spieler hat die angesagte 4 vor der Ecktasche, die 9 liegt unten.", focus: ["4"] },
      { text: "Beim Hinüberbeugen bleibt die Hand knapp vor der 9 – die Kugel wird nicht berührt.", figs: [hand(116)] },
      { text: "Der Spieler spielt die 4 an und versenkt sie – kein Foul.", aim: [W, shot.contact], expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: "ok", after: "w", delay: 300 } },
    ],
  },
];

export default {
  id: "kugel-beruehrt",
  released: false,
  discs: ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "stoss",
  ref: "3.6",
  keywords: ["Kugel berührt", "mit der Hand berührt", "Ärmel", "Kugel verschoben", "versehentlich berühren", "Berühren einer Kugel", "Abstützen"],
  title: "Berühren einer Kugel (Hand, Ärmel)",
  rule: "Jede Berührung oder Bewegung einer Kugel, außer dem normalen Kontakt im Stoß, ist ein Foul – mit der Hand, dem Ärmel, der Kleidung, den Haaren, Kreide oder der Brücke. Der Spieler haftet für alles, was er an den Tisch bringt. Unabsichtlich ist es ein Standardfoul, absichtlich zählt es als unsportliches Verhalten.",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 4"],
    [D8, "Du spielst Volle"],
    [D141, "14/1 · Ansage: 4"],
  ]),
};

export const en = {
  "Berühren einer Kugel (Hand, Ärmel)": "Touching a ball (hand, sleeve)",
  "Jede Berührung oder Bewegung einer Kugel, außer dem normalen Kontakt im Stoß, ist ein Foul – mit der Hand, dem Ärmel, der Kleidung, den Haaren, Kreide oder der Brücke. Der Spieler haftet für alles, was er an den Tisch bringt. Unabsichtlich ist es ein Standardfoul, absichtlich zählt es als unsportliches Verhalten.": "Any touching or moving of a ball, other than the normal contact in the stroke, is a foul – with the hand, sleeve, clothing, hair, chalk or bridge. The player is liable for everything he brings to the table. Unintentional it is a standard foul, intentional it counts as unsportsmanlike conduct.",
  "Kugel berührt": "ball touched",
  "mit der Hand berührt": "touched with the hand",
  "Ärmel": "sleeve",
  "Kugel verschoben": "ball displaced",
  "versehentlich berühren": "touch by accident",
  "Berühren einer Kugel": "touching a ball",
  "Abstützen": "bracing",
  "Niedrigste Kugel: 4": "Lowest ball: 4",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 4": "14.1 · call: 4",
  "Foul – Kugel berührt": "Foul – ball touched",
  "Die Hand berührt die 9 und bewegt sie: jede Berührung einer Kugel außer dem Stoß mit dem Queue ist ein Foul.": "The hand touches the 9 and moves it: any touching of a ball other than the stroke with the cue is a foul.",
  "Die Hand bleibt knapp vor der 9 und berührt sie nicht: der Stoß ist regelgerecht.": "The hand stays just short of the 9 and does not touch it: the shot is legal.",
  "Ausgangslage: Der Spieler hat die angesagte 4 vor der Ecktasche, die 9 liegt unten.": "Starting position: the player has the called 4 in front of the corner pocket, the 9 lies at the bottom.",
  "Beim Hinüberbeugen streift die Hand die 9 und schiebt sie ein Stück weiter.": "Leaning over, the hand brushes the 9 and pushes it a little.",
  "Der Spieler spielt die 4 an und versenkt sie – trotzdem ein Foul wegen der berührten 9.": "The player plays the 4 and pockets it – still a foul because of the touched 9.",
  "Beim Hinüberbeugen bleibt die Hand knapp vor der 9 – die Kugel wird nicht berührt.": "Leaning over, the hand stays just short of the 9 – the ball is not touched.",
  "Der Spieler spielt die 4 an und versenkt sie – kein Foul.": "The player plays the 4 and pockets it – no foul.",
};
