import { cue, ball, clampTable } from "../../ruleEngine.js";

/* 9-Ball-Raute am Fusspunkt (160, 60). Beide Varianten brechen gleich; nur eine
   Kugel mehr erreicht die Bande. Ziele sind Mittelpunkte: x/y am Rand
   (15.5 / 204.5, 15.5 / 104.5) = Bandenberuehrung. Alle Kugeln laufen vom Rack
   weg, damit sich die Wege nicht kreuzen. */
const X0 = 160, DX = 9.53, DY = 5.5;
const RACK = {
  1: [X0, 60],
  2: [X0 + DX, 60 - DY], 3: [X0 + DX, 60 + DY],
  4: [X0 + 2 * DX, 60 - 2 * DY], 9: [X0 + 2 * DX, 60], 5: [X0 + 2 * DX, 60 + 2 * DY],
  6: [X0 + 3 * DX, 60 - DY], 7: [X0 + 3 * DX, 60 + DY],
  8: [X0 + 4 * DX, 60],
};
const W = [70, 60];
const HIT = [149, 60];
const racked = () => Object.entries(RACK).map(([n, p]) => ball(Number(n), Math.round(p[0] * 100) / 100, p[1]));

const spread = (rails) => {
  const dest = {
    2: [139.5, 34.5], 3: [139.5, 85.5],
    4: [161, 12], 5: [161, 108],
    6: [196.6, 24.5], 7: rails.includes(7) ? [204.5, 95] : [196.6, 95.5],
    8: [210, 60],
  };
  return Object.entries(dest).map(([id, to], i) => ({ id, to: clampTable(to), after: "w", delay: i * 12 }));
};
const brake = (rails) => [{ id: "w", to: HIT }, ...spread(rails)];

export default {
  id: "anstoss-vier-kugeln",
  released: false,
  discs: ["8 Ball", "9 Ball", "10 Ball"],
  topic: "anstoss",
  ref: "4.3, 5.3, 6.3",
  keywords: ["Break", "Anstoß", "vier Kugeln", "Bande", "Dry Break"],
  title: "Anstoß: vier Kugeln an die Bande",
  rule: "Beim Anstoß muss entweder eine Kugel versenkt werden oder mindestens vier Objektkugeln müssen eine Bande anlaufen. Sonst ist der Anstoß nicht regelgerecht. Beim 8-Ball ist er dann unzulässig: der Gegner wählt, ob er die Lage übernimmt oder neu aufbauen lässt (und selbst anstößt oder den Anstoßenden erneut anstoßen lässt). Beim 9-Ball und 10-Ball gilt der Stoß als Foul.",
  variants: [
    {
      label: "Fall A", verdict: "foul",
      reason: "Keine Kugel versenkt, nur drei Kugeln erreichen die Bande.",
      balls: [cue(...W), ...racked()],
      steps: [
        { text: "Ausgangslage: Der Anstoß. Es wird keine Kugel versenkt." },
        { text: "Die Weiße bricht das Rack.", aim: [W, HIT] },
        {
          text: "Nur drei Kugeln (4, 5 und 8) laufen an eine Bande – zu wenig.",
          moves: brake([]),
          mark: { at: [175, 60], kind: "foul", after: "w", delay: 450 },
        },
      ],
    },
    {
      label: "Fall B", verdict: "ok",
      reason: "Vier Kugeln erreichen die Bande.",
      balls: [cue(...W), ...racked()],
      steps: [
        { text: "Ausgangslage: Der Anstoß. Es wird keine Kugel versenkt." },
        { text: "Die Weiße bricht das Rack.", aim: [W, HIT] },
        {
          text: "Vier Kugeln (4, 5, 7 und 8) laufen an eine Bande – regelgerecht.",
          moves: brake([7]),
          mark: { at: [175, 60], kind: "ok", after: "w", delay: 450 },
        },
      ],
    },
  ],
};

export const en = {
  "Anstoß: vier Kugeln an die Bande": "Break: four balls to a cushion",
  "Beim Anstoß muss entweder eine Kugel versenkt werden oder mindestens vier Objektkugeln müssen eine Bande anlaufen. Sonst ist der Anstoß nicht regelgerecht. Beim 8-Ball ist er dann unzulässig: der Gegner wählt, ob er die Lage übernimmt oder neu aufbauen lässt (und selbst anstößt oder den Anstoßenden erneut anstoßen lässt). Beim 9-Ball und 10-Ball gilt der Stoß als Foul.":
    "On the break either a ball must be pocketed or at least four object balls must reach a cushion. Otherwise the break is not legal. In 8-ball it is then invalid: the opponent chooses whether to accept the position or have the balls re-racked (and break himself or let the breaker break again). In 9-ball and 10-ball the shot counts as a foul.",
  "Break": "Break",
  "Anstoß": "Break",
  "vier Kugeln": "four balls",
  "Bande": "Cushion",
  "Dry Break": "Dry break",
  "Keine Kugel versenkt, nur drei Kugeln erreichen die Bande.": "No ball pocketed, only three balls reach a cushion.",
  "Vier Kugeln erreichen die Bande.": "Four balls reach a cushion.",
  "Ausgangslage: Der Anstoß. Es wird keine Kugel versenkt.": "Starting position: the break. No ball is pocketed.",
  "Die Weiße bricht das Rack.": "The cue ball breaks the rack.",
  "Nur drei Kugeln (4, 5 und 8) laufen an eine Bande – zu wenig.": "Only three balls (4, 5 and 8) reach a cushion – too few.",
  "Vier Kugeln (4, 5, 7 und 8) laufen an eine Bande – regelgerecht.": "Four balls (4, 5, 7 and 8) reach a cushion – legal.",
};
