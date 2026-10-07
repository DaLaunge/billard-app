import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8 } from "../meta.js";

/* 9-/10-Ball: die niedrigste Kugel zuerst (hier die 1).
   8-Ball: eine Kugel der EIGENEN Gruppe zuerst (hier Volle 1-7). */
const W = [60, 60];

// 9 / 10 Ball
const P1 = [130, 45], P3 = [125, 80];
const nine = (() => {
  const a = cut(W, { id: "3", at: P3 }, [150, 104.5]);
  const b = cut(W, { id: "1", at: P1 }, [204.5, 29]);
  const balls = () => [cue(...W), ball(1, ...P1), ball(3, ...P3), ball(2, 165, 62), ball(9, 188, 100)];
  return [
    {
      label: "Fall A", verdict: "foul",
      reason: "Die 3 wurde vor der 1 berührt.",
      balls: balls(),
      steps: [
        { text: "Ausgangslage: Die 1 ist die niedrigste Kugel auf dem Tisch.", focus: ["1"] },
        { text: "Die Weiße wird auf die 3 gespielt.", aim: [W, P3] },
        { text: "Die Weiße berührt zuerst die 3 – nicht die 1.", wrongFirst: true, expectRail: true, moves: [a.w, a.obj], mark: { at: P3, kind: "foul", after: "w" } },
      ],
    },
    {
      label: "Fall B", verdict: "ok",
      reason: "Die 1 wurde zuerst berührt und läuft danach zur Bande.",
      balls: balls(),
      steps: [
        { text: "Ausgangslage: Die 1 ist die niedrigste Kugel auf dem Tisch.", focus: ["1"] },
        { text: "Die Weiße wird auf die 1 gespielt.", aim: [W, P1] },
        { text: "Die Weiße berührt zuerst die 1, diese läuft danach an die Bande.", expectRail: true, moves: [b.w, b.obj], mark: { at: P1, kind: "ok", after: "w" } },
      ],
    },
  ];
})();

// 8 Ball: eigene Volle 5 und 2, Gegner Halbe 11 und 13, dazu die 8
const M5 = [148, 38], O11 = [125, 78];
const eight = (() => {
  const a = cut(W, { id: "11", at: O11 }, [150, 104.5]);
  const b = cut(W, { id: "5", at: M5 }, [204.5, 31]);
  const balls = () => [cue(...W), ball(5, ...M5), ball(2, 180, 84), ball(11, ...O11), ball(13, 168, 62), ball(8, 190, 102)];
  return [
    {
      label: "Fall A", verdict: "foul",
      reason: "Zuerst eine Kugel des Gegners berührt.",
      balls: balls(),
      steps: [
        { text: "Ausgangslage: Du spielst Volle (1–7), der Gegner Halbe (9–15).", focus: ["5", "2"] },
        { text: "Die Weiße wird auf die 11 gespielt – eine Kugel des Gegners.", aim: [W, O11] },
        { text: "Die Weiße berührt zuerst die 11 – Foul.", wrongFirst: true, expectRail: true, moves: [a.w, a.obj], mark: { at: O11, kind: "foul", after: "w" } },
      ],
    },
    {
      label: "Fall B", verdict: "ok",
      reason: "Zuerst eine eigene Kugel berührt, danach läuft eine Kugel an die Bande.",
      balls: balls(),
      steps: [
        { text: "Ausgangslage: Du spielst Volle (1–7), der Gegner Halbe (9–15).", focus: ["5", "2"] },
        { text: "Die Weiße wird auf die 5 gespielt – eine eigene Kugel.", aim: [W, M5] },
        { text: "Die Weiße berührt zuerst die 5, diese läuft an die Bande – regelgerecht.", expectRail: true, moves: [b.w, b.obj], mark: { at: M5, kind: "ok", after: "w" } },
      ],
    },
  ];
})();

export default {
  id: "erste-beruehrung",
  released: true,
  discs: ["8 Ball", "9 Ball", "10 Ball"],
  topic: "kontakt",
  tags: ["foul", "erstkontakt"],
  ref: "3.2, 4.9, 5.7, 6.9",
  keywords: ["Erstkontakt", "falsche Kugel", "niedrigste Kugel", "eigene Gruppe", "falsche Gruppe", "erste Kugel berührt", "Volle Halbe", "welche Kugel zuerst"],
  title: "Erste Berührung",
  rule: "Beim 9-Ball und 10-Ball muss die Weiße zuerst die niedrigste Kugel berühren, die noch auf dem Tisch liegt. Beim 8-Ball muss die erste berührte Kugel zur eigenen Gruppe gehören (bei offenem Tisch jede außer der 8). Sonst ist es ein Foul (der Gegner bekommt die Weiße in die Hand) – auch wenn danach die richtige Kugel getroffen oder eine Kugel versenkt wird. Beim Push Out entfällt diese Regel. Beim 14/1 Endlos gibt es diese Vorgabe nicht.",
  sets: [
    { discs: D89, tag: "Niedrigste Kugel: 1", variants: nine },
    { discs: D8, tag: "Du spielst Volle", variants: eight },
  ],
};

export const en = {
  "Erste Berührung": "First contact",
  "Beim 9-Ball und 10-Ball muss die Weiße zuerst die niedrigste Kugel berühren, die noch auf dem Tisch liegt. Beim 8-Ball muss die erste berührte Kugel zur eigenen Gruppe gehören (bei offenem Tisch jede außer der 8). Sonst ist es ein Foul (der Gegner bekommt die Weiße in die Hand) – auch wenn danach die richtige Kugel getroffen oder eine Kugel versenkt wird. Beim Push Out entfällt diese Regel. Beim 14/1 Endlos gibt es diese Vorgabe nicht.":
    "In 9-ball and 10-ball the cue ball must first touch the lowest ball still on the table. In 8-ball the first ball touched must belong to the player's own group (any ball except the 8 on an open table). Otherwise it is a foul (the opponent gets ball in hand) – even if the right ball is hit afterwards or a ball is pocketed. On a push out this rule does not apply. 14.1 continuous has no such requirement.",
  "Erstkontakt": "First contact",
  "falsche Kugel": "wrong ball",
  "niedrigste Kugel": "lowest ball",
  "eigene Gruppe": "own group",
  "falsche Gruppe": "wrong group",
  "erste Kugel berührt": "first ball touched",
  "Volle Halbe": "solids stripes",
  "welche Kugel zuerst": "which ball first",
  "Niedrigste Kugel: 1": "Lowest ball: 1",
  "Du spielst Volle": "You play solids",
  "Die 3 wurde vor der 1 berührt.": "The 3 was touched before the 1.",
  "Die 1 wurde zuerst berührt und läuft danach zur Bande.": "The 1 was touched first and then runs to the cushion.",
  "Ausgangslage: Die 1 ist die niedrigste Kugel auf dem Tisch.": "Starting position: the 1 is the lowest ball on the table.",
  "Die Weiße wird auf die 3 gespielt.": "The cue ball is played at the 3.",
  "Die Weiße berührt zuerst die 3 – nicht die 1.": "The cue ball touches the 3 first – not the 1.",
  "Die Weiße wird auf die 1 gespielt.": "The cue ball is played at the 1.",
  "Die Weiße berührt zuerst die 1, diese läuft danach an die Bande.": "The cue ball touches the 1 first, which then runs to the cushion.",
  "Zuerst eine Kugel des Gegners berührt.": "An opponent's ball was touched first.",
  "Zuerst eine eigene Kugel berührt, danach läuft eine Kugel an die Bande.": "Own ball touched first, afterwards a ball reaches a cushion.",
  "Ausgangslage: Du spielst Volle (1–7), der Gegner Halbe (9–15).": "Starting position: you play solids (1–7), the opponent plays stripes (9–15).",
  "Die Weiße wird auf die 11 gespielt – eine Kugel des Gegners.": "The cue ball is played at the 11 – an opponent's ball.",
  "Die Weiße berührt zuerst die 11 – Foul.": "The cue ball touches the 11 first – foul.",
  "Die Weiße wird auf die 5 gespielt – eine eigene Kugel.": "The cue ball is played at the 5 – one of your own.",
  "Die Weiße berührt zuerst die 5, diese läuft an die Bande – regelgerecht.": "The cue ball touches the 5 first, which runs to the cushion – legal.",
};
