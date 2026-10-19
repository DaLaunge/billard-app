import { cue, ball, cut } from "../../ruleEngine.js";

/* Doppel (Stosswechsel-Regeln): Die Spieler stossen im Wechsel Anton, Bernd, Andrea, Berta, ... Spielt der falsche
   Spieler, ist das immer ein Foul - der Gegner ruft es als "Schiedsrichter" aus; faellt es nicht auf,
   ist der Stoss "ueberspielt" und kein Foul. Der Stoss selbst ist beide Male derselbe (richtige Kugel,
   Kugel faellt). Die ersten beiden Stoesse stehen nur im Zaehler, nur der dritte wird gespielt. */
const T = [150, 50], P = [207, 13], W = [91.2, 88.2];
const shot = cut(W, { id: "4", at: T }, P, { out: true });
const balls = () => [cue(...W), ball(4, ...T), ball(9, 110, 95)];
const TEAM = "Team A: Anton und Andrea · Team B: Bernd und Berta";

const mk = (label, verdict, verdictLabel, reason, who, t3) => ({
  label, verdict, verdictLabel, reason, balls: balls(),
  steps: [
    { text: "Ausgangslage: Doppel. Die Spieler stoßen im Wechsel: Anton, Bernd, Andrea, Berta und so weiter.", say: TEAM, focus: ["4"] },
    { text: "Stoß 1: Anton spielt, es fällt keine Kugel. Dann ist Team B dran.", shot: { n: 1, of: 3, who: "Anton (Team A)" } },
    { text: "Stoß 2: Bernd spielt, es fällt keine Kugel. Jetzt wäre Andrea dran.", shot: { n: 2, of: 3, who: "Bernd (Team B)" } },
    { text: t3, shot: { n: 3, of: 3, who }, aim: [W, shot.contact], expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: verdict, after: "w", delay: 300 } },
  ],
});

const variants = [
  mk("Fall A", "foul", "Foul – falscher Spieler",
    "Anton stößt, obwohl Andrea dran ist: ein falscher Spieler ist immer ein Foul, wenn der Gegner es bemerkt und ausruft.",
    "Anton (Team A)", "Anton stößt noch einmal und versenkt die 4 – aber Andrea war dran. Der Gegner bemerkt es und ruft Foul."),
  mk("Fall B", "ok", "Kein Foul",
    "Andrea ist an der Reihe und stößt: der Stoßwechsel stimmt.",
    "Andrea (Team A)", "Andrea stößt, versenkt die 4 – der Wechsel stimmt, kein Foul."),
];

export default {
  id: "doppel-reihenfolge",
  released: true,
  discs: ["8 Ball", "9 Ball", "10 Ball"],
  topic: "ablauf",
  tags: ["doppel", "foul", "ablauf"],
  ref: "DP",
  bookRef: "99",
  keywords: ["Doppel", "Stoßwechsel", "falscher Spieler", "Reihenfolge im Doppel", "überspielt"],
  title: "Doppel: Reihenfolge der Spieler",
  rule: "Im Doppel stoßen die Spieler im Wechsel (Anton, Bernd, Andrea, Berta …). Spielt der falsche Spieler, ist das immer ein Foul; es wird vom Gegner als Schiedsrichter ausgerufen, sofern es auffällt – sonst gilt der Stoß als überspielt und es ist kein Foul. Das Ausspielen zählt nicht als Stoß im Sinne des Stoßwechsels, die Rückgabe eines Push Outs auch nicht. Das Team, das nicht anstößt, wählt, welcher Spieler den ersten Stoß im Spiel macht. Beim Anstoß wechseln die Teams und innerhalb eines Teams ab: jeder Spieler kommt alle vier Spiele zum Break. Kurze Absprachen im Team sind erlaubt; Zeichen mit Fingern oder Queue kurz vor oder während des Stoßes sind ein Foul.",
  sets: [
    { discs: ["9 Ball", "10 Ball"], tag: "Doppel · Niedrigste Kugel: 4", variants },
    { discs: ["8 Ball"], tag: "Doppel · Team A spielt Volle", variants },
  ],
};

export const en = {
  "Doppel: Reihenfolge der Spieler": "Doubles: order of the players",
  "Im Doppel stoßen die Spieler im Wechsel (Anton, Bernd, Andrea, Berta …). Spielt der falsche Spieler, ist das immer ein Foul; es wird vom Gegner als Schiedsrichter ausgerufen, sofern es auffällt – sonst gilt der Stoß als überspielt und es ist kein Foul. Das Ausspielen zählt nicht als Stoß im Sinne des Stoßwechsels, die Rückgabe eines Push Outs auch nicht. Das Team, das nicht anstößt, wählt, welcher Spieler den ersten Stoß im Spiel macht. Beim Anstoß wechseln die Teams und innerhalb eines Teams ab: jeder Spieler kommt alle vier Spiele zum Break. Kurze Absprachen im Team sind erlaubt; Zeichen mit Fingern oder Queue kurz vor oder während des Stoßes sind ein Foul.": "In doubles the players shoot in turn (Andrew, Ben, Amy, Beth …). If the wrong player shoots it is always a foul; the opponent calls it as the referee if it is noticed – otherwise the shot is played over and it is no foul. The lag does not count as a shot for the shot order, neither does the return of a push out. The team that does not break chooses which player makes the first shot of the game. On the break the teams alternate, and within a team too: every player breaks every four games. Short consultations within the team are allowed; signals with fingers or cue shortly before or during the shot are a foul.",
  "Doppel": "Doubles",
  "Stoßwechsel": "shot rotation",
  "falscher Spieler": "wrong player",
  "Reihenfolge im Doppel": "order in doubles",
  "überspielt": "played over",
  "Doppel · Niedrigste Kugel: 4": "Doubles · Lowest ball: 4",
  "Doppel · Team A spielt Volle": "Doubles · Team A plays solids",
  "Team A: Anton und Andrea · Team B: Bernd und Berta": "Team A: Andrew and Amy · Team B: Ben and Beth",
  "Anton (Team A)": "Andrew (Team A)",
  "Andrea (Team A)": "Amy (Team A)",
  "Bernd (Team B)": "Ben (Team B)",
  "Foul – falscher Spieler": "Foul – wrong player",
  "Anton stößt, obwohl Andrea dran ist: ein falscher Spieler ist immer ein Foul, wenn der Gegner es bemerkt und ausruft.": "Andrew shoots although it is Amy's turn: a wrong player is always a foul if the opponent notices and calls it.",
  "Andrea ist an der Reihe und stößt: der Stoßwechsel stimmt.": "It is Amy's turn and Amy shoots: the shot rotation is right.",
  "Ausgangslage: Doppel. Die Spieler stoßen im Wechsel: Anton, Bernd, Andrea, Berta und so weiter.": "Starting position: doubles. The players shoot in turn: Andrew, Ben, Amy, Beth and so on.",
  "Stoß 1: Anton spielt, es fällt keine Kugel. Dann ist Team B dran.": "Shot 1: Andrew plays, no ball falls. Then it is team B's turn.",
  "Stoß 2: Bernd spielt, es fällt keine Kugel. Jetzt wäre Andrea dran.": "Shot 2: Ben plays, no ball falls. Now it would be Amy's turn.",
  "Anton stößt noch einmal und versenkt die 4 – aber Andrea war dran. Der Gegner bemerkt es und ruft Foul.": "Andrew shoots again and pockets the 4 – but it was Amy's turn. The opponent notices and calls foul.",
  "Andrea stößt, versenkt die 4 – der Wechsel stimmt, kein Foul.": "Amy shoots and pockets the 4 – the rotation is right, no foul.",
};
