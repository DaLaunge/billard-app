import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, D141, ALL_DISCS, tagSets } from "../meta.js";

/* Stoerung von aussen (Zuschauer stoesst an den Tisch). Fall A: waehrend des Stosses -
   alle Kugeln zurueck, Stoss wiederholen. Fall B: vor dem Stoss, ohne Einfluss - nur die
   verschobene Kugel zurueck, es geht weiter. */
const W = [60, 72], P3 = [125, 74], P5 = [100, 38], P9 = [190, 96];
const SHIFTED = [112, 41];
const shot = cut(W, { id: "3", at: P3 }, [152, 104.5]);
const balls = () => [cue(...W), ball(3, ...P3), ball(5, ...P5), ball(9, ...P9)];

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "Stoß wird wiederholt",
    reason: "Die Störung kam während des Stoßes und hat ihn beeinflusst: alle Kugeln zurück, Stoß wiederholen.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Die Weiße wird auf die 3 gespielt.", focus: ["3"], aim: [W, P3] },
      {
        text: "Mitten im Stoß stößt ein Zuschauer an den Tisch, die 5 wird verschoben.",
        say: "Störung", sayIcon: "hand",
        expectRail: true,
        moves: [shot.w, shot.obj, { id: "5", to: SHIFTED, delay: 120 }],
      },
      {
        text: "Der Schiedsrichter legt alle Kugeln wieder so hin, wie sie vor dem Stoß lagen. Der Stoß wird wiederholt.",
        moves: [
          { id: "w", to: W, place: true },
          { id: "3", to: P3, place: true, delay: 100 },
          { id: "5", to: P5, place: true, delay: 200 },
        ],
      },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Weiterspielen",
    reason: "Die Störung hatte keinen Einfluss auf den Stoß: nur die verschobene Kugel wird zurückgelegt.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Die Weiße wird auf die 3 gespielt.", focus: ["3"], aim: [W, P3] },
      { text: "Vor dem Stoß stößt ein Zuschauer an den Tisch, die 5 wird verschoben.", say: "Störung", sayIcon: "hand", moves: [{ id: "5", to: SHIFTED }] },
      { text: "Die Störung hatte keinen Einfluss auf den Stoß: Der Schiedsrichter legt nur die 5 zurück, dann wird weitergespielt.", moves: [{ id: "5", to: P5, place: true }] },
    ],
  },
];

export default {
  id: "stoerung-von-aussen",
  released: true,
  discs: ALL_DISCS,
  topic: "ablauf",
  ref: "1.10, 1.9",
  keywords: ["Außenstörung", "Zuschauer", "Tisch angestoßen", "Kugel verschoben", "höhere Gewalt", "Kugeln zurücklegen", "Stoß wiederholen"],
  title: "Störung von außen",
  rule: "Tritt während eines Stoßes eine Störung von außen auf (zum Beispiel stößt ein Zuschauer an den Tisch) und wirkt sie sich auf den Stoß aus, stellt der Schiedsrichter die Kugeln so auf, wie sie vor dem Stoß lagen, und der Stoß wird wiederholt. Hatte die Störung keine Auswirkung auf den Stoß, legt er nur die betroffenen Kugeln an ihre ursprüngliche Position zurück, und das Spiel geht weiter. Lassen sich die Kugeln nicht mehr zurücklegen, wird die Situation wie ein Patt behandelt (Neubeginn; beim 14/1 stoßen beide neu aus, es wird neu aufgebaut und mit dem Punktestand vor der Störung weitergespielt). Der Schiedsrichter legt zurück; seine Entscheidung ist bindend, jeder Spieler darf sie einmal hinterfragen.",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 3"],
    [D8, "Du spielst Volle"],
    [D141, "14/1 · Ansage: 3"],
  ]),
};

export const en = {
  "Störung von außen": "Outside disturbance",
  "Tritt während eines Stoßes eine Störung von außen auf (zum Beispiel stößt ein Zuschauer an den Tisch) und wirkt sie sich auf den Stoß aus, stellt der Schiedsrichter die Kugeln so auf, wie sie vor dem Stoß lagen, und der Stoß wird wiederholt. Hatte die Störung keine Auswirkung auf den Stoß, legt er nur die betroffenen Kugeln an ihre ursprüngliche Position zurück, und das Spiel geht weiter. Lassen sich die Kugeln nicht mehr zurücklegen, wird die Situation wie ein Patt behandelt (Neubeginn; beim 14/1 stoßen beide neu aus, es wird neu aufgebaut und mit dem Punktestand vor der Störung weitergespielt). Der Schiedsrichter legt zurück; seine Entscheidung ist bindend, jeder Spieler darf sie einmal hinterfragen.":
    "If an outside disturbance occurs during a shot (for example a spectator bumps the table) and it affects the shot, the referee sets the balls up as they lay before the shot and the shot is replayed. If the disturbance had no effect on the shot, only the affected balls are put back in their original position and play continues. If the balls cannot be put back any more, the situation is treated like a deadlock (restart; in 14.1 both players lag again, the balls are re-racked and play continues with the score before the disturbance). The referee puts the balls back; his decision is binding, each player may question it once.",
  "Außenstörung": "outside disturbance",
  "Zuschauer": "spectator",
  "Tisch angestoßen": "table bumped",
  "Kugel verschoben": "ball displaced",
  "höhere Gewalt": "force majeure",
  "Kugeln zurücklegen": "put balls back",
  "Stoß wiederholen": "replay the shot",
  "Störung": "Disturbance",
  "Niedrigste Kugel: 3": "Lowest ball: 3",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 3": "14.1 · call: 3",
  "Stoß wird wiederholt": "Shot is replayed",
  "Weiterspielen": "Play continues",
  "Die Störung kam während des Stoßes und hat ihn beeinflusst: alle Kugeln zurück, Stoß wiederholen.": "The disturbance came during the shot and affected it: all balls back, replay the shot.",
  "Die Störung hatte keinen Einfluss auf den Stoß: nur die verschobene Kugel wird zurückgelegt.": "The disturbance had no effect on the shot: only the displaced ball is put back.",
  "Ausgangslage: Die Weiße wird auf die 3 gespielt.": "Starting position: the cue ball is played at the 3.",
  "Mitten im Stoß stößt ein Zuschauer an den Tisch, die 5 wird verschoben.": "In the middle of the shot a spectator bumps the table, the 5 is displaced.",
  "Der Schiedsrichter legt alle Kugeln wieder so hin, wie sie vor dem Stoß lagen. Der Stoß wird wiederholt.": "The referee puts all balls back as they lay before the shot. The shot is replayed.",
  "Vor dem Stoß stößt ein Zuschauer an den Tisch, die 5 wird verschoben.": "Before the shot a spectator bumps the table, the 5 is displaced.",
  "Die Störung hatte keinen Einfluss auf den Stoß: Der Schiedsrichter legt nur die 5 zurück, dann wird weitergespielt.": "The disturbance had no effect on the shot: the referee only puts the 5 back, then play continues.",
};
