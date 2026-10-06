import { cue, ball, touch } from "../../ruleEngine.js";

/* Fall A: 1 und 3 liegen nebeneinander, die Weiße trifft genau dazwischen -
   nicht zu entscheiden, welche zuerst. Fall B: die 3 liegt deutlich vorn. */
const W = [60, 60];
const A1 = [130, 54.5], A3 = [130, 65.5];
const B3 = [125, 62], B1 = [150, 56];

export default {
  id: "gleichzeitiger-treffer",
  released: false,
  discs: ["8 Ball", "9 Ball", "10 Ball"],
  topic: "kontakt",
  ref: "3.2",
  keywords: ["gleichzeitig", "Doppeltreffer", "zulässige Kugel", "im Zweifel"],
  title: "Zwei Kugeln gleichzeitig getroffen",
  rule: "Trifft die Weiße ungefähr gleichzeitig eine zulässige und eine unzulässige Kugel und lässt sich nicht feststellen, welche zuerst berührt wurde, gilt die zulässige Kugel als zuerst getroffen – kein Foul. Wurde die unzulässige Kugel erkennbar zuerst berührt, ist es ein Foul.",
  variants: [
    {
      label: "Fall A", verdict: "ok",
      reason: "Nicht zu erkennen, welche zuerst – im Zweifel gilt die 1.",
      balls: [cue(...W), ball(1, ...A1), ball(3, ...A3)],
      steps: [
        { text: "Ausgangslage: Die 1 ist die niedrigste Kugel, die 3 liegt direkt daneben.", focus: ["1"] },
        { text: "Die Weiße zielt genau zwischen die beiden Kugeln.", aim: [W, [130, 60]] },
        {
          text: "Beide Kugeln werden gleichzeitig berührt. Im Zweifel gilt die zulässige: die 1.",
          moves: [
            { id: "w", to: [120.5, 60] },
            { id: "1", to: [204.5, 30], after: "w" },
            { id: "3", to: [185, 92], after: "w" },
          ],
          mark: { at: [130, 60], kind: "ok", after: "w" },
        },
      ],
    },
    {
      label: "Fall B", verdict: "foul",
      reason: "Die 3 wurde erkennbar vor der 1 berührt.",
      balls: [cue(...W), ball(1, ...B1), ball(3, ...B3)],
      steps: [
        { text: "Ausgangslage: Die 1 ist die niedrigste Kugel, die 3 liegt deutlich weiter vorn.", focus: ["1"] },
        { text: "Die Weiße wird auf die 3 gespielt.", aim: [W, B3] },
        {
          text: "Die Weiße trifft eindeutig zuerst die 3, erst danach läuft diese gegen die 1.",
          moves: [
            { id: "w", to: touch(W, B3) },
            { id: "3", to: touch(B3, B1), after: "w" },
            { id: "1", to: [204.5, 43], after: "3" },
          ],
          mark: { at: B3, kind: "foul", after: "w" },
        },
      ],
    },
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
  "Nicht zu erkennen, welche zuerst – im Zweifel gilt die 1.": "Cannot be told which came first – in doubt the 1 counts.",
  "Die 3 wurde erkennbar vor der 1 berührt.": "The 3 was clearly touched before the 1.",
  "Ausgangslage: Die 1 ist die niedrigste Kugel, die 3 liegt direkt daneben.": "Starting position: the 1 is the lowest ball, the 3 lies right next to it.",
  "Die Weiße wird auf die 3 gespielt.": "The cue ball is played at the 3.",
  "Die Weiße zielt genau zwischen die beiden Kugeln.": "The cue ball aims exactly between the two balls.",
  "Beide Kugeln werden gleichzeitig berührt. Im Zweifel gilt die zulässige: die 1.": "Both balls are touched at the same time. In doubt the legal one counts: the 1.",
  "Ausgangslage: Die 1 ist die niedrigste Kugel, die 3 liegt deutlich weiter vorn.": "Starting position: the 1 is the lowest ball, the 3 lies clearly further ahead.",
  "Die Weiße trifft eindeutig zuerst die 3, erst danach läuft diese gegen die 1.": "The cue ball clearly hits the 3 first; only then does it run into the 1.",
};
