import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, D141 } from "../meta.js";

/* Regel 3.12: Stoesst ein Spieler ausserhalb seiner Aufnahme, ist das ein Standardfoul (unabsichtlich);
   normalerweise wird so weitergespielt, wie die Kugeln liegen geblieben sind. Absichtlich ist es
   unsportliches Verhalten (3.16). Der Stoss selbst ist beide Male derselbe, nur wer ihn macht, ist
   verschieden: Fall A stoesst Spieler B, obwohl A (der gerade eine Kugel versenkt hat) noch am Tisch
   ist; Fall B hat A nichts versenkt, die Aufnahme ist beendet, B ist dran. */
const T = [150, 50], P = [207, 13], W = [91.2, 88.2];

const build = (oid, other) => {
  const shot = cut(W, { id: oid, at: T }, P, { out: true });
  const balls = () => [cue(...W), ball(Number(oid), ...T), ball(other, 110, 95)];
  const mk = (label, verdict, verdictLabel, reason, t1, t2) => ({
    label, verdict, verdictLabel, reason, balls: balls(),
    steps: [
      { text: t1, focus: [oid] },
      { text: t2, shot: { n: 1, of: 1, who: "Spieler B" }, aim: [W, shot.contact], expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: verdict, after: "w", delay: 300 } },
    ],
  });
  return [
    mk("Fall A", "foul", "Standardfoul – Stoß außerhalb der Aufnahme",
      "Spieler A hat gerade eine Kugel versenkt und ist weiter an der Reihe. Stößt B trotzdem, ist das ein Foul; unabsichtlich ein Standardfoul, absichtlich unsportliches Verhalten.",
      "Ausgangslage: Spieler A hat soeben eine Kugel versenkt und bleibt am Tisch, seine Aufnahme läuft noch.",
      "Spieler B steht auf und stößt, während A noch dran ist – ein Stoß außerhalb der eigenen Aufnahme, Foul."),
    mk("Fall B", "ok", "Kein Foul",
      "Spieler A hat nichts versenkt, seine Aufnahme ist beendet: B ist dran und stößt regelgerecht.",
      "Ausgangslage: Spieler A hat nichts versenkt, seine Aufnahme ist zu Ende. Spieler B ist an der Reihe.",
      "Spieler B stößt in seiner eigenen Aufnahme – kein Foul."),
  ];
};

export default {
  id: "ausserhalb-aufnahme",
  released: true,
  discs: ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "ablauf",
  ref: "3.12, 3.16",
  keywords: ["außerhalb der Aufnahme"],
  title: "Stoß außerhalb der Aufnahme",
  rule: "Es ist ein Standardfoul, unabsichtlich außerhalb der eigenen Aufnahme zu stoßen. Normalerweise wird dann so weitergespielt, wie die Kugeln liegen geblieben sind. Spielt der Spieler absichtlich außerhalb seiner Aufnahme, wird das als unsportliches Verhalten (3.16) gewertet. Die Strafe des Standardfouls hängt von der Disziplin ab: Ball in Hand für den Gegner beim 8-, 9- und 10-Ball, ein Punkt Abzug beim 14/1.",
  sets: [
    { discs: D89, tag: "Niedrigste Kugel: 5", variants: build("5", 9) },
    { discs: D8, tag: "A spielt Halbe · B spielt Volle", variants: build("5", 13) },
    { discs: D141, tag: "14/1 · Ansage: 5", variants: build("5", 9) },
  ],
};

export const en = {
  "Stoß außerhalb der Aufnahme": "Shot outside your own inning",
  "außerhalb der Aufnahme": "outside the inning",
  "Es ist ein Standardfoul, unabsichtlich außerhalb der eigenen Aufnahme zu stoßen. Normalerweise wird dann so weitergespielt, wie die Kugeln liegen geblieben sind. Spielt der Spieler absichtlich außerhalb seiner Aufnahme, wird das als unsportliches Verhalten (3.16) gewertet. Die Strafe des Standardfouls hängt von der Disziplin ab: Ball in Hand für den Gegner beim 8-, 9- und 10-Ball, ein Punkt Abzug beim 14/1.": "Shooting outside your own inning unintentionally is a standard foul. Normally play then continues with the balls where they came to rest. If the player shoots outside his inning intentionally this counts as unsportsmanlike conduct (3.16). The penalty of the standard foul depends on the discipline: ball in hand for the opponent in 8-, 9- and 10-ball, one point deducted in 14.1.",
  "Niedrigste Kugel: 5": "Lowest ball: 5",
  "A spielt Halbe · B spielt Volle": "A plays stripes · B plays solids",
  "14/1 · Ansage: 5": "14.1 · call: 5",
  "Spieler B": "Player B",
  "Standardfoul – Stoß außerhalb der Aufnahme": "Standard foul – shot outside the inning",
  "Spieler A hat gerade eine Kugel versenkt und ist weiter an der Reihe. Stößt B trotzdem, ist das ein Foul; unabsichtlich ein Standardfoul, absichtlich unsportliches Verhalten.": "Player A has just pocketed a ball and is still at the table. If B shoots anyway it is a foul; unintentional a standard foul, intentional unsportsmanlike conduct.",
  "Spieler A hat nichts versenkt, seine Aufnahme ist beendet: B ist dran und stößt regelgerecht.": "Player A pocketed nothing, his inning is over: B is up and shoots legally.",
  "Ausgangslage: Spieler A hat soeben eine Kugel versenkt und bleibt am Tisch, seine Aufnahme läuft noch.": "Starting position: player A has just pocketed a ball and stays at the table, his inning is still running.",
  "Spieler B steht auf und stößt, während A noch dran ist – ein Stoß außerhalb der eigenen Aufnahme, Foul.": "Player B gets up and shoots while A is still up – a shot outside his own inning, foul.",
  "Ausgangslage: Spieler A hat nichts versenkt, seine Aufnahme ist zu Ende. Spieler B ist an der Reihe.": "Starting position: player A pocketed nothing, his inning is over. Player B is up.",
  "Spieler B stößt in seiner eigenen Aufnahme – kein Foul.": "Player B shoots in his own inning – no foul.",
};
