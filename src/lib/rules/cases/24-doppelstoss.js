import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, D141, tagSets, SOURCE_OBERSCHIRI } from "../meta.js";

/* Doppelstoss bei sehr kleinem Abstand: die Weisse liegt knapp (weniger als eine Kreidestaerke)
   vor der Kugel. Laeuft sie der getroffenen Kugel um mehr als eine halbe Kugelbreite nach, ist es
   ein Foul (Queue beruehrt die Weisse noch, waehrend sie die Kugel schon trifft), sonst nicht. */
const W = [100, 60], T4 = [115, 60], P9 = [80, 100];
const shot = cut(W, { id: "4", at: T4 }, [204.5, 60]);
const C = shot.contact;
const follow = (len) => ({ id: "w", via: [C], to: [C[0] + len, 60], stop: true });

const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Foul (Doppelstoß)",
    reason: "Die Weiße läuft der Kugel mehr als eine halbe Kugelbreite nach.",
    balls: [cue(...W), ball(4, ...T4), ball(9, ...P9)],
    steps: [
      { text: "Ausgangslage: Die Weiße liegt knapp vor der 4, ein kleiner Spalt trennt sie.", focus: ["4"] },
      { text: "Die Weiße wird gerade auf die 4 gespielt.", aim: [W, T4] },
      { text: "Die 4 läuft weg, die Weiße folgt ihr um mehr als eine halbe Kugelbreite – Doppelstoß, Foul.", expectRail: true, moves: [follow(9), shot.obj], mark: { at: T4, kind: "foul", after: "w" } },
    ],
  },
  {
    label: "Fall B", verdict: "ok",
    reason: "Die Weiße läuft der Kugel höchstens eine halbe Kugelbreite nach.",
    balls: [cue(...W), ball(4, ...T4), ball(9, ...P9)],
    steps: [
      { text: "Ausgangslage: Die Weiße liegt knapp vor der 4, ein kleiner Spalt trennt sie.", focus: ["4"] },
      { text: "Die Weiße wird gerade auf die 4 gespielt.", aim: [W, T4] },
      { text: "Die 4 läuft weg, die Weiße folgt ihr weniger als eine halbe Kugelbreite – regelgerecht.", expectRail: true, moves: [follow(3), shot.obj], mark: { at: T4, kind: "ok", after: "w" } },
    ],
  },
];

export default {
  id: "doppelstoss",
  released: false,
  discs: ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "weisse",
  ref: "2.20, 3.22, 3.23",
  src: SOURCE_OBERSCHIRI,
  keywords: ["Doppelstoß", "Weiße läuft nach", "nachlaufen", "halbe Kugelbreite", "Durchstoß", "Queue berührt zweimal", "knapp vor der Kugel", "Kreidestärke"],
  title: "Doppelstoß: Weiße läuft nach",
  rule: "Liegt die Weiße so dicht vor einer Kugel, dass der Abstand kleiner ist als die Stärke eines Stücks Kreide, braucht der Schiedsrichter besondere Aufmerksamkeit. Läuft die Weiße der getroffenen Kugel um mehr als eine halbe Kugelbreite nach, ist das ein Foul – es sei denn, der Schiedsrichter kann sicher sagen, dass der Stoß korrekt war. Der Grund steht auch in den Spielregeln 2026 (3.7): Es ist ein Foul, wenn die Pomeranze noch Kontakt mit der Weißen hat, während diese schon die Kugel berührt, oder wenn das Queue die Weiße mehr als einmal berührt.",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 4"],
    [D8, "Du spielst Volle"],
    [D141, "14/1 · Ansage: 4"],
  ]),
};

export const en = {
  "Doppelstoß: Weiße läuft nach": "Double hit: cue ball follows through",
  "Liegt die Weiße so dicht vor einer Kugel, dass der Abstand kleiner ist als die Stärke eines Stücks Kreide, braucht der Schiedsrichter besondere Aufmerksamkeit. Läuft die Weiße der getroffenen Kugel um mehr als eine halbe Kugelbreite nach, ist das ein Foul – es sei denn, der Schiedsrichter kann sicher sagen, dass der Stoß korrekt war. Der Grund steht auch in den Spielregeln 2026 (3.7): Es ist ein Foul, wenn die Pomeranze noch Kontakt mit der Weißen hat, während diese schon die Kugel berührt, oder wenn das Queue die Weiße mehr als einmal berührt.":
    "If the cue ball lies so close in front of a ball that the gap is smaller than the thickness of a piece of chalk, the referee needs to pay special attention. If the cue ball follows the struck ball by more than half a ball width, it is a foul – unless the referee can say for sure that the shot was legal. The reason is also in the 2026 rules (3.7): it is a foul if the tip is still in contact with the cue ball while it already touches the ball, or if the cue touches the cue ball more than once.",
  "Doppelstoß": "double hit",
  "Weiße läuft nach": "cue ball follows",
  "nachlaufen": "follow through",
  "halbe Kugelbreite": "half a ball width",
  "Durchstoß": "double shot",
  "Queue berührt zweimal": "cue touches twice",
  "knapp vor der Kugel": "just in front of the ball",
  "Kreidestärke": "chalk thickness",
  "Niedrigste Kugel: 4": "Lowest ball: 4",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 4": "14.1 · call: 4",
  "Foul (Doppelstoß)": "Foul (double hit)",
  "Die Weiße läuft der Kugel mehr als eine halbe Kugelbreite nach.": "The cue ball follows the ball by more than half a ball width.",
  "Die Weiße läuft der Kugel höchstens eine halbe Kugelbreite nach.": "The cue ball follows the ball by at most half a ball width.",
  "Ausgangslage: Die Weiße liegt knapp vor der 4, ein kleiner Spalt trennt sie.": "Starting position: the cue ball lies just in front of the 4, a small gap separates them.",
  "Die Weiße wird gerade auf die 4 gespielt.": "The cue ball is played straight at the 4.",
  "Die 4 läuft weg, die Weiße folgt ihr um mehr als eine halbe Kugelbreite – Doppelstoß, Foul.": "The 4 runs away, the cue ball follows it by more than half a ball width – double hit, foul.",
  "Die 4 läuft weg, die Weiße folgt ihr weniger als eine halbe Kugelbreite – regelgerecht.": "The 4 runs away, the cue ball follows it by less than half a ball width – legal.",
};
