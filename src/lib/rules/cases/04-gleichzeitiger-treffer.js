import { cue, ball, cut, along, clampTable } from "../../ruleEngine.js";
import { D89, D8 } from "../meta.js";

/* Fall A: zwei Kugeln liegen nebeneinander, die Weisse trifft genau dazwischen -
   nicht zu entscheiden, welche zuerst. Beide laufen auf ihrer Mittelpunktslinie
   auseinander. Fall B: die erste Kugel liegt deutlich vorn und trifft die
   zweite (Kette: Weisse -> erste -> zweite). */
const W = [60, 60];
const A1 = [130, 54.5], A2 = [130, 65.5];
const F = [125, 62], S = [150, 56];

const build = (legal, other, texts) => {
  // A: Doppeltreffer. Die Kugeln verlassen den Treffpunkt auf ihren Mittelpunktslinien.
  const hitA = [120.47, 60];
  const dirUp = [A1[0] + 9.53, A1[1] - 5.5], dirDown = [A2[0] + 9.53, A2[1] + 5.5];
  const toL = clampTable(along(A1, dirUp, 90)), toO = clampTable(along(A2, dirDown, 90));
  // B: die ANDERE Kugel (other) liegt vorn und wird zuerst getroffen, danach laeuft sie gegen die zulaessige (legal).
  const c2 = cut(F, { id: legal, at: S }, [204.5, 43], { striker: other });
  const c1 = cut(W, { id: other, at: F }, c2.contact);
  return [
    {
      label: "Fall A", verdict: "ok",
      reason: texts.reasonA,
      balls: [cue(...W), ball(Number(legal), ...A1), ball(Number(other), ...A2), ball(9, 95, 92)],
      steps: [
        { text: texts.start1, focus: [legal] },
        { text: "Die Weiße zielt genau zwischen die beiden Kugeln.", aim: [W, [130, 60]] },
        {
          text: texts.doubleHit,
          expectRail: true,
          moves: [
            { id: "w", to: hitA, stop: true },
            { id: legal, to: toL, after: "w" },
            { id: other, to: toO, after: "w" },
          ],
          mark: { at: [130, 60], kind: "ok", after: "w" },
        },
      ],
    },
    {
      label: "Fall B", verdict: "foul",
      reason: texts.reasonB,
      balls: [cue(...W), ball(Number(legal), ...S), ball(Number(other), ...F), ball(9, 95, 92)],
      steps: [
        { text: texts.start2, focus: [legal] },
        { text: texts.aimB, aim: [W, F] },
        {
          text: texts.hitB,
          wrongFirst: true,
          expectRail: true,
          moves: [c1.w, { ...c2.w, after: "w" }, c2.obj],
          mark: { at: F, kind: "foul", after: "w" },
        },
      ],
    },
  ];
};

const nine = build("1", "3", {
  reasonA: "Nicht zu erkennen, welche zuerst – im Zweifel gilt die 1.",
  reasonB: "Die 3 wurde erkennbar vor der 1 berührt.",
  start1: "Ausgangslage: Die 1 ist die niedrigste Kugel, die 3 liegt direkt daneben.",
  start2: "Ausgangslage: Die 1 ist die niedrigste Kugel, die 3 liegt deutlich weiter vorn.",
  doubleHit: "Beide Kugeln werden gleichzeitig berührt. Im Zweifel gilt die zulässige: die 1.",
  aimB: "Die Weiße wird auf die 3 gespielt.",
  hitB: "Die Weiße trifft eindeutig zuerst die 3, erst danach läuft diese gegen die 1.",
});
const eight = build("2", "11", {
  reasonA: "Nicht zu erkennen, welche zuerst – im Zweifel gilt die eigene 2.",
  reasonB: "Die 11 des Gegners wurde erkennbar vor der 2 berührt.",
  start1: "Ausgangslage: Du spielst Volle. Deine 2 liegt direkt neben der 11 des Gegners.",
  start2: "Ausgangslage: Du spielst Volle. Die 11 des Gegners liegt deutlich weiter vorn.",
  doubleHit: "Beide Kugeln werden gleichzeitig berührt. Im Zweifel gilt die zulässige: deine 2.",
  aimB: "Die Weiße wird auf die 11 gespielt.",
  hitB: "Die Weiße trifft eindeutig zuerst die 11, erst danach läuft diese gegen die 2.",
});

export default {
  id: "gleichzeitiger-treffer",
  released: false,
  discs: ["8 Ball", "9 Ball", "10 Ball"],
  topic: "kontakt",
  ref: "3.2",
  keywords: ["gleichzeitig", "Doppeltreffer", "zulässige Kugel", "im Zweifel", "zwei Kugeln getroffen"],
  title: "Zwei Kugeln gleichzeitig getroffen",
  rule: "Trifft die Weiße ungefähr gleichzeitig eine zulässige und eine unzulässige Kugel und lässt sich nicht feststellen, welche zuerst berührt wurde, gilt die zulässige Kugel als zuerst getroffen – kein Foul. Wurde die unzulässige Kugel erkennbar zuerst berührt, ist es ein Foul.",
  sets: [
    { discs: D89, tag: "Niedrigste Kugel: 1", variants: nine },
    { discs: D8, tag: "Du spielst Volle", variants: eight },
  ],
};

export const en = {
  "Zwei Kugeln gleichzeitig getroffen": "Two balls hit at the same time",
  "Trifft die Weiße ungefähr gleichzeitig eine zulässige und eine unzulässige Kugel und lässt sich nicht feststellen, welche zuerst berührt wurde, gilt die zulässige Kugel als zuerst getroffen – kein Foul. Wurde die unzulässige Kugel erkennbar zuerst berührt, ist es ein Foul.":
    "If the cue ball hits a legal and an illegal ball at about the same time and it cannot be determined which was touched first, the legal ball is deemed to have been hit first – no foul. If the illegal ball was clearly touched first, it is a foul.",
  "gleichzeitig": "simultaneous",
  "Doppeltreffer": "double hit",
  "zulässige Kugel": "legal ball",
  "im Zweifel": "in doubt",
  "zwei Kugeln getroffen": "two balls hit",
  "Niedrigste Kugel: 1": "Lowest ball: 1",
  "Du spielst Volle": "You play solids",
  "Die Weiße zielt genau zwischen die beiden Kugeln.": "The cue ball aims exactly between the two balls.",
  "Die Weiße wird auf die 3 gespielt.": "The cue ball is played at the 3.",
  "Nicht zu erkennen, welche zuerst – im Zweifel gilt die 1.": "Cannot be told which came first – in doubt the 1 counts.",
  "Die 3 wurde erkennbar vor der 1 berührt.": "The 3 was clearly touched before the 1.",
  "Ausgangslage: Die 1 ist die niedrigste Kugel, die 3 liegt direkt daneben.": "Starting position: the 1 is the lowest ball, the 3 lies right next to it.",
  "Ausgangslage: Die 1 ist die niedrigste Kugel, die 3 liegt deutlich weiter vorn.": "Starting position: the 1 is the lowest ball, the 3 lies clearly further ahead.",
  "Beide Kugeln werden gleichzeitig berührt. Im Zweifel gilt die zulässige: die 1.": "Both balls are touched at the same time. In doubt the legal one counts: the 1.",
  "Die Weiße trifft eindeutig zuerst die 3, erst danach läuft diese gegen die 1.": "The cue ball clearly hits the 3 first; only then does it run into the 1.",
  "Nicht zu erkennen, welche zuerst – im Zweifel gilt die eigene 2.": "Cannot be told which came first – in doubt your own 2 counts.",
  "Die 11 des Gegners wurde erkennbar vor der 2 berührt.": "The opponent's 11 was clearly touched before the 2.",
  "Ausgangslage: Du spielst Volle. Deine 2 liegt direkt neben der 11 des Gegners.": "Starting position: you play solids. Your 2 lies right next to the opponent's 11.",
  "Ausgangslage: Du spielst Volle. Die 11 des Gegners liegt deutlich weiter vorn.": "Starting position: you play solids. The opponent's 11 lies clearly further ahead.",
  "Beide Kugeln werden gleichzeitig berührt. Im Zweifel gilt die zulässige: deine 2.": "Both balls are touched at the same time. In doubt the legal one counts: your 2.",
  "Die Weiße wird auf die 11 gespielt.": "The cue ball is played at the 11.",
  "Die Weiße trifft eindeutig zuerst die 11, erst danach läuft diese gegen die 2.": "The cue ball clearly hits the 11 first; only then does it run into the 2.",
};
