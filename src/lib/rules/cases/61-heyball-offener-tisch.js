import { cue, ball, cut } from "../../ruleEngine.js";
import { DHB, SOURCE_HEYBALL } from "../meta.js";

/* Heyball, offener Tisch (WPA Rules of Heyball 10, 12.1): Nach dem Anstoss ist der Tisch IMMER offen, auch wenn
   dabei Kugeln gefallen sind. Bei offenem Tisch darf jede Kugel ausser der 8 zuerst angespielt werden. Die Gruppen
   werden erst verteilt, wenn ein Spieler nach dem Anstoss regelgerecht eine Kugel versenkt. Fall A: die 8 zuerst =
   Foul. Fall B: die 3 zuerst und versenkt = der Spieler spielt jetzt Volle, der Tisch ist geschlossen. */
const W = [60, 60], B8 = [135, 36], B3 = [130, 72], B11 = [172, 38];
const POCKET = [207, 107];
const balls = () => [cue(...W), ball(8, ...B8), ball(3, ...B3), ball(11, ...B11), ball(10, 185, 62)];
const a = cut(W, { id: "8", at: B8 }, [172, 15.5]);
const b = cut(W, { id: "3", at: B3 }, POCKET, { out: true });

const variants = [
  {
    label: "Fall A", verdict: "foul",
    reason: "Bei offenem Tisch wurde zuerst die 8 berührt: Foul, der Gegner bekommt die Weiße in die Hand.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Nach dem Anstoß ist der Tisch offen – noch hat niemand eine Gruppe.", focus: ["8"] },
      { text: "Die Weiße wird auf die 8 gespielt.", aim: [W, B8] },
      { text: "Die Weiße berührt zuerst die 8 – bei offenem Tisch ein Foul.", wrongFirst: true, expectRail: true, moves: [a.w, a.obj], mark: { at: B8, kind: "foul", after: "w" } },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Gruppe verteilt",
    reason: "Die 3 darf bei offenem Tisch zuerst gespielt werden. Wird sie versenkt, spielt der Spieler Volle und der Gegner Halbe.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Nach dem Anstoß ist der Tisch offen – noch hat niemand eine Gruppe.", focus: ["8"] },
      { text: "Die Weiße wird auf die 3 gespielt.", aim: [W, B3] },
      { text: "Die 3 fällt: Der Spieler spielt ab jetzt Volle, der Gegner Halbe – der Tisch ist geschlossen.", expectRail: true, moves: [b.w, b.obj], mark: { at: [200, 101], kind: "ok", after: "w", delay: 300 } },
    ],
  },
];

export default {
  id: "heyball-offener-tisch",
  released: true,
  discs: DHB,
  src: SOURCE_HEYBALL,
  bookRef: "8.3",
  topic: "kontakt",
  tags: ["ablauf", "erstkontakt"],
  ref: "10, 12.1",
  keywords: ["Heyball offener Tisch", "offener Tisch", "Gruppe", "Gruppen verteilt", "Volle Halbe", "8 zuerst", "Tisch geschlossen", "nach dem Anstoß"],
  title: "Heyball: Offener Tisch und Gruppenwahl",
  rule: "Nach dem Anstoß ist der Tisch immer offen – auch wenn dabei Kugeln gefallen sind. Bei offenem Tisch darf jede Kugel außer der 8 zuerst angespielt werden; die 8 zuerst zu berühren ist ein Foul. Die Gruppen werden erst verteilt, wenn ein Spieler nach dem Anstoß regelgerecht eine Kugel versenkt: Seine Gruppe ist die der versenkten Kugel, und der Tisch ist geschlossen. Danach muss die Weiße zuerst eine Kugel der eigenen Gruppe berühren. Unrechtmäßig versenkte Kugeln (außer der 8) bleiben bei offenem Tisch unten.",
  sets: [{ discs: DHB, tag: "Offener Tisch", variants }],
};

export const en = {
  "Heyball: Offener Tisch und Gruppenwahl": "Heyball: open table and group choice",
  "Nach dem Anstoß ist der Tisch immer offen – auch wenn dabei Kugeln gefallen sind. Bei offenem Tisch darf jede Kugel außer der 8 zuerst angespielt werden; die 8 zuerst zu berühren ist ein Foul. Die Gruppen werden erst verteilt, wenn ein Spieler nach dem Anstoß regelgerecht eine Kugel versenkt: Seine Gruppe ist die der versenkten Kugel, und der Tisch ist geschlossen. Danach muss die Weiße zuerst eine Kugel der eigenen Gruppe berühren. Unrechtmäßig versenkte Kugeln (außer der 8) bleiben bei offenem Tisch unten.":
    "After the break the table is always open – even if balls dropped. On an open table any ball except the 8 may be hit first; hitting the 8 first is a foul. Groups are only assigned when a player legally pockets a ball after the break: his group is the group of that ball and the table is closed. After that the cue ball must first hit a ball of your own group. Illegally pocketed balls (except the 8) stay down on an open table.",
  "Heyball offener Tisch": "Heyball open table",
  "offener Tisch": "open table",
  "Gruppe": "group",
  "Gruppen verteilt": "groups assigned",
  "Volle Halbe": "solids stripes",
  "8 zuerst": "8 first",
  "Tisch geschlossen": "table closed",
  "nach dem Anstoß": "after the break",
  "Offener Tisch": "Open table",
  "Gruppe verteilt": "Group assigned",
  "Bei offenem Tisch wurde zuerst die 8 berührt: Foul, der Gegner bekommt die Weiße in die Hand.": "On an open table the 8 was touched first: foul, the opponent gets ball in hand.",
  "Die 3 darf bei offenem Tisch zuerst gespielt werden. Wird sie versenkt, spielt der Spieler Volle und der Gegner Halbe.": "On an open table the 3 may be played first. If it is pocketed, the player has solids and the opponent stripes.",
  "Ausgangslage: Nach dem Anstoß ist der Tisch offen – noch hat niemand eine Gruppe.": "Starting position: after the break the table is open – nobody has a group yet.",
  "Die Weiße wird auf die 8 gespielt.": "The cue ball is played at the 8.",
  "Die Weiße berührt zuerst die 8 – bei offenem Tisch ein Foul.": "The cue ball touches the 8 first – a foul on an open table.",
  "Die Weiße wird auf die 3 gespielt.": "The cue ball is played at the 3.",
  "Die 3 fällt: Der Spieler spielt ab jetzt Volle, der Gegner Halbe – der Tisch ist geschlossen.": "The 3 falls: the player now has solids, the opponent stripes – the table is closed.",
};
