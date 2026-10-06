import { cue, ball, cut } from "../../ruleEngine.js";

/* Doppel (Stosswechsel-Regeln): Die Spieler stossen im Wechsel A1, B1, A2, B2, ... Spielt der falsche
   Spieler, ist das immer ein Foul - der Gegner ruft es als "Schiedsrichter" aus; faellt es nicht auf,
   ist der Stoss "ueberspielt" und kein Foul. Der Stoss selbst ist beide Male derselbe (richtige Kugel,
   Kugel faellt). Die ersten beiden Stoesse stehen nur im Zaehler, nur der dritte wird gespielt. */
const T = [150, 50], P = [207, 13], W = [91.2, 88.2];
const shot = cut(W, { id: "4", at: T }, P, { out: true });
const balls = () => [cue(...W), ball(4, ...T), ball(9, 110, 95)];
const TEAM = "Team A: A1 und A2 · Team B: B1 und B2";

const mk = (label, verdict, verdictLabel, reason, who, t3) => ({
  label, verdict, verdictLabel, reason, balls: balls(),
  steps: [
    { text: "Ausgangslage: Doppel. Die Spieler stoßen im Wechsel: A1, B1, A2, B2 und so weiter.", say: TEAM, focus: ["4"] },
    { text: "Stoß 1: A1 spielt, es fällt keine Kugel. Dann ist Team B dran.", shot: { n: 1, of: 3, who: "A1 (Team A)" } },
    { text: "Stoß 2: B1 spielt, es fällt keine Kugel. Jetzt wäre A2 dran.", shot: { n: 2, of: 3, who: "B1 (Team B)" } },
    { text: t3, shot: { n: 3, of: 3, who }, aim: [W, shot.contact], expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: verdict, after: "w", delay: 300 } },
  ],
});

const variants = [
  mk("Fall A", "foul", "Foul – falscher Spieler",
    "A1 stößt, obwohl A2 dran ist: ein falscher Spieler ist immer ein Foul, wenn der Gegner es bemerkt und ausruft.",
    "A1 (Team A)", "A1 stößt noch einmal und versenkt die 4 – aber A2 war dran. Der Gegner bemerkt es und ruft Foul."),
  mk("Fall B", "ok", "Kein Foul",
    "A2 ist an der Reihe und stößt: der Stoßwechsel stimmt.",
    "A2 (Team A)", "A2 stößt, versenkt die 4 – der Wechsel stimmt, kein Foul."),
];

export default {
  id: "doppel-reihenfolge",
  released: false,
  discs: ["8 Ball", "9 Ball", "10 Ball"],
  topic: "ablauf",
  ref: "DP",
  keywords: ["Doppel", "Stoßwechsel", "falscher Spieler", "Reihenfolge im Doppel", "überspielt"],
  title: "Doppel: Reihenfolge der Spieler",
  rule: "Im Doppel stoßen die Spieler im Wechsel (A1, B1, A2, B2 …). Spielt der falsche Spieler, ist das immer ein Foul; es wird vom Gegner als Schiedsrichter ausgerufen, sofern es auffällt – sonst gilt der Stoß als überspielt und es ist kein Foul. Das Ausspielen zählt nicht als Stoß im Sinne des Stoßwechsels, die Rückgabe eines Push Outs auch nicht. Das Team, das nicht anstößt, wählt, welcher Spieler den ersten Stoß im Spiel macht. Beim Anstoß wechseln die Teams und innerhalb eines Teams ab: jeder Spieler kommt alle vier Spiele zum Break. Kurze Absprachen im Team sind erlaubt; Zeichen mit Fingern oder Queue kurz vor oder während des Stoßes sind ein Foul.",
  sets: [
    { discs: ["9 Ball", "10 Ball"], tag: "Doppel · Niedrigste Kugel: 4", variants },
    { discs: ["8 Ball"], tag: "Doppel · Team A spielt Volle", variants },
  ],
};

export const en = {
  "Doppel: Reihenfolge der Spieler": "Doubles: order of the players",
  "Im Doppel stoßen die Spieler im Wechsel (A1, B1, A2, B2 …). Spielt der falsche Spieler, ist das immer ein Foul; es wird vom Gegner als Schiedsrichter ausgerufen, sofern es auffällt – sonst gilt der Stoß als überspielt und es ist kein Foul. Das Ausspielen zählt nicht als Stoß im Sinne des Stoßwechsels, die Rückgabe eines Push Outs auch nicht. Das Team, das nicht anstößt, wählt, welcher Spieler den ersten Stoß im Spiel macht. Beim Anstoß wechseln die Teams und innerhalb eines Teams ab: jeder Spieler kommt alle vier Spiele zum Break. Kurze Absprachen im Team sind erlaubt; Zeichen mit Fingern oder Queue kurz vor oder während des Stoßes sind ein Foul.": "In doubles the players shoot in turn (A1, B1, A2, B2 …). If the wrong player shoots it is always a foul; the opponent calls it as the referee if it is noticed – otherwise the shot is played over and it is no foul. The lag does not count as a shot for the shot order, neither does the return of a push out. The team that does not break chooses which player makes the first shot of the game. On the break the teams alternate, and within a team too: every player breaks every four games. Short consultations within the team are allowed; signals with fingers or cue shortly before or during the shot are a foul.",
  "Doppel": "Doubles",
  "Stoßwechsel": "shot rotation",
  "falscher Spieler": "wrong player",
  "Reihenfolge im Doppel": "order in doubles",
  "überspielt": "played over",
  "Doppel · Niedrigste Kugel: 4": "Doubles · Lowest ball: 4",
  "Doppel · Team A spielt Volle": "Doubles · Team A plays solids",
  "Team A: A1 und A2 · Team B: B1 und B2": "Team A: A1 and A2 · Team B: B1 and B2",
  "A1 (Team A)": "A1 (Team A)",
  "A2 (Team A)": "A2 (Team A)",
  "B1 (Team B)": "B1 (Team B)",
  "Foul – falscher Spieler": "Foul – wrong player",
  "A1 stößt, obwohl A2 dran ist: ein falscher Spieler ist immer ein Foul, wenn der Gegner es bemerkt und ausruft.": "A1 shoots although it is A2's turn: a wrong player is always a foul if the opponent notices and calls it.",
  "A2 ist an der Reihe und stößt: der Stoßwechsel stimmt.": "It is A2's turn and A2 shoots: the shot rotation is right.",
  "Ausgangslage: Doppel. Die Spieler stoßen im Wechsel: A1, B1, A2, B2 und so weiter.": "Starting position: doubles. The players shoot in turn: A1, B1, A2, B2 and so on.",
  "Stoß 1: A1 spielt, es fällt keine Kugel. Dann ist Team B dran.": "Shot 1: A1 plays, no ball falls. Then it is team B's turn.",
  "Stoß 2: B1 spielt, es fällt keine Kugel. Jetzt wäre A2 dran.": "Shot 2: B1 plays, no ball falls. Now it would be A2's turn.",
  "A1 stößt noch einmal und versenkt die 4 – aber A2 war dran. Der Gegner bemerkt es und ruft Foul.": "A1 shoots again and pockets the 4 – but it was A2's turn. The opponent notices and calls foul.",
  "A2 stößt, versenkt die 4 – der Wechsel stimmt, kein Foul.": "A2 shoots and pockets the 4 – the rotation is right, no foul.",
};
