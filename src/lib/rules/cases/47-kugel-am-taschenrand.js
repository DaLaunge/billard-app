import { cue, ball } from "../../ruleEngine.js";
import { ALL_DISCS } from "../meta.js";

/* OS19 3.32 / Regel 2.2: Eine Kugel haengt am Taschenrand und wird nur von einer anderen Kugel gestuetzt.
   Der Schiedsrichter sieht von oben auf die Lage: Fiele die Kugel, sobald man die stuetzende Kugel
   wegnaehme, gilt sie als versenkt (Fall A). Liegt sie dagegen sicher auf dem Tuch und ragt nur ueber den
   Taschenrand hinaus ohne zu fallen, ist sie nicht versenkt (Fall B). Statische Lage, es wird nicht gestossen. */
const HANG = [206.5, 13.5], SUPPORT = [197, 20.5], SAFE = [198.5, 22];
const pocketed = (b) => ({ ...b, pocketed: true });
const base = () => [cue(70, 70), ball(12, 60, 100)];

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "Kugel gilt als versenkt",
    reason: "Die 6 würde fallen, sobald man die stützende 9 wegnimmt: sie gilt als versenkt.",
    balls: [...base(), pocketed(ball(6, ...HANG)), ball(9, ...SUPPORT)],
    steps: [
      { text: "Ausgangslage: Die 6 hängt am Rand der Ecktasche, nur die 9 hält sie.", focus: ["6", "9"] },
      { text: "Der Schiedsrichter prüft von oben: Würde die 6 fallen, wenn man die 9 wegnähme?", say: "Von oben prüfen", sayIcon: "mouth", focus: ["6", "9"] },
      { text: "Ja, die 6 würde fallen: Sie gilt als versenkt.", mark: { at: HANG, kind: "ok", delay: 200 } },
    ],
  },
  {
    label: "Fall B", verdict: "foul", verdictLabel: "Nicht versenkt – bleibt liegen",
    reason: "Die 6 liegt sicher auf dem Tuch und würde auch ohne die 9 nicht fallen: sie ist nicht versenkt und bleibt liegen.",
    balls: [...base(), ball(6, ...SAFE), ball(9, 187, 28)],
    steps: [
      { text: "Ausgangslage: Die 6 liegt nahe der Ecktasche, die 9 berührt sie.", focus: ["6", "9"] },
      { text: "Der Schiedsrichter prüft von oben: Würde die 6 fallen, wenn man die 9 wegnähme?", say: "Von oben prüfen", sayIcon: "mouth", focus: ["6", "9"] },
      { text: "Nein, die 6 liegt sicher auf dem Tuch: Sie ist nicht versenkt und bleibt liegen.", mark: { at: SAFE, kind: "foul", delay: 200 } },
    ],
  },
];

export default {
  id: "kugel-am-taschenrand",
  released: true,
  discs: ALL_DISCS,
  topic: "tisch",
  tags: ["tasche", "tisch"],
  ref: "2.2, OS19 3.32",
  keywords: ["Kugel an der Taschenkante", "Kugel hängt an der Tasche", "eingeklemmte Kugel", "von einer Kugel gestützt", "Kugel wackelt in der Tasche", "gilt als versenkt"],
  title: "Taschenrand: von oben prüfen",
  rule: "Hängt eine Kugel am Taschenrand und wird nur von einer anderen Kugel gehalten, entscheidet der Schiedsrichter von oben: Würde die Kugel fallen, sobald man die stützende Kugel wegnimmt, gilt sie als versenkt. Liegt sie sicher auf dem Tuch, ist sie nicht versenkt. Eine Kugel, die am Taschenrand fünf Sekunden oder länger scheinbar still liegt, gilt nicht als versenkt, auch wenn sie später fällt.",
  sets: [{ discs: ALL_DISCS, tag: "Kugel am Taschenrand", variants }],
};

export const en = {
  "Taschenrand: von oben prüfen": "Pocket edge: check from above",
  "Kugel am Taschenrand": "ball at the pocket edge",
  "Hängt eine Kugel am Taschenrand und wird nur von einer anderen Kugel gehalten, entscheidet der Schiedsrichter von oben: Würde die Kugel fallen, sobald man die stützende Kugel wegnimmt, gilt sie als versenkt. Liegt sie sicher auf dem Tuch, ist sie nicht versenkt. Eine Kugel, die am Taschenrand fünf Sekunden oder länger scheinbar still liegt, gilt nicht als versenkt, auch wenn sie später fällt.": "If a ball hangs at the pocket edge and is held only by another ball, the referee decides from above: if the ball would fall as soon as the supporting ball is removed, it counts as pocketed. If it lies safely on the cloth it is not pocketed. A ball that seems to rest at the pocket edge for five seconds or longer does not count as pocketed, even if it falls later.",
  "Kugel an der Taschenkante": "ball on the pocket edge",
  "Kugel hängt an der Tasche": "ball hanging at the pocket",
  "eingeklemmte Kugel": "jammed ball",
  "von einer Kugel gestützt": "supported by a ball",
  "Kugel wackelt in der Tasche": "ball wobbles in the pocket",
  "gilt als versenkt": "counts as pocketed",
  "Von oben prüfen": "Check from above",
  "Kugel gilt als versenkt": "Ball counts as pocketed",
  "Nicht versenkt – bleibt liegen": "Not pocketed – stays",
  "Die 6 würde fallen, sobald man die stützende 9 wegnimmt: sie gilt als versenkt.": "The 6 would fall as soon as the supporting 9 is removed: it counts as pocketed.",
  "Die 6 liegt sicher auf dem Tuch und würde auch ohne die 9 nicht fallen: sie ist nicht versenkt und bleibt liegen.": "The 6 lies safely on the cloth and would not fall even without the 9: it is not pocketed and stays.",
  "Ausgangslage: Die 6 hängt am Rand der Ecktasche, nur die 9 hält sie.": "Starting position: the 6 hangs at the edge of the corner pocket, only the 9 holds it.",
  "Der Schiedsrichter prüft von oben: Würde die 6 fallen, wenn man die 9 wegnähme?": "The referee checks from above: would the 6 fall if the 9 were removed?",
  "Ja, die 6 würde fallen: Sie gilt als versenkt.": "Yes, the 6 would fall: it counts as pocketed.",
  "Ausgangslage: Die 6 liegt nahe der Ecktasche, die 9 berührt sie.": "Starting position: the 6 lies near the corner pocket, the 9 touches it.",
  "Nein, die 6 liegt sicher auf dem Tuch: Sie ist nicht versenkt und bleibt liegen.": "No, the 6 lies safely on the cloth: it is not pocketed and stays.",
};
