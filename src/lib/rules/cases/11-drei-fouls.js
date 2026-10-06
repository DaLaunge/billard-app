import { cue, ball, cut, cutAngle } from "../../ruleEngine.js";
import { D89, D141 } from "../meta.js";

/* Drei Fouls in Folge desselben Spielers (die Zuege des Gegners dazwischen werden
   uebersprungen). Fall A: dritter Foul = Strafe. Fall B: ein regelgerechter
   Stoss dazwischen setzt den Zaehler zurueck. */
const W0 = [60, 60];

/* ---- 9 / 10 Ball: Fouls = falsche Kugel, keine Bande, falsche Kugel ---- */
const nine = (() => {
  const P2 = [140, 38], P4 = [150, 82], P7 = [110, 92];
  const s1 = cut(W0, { id: "4", at: P4 }, [176, 100]);      // Foul 1: 4 statt 2
  const s2 = cut(s1.w.to, { id: "2", at: P2 }, [156, 31]);  // Foul 2: 2 getroffen, aber keine Bande
  const a3 = cutAngle(s2.w.to, { id: "7", at: P7 }, 12, 14);   // A: Foul 3, wieder falsche Kugel (7 statt 2)
  const b3 = cut(s2.w.to, { id: "2", at: [156, 31] }, [207, 12], { out: true }); // B: regelgerecht, die 2 faellt
  const balls = () => [cue(...W0), ball(2, ...P2), ball(4, ...P4), ball(7, ...P7), ball(9, 196, 62)];
  const head = [
    { text: "Ausgangslage: Ein Spieler hat in diesem Spiel noch kein Foul.", focus: ["2"] },
    { text: "Foul 1: Die Weiße berührt zuerst die 4 statt der 2.", say: "Foul 1/3", moves: [s1.w, s1.obj], mark: { at: P4, kind: "foul", after: "w" } },
    { text: "Foul 2: Die 2 wird getroffen, aber keine Kugel berührt danach die Bande. Der Schiedsrichter warnt den Spieler.", say: "Foul 2/3", moves: [s2.w, s2.obj], mark: { at: P2, kind: "foul", after: "w" } },
  ];
  return [
    {
      label: "Fall A", verdict: "foul", verdictLabel: "Spiel verloren",
      reason: "Drei Fouls in Folge ohne regelgerechten Stoß: Verlust des Spiels.",
      balls: balls(),
      steps: [...head, { text: "Foul 3: Wieder die falsche Kugel (7 statt 2). Drei Fouls in Folge – das Spiel ist verloren.", say: "Foul 3/3", moves: [a3.w, a3.obj], mark: { at: P7, kind: "foul", after: "w" } }],
    },
    {
      label: "Fall B", verdict: "ok", verdictLabel: "Kein Spielverlust",
      reason: "Ein regelgerechter Stoß setzt den Zähler zurück.",
      balls: balls(),
      steps: [...head, { text: "Der dritte Stoß ist regelgerecht: die 2 wird versenkt. Der Foul-Zähler beginnt von vorn.", say: "Zähler: 0", moves: [b3.w, b3.obj], mark: { at: [156, 31], kind: "ok", after: "w" } }],
    },
  ];
})();

/* ---- 14/1: dreimal "keine Bande"; Strafe 1 + 15 Punkte, neu aufbauen ---- */
const straight = (() => {
  const P5 = [140, 40], P8 = [150, 82], P11 = [110, 92];
  const s1 = cut(W0, { id: "8", at: P8 }, [165, 92]);
  const s2 = cut(s1.w.to, { id: "5", at: P5 }, [156, 32]);
  const a3 = cutAngle(s2.w.to, { id: "11", at: P11 }, 12, 14);
  const b3 = cut(s2.w.to, { id: "5", at: [156, 32] }, [207, 12], { out: true });
  const balls = () => [cue(...W0), ball(5, ...P5), ball(8, ...P8), ball(11, ...P11), ball(14, 196, 62)];
  const head = [
    { text: "Ausgangslage: Ein Spieler hat noch kein Foul in Folge.", focus: ["5"] },
    { text: "Foul 1: Die Weiße berührt eine Kugel, danach erreicht keine Kugel die Bande (−1 Punkt).", say: "Foul 1/3", moves: [s1.w, s1.obj], mark: { at: P8, kind: "foul", after: "w" } },
    { text: "Foul 2: Wieder keine Bande nach dem Treffer (−1 Punkt). Der Schiedsrichter warnt den Spieler.", say: "Foul 2/3", moves: [s2.w, s2.obj], mark: { at: P5, kind: "foul", after: "w" } },
  ];
  return [
    {
      label: "Fall A", verdict: "foul", verdictLabel: "−16 Punkte",
      reason: "Drittes Foul in Folge: 1 Punkt und zusätzlich 15 Punkte Abzug, neu aufbauen.",
      balls: balls(),
      steps: [...head, { text: "Foul 3: Wieder keine Bande. 1 Punkt plus 15 Punkte Abzug, alle Kugeln werden neu aufgebaut, der Spieler stößt neu an.", say: "Foul 3/3", moves: [a3.w, a3.obj], mark: { at: P11, kind: "foul", after: "w" } }],
    },
    {
      label: "Fall B", verdict: "ok", verdictLabel: "Kein Zusatzabzug",
      reason: "Ein regelgerechter Stoß setzt den Zähler zurück.",
      balls: balls(),
      steps: [...head, { text: "Der dritte Stoß ist regelgerecht: die angesagte 5 wird versenkt. Der Foul-Zähler beginnt von vorn.", say: "Zähler: 0", moves: [b3.w, b3.obj], mark: { at: [156, 32], kind: "ok", after: "w" } }],
    },
  ];
})();

export default {
  id: "drei-fouls",
  released: false,
  discs: ["9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "ablauf",
  ref: "3.13, 5.8, 6.10, 7.11",
  keywords: ["drei Fouls", "3-Foul-Regel", "Foul in Folge", "dritte Foul", "Spielverlust", "Verwarnung", "Warnung", "wie oft Foul", "Fouls hintereinander", "mehrere Fouls"],
  title: "Drei Fouls in Folge",
  rule: "Begeht ein Spieler drei Fouls, ohne dazwischen einen regelgerechten Stoß auszuführen, ist das ein schwerwiegendes Foul. Der Schiedsrichter muss ihn nach dem zweiten Foul warnen, sonst zählt ein drittes Foul nur als zweites. Beim 9-Ball und 10-Ball bedeutet es den Verlust des Spiels (die drei Fouls müssen im selben Spiel fallen). Beim 14/1 Endlos werden zum üblichen Punkt zusätzlich 15 Punkte abgezogen, die Fouls sind danach aufgehoben, alle Kugeln werden neu aufgebaut und der Spieler stößt neu an; ein Anstoßfoul zählt dafür nicht mit. Beim 8-Ball gibt es diese Regel nicht.",
  sets: [
    { discs: D89, tag: "Niedrigste Kugel: 2", variants: nine },
    { discs: D141, tag: "14/1 · Ansage: 5", variants: straight },
  ],
};

export const en = {
  "Drei Fouls in Folge": "Three consecutive fouls",
  "Begeht ein Spieler drei Fouls, ohne dazwischen einen regelgerechten Stoß auszuführen, ist das ein schwerwiegendes Foul. Der Schiedsrichter muss ihn nach dem zweiten Foul warnen, sonst zählt ein drittes Foul nur als zweites. Beim 9-Ball und 10-Ball bedeutet es den Verlust des Spiels (die drei Fouls müssen im selben Spiel fallen). Beim 14/1 Endlos werden zum üblichen Punkt zusätzlich 15 Punkte abgezogen, die Fouls sind danach aufgehoben, alle Kugeln werden neu aufgebaut und der Spieler stößt neu an; ein Anstoßfoul zählt dafür nicht mit. Beim 8-Ball gibt es diese Regel nicht.":
    "If a player commits three fouls without a legal shot in between, it is a serious foul. The referee must warn the player after the second foul, otherwise a third foul only counts as a second. In 9-ball and 10-ball it means loss of the game (the three fouls must fall in the same game). In 14.1 continuous 15 further points are deducted in addition to the usual point, the fouls are then cleared, all balls are re-racked and the player breaks again; a break foul does not count towards this. 8-ball has no such rule.",
  "drei Fouls": "three fouls",
  "3-Foul-Regel": "three-foul rule",
  "Foul in Folge": "foul in a row",
  "dritte Foul": "third foul",
  "Spielverlust": "loss of game",
  "Verwarnung": "caution",
  "Warnung": "warning",
  "wie oft Foul": "how many fouls",
  "Fouls hintereinander": "fouls in a row",
  "mehrere Fouls": "several fouls",
  "Niedrigste Kugel: 2": "Lowest ball: 2",
  "14/1 · Ansage: 5": "14.1 · call: 5",
  "Spiel verloren": "Game lost",
  "Kein Spielverlust": "No loss of game",
  "−16 Punkte": "−16 points",
  "Kein Zusatzabzug": "No extra deduction",
  "Foul 1/3": "Foul 1/3",
  "Foul 2/3": "Foul 2/3",
  "Foul 3/3": "Foul 3/3",
  "Zähler: 0": "Counter: 0",
  "Drei Fouls in Folge ohne regelgerechten Stoß: Verlust des Spiels.": "Three fouls in a row without a legal shot: loss of the game.",
  "Ein regelgerechter Stoß setzt den Zähler zurück.": "A legal shot resets the counter.",
  "Ausgangslage: Ein Spieler hat in diesem Spiel noch kein Foul.": "Starting position: a player has not committed a foul in this game yet.",
  "Foul 1: Die Weiße berührt zuerst die 4 statt der 2.": "Foul 1: the cue ball touches the 4 first instead of the 2.",
  "Foul 2: Die 2 wird getroffen, aber keine Kugel berührt danach die Bande. Der Schiedsrichter warnt den Spieler.": "Foul 2: the 2 is hit, but no ball touches a cushion afterwards. The referee warns the player.",
  "Foul 3: Wieder die falsche Kugel (7 statt 2). Drei Fouls in Folge – das Spiel ist verloren.": "Foul 3: the wrong ball again (7 instead of 2). Three fouls in a row – the game is lost.",
  "Der dritte Stoß ist regelgerecht: die 2 wird versenkt. Der Foul-Zähler beginnt von vorn.": "The third shot is legal: the 2 is pocketed. The foul counter starts over.",
  "Drittes Foul in Folge: 1 Punkt und zusätzlich 15 Punkte Abzug, neu aufbauen.": "Third foul in a row: 1 point plus 15 points deducted, re-rack.",
  "Ausgangslage: Ein Spieler hat noch kein Foul in Folge.": "Starting position: a player has no consecutive fouls yet.",
  "Foul 1: Die Weiße berührt eine Kugel, danach erreicht keine Kugel die Bande (−1 Punkt).": "Foul 1: the cue ball touches a ball, afterwards no ball reaches a cushion (−1 point).",
  "Foul 2: Wieder keine Bande nach dem Treffer (−1 Punkt). Der Schiedsrichter warnt den Spieler.": "Foul 2: again no cushion after the hit (−1 point). The referee warns the player.",
  "Foul 3: Wieder keine Bande. 1 Punkt plus 15 Punkte Abzug, alle Kugeln werden neu aufgebaut, der Spieler stößt neu an.": "Foul 3: no cushion again. 1 point plus 15 points deducted, all balls are re-racked and the player breaks again.",
  "Der dritte Stoß ist regelgerecht: die angesagte 5 wird versenkt. Der Foul-Zähler beginnt von vorn.": "The third shot is legal: the called 5 is pocketed. The foul counter starts over.",
};
