import { cue, ball, touch, along } from "../../ruleEngine.js";
import { ALL_DISCS } from "../meta.js";

/* Fall A: Treffer, danach laeuft die Weiße an die obere Bande - ok.
   Fall B: Weiße prallt VOR dem Treffer an die untere Bande, danach beruehrt
   keine Kugel mehr eine Bande - Foul. */
const WA = [60, 40], BA = [130, 60];
const hitA = touch(WA, BA);
// Die Weiße lenkt nach dem Treffer senkrecht zur Stosslinie ab (Schnitt) und erreicht die obere Bande.
const nA = [BA[0] - hitA[0], BA[1] - hitA[1]];
const tA = [nA[1], -nA[0]];
const railA = [hitA[0] + (tA[0] / tA[1]) * (15.5 - hitA[1]), 15.5].map((n) => Math.round(n * 100) / 100);

const WB = [60, 95], RAIL_B = [100, 104.5];
const dirB = [40, -9.5];
const BB = along(RAIL_B, [RAIL_B[0] + dirB[0], RAIL_B[1] + dirB[1]], 55);
const hitB = touch(RAIL_B, BB);

export default {
  id: "bande-vor-dem-treffer",
  released: false,
  discs: ALL_DISCS,
  topic: "bande",
  ref: "3.3, 2.7",
  keywords: ["Bande", "vor dem Treffer", "Bandenkontakt", "Karambolage"],
  title: "Bande vor dem Treffer zählt nicht",
  rule: "Die Bandenberührung zählt nur, wenn sie nach dem ersten Kontakt zwischen Weißer und Objektkugel erfolgt. Berührt die Weiße die Bande schon vor dem Treffer und läuft danach keine Kugel mehr an eine Bande (und keine wird versenkt), ist es ein Foul.",
  variants: [
    {
      label: "Fall A", verdict: "ok",
      reason: "Die Weiße läuft nach dem Treffer an die Bande.",
      balls: [cue(...WA), ball(5, ...BA), ball(9, 60, 95)],
      steps: [
        { text: "Ausgangslage: Die 5 ist die niedrigste Kugel.", focus: ["5"] },
        { text: "Die Weiße wird dünn auf die 5 gespielt.", aim: [WA, BA] },
        {
          text: "Erst der Treffer, danach läuft die Weiße an die Bande – regelgerecht.",
          moves: [
            { id: "w", via: [hitA], to: railA },
            { id: "5", to: along(BA, [BA[0] + nA[0], BA[1] + nA[1]], 40), after: "w" },
          ],
          mark: { at: railA, kind: "ok", afterEnd: "w" },
        },
      ],
    },
    {
      label: "Fall B", verdict: "foul",
      reason: "Die Bande kam vor dem Treffer, danach keine mehr.",
      balls: [cue(...WB), ball(5, ...BB), ball(9, 60, 40)],
      steps: [
        { text: "Ausgangslage: Die 5 ist die niedrigste Kugel.", focus: ["5"] },
        { text: "Die Weiße wird erst über die untere Bande auf die 5 gespielt.", aim: [WB, RAIL_B, BB] },
        {
          text: "Die Weiße berührt die Bande vor dem Treffer. Danach erreicht keine Kugel eine Bande.",
          moves: [
            { id: "w", via: [RAIL_B], to: hitB, hitLeg: 1 },
            { id: "5", to: along(BB, [BB[0] + dirB[0], BB[1] + dirB[1]], 30), after: "w" },
          ],
          mark: { at: hitB, kind: "foul", after: "w" },
        },
      ],
    },
  ],
};

export const en = {
  "Bande vor dem Treffer zählt nicht": "Cushion before contact does not count",
  "Die Bandenberührung zählt nur, wenn sie nach dem ersten Kontakt zwischen Weißer und Objektkugel erfolgt. Berührt die Weiße die Bande schon vor dem Treffer und läuft danach keine Kugel mehr an eine Bande (und keine wird versenkt), ist es ein Foul.":
    "The cushion contact only counts if it happens after the first contact between cue ball and object ball. If the cue ball touches a cushion before the hit and afterwards no ball reaches a cushion (and none is pocketed), it is a foul.",
  "vor dem Treffer": "before contact",
  "Bande": "Cushion",
  "Bandenkontakt": "cushion contact",
  "Karambolage": "carom",
  "Die Weiße läuft nach dem Treffer an die Bande.": "The cue ball runs to the cushion after the hit.",
  "Die Bande kam vor dem Treffer, danach keine mehr.": "The cushion came before the hit and none after it.",
  "Ausgangslage: Die 5 ist die niedrigste Kugel.": "Starting position: the 5 is the lowest ball.",
  "Die Weiße wird dünn auf die 5 gespielt.": "The cue ball is played thin at the 5.",
  "Erst der Treffer, danach läuft die Weiße an die Bande – regelgerecht.": "First the hit, then the cue ball runs to the cushion – legal.",
  "Die Weiße wird erst über die untere Bande auf die 5 gespielt.": "The cue ball is played off the lower cushion at the 5.",
  "Die Weiße berührt die Bande vor dem Treffer. Danach erreicht keine Kugel eine Bande.": "The cue ball touches the cushion before the hit. Afterwards no ball reaches a cushion.",
};
