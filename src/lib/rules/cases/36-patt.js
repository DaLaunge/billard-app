import { cue, ball } from "../../ruleEngine.js";
import { ALL_DISCS, D8, D89, D141 } from "../meta.js";

/* Patt (Regel 1.13): Sieht der Schiedsrichter keinen Fortschritt in Richtung Spielentscheidung, kuendigt
   er ein Patt an. Stimmen beide Spieler zu, gilt es sofort; sonst hat jeder noch drei Aufnahmen. Gibt
   es danach immer noch keinen Fortschritt, erklaert er das Spiel zum Patt. Was folgt, steht in der
   Disziplin: 8/9/10 Ball: neu beginnen, der urspruengliche Anstosser stoesst wieder an; 14/1: neuer
   Eroeffnungsstoss, beide stossen neu aus. Die Szene zeigt eine festgefahrene Lage (nichts bewegt
   sich), der Zaehler die Aufnahmen. */
const stuck = () => [cue(80, 84), ball(8, 150, 40), ball(5, 168, 40), ball(12, 160, 22), ball(7, 190, 62)];
const SAY = "Patt angekündigt";

const build = (tx) => [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "Patt sofort",
    reason: "Beide Spieler stimmen dem Patt zu: es gilt sofort, ohne die drei Aufnahmen.",
    balls: stuck(),
    steps: [
      { text: "Ausgangslage: Seit mehreren Aufnahmen wird nur noch Sicherheit gespielt, die Kugeln sind festgefahren.", focus: ["8", "5", "12"] },
      { text: "Der Schiedsrichter sieht keinen Fortschritt und kündigt ein Patt an.", say: SAY, sayIcon: "mouth", count: { label: "Aufnahmen bis zum Patt", n: 0, of: 3 } },
      { text: "Beide Spieler stimmen zu – das Patt gilt sofort. " + tx.after, count: { label: "Aufnahmen bis zum Patt", n: 0, of: 3 }, mark: { at: [160, 40], kind: "ok", delay: 200 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Patt nach drei Aufnahmen",
    reason: "Stimmt ein Spieler nicht zu, hat jeder noch drei Aufnahmen. Gibt es danach keinen Fortschritt, wird das Spiel zum Patt erklärt.",
    balls: stuck(),
    steps: [
      { text: "Ausgangslage: Seit mehreren Aufnahmen wird nur noch Sicherheit gespielt, die Kugeln sind festgefahren.", focus: ["8", "5", "12"] },
      { text: "Der Schiedsrichter kündigt ein Patt an. Ein Spieler stimmt nicht zu: jeder hat noch drei Aufnahmen.", say: SAY, sayIcon: "mouth", count: { label: "Aufnahmen bis zum Patt", n: 0, of: 3 } },
      { text: "Nach der ersten Aufnahme jedes Spielers hat sich nichts verändert.", count: { label: "Aufnahmen bis zum Patt", n: 1, of: 3 } },
      { text: "Auch nach der zweiten Aufnahme gibt es keinen Fortschritt.", count: { label: "Aufnahmen bis zum Patt", n: 2, of: 3 } },
      { text: "Nach der dritten Aufnahme erklärt der Schiedsrichter das Spiel zum Patt. " + tx.after, count: { label: "Aufnahmen bis zum Patt", n: 3, of: 3 }, mark: { at: [160, 40], kind: "ok", delay: 200 } },
    ],
  },
];

const ball8910 = build({ after: "Das Spiel wird neu begonnen, der ursprüngliche Anstoßer stößt wieder an." });
const straight = build({ after: "Es wird neu aufgebaut, beide Spieler stoßen das Anstoßrecht neu aus." });

export default {
  id: "patt",
  released: true,
  discs: ALL_DISCS,
  topic: "ablauf",
  tags: ["ablauf"],
  ref: "1.13, 4.11, 5.9, 6.11, 7.12",
  keywords: ["Patt", "Spiel festgefahren", "kein Fortschritt", "drei Aufnahmen", "Spielstand blockiert", "Remis im Spiel", "Schiedsrichter kündigt Patt an"],
  title: "Patt: kein Fortschritt im Spiel",
  rule: "Sieht der Schiedsrichter keinen Fortschritt in Richtung Spielentscheidung, kündigt er ein Patt an. Stimmen beide Spieler zu, gilt das Patt sofort. Sonst hat jeder Spieler noch drei Aufnahmen; ist danach immer noch kein Fortschritt zu sehen, erklärt der Schiedsrichter das Spiel zum Patt. Beim 8-, 9- und 10-Ball wird neu begonnen und der ursprüngliche Anstoßer stößt wieder an. Beim 14/1 wird neu aufgebaut und beide Spieler stoßen das Anstoßrecht neu aus. Nach der Lehrunterlage (8-Ball) kündigt der Schiedsrichter die Absicht sechs Stöße vorher an.",
  sets: [
    { discs: [...D8, ...D89], tag: "Patt · neu beginnen", variants: ball8910 },
    { discs: D141, tag: "14/1 · Patt", variants: straight },
  ],
};

export const en = {
  "Patt: kein Fortschritt im Spiel": "Deadlock: no progress in the game",
  "Sieht der Schiedsrichter keinen Fortschritt in Richtung Spielentscheidung, kündigt er ein Patt an. Stimmen beide Spieler zu, gilt das Patt sofort. Sonst hat jeder Spieler noch drei Aufnahmen; ist danach immer noch kein Fortschritt zu sehen, erklärt der Schiedsrichter das Spiel zum Patt. Beim 8-, 9- und 10-Ball wird neu begonnen und der ursprüngliche Anstoßer stößt wieder an. Beim 14/1 wird neu aufgebaut und beide Spieler stoßen das Anstoßrecht neu aus. Nach der Lehrunterlage (8-Ball) kündigt der Schiedsrichter die Absicht sechs Stöße vorher an.": "If the referee sees no progress towards deciding the game he announces a deadlock. If both players agree the deadlock applies at once. Otherwise each player has three more innings; if there is still no progress afterwards the referee declares the game a deadlock. In 8-, 9- and 10-ball the game starts again and the original breaker breaks again. In 14.1 the balls are re-racked and both players lag again for the break. According to the training material (8-ball) the referee announces his intention six shots in advance.",
  "Patt": "Deadlock",
  "Spiel festgefahren": "game stuck",
  "kein Fortschritt": "no progress",
  "drei Aufnahmen": "three innings",
  "Spielstand blockiert": "game blocked",
  "Remis im Spiel": "draw in the game",
  "Schiedsrichter kündigt Patt an": "referee announces deadlock",
  "Patt · neu beginnen": "Deadlock · start again",
  "14/1 · Patt": "14.1 · deadlock",
  "Patt angekündigt": "Deadlock announced",
  "Aufnahmen bis zum Patt": "Innings until deadlock",
  "Patt sofort": "Deadlock at once",
  "Patt nach drei Aufnahmen": "Deadlock after three innings",
  "Beide Spieler stimmen dem Patt zu: es gilt sofort, ohne die drei Aufnahmen.": "Both players agree to the deadlock: it applies at once, without the three innings.",
  "Stimmt ein Spieler nicht zu, hat jeder noch drei Aufnahmen. Gibt es danach keinen Fortschritt, wird das Spiel zum Patt erklärt.": "If a player does not agree each has three more innings. If there is still no progress the game is declared a deadlock.",
  "Ausgangslage: Seit mehreren Aufnahmen wird nur noch Sicherheit gespielt, die Kugeln sind festgefahren.": "Starting position: for several innings only safeties have been played, the balls are stuck.",
  "Der Schiedsrichter sieht keinen Fortschritt und kündigt ein Patt an.": "The referee sees no progress and announces a deadlock.",
  "Beide Spieler stimmen zu – das Patt gilt sofort. Das Spiel wird neu begonnen, der ursprüngliche Anstoßer stößt wieder an.": "Both players agree – the deadlock applies at once. The game starts again, the original breaker breaks again.",
  "Beide Spieler stimmen zu – das Patt gilt sofort. Es wird neu aufgebaut, beide Spieler stoßen das Anstoßrecht neu aus.": "Both players agree – the deadlock applies at once. The balls are re-racked, both players lag again for the break.",
  "Der Schiedsrichter kündigt ein Patt an. Ein Spieler stimmt nicht zu: jeder hat noch drei Aufnahmen.": "The referee announces a deadlock. One player does not agree: each has three more innings.",
  "Nach der ersten Aufnahme jedes Spielers hat sich nichts verändert.": "After each player's first inning nothing has changed.",
  "Auch nach der zweiten Aufnahme gibt es keinen Fortschritt.": "There is still no progress after the second inning.",
  "Nach der dritten Aufnahme erklärt der Schiedsrichter das Spiel zum Patt. Das Spiel wird neu begonnen, der ursprüngliche Anstoßer stößt wieder an.": "After the third inning the referee declares the game a deadlock. The game starts again, the original breaker breaks again.",
  "Nach der dritten Aufnahme erklärt der Schiedsrichter das Spiel zum Patt. Es wird neu aufgebaut, beide Spieler stoßen das Anstoßrecht neu aus.": "After the third inning the referee declares the game a deadlock. The balls are re-racked, both players lag again for the break.",
};
