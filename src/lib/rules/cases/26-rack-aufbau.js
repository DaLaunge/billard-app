import { D8, D141 } from "../meta.js";
import { rack, R15, R9, R10 } from "../racks.js";

/* Das Rack korrekt aufbauen - je Disziplin die Regel, dazu ein typischer Fehler.
   Fall A: falsch aufgebaut (eine Schluesselkugel liegt am falschen Platz bzw. das Rack
   ist verrutscht). Fall B: richtig. Es gibt keinen Stoss, gezeigt wird der Aufbau. */
const hidden = (rows, shift = 0) => rack(rows, shift).map((b) => ({ id: String(b.n), n: b.n, x: b.p[0], y: b.p[1], hidden: true }));
const place = (rows, shift = 0) => rack(rows, shift).map((b, i) => ({ id: String(b.n), to: b.p, place: true, delay: i * 30 }));
const posOf = (rows, n, shift = 0) => rack(rows, shift).find((b) => b.n === n).p;

// 8 Ball: vorn 1, die 8 in der Mitte (3. Reihe), in den hinteren Ecken eine Volle und eine Halbe.
const R8_WRONG = [[1], [9, 2], [3, 4, 10], [11, 8, 5, 12], [6, 13, 7, 14, 15]]; // 8 und 4 vertauscht
// 9 Ball: die 9 liegt in der Mitte der Raute (auf dem Fusspunkt).
const R9_WRONG = [[1], [2, 3], [4, 5, 9], [6, 7], [8]];
// 10 Ball: die 10 liegt in der Mitte des Dreiecks.
const R10_WRONG = [[1], [2, 3], [4, 5, 10], [6, 7, 8, 9]];
// 14/1: zufaellige Reihenfolge, die vorderste Kugel auf dem Fusspunkt.
const R141 = [[8], [3, 12], [1, 5, 9], [14, 2, 6, 11], [4, 13, 7, 10, 15]];

const variants = (rows, wrongRows, keyBall, texts, shift = 0, triangle = false) => {
  const table = { headLine: true, triangle };
  const start = { text: texts.start };
  return [
    {
      label: "Fall A", verdict: "foul", verdictLabel: "Falsch aufgebaut",
      reason: texts.reasonWrong,
      table,
      balls: hidden(wrongRows, shift ? -14 : 0),
      steps: [start, { text: texts.wrong, moves: place(wrongRows, shift ? -14 : 0), mark: { at: posOf(wrongRows, keyBall, shift ? -14 : 0), kind: "foul", delay: 900 } }],
    },
    {
      label: "Fall B", verdict: "ok", verdictLabel: "Richtig aufgebaut",
      reason: texts.reasonRight,
      table,
      balls: hidden(rows),
      steps: [start, { text: texts.right, moves: place(rows), mark: { at: posOf(rows, keyBall), kind: "ok", delay: 900 } }],
    },
  ];
};

const eight = variants(R15, R8_WRONG, 8, {
  start: "Ausgangslage: Der Tisch ist leer. Das Dreieck wird am Fußpunkt angelegt.",
  wrong: "Die 8 liegt nicht in der Mitte des Dreiecks – falsch aufgebaut.",
  right: "15 Kugeln eng im Dreieck: die Spitze auf dem Fußpunkt, die 8 in der Mitte, hinten links und rechts je eine Volle und eine Halbe.",
  reasonWrong: "Die 8 muss in der Mitte des Dreiecks liegen.",
  reasonRight: "Spitze auf dem Fußpunkt, 8 in der Mitte, in den hinteren Ecken eine Volle und eine Halbe.",
}, 0, true);
const nine = variants(R9, R9_WRONG, 9, {
  start: "Ausgangslage: Der Tisch ist leer. Die Raute wird so angelegt, dass die 9 auf dem Fußpunkt liegt.",
  wrong: "Die 9 liegt nicht in der Mitte der Raute – falsch aufgebaut.",
  right: "Die Raute liegt eng: die 1 an der Spitze, die 9 in der Mitte auf dem Fußpunkt, alle anderen Kugeln zufällig.",
  reasonWrong: "Die 9 muss in der Mitte der Raute liegen.",
  reasonRight: "1 an der Spitze, 9 in der Mitte auf dem Fußpunkt, der Rest zufällig.",
});
const ten = variants(R10, R10_WRONG, 10, {
  start: "Ausgangslage: Der Tisch ist leer. Das Dreieck wird am Fußpunkt angelegt.",
  wrong: "Die 10 liegt nicht in der Mitte des Dreiecks – falsch aufgebaut.",
  right: "Das Dreieck liegt eng: die 1 an der Spitze auf dem Fußpunkt, die 10 in der Mitte, alle anderen Kugeln zufällig.",
  reasonWrong: "Die 10 muss in der Mitte des Dreiecks liegen.",
  reasonRight: "1 an der Spitze auf dem Fußpunkt, 10 in der Mitte, der Rest zufällig.",
});
const straight = variants(R141, R141, 8, {
  start: "Ausgangslage: Der Tisch ist leer. Die 15 Kugeln werden in zufälliger Reihenfolge von Hand angelegt, ohne Aufbauhilfe.",
  wrong: "Die vorderste Kugel liegt nicht auf dem Fußpunkt: das Dreieck sitzt zu weit vorn – falsch aufgebaut.",
  right: "15 Kugeln in zufälliger Reihenfolge eng im Dreieck, die vorderste Kugel genau auf dem Fußpunkt.",
  reasonWrong: "Die vorderste Kugel muss genau auf dem Fußpunkt liegen.",
  reasonRight: "Zufällige Reihenfolge, eng, die vorderste Kugel auf dem Fußpunkt, keine Aufbauhilfe.",
}, -14, true);

export default {
  id: "rack-aufbau",
  released: true,
  discs: ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "anstoss",
  ref: "4.2, 5.2, 6.2, 7.2, 1.5",
  keywords: ["Rack", "Aufbau", "Dreieck", "Raute", "Aufbauhilfe", "Template", "Kugeln aufbauen", "Fußpunkt", "klopfen", "press", "zufällig", "Dreieck anlegen"],
  title: "Rack korrekt aufbauen",
  rule: "Die Kugeln werden so eng wie möglich zusammengelegt, am besten press; man klopft sie nicht mehr als nötig und kann das Tuch kurz glätten. Es gilt immer: zufällige Reihenfolge, kein absichtliches Muster. 8-Ball: 15 Kugeln im Dreieck, die vorderste Kugel auf dem Fußpunkt, die 8 in der Mitte (erste Kugel hinter der vordersten Kugel in gerader Linie), in den beiden hinteren Ecken je eine Volle und eine Halbe; nach der Lehrunterlage nicht mehr als vier Kugeln derselben Gruppe in einer Linie. 9-Ball: Raute, die 1 an der vorderen Spitze, die 9 in der Mitte – die 9 liegt auf dem Fußpunkt. 10-Ball: Dreieck, die 1 an der Spitze auf dem Fußpunkt, die 10 in der Mitte. 14/1: 15 Kugeln im Dreieck, die vorderste Kugel auf dem Fußpunkt, ohne Aufbauhilfe; das auf den Tisch gezeichnete Dreieck entscheidet, ob eine Kugel im Dreieck liegt. Die Aufbauhilfe (dünne Folie, höchstens 0,14 mm) darf bei 8-, 9- und 10-Ball verwendet werden, beim 14/1 nicht; sie wird nach dem Anstoß vom Schiedsrichter entfernt. Baut der Schiedsrichter auf, darf der Spieler dabei nicht zusehen; danach darf er das Rack prüfen und einmal eine Korrektur verlangen. Vermutet der Spieler absichtliche Muster, informiert er den Schiedsrichter: erst Verwarnung, dann Strafe wegen unsportlichen Verhaltens.",
  sets: [
    { discs: D8, tag: "8-Ball-Dreieck", variants: eight },
    { discs: ["9 Ball"], tag: "9-Ball-Raute", variants: nine },
    { discs: ["10 Ball"], tag: "10-Ball-Dreieck", variants: ten },
    { discs: D141, tag: "14/1-Dreieck", variants: straight },
  ],
};

export const en = {
  "Rack korrekt aufbauen": "Racking correctly",
  "Die Kugeln werden so eng wie möglich zusammengelegt, am besten press; man klopft sie nicht mehr als nötig und kann das Tuch kurz glätten. Es gilt immer: zufällige Reihenfolge, kein absichtliches Muster. 8-Ball: 15 Kugeln im Dreieck, die vorderste Kugel auf dem Fußpunkt, die 8 in der Mitte (erste Kugel hinter der vordersten Kugel in gerader Linie), in den beiden hinteren Ecken je eine Volle und eine Halbe; nach der Lehrunterlage nicht mehr als vier Kugeln derselben Gruppe in einer Linie. 9-Ball: Raute, die 1 an der vorderen Spitze, die 9 in der Mitte – die 9 liegt auf dem Fußpunkt. 10-Ball: Dreieck, die 1 an der Spitze auf dem Fußpunkt, die 10 in der Mitte. 14/1: 15 Kugeln im Dreieck, die vorderste Kugel auf dem Fußpunkt, ohne Aufbauhilfe; das auf den Tisch gezeichnete Dreieck entscheidet, ob eine Kugel im Dreieck liegt. Die Aufbauhilfe (dünne Folie, höchstens 0,14 mm) darf bei 8-, 9- und 10-Ball verwendet werden, beim 14/1 nicht; sie wird nach dem Anstoß vom Schiedsrichter entfernt. Baut der Schiedsrichter auf, darf der Spieler dabei nicht zusehen; danach darf er das Rack prüfen und einmal eine Korrektur verlangen. Vermutet der Spieler absichtliche Muster, informiert er den Schiedsrichter: erst Verwarnung, dann Strafe wegen unsportlichen Verhaltens.":
    "The balls are put together as tightly as possible, ideally frozen; they are not tapped more than necessary and the cloth may be briefly smoothed. Always: random order, no deliberate pattern. 8-ball: 15 balls in a triangle, the front ball on the foot spot, the 8 in the middle (the first ball behind the front ball in a straight line), one solid and one stripe in the two back corners; according to the training material no more than four balls of the same group in a line. 9-ball: diamond, the 1 at the front tip, the 9 in the middle – the 9 sits on the foot spot. 10-ball: triangle, the 1 at the tip on the foot spot, the 10 in the middle. 14.1: 15 balls in a triangle, the front ball on the foot spot, without a template; the triangle drawn on the table decides whether a ball is in the triangle. The template (thin foil, at most 0.14 mm) may be used in 8-, 9- and 10-ball, not in 14.1; the referee removes it after the break. If the referee racks, the player must not watch; afterwards he may check the rack and ask for one correction. If the player suspects deliberate patterns he informs the referee: first a warning, then a penalty for unsportsmanlike conduct.",
  "Rack": "Rack",
  "Aufbau": "setup",
  "Dreieck": "triangle",
  "Raute": "diamond",
  "Aufbauhilfe": "template",
  "Template": "template",
  "Kugeln aufbauen": "racking the balls",
  "Fußpunkt": "foot spot",
  "klopfen": "tapping",
  "press": "frozen",
  "zufällig": "random",
  "Dreieck anlegen": "placing the triangle",
  "8-Ball-Dreieck": "8-ball triangle",
  "9-Ball-Raute": "9-ball diamond",
  "10-Ball-Dreieck": "10-ball triangle",
  "14/1-Dreieck": "14.1 triangle",
  "Falsch aufgebaut": "Racked wrongly",
  "Richtig aufgebaut": "Racked correctly",
  "Die 8 muss in der Mitte des Dreiecks liegen.": "The 8 must lie in the middle of the triangle.",
  "Spitze auf dem Fußpunkt, 8 in der Mitte, in den hinteren Ecken eine Volle und eine Halbe.": "Tip on the foot spot, 8 in the middle, one solid and one stripe in the back corners.",
  "Ausgangslage: Der Tisch ist leer. Das Dreieck wird am Fußpunkt angelegt.": "Starting position: the table is empty. The triangle is placed at the foot spot.",
  "Die 8 liegt nicht in der Mitte des Dreiecks – falsch aufgebaut.": "The 8 does not lie in the middle of the triangle – racked wrongly.",
  "15 Kugeln eng im Dreieck: die Spitze auf dem Fußpunkt, die 8 in der Mitte, hinten links und rechts je eine Volle und eine Halbe.": "15 balls tightly in the triangle: the tip on the foot spot, the 8 in the middle, one solid and one stripe at the back left and right.",
  "Die 9 muss in der Mitte der Raute liegen.": "The 9 must lie in the middle of the diamond.",
  "1 an der Spitze, 9 in der Mitte auf dem Fußpunkt, der Rest zufällig.": "1 at the tip, 9 in the middle on the foot spot, the rest random.",
  "Ausgangslage: Der Tisch ist leer. Die Raute wird so angelegt, dass die 9 auf dem Fußpunkt liegt.": "Starting position: the table is empty. The diamond is placed so that the 9 lies on the foot spot.",
  "Die 9 liegt nicht in der Mitte der Raute – falsch aufgebaut.": "The 9 does not lie in the middle of the diamond – racked wrongly.",
  "Die Raute liegt eng: die 1 an der Spitze, die 9 in der Mitte auf dem Fußpunkt, alle anderen Kugeln zufällig.": "The diamond is tight: the 1 at the tip, the 9 in the middle on the foot spot, all other balls random.",
  "Die 10 muss in der Mitte des Dreiecks liegen.": "The 10 must lie in the middle of the triangle.",
  "1 an der Spitze auf dem Fußpunkt, 10 in der Mitte, der Rest zufällig.": "1 at the tip on the foot spot, 10 in the middle, the rest random.",
  "Die 10 liegt nicht in der Mitte des Dreiecks – falsch aufgebaut.": "The 10 does not lie in the middle of the triangle – racked wrongly.",
  "Das Dreieck liegt eng: die 1 an der Spitze auf dem Fußpunkt, die 10 in der Mitte, alle anderen Kugeln zufällig.": "The triangle is tight: the 1 at the tip on the foot spot, the 10 in the middle, all other balls random.",
  "Die vorderste Kugel muss genau auf dem Fußpunkt liegen.": "The front ball must lie exactly on the foot spot.",
  "Zufällige Reihenfolge, eng, die vorderste Kugel auf dem Fußpunkt, keine Aufbauhilfe.": "Random order, tight, the front ball on the foot spot, no template.",
  "Ausgangslage: Der Tisch ist leer. Die 15 Kugeln werden in zufälliger Reihenfolge von Hand angelegt, ohne Aufbauhilfe.": "Starting position: the table is empty. The 15 balls are placed by hand in random order, without a template.",
  "Die vorderste Kugel liegt nicht auf dem Fußpunkt: das Dreieck sitzt zu weit vorn – falsch aufgebaut.": "The front ball is not on the foot spot: the triangle sits too far forward – racked wrongly.",
  "15 Kugeln in zufälliger Reihenfolge eng im Dreieck, die vorderste Kugel genau auf dem Fußpunkt.": "15 balls in random order tightly in the triangle, the front ball exactly on the foot spot.",
};
