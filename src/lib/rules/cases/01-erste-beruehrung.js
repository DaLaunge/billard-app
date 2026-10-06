import { cue, ball } from "../../ruleEngine.js";

export default {
  id: "erste-beruehrung",
  released: false,
  discs: ["9 Ball", "10 Ball"],
  topic: "kontakt",
  ref: "3.2, 5.7, 6.9",
  keywords: ["Erstkontakt", "falsche Kugel", "niedrigste Kugel"],
  title: "Erste Berührung",
  rule: "Beim 9-Ball und 10-Ball muss die Weiße zuerst die niedrigste Kugel berühren, die noch auf dem Tisch liegt. Sonst ist es ein Foul (der Gegner bekommt die Weiße in die Hand) – auch wenn danach die richtige Kugel getroffen oder eine Kugel versenkt wird. Beim Push Out entfällt diese Regel. Beim 8-Ball gilt stattdessen: die erste berührte Kugel muss zur eigenen Gruppe gehören (bei offenem Tisch jede außer der 8). Beim 14/1 Endlos gibt es diese Vorgabe nicht.",
  variants: [
    {
      label: "Fall A", verdict: "foul",
      reason: "Die 3 wurde vor der 1 berührt.",
      balls: [cue(60, 60), ball(1, 130, 45), ball(3, 125, 80), ball(2, 165, 62)],
      steps: [
        { text: "Ausgangslage: Die 1 ist die niedrigste Kugel auf dem Tisch.", focus: ["1"] },
        { text: "Die Weiße wird auf die 3 gespielt.", aim: [[60, 60], [125, 80]] },
        {
          text: "Die Weiße berührt zuerst die 3 – nicht die 1.",
          moves: [
            { id: "w", to: [116, 77.5] },
            { id: "3", to: [160, 98], after: "w" },
          ],
          mark: { at: [125, 80], kind: "foul", after: "w" },
        },
      ],
    },
    {
      label: "Fall B", verdict: "ok",
      reason: "Die 1 wurde zuerst berührt und läuft danach zur Bande.",
      balls: [cue(60, 60), ball(1, 130, 45), ball(3, 125, 80), ball(2, 165, 62)],
      steps: [
        { text: "Ausgangslage: Die 1 ist die niedrigste Kugel auf dem Tisch.", focus: ["1"] },
        { text: "Die Weiße wird auf die 1 gespielt.", aim: [[60, 60], [130, 45]] },
        {
          text: "Die Weiße berührt zuerst die 1, diese läuft danach an die Bande.",
          moves: [
            { id: "w", to: [119, 47.3] },
            { id: "1", to: [204, 29], after: "w" },
          ],
          mark: { at: [130, 45], kind: "ok", after: "w" },
        },
      ],
    },
  ],
};

export const en = {
  "Erste Berührung": "First contact",
  "Beim 9-Ball und 10-Ball muss die Weiße zuerst die niedrigste Kugel berühren, die noch auf dem Tisch liegt. Sonst ist es ein Foul (der Gegner bekommt die Weiße in die Hand) – auch wenn danach die richtige Kugel getroffen oder eine Kugel versenkt wird. Beim Push Out entfällt diese Regel. Beim 8-Ball gilt stattdessen: die erste berührte Kugel muss zur eigenen Gruppe gehören (bei offenem Tisch jede außer der 8). Beim 14/1 Endlos gibt es diese Vorgabe nicht.":
    "In 9-ball and 10-ball the cue ball must first touch the lowest ball still on the table. Otherwise it is a foul (the opponent gets ball in hand) – even if the right ball is hit afterwards or a ball is pocketed. On a push out this rule does not apply. In 8-ball the first ball touched must belong to the player's own group instead (any ball except the 8 on an open table). 14.1 continuous has no such requirement.",
  "Erstkontakt": "First contact",
  "falsche Kugel": "wrong ball",
  "niedrigste Kugel": "lowest ball",
  "Die 3 wurde vor der 1 berührt.": "The 3 was touched before the 1.",
  "Die 1 wurde zuerst berührt und läuft danach zur Bande.": "The 1 was touched first and then runs to the cushion.",
  "Ausgangslage: Die 1 ist die niedrigste Kugel auf dem Tisch.": "Starting position: the 1 is the lowest ball on the table.",
  "Die Weiße wird auf die 3 gespielt.": "The cue ball is played at the 3.",
  "Die Weiße berührt zuerst die 3 – nicht die 1.": "The cue ball touches the 3 first – not the 1.",
  "Die Weiße wird auf die 1 gespielt.": "The cue ball is played at the 1.",
  "Die Weiße berührt zuerst die 1, diese läuft danach an die Bande.": "The cue ball touches the 1 first, which then runs to the cushion.",
};
