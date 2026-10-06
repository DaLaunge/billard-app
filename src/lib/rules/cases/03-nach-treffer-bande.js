import { cue, ball } from "../../ruleEngine.js";
import { ALL_DISCS } from "../meta.js";

export default {
  id: "nach-treffer-bande",
  released: false,
  discs: ALL_DISCS,
  topic: "bande",
  ref: "3.3, 2.7",
  keywords: ["Bande", "Tasche", "kein Bandenkontakt", "No Rail"],
  title: "Nach dem Treffer: Bande oder Tasche",
  rule: "Wird bei einem Stoß keine Kugel versenkt, muss die Weiße eine Objektkugel berühren, und danach muss mindestens eine Kugel (Weiße oder Objektkugel) eine Bande anlaufen. Sonst ist es ein Foul. Eine versenkte Kugel zählt dabei als Bandenberührung. Die Regel gilt bei 8-Ball, 9-Ball, 10-Ball und 14/1 Endlos, beim Push Out entfällt sie. Folgen: wie beim Scratch (Ball in Hand bzw. ein Punkt Abzug beim 14/1).",
  variants: [
    {
      label: "Fall A", verdict: "foul",
      reason: "Keine Kugel versenkt und keine Bande berührt.",
      balls: [cue(50, 60), ball(4, 110, 60), ball(12, 150, 90)],
      steps: [
        { text: "Ausgangslage: Die Weiße spielt eine Kugel ihrer Gruppe an.", focus: ["4"] },
        { text: "Der Stoß geht gerade auf die 4.", aim: [[50, 60], [110, 60]] },
        {
          text: "Beide Kugeln bleiben mitten auf dem Tisch liegen.",
          moves: [
            { id: "w", to: [99, 60] },
            { id: "4", to: [140, 60], after: "w" },
          ],
          mark: { at: [140, 60], kind: "foul", afterEnd: "4" },
        },
      ],
    },
    {
      label: "Fall B", verdict: "ok",
      reason: "Die 4 berührt die Bande.",
      balls: [cue(50, 60), ball(4, 110, 60), ball(12, 150, 90)],
      steps: [
        { text: "Ausgangslage: Die Weiße spielt eine Kugel ihrer Gruppe an.", focus: ["4"] },
        { text: "Der Stoß geht gerade auf die 4.", aim: [[50, 60], [110, 60]] },
        {
          text: "Die 4 läuft bis zur Bande.",
          moves: [
            { id: "w", to: [99, 60] },
            { id: "4", to: [204.5, 60], after: "w" },
          ],
          mark: { at: [204.5, 60], kind: "ok", afterEnd: "4" },
        },
      ],
    },
  ],
};

export const en = {
  "Nach dem Treffer: Bande oder Tasche": "After contact: cushion or pocket",
  "Wird bei einem Stoß keine Kugel versenkt, muss die Weiße eine Objektkugel berühren, und danach muss mindestens eine Kugel (Weiße oder Objektkugel) eine Bande anlaufen. Sonst ist es ein Foul. Eine versenkte Kugel zählt dabei als Bandenberührung. Die Regel gilt bei 8-Ball, 9-Ball, 10-Ball und 14/1 Endlos, beim Push Out entfällt sie. Folgen: wie beim Scratch (Ball in Hand bzw. ein Punkt Abzug beim 14/1).":
    "If no ball is pocketed on a shot, the cue ball must touch an object ball, and afterwards at least one ball (cue ball or object ball) must reach a cushion. Otherwise it is a foul. A pocketed ball counts as touching a cushion. The rule applies in 8-ball, 9-ball, 10-ball and 14.1 continuous; it does not apply on a push out. Consequences: as for a scratch (ball in hand, or one point deducted in 14.1).",
  "Bande": "Cushion",
  "Tasche": "Pocket",
  "kein Bandenkontakt": "no cushion contact",
  "No Rail": "No Rail",
  "Keine Kugel versenkt und keine Bande berührt.": "No ball pocketed and no cushion touched.",
  "Die 4 berührt die Bande.": "The 4 touches the cushion.",
  "Ausgangslage: Die Weiße spielt eine Kugel ihrer Gruppe an.": "Starting position: the cue ball plays a ball of its group.",
  "Der Stoß geht gerade auf die 4.": "The shot goes straight at the 4.",
  "Beide Kugeln bleiben mitten auf dem Tisch liegen.": "Both balls stay in the middle of the table.",
  "Die 4 läuft bis zur Bande.": "The 4 runs to the cushion.",
};
