import { cue, ball, cut, along } from "../../ruleEngine.js";
import { D8, D141 } from "../meta.js";

/* Ansagespiel: die Kugel faellt, aber NICHT in die angesagte Tasche. Sie zaehlt nicht.
   8 Ball: die Kugel bleibt unten, die Aufnahme ist beendet. 10 Ball: der Gegner waehlt, ob er
   den Tisch uebernimmt oder zurueckgibt. 14/1: die Kugel wird aufgebaut, keine Strafe.
   Fall A: Mitteltasche statt der angesagten Ecktasche. Fall B: angesagte Tasche. */
const T = [140, 40], MID = [110, 8], CORNER = [207, 12.5], FOOT = [160, 60];
const WA = along(T, MID, -71), WB = along(T, CORNER, -71);
const a = cut(WA, { id: "4", at: T }, MID, { out: true });
const b = cut(WB, { id: "4", at: T }, CORNER, { out: true });

const build = (opp, tx, respot) => [
  {
    label: "Fall A", verdict: "foul", verdictLabel: tx.labelA,
    reason: tx.reasonA,
    balls: [cue(...WA), ball(4, ...T), ball(opp, 60, 95)],
    steps: [
      { text: "Ausgangslage: Der Spieler sagt die 4 in die Ecktasche rechts oben an.", say: "Ansage: 4 → rechts oben", sayIcon: "mouth", focus: ["4"] },
      { text: "Die Weiße spielt die 4 an.", aim: [WA, a.contact] },
      { text: "Die 4 fällt in die Mitteltasche, nicht in die angesagte Tasche – sie zählt nicht.", expectRail: true, moves: [a.w, a.obj], mark: { at: [112, 14], kind: "foul", after: "w", delay: 400 } },
      ...(respot ? [{ text: "Die Kugel wird wieder aufgebaut (Fußpunkt), es gibt keine Strafe.", moves: [{ id: "4", to: FOOT, place: true }] }] : []),
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: tx.labelB,
    reason: tx.reasonB,
    balls: [cue(...WB), ball(4, ...T), ball(opp, 60, 95)],
    steps: [
      { text: "Ausgangslage: Der Spieler sagt die 4 in die Ecktasche rechts oben an.", say: "Ansage: 4 → rechts oben", sayIcon: "mouth", focus: ["4"] },
      { text: "Die Weiße spielt die 4 an.", aim: [WB, b.contact] },
      { text: "Die 4 fällt in die angesagte Tasche – gewertet, der Spieler spielt weiter.", expectRail: true, moves: [b.w, b.obj], mark: { at: [200, 19], kind: "ok", after: "w", delay: 400 } },
    ],
  },
];

const ten = build(9, {
  labelA: "Nicht gewertet – Gegner wählt", labelB: "Gewertet, Spieler spielt weiter",
  reasonA: "Nicht in die angesagte Tasche gefallen: die Aufnahme ist beendet, der Gegner wählt, ob er übernimmt oder zurückgibt.",
  reasonB: "In die angesagte Tasche gefallen: die Kugel zählt.",
}, false);
const eight = build(12, {
  labelA: "Nicht gewertet – Aufnahme beendet", labelB: "Gewertet, Spieler spielt weiter",
  reasonA: "Nicht in die angesagte Tasche gefallen: die Kugel zählt nicht und bleibt in der Tasche, die Aufnahme ist beendet.",
  reasonB: "In die angesagte Tasche gefallen: die Kugel zählt.",
}, false);
const straight = build(11, {
  labelA: "Kugel wird aufgebaut, keine Strafe", labelB: "1 Punkt, Spieler spielt weiter",
  reasonA: "Nicht in die angesagte Tasche gefallen: die Kugel wird wieder aufgebaut, es gibt keine Strafe.",
  reasonB: "In die angesagte Tasche gefallen: ein Punkt.",
}, true);

export default {
  id: "falsche-tasche",
  released: true,
  discs: ["8 Ball", "10 Ball", "14/1 Endlos"],
  topic: "ablauf",
  ref: "1.7, 4.6, 6.5, 6.6, 7.5, 7.6",
  keywords: ["falsche Tasche", "nicht angesagte Tasche", "Ansage", "Kugel und Tasche ansagen", "andere Tasche", "unkorrekt versenkt", "Falschansage"],
  title: "Kugel fällt in die falsche Tasche",
  rule: "Bei Ansagespielen (8-Ball, 10-Ball, 14/1) müssen Kugel und Tasche angesagt werden, wenn das nicht offensichtlich ist; Banden oder Kombinationen müssen nicht angesagt werden, es darf nur eine Kugel pro Stoß angesagt werden. Fällt die angesagte Kugel nicht in die angesagte Tasche, zählt sie nicht: Beim 8-Ball bleibt sie in der Tasche und die Aufnahme ist beendet, beim 10-Ball wählt der Gegner, ob er den Tisch übernimmt oder zurückgibt (die 10 wird wieder aufgebaut), beim 14/1 wird sie wieder aufgebaut, ohne Strafe. Fällt beim 8-Ball die 8 in eine nicht angesagte Tasche, ist das Spiel verloren. Eine falsche Ansage des Schiedsrichters muss der Spieler vor dem Stoß korrigieren. Zusätzlich versenkte Kugeln zählen nur zu einer korrekt versenkten angesagten Kugel.",
  sets: [
    { discs: ["10 Ball"], tag: "Niedrigste Kugel: 4", variants: ten },
    { discs: D8, tag: "Du spielst Volle", variants: eight },
    { discs: D141, tag: "14/1 · Ansage: 4", variants: straight },
  ],
};

export const en = {
  "Kugel fällt in die falsche Tasche": "Ball falls into the wrong pocket",
  "Bei Ansagespielen (8-Ball, 10-Ball, 14/1) müssen Kugel und Tasche angesagt werden, wenn das nicht offensichtlich ist; Banden oder Kombinationen müssen nicht angesagt werden, es darf nur eine Kugel pro Stoß angesagt werden. Fällt die angesagte Kugel nicht in die angesagte Tasche, zählt sie nicht: Beim 8-Ball bleibt sie in der Tasche und die Aufnahme ist beendet, beim 10-Ball wählt der Gegner, ob er den Tisch übernimmt oder zurückgibt (die 10 wird wieder aufgebaut), beim 14/1 wird sie wieder aufgebaut, ohne Strafe. Fällt beim 8-Ball die 8 in eine nicht angesagte Tasche, ist das Spiel verloren. Eine falsche Ansage des Schiedsrichters muss der Spieler vor dem Stoß korrigieren. Zusätzlich versenkte Kugeln zählen nur zu einer korrekt versenkten angesagten Kugel.":
    "In call games (8-ball, 10-ball, 14.1) ball and pocket must be called unless obvious; cushions or combinations need not be called, and only one ball may be called per shot. If the called ball does not fall into the called pocket it does not count: in 8-ball it stays in the pocket and the inning is over, in 10-ball the opponent chooses whether to take the table or hand it back (the 10 is re-spotted), in 14.1 it is re-spotted without penalty. If in 8-ball the 8 falls into an uncalled pocket the game is lost. A wrong call by the referee must be corrected by the player before the shot. Additionally pocketed balls only count together with a correctly pocketed called ball.",
  "falsche Tasche": "wrong pocket",
  "nicht angesagte Tasche": "uncalled pocket",
  "Ansage": "announcement",
  "Kugel und Tasche ansagen": "call ball and pocket",
  "andere Tasche": "other pocket",
  "unkorrekt versenkt": "incorrectly pocketed",
  "Falschansage": "wrong call",
  "Niedrigste Kugel: 4": "Lowest ball: 4",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 4": "14.1 · call: 4",
  "Ansage: 4 → rechts oben": "Call: 4 → top right",
  "Nicht gewertet – Gegner wählt": "Not counted – opponent chooses",
  "Nicht gewertet – Aufnahme beendet": "Not counted – inning over",
  "Gewertet, Spieler spielt weiter": "Counted, player continues",
  "Kugel wird aufgebaut, keine Strafe": "Ball is re-spotted, no penalty",
  "1 Punkt, Spieler spielt weiter": "1 point, player continues",
  "Nicht in die angesagte Tasche gefallen: die Aufnahme ist beendet, der Gegner wählt, ob er übernimmt oder zurückgibt.": "Did not fall into the called pocket: the inning is over, the opponent chooses whether to take over or hand back.",
  "In die angesagte Tasche gefallen: die Kugel zählt.": "Fell into the called pocket: the ball counts.",
  "Nicht in die angesagte Tasche gefallen: die Kugel zählt nicht und bleibt in der Tasche, die Aufnahme ist beendet.": "Did not fall into the called pocket: the ball does not count and stays in the pocket, the inning is over.",
  "Nicht in die angesagte Tasche gefallen: die Kugel wird wieder aufgebaut, es gibt keine Strafe.": "Did not fall into the called pocket: the ball is re-spotted, there is no penalty.",
  "In die angesagte Tasche gefallen: ein Punkt.": "Fell into the called pocket: one point.",
  "Ausgangslage: Der Spieler sagt die 4 in die Ecktasche rechts oben an.": "Starting position: the player calls the 4 in the top right corner pocket.",
  "Die Weiße spielt die 4 an.": "The cue ball plays the 4.",
  "Die 4 fällt in die Mitteltasche, nicht in die angesagte Tasche – sie zählt nicht.": "The 4 falls into the side pocket, not the called pocket – it does not count.",
  "Die Kugel wird wieder aufgebaut (Fußpunkt), es gibt keine Strafe.": "The ball is re-spotted (foot spot), there is no penalty.",
  "Die 4 fällt in die angesagte Tasche – gewertet, der Spieler spielt weiter.": "The 4 falls into the called pocket – counted, the player continues.",
};
