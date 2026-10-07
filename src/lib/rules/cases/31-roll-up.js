import { cue, ball, cut } from "../../ruleEngine.js";
import { D141 } from "../meta.js";

/* 14/1 (Lehrunterlage OS19 6.7 Nr. 2): Eine Kugel liegt innerhalb einer Kugelstaerke von der Bande,
   aber nicht press. Jeder Spieler darf darauf nur ZWEIMAL einen Roll-up spielen; beim dritten Mal
   zaehlt es als drittes Foul in Folge. Ein Roll-up: die Weisse trifft die Kugel duenn, sie rollt
   ein Stueck an der Bande entlang, die Weisse laeuft an die Bande zurueck. Zwischen den Stoessen
   spielt der Gegner (uebersprungen, die Weisse kommt per Hand neu hin).
   Fall A: dritter Roll-up = Foul. Fall B: beim dritten Stoss wird die Kugel gespielt (versenkt). */
const T0 = [110, 97], STEP = [7.7, 1.9];
const Ts = [T0, [T0[0] + STEP[0], T0[1] + STEP[1]], [T0[0] + 2 * STEP[0], T0[1] + 2 * STEP[1]]];
// Startpunkt der Weissen: 55 Grad Schnitt gegen die Laufrichtung der Kugel, von oben
const fromFor = (T) => {
  const l = Math.hypot(...STEP), u = [STEP[0] / l, STEP[1] / l];
  const c = [T[0] - u[0] * 11, T[1] - u[1] * 11], a = (55 * Math.PI) / 180;
  const inc = [u[0] * Math.cos(a) - u[1] * Math.sin(a), u[1] * Math.cos(a) + u[0] * Math.sin(a)];
  return [c[0] - inc[0] * 40, c[1] - inc[1] * 40];
};
const roll = (i) => cut(fromFor(Ts[i]), { id: "5", at: Ts[i] }, [Ts[i][0] + STEP[0], Ts[i][1] + STEP[1]], i ? { hand: true } : {});
const r = [roll(0), roll(1), roll(2)];
const pocket = cut([100, 88], { id: "5", at: Ts[2] }, [207, 107.5], { out: true, hand: true });

const who = "Derselbe Spieler";
const balls = () => [cue(...fromFor(T0)), ball(5, ...T0), ball(9, 170, 40), ball(12, 60, 32)];
const first = [
  { text: "Ausgangslage: Die angesagte 5 liegt nahe an der Bande, aber nicht press. Der Spieler spielt einen Roll-up.", say: "nicht press", sayIcon: "mouth", focus: ["5"] },
  { text: "Roll-up 1: Die Weiße trifft die 5 dünn, sie rollt an der Bande entlang, die Weiße läuft an die Bande. Erlaubt.", shot: { n: 1, of: 3, who }, count: { label: "Roll-ups", n: 1, of: 2 }, aim: [fromFor(T0), r[0].contact], expectRail: true, moves: [r[0].w, r[0].obj] },
  { text: "Roll-up 2: Wieder derselbe Stoß, nachdem der Gegner gespielt hat. Das zweite und letzte erlaubte Mal.", shot: { n: 2, of: 3, who }, count: { label: "Roll-ups", n: 2, of: 2 }, aim: [fromFor(Ts[1]), r[1].contact], expectRail: true, moves: [r[1].w, r[1].obj] },
];

const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Drittes Foul in Folge",
    reason: "Auf eine Kugel innerhalb einer Kugelstärke von der Bande darf jeder Spieler nur zweimal einen Roll-up spielen. Der dritte zählt als drittes Foul in Folge.",
    balls: balls(),
    steps: [
      ...first,
      { text: "Roll-up 3: Derselbe Stoß ein drittes Mal – er zählt als drittes Foul in Folge: 1 Punkt plus 15 Punkte Abzug, neu aufbauen.", shot: { n: 3, of: 3, who }, count: { label: "Roll-ups", n: 2, of: 2 }, aim: [fromFor(Ts[2]), r[2].contact], expectRail: true, moves: [r[2].w, r[2].obj], mark: { at: Ts[2], kind: "foul", after: "w" } },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Kein Foul – Kugel versenkt",
    reason: "Statt eines dritten Roll-ups wird die Kugel gespielt und versenkt: die angesagte 5 zählt, es gibt keinen Abzug.",
    balls: balls(),
    steps: [
      ...first,
      { text: "Stoß 3: Der Spieler spielt die 5 diesmal in die Ecktasche – kein dritter Roll-up.", shot: { n: 3, of: 3, who }, count: { label: "Roll-ups", n: 2, of: 2 }, aim: [[100, 88], pocket.contact], expectRail: true, moves: [pocket.w, pocket.obj], mark: { at: [200, 102], kind: "ok", after: "w", delay: 300 } },
    ],
  },
];

export default {
  id: "roll-up",
  released: true,
  discs: D141,
  topic: "ablauf",
  tags: ["bande", "foul"],
  ref: "6.7",
  bookRef: "7.5",
  keywords: ["Roll-up", "Abstand zur Bande", "Kugelstärke Abstand", "zweimal Roll-up", "dritter Roll-up"],
  title: "Roll-up: nur zweimal erlaubt",
  rule: "Beim 14/1 gilt nach der Lehrunterlage: Liegt die angesagte Kugel innerhalb einer Kugelstärke von der Bande (aber nicht press), darf jeder Spieler darauf nur zweimal einen Roll-up spielen. Beim dritten Mal zählt das als drittes Foul in Folge: ein Punkt Abzug und zusätzlich 15 Punkte, alle Kugeln werden neu aufgebaut und der Spieler stößt unter den Eröffnungsbedingungen neu an. Kombinationen aus Roll-ups und anderen Fouls werden entsprechend gezählt.",
  sets: [{ discs: D141, tag: "14/1 · Ansage: 5", variants }],
};

export const en = {
  "Roll-up: nur zweimal erlaubt": "Roll-up: only twice allowed",
  "Beim 14/1 gilt nach der Lehrunterlage: Liegt die angesagte Kugel innerhalb einer Kugelstärke von der Bande (aber nicht press), darf jeder Spieler darauf nur zweimal einen Roll-up spielen. Beim dritten Mal zählt das als drittes Foul in Folge: ein Punkt Abzug und zusätzlich 15 Punkte, alle Kugeln werden neu aufgebaut und der Spieler stößt unter den Eröffnungsbedingungen neu an. Kombinationen aus Roll-ups und anderen Fouls werden entsprechend gezählt.":
    "In 14.1 the training material says: if the called ball lies within one ball width of the cushion (but is not frozen), each player may play only two roll-ups on it. The third counts as a third consecutive foul: one point deduction plus 15 points, all balls are re-racked and the player breaks again under the opening-break conditions. Combinations of roll-ups and other fouls are counted accordingly.",
  "Derselbe Spieler": "Same player",
  "Roll-up": "roll-up",
  "Abstand zur Bande": "distance to the cushion",
  "Kugelstärke Abstand": "ball width distance",
  "zweimal Roll-up": "two roll-ups",
  "dritter Roll-up": "third roll-up",
  "14/1 · Ansage: 5": "14.1 · call: 5",
  "nicht press": "not frozen",
  "Roll-ups": "Roll-ups",
  "Drittes Foul in Folge": "Third consecutive foul",
  "Kein Foul – Kugel versenkt": "No foul – ball pocketed",
  "Auf eine Kugel innerhalb einer Kugelstärke von der Bande darf jeder Spieler nur zweimal einen Roll-up spielen. Der dritte zählt als drittes Foul in Folge.": "On a ball within one ball width of the cushion each player may play only two roll-ups. The third counts as a third consecutive foul.",
  "Statt eines dritten Roll-ups wird die Kugel gespielt und versenkt: die angesagte 5 zählt, es gibt keinen Abzug.": "Instead of a third roll-up the ball is played and pocketed: the called 5 counts, there is no deduction.",
  "Ausgangslage: Die angesagte 5 liegt nahe an der Bande, aber nicht press. Der Spieler spielt einen Roll-up.": "Starting position: the called 5 lies near the cushion, but is not frozen. The player plays a roll-up.",
  "Roll-up 1: Die Weiße trifft die 5 dünn, sie rollt an der Bande entlang, die Weiße läuft an die Bande. Erlaubt.": "Roll-up 1: The cue ball hits the 5 thinly, it rolls along the cushion, the cue ball runs to the cushion. Allowed.",
  "Roll-up 2: Wieder derselbe Stoß, nachdem der Gegner gespielt hat. Das zweite und letzte erlaubte Mal.": "Roll-up 2: The same shot again after the opponent has played. The second and last time allowed.",
  "Roll-up 3: Derselbe Stoß ein drittes Mal – er zählt als drittes Foul in Folge: 1 Punkt plus 15 Punkte Abzug, neu aufbauen.": "Roll-up 3: The same shot a third time – it counts as a third consecutive foul: 1 point plus 15 points deducted, re-rack.",
  "Stoß 3: Der Spieler spielt die 5 diesmal in die Ecktasche – kein dritter Roll-up.": "Shot 3: this time the player plays the 5 into the corner pocket – no third roll-up.",
};
