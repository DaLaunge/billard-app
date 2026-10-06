import { cue, ball, cut, cutAngle } from "../../ruleEngine.js";
import { D89, D141 } from "../meta.js";

/* Drei Fouls in Folge desselben Spielers; die Zuege des Gegners dazwischen werden
   uebersprungen (nach jedem Foul bekommt der Spieler die Weisse neu in die Hand).
   Die Fouls sind bewusst verschieden, damit man sieht, was alles zaehlt:
     1  falsche Kugel (bzw. beim 14/1 keine Bande)
     2  SCRATCH - die richtige Kugel wird getroffen und laeuft sogar an die Bande,
        trotzdem ist es ein Foul, weil die Weisse in die Tasche faellt
     3  A: 9/10 Ball wieder die falsche Kugel (auch mit Bandenkontakt ein Foul),
           14/1 wieder keine Bande -> Strafe
        B: ein regelgerechter Stoss (die niedrigste/angesagte Kugel faellt) -> Zaehler zurueck
   Ob ein Schritt "Bande" zeigt oder nicht, prueft scripts/checkRules.mjs (expectRail). */
const W0 = [60, 60];
const POCKET = [207, 13];

// Scratch-Geometrie: Kugel bei T laeuft an die untere Bande, die Weisse rollt nach dem Treffer in die Ecktasche.
const T = [165, 55], OBJ = [198.8, 104.5], HAND2 = [90.1, 32.5];

/* lowId = niedrigste (bzw. angesagte) Kugel, wrong1 wird beim ersten Foul getroffen,
   wrong3 beim dritten. wrong3Rail: laeuft die dritte Kugel an die Bande? */
const build = (lowId, wrong1, wrong3, nineMode, tx) => {
  // 9/10 Ball: die falsche Kugel liegt oben und laeuft an die Bande; 14/1: weiche Treffer unten, keine Bande
  const P1 = nineMode ? [100, 40] : [100, 86], P3 = nineMode ? [130, 96] : [150, 88], P9 = [70, 90];
  // Foul 1: 9/10 Ball: falsche Kugel, die danach an die Bande laeuft (auch dann Foul); 14/1: weicher Treffer, keine Bande
  const s1 = nineMode ? cut(W0, { id: wrong1, at: P1 }, [149, 15.5]) : cutAngle(W0, { id: wrong1, at: P1 }, 10, 14);
  // Foul 2: Scratch nach legalem Treffer, die Kugel laeuft an die Bande
  const s2 = cut(HAND2, { id: lowId, at: T }, OBJ, { hand: true });
  s2.w.to = POCKET; s2.w.out = true;
  // Foul 3 A: 9/10 Ball: falsche Kugel mit Bandenkontakt; 14/1: weicher Treffer ohne Bande
  const a3 = nineMode
    ? cut([88, 100], { id: wrong3, at: P3 }, [140, 104.5], { hand: true })
    : cutAngle([100, 66], { id: wrong3, at: P3 }, 8, 12, { hand: true });
  // Foul 3 B: regelgerechter Stoss - die niedrigste Kugel liegt jetzt an der Bande und wird in die Ecktasche gespielt
  const b3 = cut([150, 104.5], { id: lowId, at: OBJ }, [207, 107.5], { out: true, hand: true });
  const balls = () => [cue(...W0), ball(Number(lowId), ...T), ball(Number(wrong1), ...P1), ball(Number(wrong3), ...P3), ball(9, ...P9)];
  const head = [
    { text: tx.start, focus: [lowId] },
    { text: tx.f1, say: "Foul 1/3", wrongFirst: nineMode, expectRail: nineMode, moves: [s1.w, s1.obj], mark: { at: P1, kind: "foul", after: "w" } },
    { text: tx.f2, say: "Foul 2/3", expectRail: true, moves: [s2.w, s2.obj], mark: { at: [200, 19], kind: "foul", afterEnd: "w", delay: -300 } },
  ];
  return [
    {
      label: "Fall A", verdict: "foul", verdictLabel: tx.lossLabel,
      reason: tx.reasonA,
      balls: balls(),
      steps: [...head, { text: tx.f3a, say: "Foul 3/3", wrongFirst: nineMode, expectRail: nineMode, moves: [a3.w, a3.obj], mark: { at: P3, kind: "foul", after: "w" } }],
    },
    {
      label: "Fall B", verdict: "ok", verdictLabel: tx.okLabel,
      reason: "Ein regelgerechter Stoß setzt den Zähler zurück.",
      balls: balls(),
      steps: [...head, { text: tx.f3b, say: "Zähler: 0", expectRail: true, moves: [b3.w, b3.obj], mark: { at: OBJ, kind: "ok", after: "w" } }],
    },
  ];
};

const nine = build("2", "4", "7", true, {
  start: "Ausgangslage: Ein Spieler hat in diesem Spiel noch kein Foul. Zwischen seinen Stößen spielt der Gegner regulär.",
  f1: "Foul 1: Die Weiße berührt zuerst die 4 statt der 2. Die 4 läuft zwar an die Bande, trotzdem ein Foul.",
  f2: "Foul 2: Die 2 wird zuerst berührt und läuft sogar an die Bande – trotzdem ein Foul, denn die Weiße fällt in die Tasche (Scratch). Der Schiedsrichter warnt den Spieler.",
  f3a: "Foul 3: Wieder die falsche Kugel (7 statt 2) – auch mit Bandenkontakt ein Foul. Drei Fouls in Folge: das Spiel ist verloren.",
  f3b: "Der dritte Stoß ist regelgerecht: die 2 wird zuerst getroffen und versenkt. Der Foul-Zähler beginnt von vorn.",
  lossLabel: "Spiel verloren",
  okLabel: "Kein Spielverlust",
  reasonA: "Drei Fouls in Folge ohne regelgerechten Stoß: Verlust des Spiels.",
});

const straight = build("5", "8", "11", false, {
  start: "Ausgangslage: Ein Spieler hat noch kein Foul in Folge. Zwischen seinen Stößen spielt der Gegner regulär.",
  f1: "Foul 1: Die Weiße berührt eine Kugel, danach erreicht keine Kugel die Bande (−1 Punkt).",
  f2: "Foul 2: Die angesagte 5 läuft an die Bande, aber die Weiße fällt in die Tasche (Scratch, −1 Punkt). Der Schiedsrichter warnt den Spieler.",
  f3a: "Foul 3: Wieder keine Bande nach dem Treffer (−1 Punkt). Drittes Foul in Folge: zusätzlich 15 Punkte Abzug, alle Kugeln werden neu aufgebaut, der Spieler stößt neu an.",
  f3b: "Der dritte Stoß ist regelgerecht: die angesagte 5 wird versenkt. Der Foul-Zähler beginnt von vorn.",
  lossLabel: "−16 Punkte",
  okLabel: "Kein Zusatzabzug",
  reasonA: "Drittes Foul in Folge: 1 Punkt und zusätzlich 15 Punkte Abzug, neu aufbauen.",
});

export default {
  id: "drei-fouls",
  released: false,
  discs: ["9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "ablauf",
  ref: "3.13, 3.1, 5.8, 6.10, 7.11",
  keywords: ["drei Fouls", "3-Foul-Regel", "Foul in Folge", "dritte Foul", "Spielverlust", "Verwarnung", "Warnung", "wie oft Foul", "Fouls hintereinander", "mehrere Fouls", "15 Punkte Abzug", "minus 15 Punkte", "Strafpunkte"],
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
  "15 Punkte Abzug": "15 points deducted",
  "minus 15 Punkte": "minus 15 points",
  "Strafpunkte": "penalty points",
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
  "Ausgangslage: Ein Spieler hat in diesem Spiel noch kein Foul. Zwischen seinen Stößen spielt der Gegner regulär.": "Starting position: a player has not committed a foul in this game yet. The opponent plays normally between his shots.",
  "Foul 1: Die Weiße berührt zuerst die 4 statt der 2. Die 4 läuft zwar an die Bande, trotzdem ein Foul.": "Foul 1: the cue ball touches the 4 first instead of the 2. The 4 does reach a cushion, but it is still a foul.",
  "Foul 2: Die 2 wird zuerst berührt und läuft sogar an die Bande – trotzdem ein Foul, denn die Weiße fällt in die Tasche (Scratch). Der Schiedsrichter warnt den Spieler.": "Foul 2: the 2 is touched first and even runs to a cushion – still a foul, because the cue ball falls into the pocket (scratch). The referee warns the player.",
  "Foul 3: Wieder die falsche Kugel (7 statt 2) – auch mit Bandenkontakt ein Foul. Drei Fouls in Folge: das Spiel ist verloren.": "Foul 3: the wrong ball again (7 instead of 2) – a foul even with cushion contact. Three fouls in a row: the game is lost.",
  "Der dritte Stoß ist regelgerecht: die 2 wird zuerst getroffen und versenkt. Der Foul-Zähler beginnt von vorn.": "The third shot is legal: the 2 is hit first and pocketed. The foul counter starts over.",
  "Drittes Foul in Folge: 1 Punkt und zusätzlich 15 Punkte Abzug, neu aufbauen.": "Third foul in a row: 1 point plus 15 points deducted, re-rack.",
  "Ausgangslage: Ein Spieler hat noch kein Foul in Folge. Zwischen seinen Stößen spielt der Gegner regulär.": "Starting position: a player has no consecutive fouls yet. The opponent plays normally between his shots.",
  "Foul 1: Die Weiße berührt eine Kugel, danach erreicht keine Kugel die Bande (−1 Punkt).": "Foul 1: the cue ball touches a ball, afterwards no ball reaches a cushion (−1 point).",
  "Foul 2: Die angesagte 5 läuft an die Bande, aber die Weiße fällt in die Tasche (Scratch, −1 Punkt). Der Schiedsrichter warnt den Spieler.": "Foul 2: the called 5 runs to a cushion, but the cue ball falls into the pocket (scratch, −1 point). The referee warns the player.",
  "Foul 3: Wieder keine Bande nach dem Treffer (−1 Punkt). Drittes Foul in Folge: zusätzlich 15 Punkte Abzug, alle Kugeln werden neu aufgebaut, der Spieler stößt neu an.": "Foul 3: no cushion after the hit again (−1 point). Third foul in a row: 15 further points deducted, all balls are re-racked and the player breaks again.",
  "Der dritte Stoß ist regelgerecht: die angesagte 5 wird versenkt. Der Foul-Zähler beginnt von vorn.": "The third shot is legal: the called 5 is pocketed. The foul counter starts over.",
};
