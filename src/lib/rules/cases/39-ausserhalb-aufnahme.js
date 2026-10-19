import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, D141 } from "../meta.js";

/* Regel 3.12: Stoesst ein Spieler ausserhalb seiner Aufnahme, ist das ein Standardfoul (unabsichtlich);
   normalerweise wird so weitergespielt, wie die Kugeln liegen geblieben sind. Absichtlich ist es
   unsportliches Verhalten (3.16). Der Stoss selbst ist beide Male derselbe, nur wer ihn macht, ist
   verschieden: Fall A stoesst Bernd, obwohl Anton (der gerade eine Kugel versenkt hat) noch am Tisch
   ist; Fall B hat Anton nichts versenkt, die Aufnahme ist beendet, Bernd ist dran. */
const T = [150, 50], P = [207, 13], W = [91.2, 88.2];

const build = (oid, other) => {
  const shot = cut(W, { id: oid, at: T }, P, { out: true });
  const balls = () => [cue(...W), ball(Number(oid), ...T), ball(other, 110, 95)];
  const mk = (label, verdict, verdictLabel, reason, t1, t2) => ({
    label, verdict, verdictLabel, reason, balls: balls(),
    steps: [
      { text: t1, focus: [oid] },
      { text: t2, shot: { n: 1, of: 1, who: "Bernd" }, aim: [W, shot.contact], expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: verdict, after: "w", delay: 300 } },
    ],
  });
  return [
    mk("Fall A", "foul", "Standardfoul – Stoß außerhalb der Aufnahme",
      "Anton hat gerade eine Kugel versenkt und ist weiter an der Reihe. Stößt Bernd trotzdem, ist das ein Foul; unabsichtlich ein Standardfoul, absichtlich unsportliches Verhalten.",
      "Ausgangslage: Anton hat soeben eine Kugel versenkt und bleibt am Tisch, seine Aufnahme läuft noch.",
      "Bernd steht auf und stößt, während Anton noch dran ist – ein Stoß außerhalb der eigenen Aufnahme, Foul."),
    mk("Fall B", "ok", "Kein Foul",
      "Anton hat nichts versenkt, seine Aufnahme ist beendet: Bernd ist dran und stößt regelgerecht.",
      "Ausgangslage: Anton hat nichts versenkt, seine Aufnahme ist zu Ende. Bernd ist an der Reihe.",
      "Bernd stößt in seiner eigenen Aufnahme – kein Foul."),
  ];
};

export default {
  id: "ausserhalb-aufnahme",
  released: true,
  discs: ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "ablauf",
  tags: ["foul", "ablauf"],
  ref: "3.12, 3.16",
  keywords: ["Stoß außer der Reihe", "außerhalb der Aufnahme"],
  title: "Stoß außerhalb der Aufnahme",
  rule: "Es ist ein Standardfoul, unabsichtlich außerhalb der eigenen Aufnahme zu stoßen. Normalerweise wird dann so weitergespielt, wie die Kugeln liegen geblieben sind. Spielt der Spieler absichtlich außerhalb seiner Aufnahme, wird das als unsportliches Verhalten (3.16) gewertet. Die Strafe des Standardfouls hängt von der Disziplin ab: Ball in Hand für den Gegner beim 8-, 9- und 10-Ball, ein Punkt Abzug beim 14/1.",
  sets: [
    { discs: D89, tag: "Niedrigste Kugel: 5", variants: build("5", 9) },
    { discs: D8, tag: "Anton spielt Halbe · Bernd spielt Volle", variants: build("5", 13) },
    { discs: D141, tag: "14/1 · Ansage: 5", variants: build("5", 9) },
  ],
};

export const en = {
  "Stoß außer der Reihe": "shot out of turn",
  "Stoß außerhalb der Aufnahme": "Shot outside your own inning",
  "außerhalb der Aufnahme": "outside the inning",
  "Es ist ein Standardfoul, unabsichtlich außerhalb der eigenen Aufnahme zu stoßen. Normalerweise wird dann so weitergespielt, wie die Kugeln liegen geblieben sind. Spielt der Spieler absichtlich außerhalb seiner Aufnahme, wird das als unsportliches Verhalten (3.16) gewertet. Die Strafe des Standardfouls hängt von der Disziplin ab: Ball in Hand für den Gegner beim 8-, 9- und 10-Ball, ein Punkt Abzug beim 14/1.": "Shooting outside your own inning unintentionally is a standard foul. Normally play then continues with the balls where they came to rest. If the player shoots outside his inning intentionally this counts as unsportsmanlike conduct (3.16). The penalty of the standard foul depends on the discipline: ball in hand for the opponent in 8-, 9- and 10-ball, one point deducted in 14.1.",
  "Niedrigste Kugel: 5": "Lowest ball: 5",
  "Anton spielt Halbe · Bernd spielt Volle": "Andrew plays stripes · Ben plays solids",
  "14/1 · Ansage: 5": "14.1 · call: 5",
  "Bernd": "Ben",
  "Standardfoul – Stoß außerhalb der Aufnahme": "Standard foul – shot outside the inning",
  "Anton hat gerade eine Kugel versenkt und ist weiter an der Reihe. Stößt Bernd trotzdem, ist das ein Foul; unabsichtlich ein Standardfoul, absichtlich unsportliches Verhalten.": "Andrew has just pocketed a ball and is still at the table. If Ben shoots anyway it is a foul; unintentional a standard foul, intentional unsportsmanlike conduct.",
  "Anton hat nichts versenkt, seine Aufnahme ist beendet: Bernd ist dran und stößt regelgerecht.": "Andrew pocketed nothing, his inning is over: Ben is up and shoots legally.",
  "Ausgangslage: Anton hat soeben eine Kugel versenkt und bleibt am Tisch, seine Aufnahme läuft noch.": "Starting position: Andrew has just pocketed a ball and stays at the table, his inning is still running.",
  "Bernd steht auf und stößt, während Anton noch dran ist – ein Stoß außerhalb der eigenen Aufnahme, Foul.": "Ben gets up and shoots while Andrew is still up – a shot outside his own inning, foul.",
  "Ausgangslage: Anton hat nichts versenkt, seine Aufnahme ist zu Ende. Bernd ist an der Reihe.": "Starting position: Andrew pocketed nothing, his inning is over. Ben is up.",
  "Bernd stößt in seiner eigenen Aufnahme – kein Foul.": "Ben shoots in his own inning – no foul.",
};
