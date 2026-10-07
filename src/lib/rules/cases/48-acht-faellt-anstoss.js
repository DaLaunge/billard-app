import { cue } from "../../ruleEngine.js";
import { D8 } from "../meta.js";
import { rack, brake, hitOf, R15, W } from "../racks.js";

/* 8 Ball, Anstoss (S26 4.3 e/f): Die 8 faellt beim Anstoss. Fall A: sonst korrekter Anstoss - kein Foul;
   der Spieler darf die 8 wieder aufbauen und weiterspielen oder neu anstossen. Fall B: die Weisse faellt
   ebenfalls (Foul) - der Gegner waehlt: die 8 wieder aufbauen und mit Ball in Hand aus dem Kopffeld
   spielen, oder selbst neu anstossen.
   Bewusst vereinfachte Physik (`looseCollisions`): die 8 liegt mitten im Rack; bei einem kraeftigen
   Anstoss raeumen die Nachbarn (4, 5) und die Randkugeln das Feld, die 8 rollt hinterher in die Ecktasche.
   Endlagen ueberlappen nie, nur die Bahnen duerfen sich beim Aufstieben des Racks kreuzen. */
const balls = rack(R15);
const start = () => [cue(...W), ...balls.map((b) => ({ id: String(b.n), n: b.n, x: b.p[0], y: b.p[1] }))];
const HIT = hitOf(R15);
const POCKET = [207, 107];
const without = (m, ids) => m.filter((x) => !ids.includes(x.id));

const base = () => {
  const m = without(brake(R15, balls, [11, 6, 12, 15, 14]), ["8", "4", "5"]);
  m.push({ id: "4", to: [150, 22], after: "w", delay: 0 });
  m.push({ id: "5", to: [140, 98], after: "w", delay: 0 });
  m.push({ id: "8", to: POCKET, out: true, after: "w", delay: 200 });
  return m;
};
const mA = base();
const mB = base();
mB[0] = { id: "w", via: [HIT, [104.5, 104.5]], to: [11, 11], out: true, stop: true };

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "Kein Foul – Wahl des Spielers",
    reason: "Die 8 fällt bei einem sonst korrekten Anstoß: kein Foul. Der Spieler baut die 8 wieder auf und spielt weiter oder stößt neu an.",
    looseCollisions: true,
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim 8-Ball." },
      { text: "Die Weiße bricht das Rack.", aim: [W, HIT] },
      { text: "Die 8 fällt in die Ecktasche, sonst ist der Anstoß korrekt – kein Foul. Der Spieler wählt: 8 wieder aufbauen und weiterspielen oder neu anstoßen.", moves: mA, mark: { at: [176, 60], kind: "ok", after: "w", delay: 700 } },
    ],
  },
  {
    label: "Fall B", verdict: "foul", verdictLabel: "Foul – Wahl des Gegners",
    reason: "Die 8 fällt, und die Weiße fällt ebenfalls: Foul. Der Gegner wählt: die 8 wieder aufbauen und mit Ball in Hand aus dem Kopffeld spielen oder selbst neu anstoßen.",
    looseCollisions: true,
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim 8-Ball." },
      { text: "Die Weiße bricht das Rack.", aim: [W, HIT] },
      { text: "Die 8 fällt, aber auch die Weiße fällt in die Tasche – Foul. Der Gegner wählt: 8 aufbauen und Ball in Hand aus dem Kopffeld oder neu anstoßen.", moves: mB, mark: { at: [176, 60], kind: "foul", after: "w", delay: 700 } },
    ],
  },
];

export default {
  id: "acht-faellt-anstoss",
  released: true,
  discs: D8,
  topic: "anstoss",
  tags: ["anstoss", "tasche"],
  ref: "4.3 e, 4.3 f",
  keywords: ["8 fällt beim Anstoß", "Achter beim Break gefallen", "8 wieder aufbauen", "8 beim Break", "schwarze Kugel beim Anstoß"],
  title: "Die 8 fällt beim Anstoß",
  rule: "Fällt die 8 bei einem korrekten Anstoß, ist das kein Foul: der Spieler wählt, ob die 8 wieder aufgebaut wird und er weiterspielt, oder ob er neu anstößt. Fällt die 8 bei einem Anstoß mit Foul, wählt der Gegner: die 8 wieder aufbauen und die Weiße mit Ball in Hand aus dem Kopffeld spielen, oder selbst neu anstoßen.",
  sets: [{ discs: D8, tag: "8-Ball-Anstoß", variants }],
};

export const en = {
  "Die 8 fällt beim Anstoß": "The 8 falls on the break",
  "Fällt die 8 bei einem korrekten Anstoß, ist das kein Foul: der Spieler wählt, ob die 8 wieder aufgebaut wird und er weiterspielt, oder ob er neu anstößt. Fällt die 8 bei einem Anstoß mit Foul, wählt der Gegner: die 8 wieder aufbauen und die Weiße mit Ball in Hand aus dem Kopffeld spielen, oder selbst neu anstoßen.": "If the 8 falls on a legal break it is not a foul: the player chooses whether the 8 is re-spotted and he plays on, or whether he breaks again. If the 8 falls on a break with a foul, the opponent chooses: re-spot the 8 and play the cue ball with ball in hand from the kitchen, or break himself.",
  "8 fällt beim Anstoß": "8 falls on the break",
  "Achter beim Break gefallen": "eight fell on the break",
  "8 wieder aufbauen": "re-spot the 8",
  "8 beim Break": "8 on the break",
  "schwarze Kugel beim Anstoß": "black ball on the break",
  "8-Ball-Anstoß": "8-ball break",
  "Kein Foul – Wahl des Spielers": "No foul – player's choice",
  "Foul – Wahl des Gegners": "Foul – opponent's choice",
  "Die 8 fällt bei einem sonst korrekten Anstoß: kein Foul. Der Spieler baut die 8 wieder auf und spielt weiter oder stößt neu an.": "The 8 falls on an otherwise legal break: no foul. The player re-spots the 8 and plays on or breaks again.",
  "Die 8 fällt, und die Weiße fällt ebenfalls: Foul. Der Gegner wählt: die 8 wieder aufbauen und mit Ball in Hand aus dem Kopffeld spielen oder selbst neu anstoßen.": "The 8 falls and the cue ball falls too: foul. The opponent chooses: re-spot the 8 and play with ball in hand from the kitchen or break himself.",
  "Ausgangslage: Der Anstoß beim 8-Ball.": "Starting position: the 8-ball break.",
  "Die Weiße bricht das Rack.": "The cue ball breaks the rack.",
  "Die 8 fällt in die Ecktasche, sonst ist der Anstoß korrekt – kein Foul. Der Spieler wählt: 8 wieder aufbauen und weiterspielen oder neu anstoßen.": "The 8 falls into the corner pocket, the break is otherwise legal – no foul. The player chooses: re-spot the 8 and play on or break again.",
  "Die 8 fällt, aber auch die Weiße fällt in die Tasche – Foul. Der Gegner wählt: 8 aufbauen und Ball in Hand aus dem Kopffeld oder neu anstoßen.": "The 8 falls, but the cue ball also falls into the pocket – foul. The opponent chooses: re-spot the 8 and ball in hand from the kitchen or break again.",
};
