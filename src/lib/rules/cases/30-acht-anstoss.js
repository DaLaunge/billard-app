import { cue } from "../../ruleEngine.js";
import { D8 } from "../meta.js";
import { rack, brake, hitOf, R15, W } from "../racks.js";

/* 8 Ball, Anstoss mit Folgen (S26 4.3): Fall A eine Kugel faellt - kein Foul, der Spieler bleibt am
   Tisch (der Tisch ist offen). Fall B die Weisse faellt - Foul, der Gegner hat Ball in Hand aus dem
   Kopffeld oder uebernimmt die Lage. Fall C eine Objektkugel springt vom Tisch - Foul. In B und C
   erreichen vier Kugeln die Bande, es geht nur um den einen Fehler. */
const balls = rack(R15);
const start = () => [cue(...W), ...balls.map((b) => ({ id: String(b.n), n: b.n, x: b.p[0], y: b.p[1] }))];
const HIT = hitOf(R15);
const RAILS = [11, 6, 15, 12];
const withoutBall = (moves, id) => moves.filter((m) => m.id !== id);

// A: die 15 faellt in die Ecktasche unten rechts, zwei weitere Kugeln laufen an die Bande.
const mA = withoutBall(withoutBall(brake(R15, balls, [11, 6]), "15"), "12");
mA.push({ id: "15", to: [207, 107], out: true, after: "w", delay: 20 });
// B: die Weisse prallt von der Spitze ab, laeuft ueber die untere Bande und faellt in die Ecktasche oben links.
const mB = brake(R15, balls, RAILS);
mB[0] = { id: "w", via: [HIT, [104.5, 104.5]], to: [11, 11], out: true, stop: true };
// C: die 9 springt ueber die obere Bande vom Tisch.
const mC = withoutBall(brake(R15, balls, RAILS), "9");
mC.push({ id: "9", to: [138, -8], out: true, after: "w", delay: 20 });

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "Kein Foul – Spieler bleibt am Tisch",
    reason: "Eine Kugel fällt beim korrekten Anstoß: kein Foul, der Spieler spielt weiter. Der Tisch ist offen.",
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim 8-Ball." },
      { text: "Die Weiße bricht das Rack.", aim: [W, HIT] },
      { text: "Die 15 fällt in die Ecktasche, zwei weitere Kugeln laufen an die Bande – kein Foul. Der Spieler bleibt am Tisch, der Tisch ist offen.", moves: mA, mark: { at: [176, 60], kind: "ok", after: "w", delay: 450 } },
    ],
  },
  {
    label: "Fall B", verdict: "foul", verdictLabel: "Foul – Weiße versenkt",
    reason: "Die Weiße fällt beim Anstoß in die Tasche: Foul. Der Gegner übernimmt die Lage oder spielt die Weiße mit Ball in Hand aus dem Kopffeld; der Tisch bleibt offen.",
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim 8-Ball." },
      { text: "Die Weiße bricht das Rack.", aim: [W, HIT] },
      { text: "Vier Kugeln laufen an die Bande, aber die Weiße fällt über die Bande in die Tasche – Foul.", moves: mB, mark: { at: [176, 60], kind: "foul", after: "w", delay: 450 } },
    ],
  },
  {
    label: "Fall C", verdict: "foul", verdictLabel: "Foul – Kugel vom Tisch",
    reason: "Eine Objektkugel springt beim Anstoß vom Tisch: Foul, die Kugel bleibt draußen (nur die 8 würde wieder aufgebaut). Der Gegner übernimmt die Lage oder spielt mit Ball in Hand aus dem Kopffeld.",
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim 8-Ball." },
      { text: "Die Weiße bricht das Rack.", aim: [W, HIT] },
      { text: "Die 9 springt vom Tisch, vier andere Kugeln laufen an die Bande – Foul wegen der gesprungenen Kugel.", moves: mC, mark: { at: [176, 60], kind: "foul", after: "w", delay: 450 } },
    ],
  },
];

export default {
  id: "acht-anstoss",
  released: true,
  discs: D8,
  topic: "anstoss",
  tags: ["anstoss", "foul", "tasche"],
  ref: "4.3, 4.9",
  keywords: ["8 Ball Anstoß", "Kugel fällt beim Anstoß", "Weiße fällt beim Anstoß", "Kugel springt beim Anstoß", "Anstoßfoul 8 Ball", "Gruppen nach dem Anstoß", "Break Foul"],
  title: "8-Ball-Anstoß: Kugel oder Weiße fällt",
  rule: "Fällt beim korrekten 8-Ball-Anstoß eine Kugel, ist das kein Foul: der Spieler bleibt am Tisch und der Tisch ist offen, die Gruppen sind noch nicht verteilt. Fällt die Weiße oder springt eine Objektkugel vom Tisch, ist es ein Foul: der Gegner übernimmt die Lage oder spielt die Weiße mit Ball in Hand aus dem Kopffeld. Gesprungene Objektkugeln bleiben draußen. Fällt die 8 beim korrekten Anstoß, wählt der Spieler: die 8 wieder aufbauen und weiterspielen oder neu anstoßen; fällt sie bei einem Foul, wählt der Gegner.",
  sets: [{ discs: D8, tag: "8-Ball-Anstoß", variants }],
};

export const en = {
  "8-Ball-Anstoß: Kugel oder Weiße fällt": "8-ball break: ball or cue ball falls",
  "Fällt beim korrekten 8-Ball-Anstoß eine Kugel, ist das kein Foul: der Spieler bleibt am Tisch und der Tisch ist offen, die Gruppen sind noch nicht verteilt. Fällt die Weiße oder springt eine Objektkugel vom Tisch, ist es ein Foul: der Gegner übernimmt die Lage oder spielt die Weiße mit Ball in Hand aus dem Kopffeld. Gesprungene Objektkugeln bleiben draußen. Fällt die 8 beim korrekten Anstoß, wählt der Spieler: die 8 wieder aufbauen und weiterspielen oder neu anstoßen; fällt sie bei einem Foul, wählt der Gegner.":
    "If a ball falls on a legal 8-ball break it is not a foul: the player stays at the table and the table is open, the groups are not yet assigned. If the cue ball falls or an object ball jumps off the table it is a foul: the opponent accepts the position or plays the cue ball with ball in hand from behind the head string. Jumped object balls stay off the table. If the 8 falls on a legal break the player chooses: re-spot the 8 and continue or break again; if it falls on a foul the opponent chooses.",
  "8 Ball Anstoß": "8-ball break",
  "Kugel fällt beim Anstoß": "ball falls on the break",
  "Weiße fällt beim Anstoß": "cue ball falls on the break",
  "Kugel springt beim Anstoß": "ball jumps on the break",
  "Anstoßfoul 8 Ball": "8-ball break foul",
  "Gruppen nach dem Anstoß": "groups after the break",
  "Break Foul": "break foul",
  "8-Ball-Anstoß": "8-ball break",
  "Fall C": "Case C",
  "Kein Foul – Spieler bleibt am Tisch": "No foul – player stays at the table",
  "Foul – Weiße versenkt": "Foul – cue ball pocketed",
  "Foul – Kugel vom Tisch": "Foul – ball off the table",
  "Eine Kugel fällt beim korrekten Anstoß: kein Foul, der Spieler spielt weiter. Der Tisch ist offen.": "A ball falls on a legal break: no foul, the player continues. The table is open.",
  "Die Weiße fällt beim Anstoß in die Tasche: Foul. Der Gegner übernimmt die Lage oder spielt die Weiße mit Ball in Hand aus dem Kopffeld; der Tisch bleibt offen.": "The cue ball is pocketed on the break: foul. The opponent accepts the position or plays the cue ball with ball in hand from behind the head string; the table stays open.",
  "Eine Objektkugel springt beim Anstoß vom Tisch: Foul, die Kugel bleibt draußen (nur die 8 würde wieder aufgebaut). Der Gegner übernimmt die Lage oder spielt mit Ball in Hand aus dem Kopffeld.": "An object ball jumps off the table on the break: foul, the ball stays off (only the 8 would be re-spotted). The opponent accepts the position or plays with ball in hand from behind the head string.",
  "Ausgangslage: Der Anstoß beim 8-Ball.": "Starting position: the 8-ball break.",
  "Die Weiße bricht das Rack.": "The cue ball breaks the rack.",
  "Die 15 fällt in die Ecktasche, zwei weitere Kugeln laufen an die Bande – kein Foul. Der Spieler bleibt am Tisch, der Tisch ist offen.": "The 15 falls into the corner pocket, two more balls reach a cushion – no foul. The player stays at the table, the table is open.",
  "Vier Kugeln laufen an die Bande, aber die Weiße fällt über die Bande in die Tasche – Foul.": "Four balls reach a cushion, but the cue ball falls into the pocket off the cushion – foul.",
  "Die 9 springt vom Tisch, vier andere Kugeln laufen an die Bande – Foul wegen der gesprungenen Kugel.": "The 9 jumps off the table, four other balls reach a cushion – foul for the jumped ball.",
};
