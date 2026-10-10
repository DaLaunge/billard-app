import { cue } from "../../ruleEngine.js";
import { DHB, SOURCE_HEYBALL } from "../meta.js";
import { rack, brake, hitOf, R15, W } from "../racks.js";

/* Heyball, Anstoss (6 f): Die 8 faellt beim Anstoss. Fall A: sonst korrekter Anstoss - der Anstossende darf die 8
   auf den Fusspunkt zuruecklegen und weiterspielen oder neu anstossen. Fall B: die Weisse faellt ebenfalls (Foul) -
   der Gegner waehlt unter vier Moeglichkeiten. Bewusst vereinfachte Physik wie cases/48 (`looseCollisions`). */
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
    label: "Fall A", verdict: "ok", verdictLabel: "Kein Foul – Wahl des Anstoßenden",
    reason: "Die 8 fällt bei einem sonst korrekten Anstoß: kein Foul. Der Anstoßende legt die 8 auf den Fußpunkt zurück und spielt weiter oder stößt neu an.",
    looseCollisions: true,
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim Heyball." },
      { text: "Die Weiße bricht das Rack.", aim: [W, HIT] },
      { text: "Die 8 fällt in die Ecktasche, sonst ist der Anstoß korrekt – kein Foul. Der Anstoßende wählt: 8 auf den Fußpunkt zurücklegen und weiterspielen oder neu anstoßen.", moves: mA, mark: { at: [176, 60], kind: "ok", after: "w", delay: 700 } },
    ],
  },
  {
    label: "Fall B", verdict: "foul", verdictLabel: "Foul – Wahl des Gegners",
    reason: "Die 8 fällt, und die Weiße fällt ebenfalls: Foul. Der Gegner wählt: die 8 auf den Fußpunkt, die Weiße in der Hand hinter der Kopflinie, neu aufbauen und selbst anstoßen oder neu aufbauen und den Gegner anstoßen lassen.",
    looseCollisions: true,
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim Heyball." },
      { text: "Die Weiße bricht das Rack.", aim: [W, HIT] },
      { text: "Die 8 fällt, aber auch die Weiße fällt in die Tasche – Foul. Der Gegner hat vier Möglichkeiten, siehe Regeltext.", moves: mB, mark: { at: [176, 60], kind: "foul", after: "w", delay: 700 } },
    ],
  },
];

export default {
  id: "heyball-acht-faellt-anstoss",
  released: true,
  discs: DHB,
  src: SOURCE_HEYBALL,
  bookRef: "8.2",
  topic: "anstoss",
  tags: ["anstoss", "tasche"],
  ref: "6 (f)",
  keywords: ["8 fällt beim Anstoß", "Achter beim Break gefallen", "8 zurücklegen", "8 beim Break", "Heyball 8 Anstoß"],
  title: "Heyball: Die 8 fällt beim Anstoß",
  rule: "Fällt die 8 beim Anstoß ohne Foul, darf der Anstoßende sie auf den Fußpunkt zurücklegen und weiterspielen oder neu anstoßen. Bei einem Foul wählt der Gegner: die 8 auf den Fußpunkt zurücklegen, die Weiße in der Hand hinter der Kopflinie, neu aufbauen und selbst anstoßen oder neu aufbauen und den Gegner anstoßen lassen.",
  sets: [{ discs: DHB, tag: "Heyball-Anstoß", variants }],
};

export const en = {
  "Heyball: Die 8 fällt beim Anstoß": "Heyball: the 8 falls on the break",
  "Fällt die 8 beim Anstoß ohne Foul, darf der Anstoßende sie auf den Fußpunkt zurücklegen und weiterspielen oder neu anstoßen. Bei einem Foul wählt der Gegner: die 8 auf den Fußpunkt zurücklegen, die Weiße in der Hand hinter der Kopflinie, neu aufbauen und selbst anstoßen oder neu aufbauen und den Gegner anstoßen lassen.":
    "If the 8 falls on the break without a foul, the breaker may re-spot it on the foot spot and play on, or break again. After a foul the opponent chooses: re-spot the 8 on the foot spot, ball in hand behind the head string, re-rack and break himself, or re-rack and have the opponent break.",
  "8 fällt beim Anstoß": "8 falls on the break",
  "Achter beim Break gefallen": "eight fell on the break",
  "8 zurücklegen": "re-spot the 8",
  "8 beim Break": "8 on the break",
  "Heyball 8 Anstoß": "Heyball 8 on the break",
  "Heyball-Anstoß": "Heyball break",
  "Kein Foul – Wahl des Anstoßenden": "No foul – breaker's choice",
  "Foul – Wahl des Gegners": "Foul – opponent's choice",
  "Die 8 fällt bei einem sonst korrekten Anstoß: kein Foul. Der Anstoßende legt die 8 auf den Fußpunkt zurück und spielt weiter oder stößt neu an.": "The 8 falls on an otherwise legal break: no foul. The breaker re-spots the 8 on the foot spot and plays on or breaks again.",
  "Die 8 fällt, und die Weiße fällt ebenfalls: Foul. Der Gegner wählt: die 8 auf den Fußpunkt, die Weiße in der Hand hinter der Kopflinie, neu aufbauen und selbst anstoßen oder neu aufbauen und den Gegner anstoßen lassen.": "The 8 falls and the cue ball falls too: foul. The opponent chooses: the 8 on the foot spot, ball in hand behind the head string, re-rack and break himself, or re-rack and have the opponent break.",
  "Ausgangslage: Der Anstoß beim Heyball.": "Starting position: the Heyball break.",
  "Die Weiße bricht das Rack.": "The cue ball breaks the rack.",
  "Die 8 fällt in die Ecktasche, sonst ist der Anstoß korrekt – kein Foul. Der Anstoßende wählt: 8 auf den Fußpunkt zurücklegen und weiterspielen oder neu anstoßen.": "The 8 falls into the corner pocket, the break is otherwise legal – no foul. The breaker chooses: re-spot the 8 on the foot spot and play on, or break again.",
  "Die 8 fällt, aber auch die Weiße fällt in die Tasche – Foul. Der Gegner hat vier Möglichkeiten, siehe Regeltext.": "The 8 falls, but the cue ball also falls into the pocket – foul. The opponent has four options, see the rule text.",
};
