import { cue, ball, cut, bankPoint } from "../../ruleEngine.js";
import { D89, D8, D141, ALL_DISCS, tagSets } from "../meta.js";

/* Fall A: Treffer, danach laeuft die Weisse an die Bande - ok.
   Fall B: Die Weisse prallt VOR dem Treffer an die untere Bande, danach beruehrt
   keine Kugel mehr eine Bande - Foul. */
const WA = [70, 70], TA = [130, 40], OA = [190, 55];
const a = cut(WA, { id: "5", at: TA }, OA);

const WB = [60, 95], TB = [150, 88], OB = [185, 80];
const bankB = bankPoint(WB, cut(WB, { id: "5", at: TB }, OB).contact, "bottom");
const b = cut(bankB, { id: "5", at: TB }, OB, { bank: bankB });

const variants = [
  {
    label: "Fall A", verdict: "ok",
    reason: "Die Weiße läuft nach dem Treffer an die Bande.",
    balls: [cue(...WA), ball(5, ...TA), ball(9, 60, 40)],
    steps: [
      { text: "Ausgangslage: Die Weiße spielt die 5 an.", focus: ["5"] },
      { text: "Die Weiße wird dünn auf die 5 gespielt.", aim: [WA, a.contact] },
      { text: "Erst der Treffer, danach läuft die Weiße an die Bande – regelgerecht.", expectRail: true, moves: [a.w, a.obj], mark: { at: a.rail || a.w.to, kind: "ok", afterEnd: "w", delay: -300 } },
    ],
  },
  {
    label: "Fall B", verdict: "foul",
    reason: "Die Bande kam vor dem Treffer, danach keine mehr.",
    balls: [cue(...WB), ball(5, ...TB), ball(9, 60, 40)],
    steps: [
      { text: "Ausgangslage: Die Weiße spielt die 5 an.", focus: ["5"] },
      { text: "Die Weiße wird erst über die untere Bande auf die 5 gespielt.", aim: [WB, bankB, b.contact] },
      { text: "Die Weiße berührt die Bande vor dem Treffer. Danach erreicht keine Kugel eine Bande.", expectRail: false, moves: [b.w, b.obj], mark: { at: b.contact, kind: "foul", after: "w" } },
    ],
  },
];

export default {
  id: "bande-vor-dem-treffer",
  released: true,
  discs: ALL_DISCS,
  topic: "bande",
  ref: "3.3, 2.7",
  keywords: ["Bande", "vor dem Treffer", "Bandenkontakt", "Karambolage", "erst Bande dann Kugel"],
  title: "Bande vor dem Treffer zählt nicht",
  rule: "Die Bandenberührung zählt nur, wenn sie nach dem ersten Kontakt zwischen Weißer und Objektkugel erfolgt. Berührt die Weiße die Bande schon vor dem Treffer und läuft danach keine Kugel mehr an eine Bande (und keine wird versenkt), ist es ein Foul.",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 5"],
    [D8, "Du spielst Volle"],
    [D141, "14/1 · Sicherheit angesagt"],
  ]),
};

export const en = {
  "Bande vor dem Treffer zählt nicht": "Cushion before contact does not count",
  "Die Bandenberührung zählt nur, wenn sie nach dem ersten Kontakt zwischen Weißer und Objektkugel erfolgt. Berührt die Weiße die Bande schon vor dem Treffer und läuft danach keine Kugel mehr an eine Bande (und keine wird versenkt), ist es ein Foul.":
    "The cushion contact only counts if it happens after the first contact between cue ball and object ball. If the cue ball touches a cushion before the hit and afterwards no ball reaches a cushion (and none is pocketed), it is a foul.",
  "Bande": "Cushion",
  "vor dem Treffer": "before contact",
  "Bandenkontakt": "cushion contact",
  "Karambolage": "carom",
  "erst Bande dann Kugel": "cushion first then ball",
  "Niedrigste Kugel: 5": "Lowest ball: 5",
  "Du spielst Volle": "You play solids",
  "14/1 · Sicherheit angesagt": "14.1 · safety announced",
  "Die Weiße läuft nach dem Treffer an die Bande.": "The cue ball runs to the cushion after the hit.",
  "Die Bande kam vor dem Treffer, danach keine mehr.": "The cushion came before the hit and none after it.",
  "Ausgangslage: Die Weiße spielt die 5 an.": "Starting position: the cue ball plays the 5.",
  "Die Weiße wird dünn auf die 5 gespielt.": "The cue ball is played thin at the 5.",
  "Erst der Treffer, danach läuft die Weiße an die Bande – regelgerecht.": "First the hit, then the cue ball runs to the cushion – legal.",
  "Die Weiße wird erst über die untere Bande auf die 5 gespielt.": "The cue ball is played off the lower cushion at the 5.",
  "Die Weiße berührt die Bande vor dem Treffer. Danach erreicht keine Kugel eine Bande.": "The cue ball touches the cushion before the hit. Afterwards no ball reaches a cushion.",
};
