import { cue, ball, cut } from "../../ruleEngine.js";
import { D8 } from "../meta.js";

const W = [60, 60], B8 = [135, 36], B3 = [130, 72], B12 = [165, 95];
const balls = () => [cue(...W), ball(8, ...B8), ball(3, ...B3), ball(12, ...B12), ball(10, 185, 62)];
const a = cut(W, { id: "8", at: B8 }, [172, 24]);
const b = cut(W, { id: "3", at: B3 }, [152, 104.5]);

const variants = [
  {
    label: "Fall A", verdict: "foul",
    reason: "Bei offenem Tisch wurde zuerst die 8 berührt.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Der Tisch ist offen, noch hat niemand eine Gruppe.", focus: ["8"] },
      { text: "Die Weiße wird auf die 8 gespielt.", aim: [W, B8] },
      { text: "Die Weiße berührt zuerst die 8 – bei offenem Tisch ein Foul.", moves: [a.w, a.obj], mark: { at: B8, kind: "foul", after: "w" } },
    ],
  },
  {
    label: "Fall B", verdict: "ok",
    reason: "Die 3 darf bei offenem Tisch zuerst gespielt werden.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Der Tisch ist offen, noch hat niemand eine Gruppe.", focus: ["8"] },
      { text: "Die Weiße wird auf die 3 gespielt.", aim: [W, B3] },
      { text: "Die Weiße berührt die 3, die danach an die Bande läuft – regelgerecht.", moves: [b.w, b.obj], mark: { at: B3, kind: "ok", after: "w" } },
    ],
  },
];

export default {
  id: "offener-tisch-acht",
  released: false,
  discs: D8,
  topic: "kontakt",
  ref: "4.4, 4.9",
  keywords: ["offener Tisch", "Gruppe", "Achtball", "Achter", "8 zu früh", "schwarze Kugel"],
  title: "Offener Tisch: die 8 zuerst",
  rule: "Solange der Tisch beim 8-Ball offen ist (noch hat niemand eine Gruppe), darf jede Kugel außer der 8 zuerst angespielt werden. Die 8 zuerst zu berühren ist ein Foul, es sei denn, eine der beiden Gruppen ist bereits vollständig versenkt. Nach dem Foul bekommt der Gegner die Weiße in die Hand.",
  sets: [{ discs: D8, tag: "Offener Tisch", variants }],
};

export const en = {
  "Offener Tisch: die 8 zuerst": "Open table: the 8 first",
  "Solange der Tisch beim 8-Ball offen ist (noch hat niemand eine Gruppe), darf jede Kugel außer der 8 zuerst angespielt werden. Die 8 zuerst zu berühren ist ein Foul, es sei denn, eine der beiden Gruppen ist bereits vollständig versenkt. Nach dem Foul bekommt der Gegner die Weiße in die Hand.":
    "While the table is open in 8-ball (nobody has a group yet), any ball except the 8 may be played first. Touching the 8 first is a foul, unless one of the two groups has already been completely pocketed. After the foul the opponent gets ball in hand.",
  "offener Tisch": "open table",
  "Gruppe": "group",
  "Achtball": "eight-ball",
  "Achter": "the eight",
  "8 zu früh": "8 too early",
  "schwarze Kugel": "black ball",
  "Offener Tisch": "Open table",
  "Bei offenem Tisch wurde zuerst die 8 berührt.": "On an open table the 8 was touched first.",
  "Die 3 darf bei offenem Tisch zuerst gespielt werden.": "On an open table the 3 may be played first.",
  "Ausgangslage: Der Tisch ist offen, noch hat niemand eine Gruppe.": "Starting position: the table is open, nobody has a group yet.",
  "Die Weiße wird auf die 8 gespielt.": "The cue ball is played at the 8.",
  "Die Weiße berührt zuerst die 8 – bei offenem Tisch ein Foul.": "The cue ball touches the 8 first – a foul on an open table.",
  "Die Weiße wird auf die 3 gespielt.": "The cue ball is played at the 3.",
  "Die Weiße berührt die 3, die danach an die Bande läuft – regelgerecht.": "The cue ball touches the 3, which then runs to the cushion – legal.",
};
