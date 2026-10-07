import { cue } from "../../ruleEngine.js";
import { rack, brake, hitOf, R10, W } from "../racks.js";

/* 10 Ball, Anstoss (S26 6.8, 6.7): Die 10 faellt beim Anstoss. Sie gewinnt NICHT: das Spiel endet nur, wenn
   die 10 die einzige Objektkugel auf dem Tisch ist. Beim Anstoss versenkt wird sie wieder aufgebaut (Fusspunkt),
   das Spiel geht weiter. Fall A: sonst korrekter Anstoss. Fall B: die Weisse faellt ebenfalls (Foul) - die 10
   wird wieder aufgebaut, der Gegner hat Ball in Hand auf dem ganzen Tisch.
   Vereinfachte Physik wie bei der 9 (`looseCollisions`). */
const balls = rack(R10);
const start = () => [cue(...W), ...balls.map((b) => ({ id: String(b.n), n: b.n, x: b.p[0], y: b.p[1] }))];
const HIT = hitOf(R10);
const POCKET = [207, 107];
const without = (m, ids) => m.filter((x) => !ids.includes(x.id));

const base = () => {
  const m = without(brake(R10, balls, [6, 9, 8, 2]), ["10"]);
  m.push({ id: "10", to: POCKET, out: true, after: "w", delay: 250 });
  return m;
};
const scratch = () => { const m = base(); m[0] = { id: "w", via: [HIT, [104.5, 104.5]], to: [11, 11], out: true, stop: true }; return m; };

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "Kein Sieg – die 10 wird wieder aufgebaut",
    reason: "Die 10 gewinnt nur als letzte Kugel auf dem Tisch. Fällt sie beim Anstoß, wird sie wieder aufgebaut (Fußpunkt) und das Spiel geht weiter.",
    looseCollisions: true,
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim 10-Ball." },
      { text: "Die Weiße bricht das Rack.", aim: [W, HIT] },
      { text: "Die 10 fällt in die Ecktasche, vier Kugeln laufen an die Bande. Die 10 gewinnt nicht, sie wird wieder aufgebaut.", moves: base(), mark: { at: [176, 60], kind: "ok", after: "w", delay: 700 } },
    ],
  },
  {
    label: "Fall B", verdict: "foul", verdictLabel: "Foul – die 10 wird wieder aufgebaut",
    reason: "Die 10 fällt, aber auch die Weiße fällt: Foul. Die 10 wird auf den Fußpunkt gesetzt, der Gegner hat Ball in Hand auf dem ganzen Tisch.",
    looseCollisions: true,
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim 10-Ball." },
      { text: "Die Weiße bricht das Rack.", aim: [W, HIT] },
      { text: "Die 10 fällt, aber auch die Weiße fällt in die Tasche – Foul. Die 10 wird wieder aufgebaut, der Gegner spielt mit Ball in Hand.", moves: scratch(), mark: { at: [176, 60], kind: "foul", after: "w", delay: 700 } },
    ],
  },
];

export default {
  id: "zehn-faellt-anstoss",
  released: true,
  discs: ["10 Ball"],
  topic: "anstoss",
  tags: ["anstoss", "tasche", "foul"],
  ref: "6.7, 6.8",
  keywords: ["10 fällt beim Anstoß", "Zehn beim Break", "10 beim Anstoß versenkt", "10 wieder aufbauen", "Break und 10"],
  title: "Die 10 fällt beim Anstoß",
  rule: "Beim 10-Ball gewinnt die 10 nur, wenn sie die einzige Objektkugel auf dem Tisch ist und regelgerecht in die angesagte Tasche fällt. Wird sie beim Anstoß versenkt, wird sie wieder aufgebaut (Fußpunkt), das Spiel geht weiter. Fällt gleichzeitig die Weiße (Foul), hat der Gegner Ball in Hand auf dem ganzen Tisch. Alle anderen beim Anstoß versenkten Kugeln bleiben aus dem Spiel.",
  sets: [{ discs: ["10 Ball"], tag: "10-Ball-Anstoß", variants }],
};

export const en = {
  "Die 10 fällt beim Anstoß": "The 10 falls on the break",
  "Beim 10-Ball gewinnt die 10 nur, wenn sie die einzige Objektkugel auf dem Tisch ist und regelgerecht in die angesagte Tasche fällt. Wird sie beim Anstoß versenkt, wird sie wieder aufgebaut (Fußpunkt), das Spiel geht weiter. Fällt gleichzeitig die Weiße (Foul), hat der Gegner Ball in Hand auf dem ganzen Tisch. Alle anderen beim Anstoß versenkten Kugeln bleiben aus dem Spiel.": "In 10-ball the 10 only wins if it is the only object ball on the table and falls legally into the called pocket. If it is pocketed on the break it is re-spotted (foot spot) and the game goes on. If the cue ball falls at the same time (foul) the opponent has ball in hand on the whole table. All other balls pocketed on the break stay off the table.",
  "10 fällt beim Anstoß": "10 falls on the break",
  "Zehn beim Break": "ten on the break",
  "10 beim Anstoß versenkt": "10 pocketed on the break",
  "10 wieder aufbauen": "re-spot the 10",
  "Break und 10": "break and 10",
  "10-Ball-Anstoß": "10-ball break",
  "Kein Sieg – die 10 wird wieder aufgebaut": "No win – the 10 is re-spotted",
  "Foul – die 10 wird wieder aufgebaut": "Foul – the 10 is re-spotted",
  "Die 10 gewinnt nur als letzte Kugel auf dem Tisch. Fällt sie beim Anstoß, wird sie wieder aufgebaut (Fußpunkt) und das Spiel geht weiter.": "The 10 only wins as the last ball on the table. If it falls on the break it is re-spotted (foot spot) and the game goes on.",
  "Die 10 fällt, aber auch die Weiße fällt: Foul. Die 10 wird auf den Fußpunkt gesetzt, der Gegner hat Ball in Hand auf dem ganzen Tisch.": "The 10 falls, but the cue ball falls too: foul. The 10 is placed on the foot spot, the opponent has ball in hand on the whole table.",
  "Ausgangslage: Der Anstoß beim 10-Ball.": "Starting position: the 10-ball break.",
  "Die Weiße bricht das Rack.": "The cue ball breaks the rack.",
  "Die 10 fällt in die Ecktasche, vier Kugeln laufen an die Bande. Die 10 gewinnt nicht, sie wird wieder aufgebaut.": "The 10 falls into the corner pocket, four balls reach a cushion. The 10 does not win, it is re-spotted.",
  "Die 10 fällt, aber auch die Weiße fällt in die Tasche – Foul. Die 10 wird wieder aufgebaut, der Gegner spielt mit Ball in Hand.": "The 10 falls, but the cue ball also falls into the pocket – foul. The 10 is re-spotted, the opponent plays with ball in hand.",
};
