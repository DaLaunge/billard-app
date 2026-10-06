import { cue } from "../../ruleEngine.js";
import { rack, brake, hitOf, R15, R9, R10, W } from "../racks.js";

/* Anstoss: je Disziplin das richtige Rack (8 Ball: 15er-Dreieck, 9 Ball: Raute,
   10 Ball: 10er-Dreieck) am Fusspunkt. Beide Varianten brechen gleich; nur eine
   Kugel mehr erreicht die Bande. Alle Kugeln laufen RADIAL vom Mittelpunkt des
   Racks weg - so kreuzen sich ihre Wege nie. Eine Kugel mit Bandenkontakt laeuft
   bis zur ersten Bande, die anderen hoechstens 30 Einheiten und bleiben mindestens
   6 Einheiten vor der Bande. Die erste Kugel der Spitze bleibt liegen. */
// Zur Sicherheit: genau so viele Kugeln enden an der Bande, wie die Variante behauptet.
const onWall = (m) => m.id !== "w" && (m.to[0] >= 204.4 || m.to[0] <= 15.6 || m.to[1] <= 15.6 || m.to[1] >= 104.4);
const withRails = (moves, want) => {
  const n = moves.filter(onWall).length;
  if (n !== want) throw new Error(`Anstoss: ${n} statt ${want} Kugeln an der Bande`);
  return moves;
};
const variants = (rows, railsA, railsB) => {
  const balls = rack(rows);
  const start = () => [cue(...W), ...balls.map((b) => ({ id: String(b.n), n: b.n, x: b.p[0], y: b.p[1] }))];
  return [
    {
      label: "Fall A", verdict: "foul",
      reason: "Keine Kugel versenkt, nur drei Kugeln erreichen die Bande.",
      balls: start(),
      steps: [
        { text: "Ausgangslage: Der Anstoß. Es wird keine Kugel versenkt." },
        { text: "Die Weiße bricht das Rack.", aim: [W, hitOf(rows)] },
        { text: "Nur drei Kugeln laufen an eine Bande – zu wenig.", moves: withRails(brake(rows, balls, railsA), 3), mark: { at: [176, 60], kind: "foul", after: "w", delay: 450 } },
      ],
    },
    {
      label: "Fall B", verdict: "ok",
      reason: "Vier Kugeln erreichen die Bande.",
      balls: start(),
      steps: [
        { text: "Ausgangslage: Der Anstoß. Es wird keine Kugel versenkt." },
        { text: "Die Weiße bricht das Rack.", aim: [W, hitOf(rows)] },
        { text: "Vier Kugeln laufen an eine Bande – regelgerecht.", moves: withRails(brake(rows, balls, railsB), 4), mark: { at: [176, 60], kind: "ok", after: "w", delay: 450 } },
      ],
    },
  ];
};

export default {
  id: "anstoss-vier-kugeln",
  released: false,
  discs: ["8 Ball", "9 Ball", "10 Ball"],
  topic: "anstoss",
  ref: "4.3, 5.3, 6.3",
  keywords: ["Break", "Anstoß", "vier Kugeln", "Bande", "Anstoß ungültig", "Rack"],
  title: "Anstoß: vier Kugeln an die Bande",
  rule: "Beim Anstoß muss entweder eine Kugel versenkt werden oder mindestens vier Objektkugeln müssen eine Bande anlaufen. Sonst ist der Anstoß nicht regelgerecht. Beim 8-Ball ist er dann unzulässig: der Gegner wählt, ob er die Lage übernimmt oder neu aufbauen lässt (und selbst anstößt oder den Anstoßenden erneut anstoßen lässt). Beim 9-Ball und 10-Ball gilt der Stoß als Foul.",
  sets: [
    { discs: ["8 Ball"], tag: "8-Ball-Dreieck", variants: variants(R15, [11, 6, 15], [11, 6, 15, 12]) },
    { discs: ["9 Ball"], tag: "9-Ball-Raute", variants: variants(R9, [4, 5, 8], [4, 5, 7, 8]) },
    { discs: ["10 Ball"], tag: "10-Ball-Dreieck", variants: variants(R10, [6, 9, 8], [6, 9, 8, 2]) },
  ],
};

export const en = {
  "Anstoß: vier Kugeln an die Bande": "Break: four balls to a cushion",
  "Beim Anstoß muss entweder eine Kugel versenkt werden oder mindestens vier Objektkugeln müssen eine Bande anlaufen. Sonst ist der Anstoß nicht regelgerecht. Beim 8-Ball ist er dann unzulässig: der Gegner wählt, ob er die Lage übernimmt oder neu aufbauen lässt (und selbst anstößt oder den Anstoßenden erneut anstoßen lässt). Beim 9-Ball und 10-Ball gilt der Stoß als Foul.":
    "On the break either a ball must be pocketed or at least four object balls must reach a cushion. Otherwise the break is not legal. In 8-ball it is then invalid: the opponent chooses whether to accept the position or have the balls re-racked (and break himself or let the breaker break again). In 9-ball and 10-ball the shot counts as a foul.",
  "Bande": "Cushion",
  "Break": "Break",
  "Anstoß": "Break",
  "vier Kugeln": "four balls",
  "Anstoß ungültig": "invalid break",
  "Rack": "Rack",
  "8-Ball-Dreieck": "8-ball triangle",
  "9-Ball-Raute": "9-ball diamond",
  "10-Ball-Dreieck": "10-ball triangle",
  "Keine Kugel versenkt, nur drei Kugeln erreichen die Bande.": "No ball pocketed, only three balls reach a cushion.",
  "Vier Kugeln erreichen die Bande.": "Four balls reach a cushion.",
  "Ausgangslage: Der Anstoß. Es wird keine Kugel versenkt.": "Starting position: the break. No ball is pocketed.",
  "Die Weiße bricht das Rack.": "The cue ball breaks the rack.",
  "Nur drei Kugeln laufen an eine Bande – zu wenig.": "Only three balls reach a cushion – too few.",
  "Vier Kugeln laufen an eine Bande – regelgerecht.": "Four balls reach a cushion – legal.",
};
