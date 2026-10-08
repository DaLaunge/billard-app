import { cue, ball, cut } from "../../ruleEngine.js";
import { D8 } from "../meta.js";

/* 8 Ball, Spezialfall (S26 4.3 c, 4.4; OS19 5.14): Beim Anstoss fallen ALLE Kugeln einer Gruppe (hier alle
   Halben 9-15). Der Anstoss legt die Gruppen nie fest: der Tisch bleibt "offen", der Anstoessende bleibt
   an der Aufnahme (es ist eine Kugel gefallen, kein Foul). Weil eine Gruppe komplett vom Tisch ist, darf
   er sie VORUEBERGEHEND fuer sich beanspruchen und direkt die 8 spielen - als Ansagestoss (Kugel und
   Tasche). Ob die Kugeln er selbst oder der Anstoss versenkt hat, ist egal (OS19 5.14).
   Fall A: er sagt die 8 in die Ecktasche an und versenkt sie - Spiel gewonnen.
   Fall B: die 8 faellt in eine andere als die angesagte Tasche - Spiel verloren (4.8 c). */
const T = [150, 50], P = [207, 13], MID = [110, 8], W = [91.2, 88.2];
const a = cut(W, { id: "8", at: T }, P, { out: true });
const b = cut(W, { id: "8", at: T }, [140, 14], { out: true }); // nicht die angesagte Ecktasche
const solids = () => [
  ball(1, 35, 30), ball(2, 60, 95), ball(3, 100, 102), ball(4, 180, 95), ball(5, 192, 68), ball(6, 140, 100), ball(7, 40, 62),
];
const balls = () => [cue(...W), ball(8, ...T), ...solids()];
const SAY = "Ansage: 8 → rechts oben";

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "Spiel gewonnen",
    reason: "Alle Halben fielen beim Anstoß: kein Foul, der Tisch bleibt offen. Der Spieler beansprucht die vollständig versenkte Gruppe vorübergehend, spielt die 8 an und versenkt sie in die angesagte Tasche – Spiel gewonnen.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Beim Anstoß sind alle Halben gefallen, es liegen nur noch die sieben Vollen und die 8 auf dem Tisch. Die Gruppen sind nicht verteilt, der Tisch ist offen.", focus: ["8"] },
      { text: "Weil eine ganze Gruppe vom Tisch ist, darf der Spieler sie vorübergehend für sich beanspruchen und die 8 spielen. Er sagt die 8 in die Ecktasche rechts oben an.", say: SAY, sayIcon: "mouth", aim: [W, a.contact] },
      { text: "Die 8 fällt in die angesagte Tasche – der Spieler gewinnt das Spiel.", expectRail: true, moves: [a.w, a.obj], mark: { at: [200, 19], kind: "ok", after: "w", delay: 300 } },
    ],
  },
  {
    label: "Fall B", verdict: "foul", verdictLabel: "Spiel verloren",
    reason: "Die 8 fällt in eine andere als die angesagte Tasche: das Spiel ist verloren, auch wenn die 8 vorher spielbar war.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Beim Anstoß sind alle Halben gefallen, es liegen nur noch die sieben Vollen und die 8 auf dem Tisch. Die Gruppen sind nicht verteilt, der Tisch ist offen.", focus: ["8"] },
      { text: "Der Spieler beansprucht die vollständig versenkte Gruppe vorübergehend und sagt die 8 in die Ecktasche rechts oben an.", say: SAY, sayIcon: "mouth", aim: [W, b.contact] },
      { text: "Die 8 fällt in die obere Mitteltasche, nicht in die angesagte Ecktasche – das Spiel ist verloren.", expectRail: true, moves: [b.w, b.obj], mark: { at: [138, 20], kind: "foul", after: "w", delay: 300 } },
    ],
  },
];

export default {
  id: "acht-gruppe-beim-anstoss",
  released: false,
  discs: D8,
  topic: "anstoss",
  tags: ["anstoss", "ablauf", "tasche"],
  ref: "4.3 c, 4.4",
  keywords: ["alle Halben beim Anstoß", "alle Vollen beim Anstoß", "Gruppe komplett versenkt", "8 nach dem Anstoß spielen"],
  title: "Anstoß: alle Halben oder Vollen fallen",
  rule: "Der 8-Ball-Anstoß legt die Gruppen nie fest. Fällt dabei eine Kugel und es gibt kein Foul, bleibt der Spieler an der Aufnahme und der Tisch ist offen. Fallen beim Anstoß alle Kugeln einer Gruppe (Vollen oder Halben), darf der Spieler diese Gruppe vorübergehend für sich beanspruchen und direkt die 8 spielen, um das Spiel zu gewinnen – als Ansagestoß mit Kugel und Tasche. Nach der Lehrunterlage ist es egal, ob die Kugeln der Gruppe er selbst oder der Anstoß versenkt hat. Fällt die 8 in eine nicht angesagte Tasche, ist das Spiel verloren; spielt der Spieler die 8 bei offenem Tisch, ohne dass eine Gruppe komplett versenkt ist, ist es ein Foul.",
  sets: [{ discs: D8, tag: "Anstoß: alle Halben versenkt", variants }],
};

export const en = {
  "Anstoß: alle Halben oder Vollen fallen": "Break: all stripes or all solids fall",
  "Der 8-Ball-Anstoß legt die Gruppen nie fest. Fällt dabei eine Kugel und es gibt kein Foul, bleibt der Spieler an der Aufnahme und der Tisch ist offen. Fallen beim Anstoß alle Kugeln einer Gruppe (Vollen oder Halben), darf der Spieler diese Gruppe vorübergehend für sich beanspruchen und direkt die 8 spielen, um das Spiel zu gewinnen – als Ansagestoß mit Kugel und Tasche. Nach der Lehrunterlage ist es egal, ob die Kugeln der Gruppe er selbst oder der Anstoß versenkt hat. Fällt die 8 in eine nicht angesagte Tasche, ist das Spiel verloren; spielt der Spieler die 8 bei offenem Tisch, ohne dass eine Gruppe komplett versenkt ist, ist es ein Foul.": "The 8-ball break never decides the groups. If a ball falls and there is no foul, the player stays at the table and the table is open. If all balls of a group (solids or stripes) fall on the break, the player may temporarily claim that group and play the 8 right away to win the game – as a called shot with ball and pocket. According to the training material it does not matter whether he or the break pocketed the balls of the group. If the 8 falls into an uncalled pocket the game is lost; if the player plays the 8 on an open table without a group being completely pocketed it is a foul.",
  "alle Halben beim Anstoß": "all stripes on the break",
  "alle Vollen beim Anstoß": "all solids on the break",
  "Gruppe komplett versenkt": "group completely pocketed",
  "8 nach dem Anstoß spielen": "play the 8 after the break",
  "Anstoß: alle Halben versenkt": "Break: all stripes pocketed",
  "Ansage: 8 → rechts oben": "Call: 8 → top right",
  "Spiel gewonnen": "Game won",
  "Spiel verloren": "Game lost",
  "Alle Halben fielen beim Anstoß: kein Foul, der Tisch bleibt offen. Der Spieler beansprucht die vollständig versenkte Gruppe vorübergehend, spielt die 8 an und versenkt sie in die angesagte Tasche – Spiel gewonnen.": "All stripes fell on the break: no foul, the table stays open. The player temporarily claims the completely pocketed group, plays the 8 and pockets it in the called pocket – game won.",
  "Die 8 fällt in eine andere als die angesagte Tasche: das Spiel ist verloren, auch wenn die 8 vorher spielbar war.": "The 8 falls into a pocket other than the called one: the game is lost, even though the 8 was playable.",
  "Ausgangslage: Beim Anstoß sind alle Halben gefallen, es liegen nur noch die sieben Vollen und die 8 auf dem Tisch. Die Gruppen sind nicht verteilt, der Tisch ist offen.": "Starting position: all stripes fell on the break, only the seven solids and the 8 are left on the table. The groups are not assigned, the table is open.",
  "Weil eine ganze Gruppe vom Tisch ist, darf der Spieler sie vorübergehend für sich beanspruchen und die 8 spielen. Er sagt die 8 in die Ecktasche rechts oben an.": "Because a whole group is off the table, the player may temporarily claim it and play the 8. He calls the 8 in the top right corner pocket.",
  "Die 8 fällt in die angesagte Tasche – der Spieler gewinnt das Spiel.": "The 8 falls into the called pocket – the player wins the game.",
  "Der Spieler beansprucht die vollständig versenkte Gruppe vorübergehend und sagt die 8 in die Ecktasche rechts oben an.": "The player temporarily claims the completely pocketed group and calls the 8 in the top right corner pocket.",
  "Die 8 fällt in die obere Mitteltasche, nicht in die angesagte Ecktasche – das Spiel ist verloren.": "The 8 falls into the top side pocket, not the called corner pocket – the game is lost.",
};
