import { cue, ball, touch } from "../../ruleEngine.js";
import { ALL_DISCS } from "../meta.js";

const W = [60, 78], B3 = [125, 80];

export default {
  id: "bewegende-kugeln",
  released: false,
  discs: ALL_DISCS,
  topic: "ablauf",
  ref: "3.9, 2.19",
  keywords: ["rollt noch", "Kugel bewegt sich", "zu früh gestoßen", "Stoß"],
  title: "Stoß bei rollender Kugel",
  rule: "Ein Stoß, während sich noch irgendeine Kugel bewegt oder dreht, ist ein Foul. Man wartet, bis alle Kugeln ruhen. Ein Stoß beginnt, sobald die Pomeranze die Weiße berührt, und endet erst, wenn sich keine Kugel mehr bewegt.",
  variants: [
    {
      label: "Fall A", verdict: "foul",
      reason: "Gestoßen, während die 7 noch rollte.",
      balls: [cue(...W), ball(3, ...B3), ball(7, 150, 30)],
      steps: [
        { text: "Ausgangslage: Die 7 rollt noch langsam aus.", focus: ["7"] },
        {
          text: "Der Spieler stößt schon, obwohl die 7 noch rollt – Foul.",
          moves: [
            { id: "7", to: [190, 40] },
            { id: "w", to: touch(W, B3), delay: 220 },
            { id: "3", to: [160, 100], after: "w" },
          ],
          mark: { at: W, kind: "foul", delay: 220 },
        },
      ],
    },
    {
      label: "Fall B", verdict: "ok",
      reason: "Erst gespielt, als alle Kugeln ruhten.",
      balls: [cue(...W), ball(3, ...B3), ball(7, 150, 30)],
      steps: [
        { text: "Ausgangslage: Die 7 rollt noch langsam aus.", focus: ["7"] },
        { text: "Der Spieler wartet, bis die 7 liegen bleibt.", moves: [{ id: "7", to: [190, 40] }] },
        {
          text: "Jetzt ruht alles. Der Stoß ist regelgerecht.",
          moves: [
            { id: "w", to: touch(W, B3) },
            { id: "3", to: [143, 104.5], after: "w" },
          ],
          mark: { at: B3, kind: "ok", after: "w" },
        },
      ],
    },
  ],
};

export const en = {
  "Stoß bei rollender Kugel": "Shot while a ball is still moving",
  "Ein Stoß, während sich noch irgendeine Kugel bewegt oder dreht, ist ein Foul. Man wartet, bis alle Kugeln ruhen. Ein Stoß beginnt, sobald die Pomeranze die Weiße berührt, und endet erst, wenn sich keine Kugel mehr bewegt.":
    "A shot played while any ball is still moving or spinning is a foul. You wait until all balls are at rest. A shot begins when the tip touches the cue ball and only ends when no ball is moving any more.",
  "rollt noch": "still rolling",
  "Kugel bewegt sich": "ball moves",
  "zu früh gestoßen": "shot too early",
  "Stoß": "shot",
  "Gestoßen, während die 7 noch rollte.": "Shot while the 7 was still rolling.",
  "Erst gespielt, als alle Kugeln ruhten.": "Played only when all balls were at rest.",
  "Ausgangslage: Die 7 rollt noch langsam aus.": "Starting position: the 7 is still rolling out slowly.",
  "Der Spieler stößt schon, obwohl die 7 noch rollt – Foul.": "The player shoots although the 7 is still rolling – foul.",
  "Der Spieler wartet, bis die 7 liegen bleibt.": "The player waits until the 7 comes to rest.",
  "Jetzt ruht alles. Der Stoß ist regelgerecht.": "Now everything is at rest. The shot is legal.",
};
