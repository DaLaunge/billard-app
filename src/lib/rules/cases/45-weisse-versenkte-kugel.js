import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, D141, tagSets } from "../meta.js";

/* Regel 2.2 / OS19 3.19: Eine versenkte Kugel liegt in der Tasche (volle Tasche). Beruehrt die Weisse
   diese Kugel, gilt die Weisse als versenkt - Foul (Scratch). Die Weisse laeuft nach einem duennen
   Treffer tangential in die Ecke: in Fall A bis an die versenkte 7 (Beruehrung), in Fall B bleibt sie
   knapp davor liegen (keine Beruehrung). Der Treffer auf die 4 ist beide Male regelgerecht (die 4
   laeuft an die Bande). */
const T = [150, 54], W = [120, 36], POCKETED = [211.4, 9];
const a = cut(W, { id: "4", at: T }, [174, 104.5]);
const b = cut(W, { id: "4", at: T }, [172, 104.5]);
const balls = () => [cue(...W), ball(4, ...T), { ...ball(7, ...POCKETED), pocketed: true }, ball(12, 60, 90)];

const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Foul – Weiße gilt als versenkt",
    reason: "Die Weiße berührt die bereits versenkte 7 in der vollen Tasche: sie gilt als versenkt, es ist ein Foul.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Die 7 liegt versenkt in der Ecktasche (die Tasche ist voll).", focus: ["7"] },
      { text: "Der Spieler trifft die 4 dünn. Die Weiße läuft zur Ecktasche.", aim: [W, a.contact] },
      { text: "Die Weiße rollt bis an die versenkte 7 und berührt sie – die Weiße gilt als versenkt: Foul.", expectRail: true, moves: [a.w, a.obj], mark: { at: [203, 17], kind: "foul", afterEnd: "w", delay: -200 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Kein Foul",
    reason: "Die Weiße bleibt vor der versenkten 7 liegen und berührt sie nicht.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Die 7 liegt versenkt in der Ecktasche (die Tasche ist voll).", focus: ["7"] },
      { text: "Der Spieler trifft die 4 dünn. Die Weiße läuft zur Ecktasche.", aim: [W, b.contact] },
      { text: "Die Weiße bleibt vor der 7 liegen, ohne sie zu berühren – kein Foul.", expectRail: true, moves: [b.w, b.obj], mark: { at: b.w.to, kind: "ok", afterEnd: "w", delay: -200 } },
    ],
  },
];

export default {
  id: "weisse-versenkte-kugel",
  released: false,
  discs: ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "weisse",
  ref: "2.2",
  keywords: ["versenkte Kugel berührt", "Weiße berührt versenkte Kugel", "Kugel in der Tasche", "Tasche voll"],
  title: "Volle Tasche: Kugel in der Tasche berührt",
  rule: "Berührt die Weiße eine bereits versenkte Kugel (zum Beispiel in einer vollen Tasche), gilt die Weiße als versenkt: das ist ein Foul. Eine Objektkugel, die aus der Tasche auf den Tisch zurückspringt, gilt nicht als versenkt. Volle Taschen leert der Schiedsrichter, die Verantwortung bleibt aber beim Spieler.",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 4"],
    [D8, "Du spielst Volle"],
    [D141, "14/1 · Ansage: 4"],
  ]),
};

export const en = {
  "Volle Tasche: Kugel in der Tasche berührt": "Full pocket: ball in the pocket touched",
  "Berührt die Weiße eine bereits versenkte Kugel (zum Beispiel in einer vollen Tasche), gilt die Weiße als versenkt: das ist ein Foul. Eine Objektkugel, die aus der Tasche auf den Tisch zurückspringt, gilt nicht als versenkt. Volle Taschen leert der Schiedsrichter, die Verantwortung bleibt aber beim Spieler.": "If the cue ball touches a ball that is already pocketed (for example in a full pocket) the cue ball counts as pocketed: that is a foul. An object ball that jumps back from the pocket onto the table does not count as pocketed. The referee empties full pockets, but the responsibility stays with the player.",
  "versenkte Kugel berührt": "pocketed ball touched",
  "Weiße berührt versenkte Kugel": "cue ball touches pocketed ball",
  "Kugel in der Tasche": "ball in the pocket",
  "Tasche voll": "pocket full",
  "Niedrigste Kugel: 4": "Lowest ball: 4",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 4": "14.1 · call: 4",
  "Foul – Weiße gilt als versenkt": "Foul – cue ball counts as pocketed",
  "Die Weiße berührt die bereits versenkte 7 in der vollen Tasche: sie gilt als versenkt, es ist ein Foul.": "The cue ball touches the already pocketed 7 in the full pocket: it counts as pocketed, it is a foul.",
  "Die Weiße bleibt vor der versenkten 7 liegen und berührt sie nicht.": "The cue ball stops short of the pocketed 7 and does not touch it.",
  "Ausgangslage: Die 7 liegt versenkt in der Ecktasche (die Tasche ist voll).": "Starting position: the 7 lies pocketed in the corner pocket (the pocket is full).",
  "Der Spieler trifft die 4 dünn. Die Weiße läuft zur Ecktasche.": "The player hits the 4 thinly. The cue ball runs to the corner pocket.",
  "Die Weiße rollt bis an die versenkte 7 und berührt sie – die Weiße gilt als versenkt: Foul.": "The cue ball rolls up to the pocketed 7 and touches it – the cue ball counts as pocketed: foul.",
  "Die Weiße bleibt vor der 7 liegen, ohne sie zu berühren – kein Foul.": "The cue ball stops short of the 7 without touching it – no foul.",
};
