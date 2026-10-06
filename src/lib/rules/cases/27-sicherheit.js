import { cue, ball, cut } from "../../ruleEngine.js";
import { D8, D141 } from "../meta.js";

/* Sicherheit ("Safe") bei Ansagespielen: wird vor dem Stoss angesagt, endet die Aufnahme nach
   dem Stoss, auch wenn eine Kugel faellt. 8 Ball: die Kugel bleibt in der Tasche (zaehlt nicht).
   14/1: sie wird wieder aufgebaut. Ohne Ansage zaehlt die versenkte Kugel und der Spieler
   spielt weiter. */
const T = [150, 50], P = [207, 13], W = [91.2, 88.2], FOOT = [160, 60];
const shot = cut(W, { id: "5", at: T }, P, { out: true });
const balls = (opp) => [cue(...W), ball(5, ...T), ball(opp, 100, 40)];

const build = (opp, tx, respot) => [
  {
    label: "Fall A", verdict: "ok", verdictLabel: tx.labelA,
    reason: tx.reasonA,
    balls: balls(opp),
    steps: [
      { text: "Ausgangslage: Die 5 liegt vor der Ecktasche, der Spieler könnte sie versenken.", focus: ["5"] },
      { text: "Der Spieler sagt „Sicherheit“ an und spielt die 5 an.", say: "Sicherheit", aim: [W, shot.contact] },
      { text: tx.shotA, expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: "ok", after: "w", delay: 300 } },
      ...(respot ? [{ text: "Weil Sicherheit angesagt war, wird die 5 wieder aufgebaut (Fußpunkt), die Aufnahme ist beendet.", moves: [{ id: "5", to: FOOT, place: true }] }] : []),
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: tx.labelB,
    reason: tx.reasonB,
    balls: balls(opp),
    steps: [
      { text: "Ausgangslage: Die 5 liegt vor der Ecktasche, der Spieler könnte sie versenken.", focus: ["5"] },
      { text: "Der Spieler sagt keine Sicherheit an und spielt die 5 an.", aim: [W, shot.contact] },
      { text: tx.shotB, expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: "ok", after: "w", delay: 300 } },
    ],
  },
];

const eight = build(12, {
  labelA: "Kugel bleibt unten, Aufnahme beendet", labelB: "Kugel zählt, Spieler spielt weiter",
  reasonA: "Sicherheit angesagt: die versenkte Kugel bleibt in der Tasche, die Aufnahme ist beendet.",
  reasonB: "Ohne Ansage zählt die korrekt versenkte Kugel: der Spieler spielt weiter.",
  shotA: "Die 5 fällt trotzdem. Wegen der Sicherheit bleibt sie in der Tasche, zählt aber nicht, und die Aufnahme ist beendet.",
  shotB: "Die 5 fällt in die Tasche – korrekt versenkt, der Spieler spielt weiter.",
}, false);
const straight = build(11, {
  labelA: "Kugel wird aufgebaut, Aufnahme beendet", labelB: "1 Punkt, Spieler spielt weiter",
  reasonA: "Sicherheit angesagt: versenkte Kugeln werden wieder aufgebaut, die Aufnahme ist beendet.",
  reasonB: "Ohne Ansage zählt die angesagte, korrekt versenkte Kugel einen Punkt: der Spieler spielt weiter.",
  shotA: "Die 5 fällt trotzdem in die Tasche, zählt wegen der Sicherheit aber keinen Punkt.",
  shotB: "Die angesagte 5 fällt in die Tasche – ein Punkt, der Spieler spielt weiter.",
}, true);

export default {
  id: "sicherheit",
  released: false,
  discs: ["8 Ball", "14/1 Endlos"],
  topic: "ablauf",
  ref: "4.6, 7.5, 7.6, 1.7, 2.16",
  keywords: ["Sicherheit", "Safe", "Sicherheitsstoß", "Sicherheit ansagen", "Safety", "Kugel fällt trotz Sicherheit", "Ansagespiel"],
  title: "Sicherheit ansagen",
  rule: "Bei Ansagespielen darf der Spieler vor dem Stoß „Sicherheit“ ansagen statt Kugel und Tasche. Nach dem Stoß ist die Aufnahme beendet, der Gegner übernimmt den Tisch. Fällt dabei trotzdem eine Kugel, zählt sie nicht: Beim 8-Ball bleibt sie in der Tasche (aus dem Spiel), beim 14/1 wird sie wieder aufgebaut. Ohne Ansage ist es ein normaler Stoß; gilt die versenkte Kugel, spielt der Spieler weiter. Der Stoß muss ein korrekter Stoß sein (zulässige Kugel zuerst, danach Bande oder Tasche). Beim 9-Ball wird nichts angesagt, beim 10-Ball gibt es keine Sicherheitsansage.",
  sets: [
    { discs: D8, tag: "Du spielst Volle", variants: eight },
    { discs: D141, tag: "14/1 · Ansage: 5", variants: straight },
  ],
};

export const en = {
  "Sicherheit ansagen": "Calling a safety",
  "Bei Ansagespielen darf der Spieler vor dem Stoß „Sicherheit“ ansagen statt Kugel und Tasche. Nach dem Stoß ist die Aufnahme beendet, der Gegner übernimmt den Tisch. Fällt dabei trotzdem eine Kugel, zählt sie nicht: Beim 8-Ball bleibt sie in der Tasche (aus dem Spiel), beim 14/1 wird sie wieder aufgebaut. Ohne Ansage ist es ein normaler Stoß; gilt die versenkte Kugel, spielt der Spieler weiter. Der Stoß muss ein korrekter Stoß sein (zulässige Kugel zuerst, danach Bande oder Tasche). Beim 9-Ball wird nichts angesagt, beim 10-Ball gibt es keine Sicherheitsansage.":
    "In call games the player may call “safety” before the shot instead of ball and pocket. After the shot the inning is over and the opponent takes the table. If a ball falls anyway it does not count: in 8-ball it stays in the pocket (out of play), in 14.1 it is re-spotted. Without a call it is a normal shot; if the pocketed ball counts, the player continues. The shot must still be a legal shot (legal ball first, then cushion or pocket). In 9-ball nothing is called, in 10-ball there is no safety call.",
  "Sicherheit": "Safety",
  "Safe": "safe",
  "Sicherheitsstoß": "safety shot",
  "Safety": "safety",
  "Kugel fällt trotz Sicherheit": "ball falls despite safety",
  "Ansagespiel": "call game",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 5": "14.1 · call: 5",
  "Kugel bleibt unten, Aufnahme beendet": "Ball stays down, inning over",
  "Kugel zählt, Spieler spielt weiter": "Ball counts, player continues",
  "Kugel wird aufgebaut, Aufnahme beendet": "Ball is re-spotted, inning over",
  "1 Punkt, Spieler spielt weiter": "1 point, player continues",
  "Sicherheit angesagt: die versenkte Kugel bleibt in der Tasche, die Aufnahme ist beendet.": "Safety called: the pocketed ball stays in the pocket, the inning is over.",
  "Ohne Ansage zählt die korrekt versenkte Kugel: der Spieler spielt weiter.": "Without a call the legally pocketed ball counts: the player continues.",
  "Sicherheit angesagt: versenkte Kugeln werden wieder aufgebaut, die Aufnahme ist beendet.": "Safety called: pocketed balls are re-spotted, the inning is over.",
  "Ohne Ansage zählt die angesagte, korrekt versenkte Kugel einen Punkt: der Spieler spielt weiter.": "Without a call the called, legally pocketed ball counts one point: the player continues.",
  "Ausgangslage: Die 5 liegt vor der Ecktasche, der Spieler könnte sie versenken.": "Starting position: the 5 lies in front of the corner pocket, the player could pocket it.",
  "Der Spieler sagt „Sicherheit“ an und spielt die 5 an.": "The player calls “safety” and plays the 5.",
  "Die 5 fällt trotzdem. Wegen der Sicherheit bleibt sie in der Tasche, zählt aber nicht, und die Aufnahme ist beendet.": "The 5 falls anyway. Because of the safety it stays in the pocket but does not count, and the inning is over.",
  "Der Spieler sagt keine Sicherheit an und spielt die 5 an.": "The player does not call a safety and plays the 5.",
  "Die 5 fällt in die Tasche – korrekt versenkt, der Spieler spielt weiter.": "The 5 falls into the pocket – legally pocketed, the player continues.",
  "Die 5 fällt trotzdem in die Tasche, zählt wegen der Sicherheit aber keinen Punkt.": "The 5 falls into the pocket anyway, but because of the safety it scores no point.",
  "Die angesagte 5 fällt in die Tasche – ein Punkt, der Spieler spielt weiter.": "The called 5 falls into the pocket – one point, the player continues.",
  "Weil Sicherheit angesagt war, wird die 5 wieder aufgebaut (Fußpunkt), die Aufnahme ist beendet.": "Because a safety was called, the 5 is re-spotted (foot spot), the inning is over.",
};
