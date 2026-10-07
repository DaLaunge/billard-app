import { cue } from "../../ruleEngine.js";
import { rack, brake, hitOf, R9, W } from "../racks.js";

/* 9 Ball, Anstoss (S26 5.5, 5.6, 5.3 c): Die 9 faellt beim Anstoss.
   Fall A: korrekter Anstoss (vier Kugeln an die Bande), keine Regelverletzung - der Spieler GEWINNT das Spiel.
   Fall B: die Weisse faellt ebenfalls (Foul) - die 9 wird auf den Fusspunkt zurueckgesetzt, der Gegner hat
           Ball in Hand auf dem ganzen Tisch.
   Fall C: mit Kitchen Rule: die Bedingung (3 Kugeln ins Kopffeld) ist nicht erfuellt (Dry Break) - die 9
           wird wieder aufgebaut, der Gegner uebernimmt die Lage oder gibt sie zurueck.
   Die 9 liegt in der Mitte der Raute; erst wenn die Nachbarn weggelaufen sind, rollt sie hinterher in die
   Ecktasche - vereinfachte Physik (`looseCollisions`), die Endlagen ueberlappen nie. */
const balls = rack(R9);
const start = () => [cue(...W), ...balls.map((b) => ({ id: String(b.n), n: b.n, x: b.p[0], y: b.p[1] }))];
const HIT = hitOf(R9);
const POCKET = [207, 107];
const without = (m, ids) => m.filter((x) => !ids.includes(x.id));

const base = () => {
  const m = without(brake(R9, balls, [5, 7, 8, 6]), ["9"]);
  m.push({ id: "9", to: POCKET, out: true, after: "w", delay: 250 });
  return m;
};
const scratch = () => { const m = base(); m[0] = { id: "w", via: [HIT, [104.5, 104.5]], to: [11, 11], out: true, stop: true }; return m; };

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "Spiel gewonnen",
    reason: "Die 9 fällt bei einem korrekten Anstoß ohne Foul: der Anstoßende gewinnt das Spiel.",
    looseCollisions: true,
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim 9-Ball." },
      { text: "Die Weiße bricht das Rack.", aim: [W, HIT] },
      { text: "Die 9 fällt, vier Kugeln laufen an die Bande, kein Foul – der Spieler gewinnt das Spiel.", moves: base(), mark: { at: [176, 60], kind: "ok", after: "w", delay: 700 } },
    ],
  },
  {
    label: "Fall B", verdict: "foul", verdictLabel: "Foul – die 9 wird wieder aufgebaut",
    reason: "Die 9 fällt, aber auch die Weiße fällt: Foul. Die 9 wird auf den Fußpunkt gesetzt, der Gegner hat Ball in Hand auf dem ganzen Tisch.",
    looseCollisions: true,
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim 9-Ball." },
      { text: "Die Weiße bricht das Rack.", aim: [W, HIT] },
      { text: "Die 9 fällt, aber auch die Weiße fällt in die Tasche – Foul. Die 9 wird wieder aufgebaut, der Gegner spielt mit Ball in Hand.", moves: scratch(), mark: { at: [176, 60], kind: "foul", after: "w", delay: 700 } },
    ],
  },
  {
    label: "Fall C", verdict: "foul", verdictLabel: "Dry Break – die 9 wird wieder aufgebaut",
    reason: "Mit Kitchen Rule fehlt die Bedingung (3 Kugeln im Kopffeld): Dry Break. Die 9 wird wieder aufgebaut; der Gegner übernimmt die Lage (kein Push Out) oder gibt sie zurück.",
    looseCollisions: true,
    table: { headLine: true },
    balls: start(),
    steps: [
      { text: "Ausgangslage: 9-Ball-Anstoß, es wird mit der Drei-Punkte-Regel (Kitchen Rule) gespielt.", count: { label: "Kugeln im Kopffeld", n: 0, of: 3 } },
      { text: "Die Weiße bricht das Rack.", aim: [W, HIT], count: { label: "Kugeln im Kopffeld", n: 0, of: 3 } },
      { text: "Die 9 fällt, aber es kommt keine Kugel ins Kopffeld – Dry Break: die 9 wird wieder aufgebaut.", count: { label: "Kugeln im Kopffeld", n: 0, of: 3 }, moves: base(), mark: { at: [176, 60], kind: "foul", after: "w", delay: 700 } },
    ],
  },
];

export default {
  id: "neun-faellt-anstoss",
  released: true,
  discs: ["9 Ball"],
  topic: "anstoss",
  tags: ["anstoss", "tasche", "foul"],
  ref: "5.5, 5.6, 5.3 c",
  keywords: ["9 fällt beim Anstoß", "Neun beim Break", "9 beim Anstoß versenkt", "Golden Break", "9 wieder aufbauen", "Break und 9"],
  title: "Die 9 fällt beim Anstoß",
  rule: "Fällt die 9 bei einem korrekten Anstoß (vier Kugeln an die Bande oder eine versenkte Kugel, ohne Foul), gewinnt der Anstoßende das Spiel. Fällt sie mit einem Foul (zum Beispiel fällt die Weiße), wird sie wieder aufgebaut (Fußpunkt) und der Gegner hat Ball in Hand auf dem ganzen Tisch. Wird mit der Kitchen Rule gespielt und fehlen die drei Kugeln im Kopffeld (Dry Break), wird die 9 ebenfalls wieder aufgebaut; der Gegner übernimmt die Lage (kein Push Out) oder gibt sie zurück.",
  sets: [{ discs: ["9 Ball"], tag: "9-Ball-Anstoß", variants }],
};

export const en = {
  "Die 9 fällt beim Anstoß": "The 9 falls on the break",
  "Fällt die 9 bei einem korrekten Anstoß (vier Kugeln an die Bande oder eine versenkte Kugel, ohne Foul), gewinnt der Anstoßende das Spiel. Fällt sie mit einem Foul (zum Beispiel fällt die Weiße), wird sie wieder aufgebaut (Fußpunkt) und der Gegner hat Ball in Hand auf dem ganzen Tisch. Wird mit der Kitchen Rule gespielt und fehlen die drei Kugeln im Kopffeld (Dry Break), wird die 9 ebenfalls wieder aufgebaut; der Gegner übernimmt die Lage (kein Push Out) oder gibt sie zurück.": "If the 9 falls on a legal break (four balls to a cushion or a ball pocketed, no foul) the breaker wins the game. If it falls with a foul (for example the cue ball falls) it is re-spotted (foot spot) and the opponent has ball in hand on the whole table. If the kitchen rule is played and the three balls in the kitchen are missing (dry break) the 9 is also re-spotted; the opponent accepts the position (no push out) or hands it back.",
  "9 fällt beim Anstoß": "9 falls on the break",
  "Neun beim Break": "nine on the break",
  "9 beim Anstoß versenkt": "9 pocketed on the break",
  "Golden Break": "golden break",
  "9 wieder aufbauen": "re-spot the 9",
  "Break und 9": "break and 9",
  "9-Ball-Anstoß": "9-ball break",
  "Spiel gewonnen": "Game won",
  "Fall C": "Case C",
  "Foul – die 9 wird wieder aufgebaut": "Foul – the 9 is re-spotted",
  "Dry Break – die 9 wird wieder aufgebaut": "Dry break – the 9 is re-spotted",
  "Kugeln im Kopffeld": "Balls in the kitchen",
  "Die 9 fällt bei einem korrekten Anstoß ohne Foul: der Anstoßende gewinnt das Spiel.": "The 9 falls on a legal break without a foul: the breaker wins the game.",
  "Die 9 fällt, aber auch die Weiße fällt: Foul. Die 9 wird auf den Fußpunkt gesetzt, der Gegner hat Ball in Hand auf dem ganzen Tisch.": "The 9 falls, but the cue ball falls too: foul. The 9 is placed on the foot spot, the opponent has ball in hand on the whole table.",
  "Mit Kitchen Rule fehlt die Bedingung (3 Kugeln im Kopffeld): Dry Break. Die 9 wird wieder aufgebaut; der Gegner übernimmt die Lage (kein Push Out) oder gibt sie zurück.": "With the kitchen rule the condition (3 balls in the kitchen) is missing: dry break. The 9 is re-spotted; the opponent accepts the position (no push out) or hands it back.",
  "Ausgangslage: Der Anstoß beim 9-Ball.": "Starting position: the 9-ball break.",
  "Die Weiße bricht das Rack.": "The cue ball breaks the rack.",
  "Die 9 fällt, vier Kugeln laufen an die Bande, kein Foul – der Spieler gewinnt das Spiel.": "The 9 falls, four balls reach a cushion, no foul – the player wins the game.",
  "Die 9 fällt, aber auch die Weiße fällt in die Tasche – Foul. Die 9 wird wieder aufgebaut, der Gegner spielt mit Ball in Hand.": "The 9 falls, but the cue ball also falls into the pocket – foul. The 9 is re-spotted, the opponent plays with ball in hand.",
  "Ausgangslage: 9-Ball-Anstoß, es wird mit der Drei-Punkte-Regel (Kitchen Rule) gespielt.": "Starting position: 9-ball break, played with the three-point rule (kitchen rule).",
  "Die 9 fällt, aber es kommt keine Kugel ins Kopffeld – Dry Break: die 9 wird wieder aufgebaut.": "The 9 falls, but no ball reaches the kitchen – dry break: the 9 is re-spotted.",
};
