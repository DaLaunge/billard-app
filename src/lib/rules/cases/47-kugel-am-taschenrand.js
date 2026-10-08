import { cue, ball } from "../../ruleEngine.js";
import { ALL_DISCS } from "../meta.js";

/* OS19 3.32 / Regel 2.2: Zwei Kugeln klemmen zusammen im Maul der Tasche (so entsteht es in der Praxis: zwei
   Kugeln wollen gleichzeitig in dieselbe Tasche). Keine kann ohne die andere fallen. Der Schiedsrichter sieht von
   oben auf die Lage und fragt je Kugel: Fiele sie, wenn man die andere wegnaehme? Dann gilt sie als versenkt.
   Fall A: beide Mittelpunkte liegen ueber der Taschenoeffnung - beide Kugeln gelten als versenkt.
   Fall B: nur der Mittelpunkt der 6 liegt ueber der Oeffnung, die 9 liegt mit dem Mittelpunkt auf dem Tuch an
   der Bande - nur die 6 gilt als versenkt, die 9 bleibt liegen. Statische Lage, es wird nicht gestossen.
   Seitentasche oben Mitte: Mittelpunkt (110, 8), Oeffnung etwa x 103.5 .. 116.5. */
const pocketed = (b) => ({ ...b, pocketed: true });
const base = () => [cue(60, 80), ball(12, 70, 40)];
const A6 = [104.6, 12.3], A9 = [115.4, 12.3];
const B6 = [107.5, 11.5], B9 = [119.5, 15.5];

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "Beide Kugeln gelten als versenkt",
    reason: "Beide Kugeln klemmen im Maul der Tasche: jede würde fallen, sobald man die andere wegnimmt. Beide gelten als versenkt.",
    balls: [...base(), pocketed(ball(6, ...A6)), pocketed(ball(9, ...A9))],
    steps: [
      { text: "Ausgangslage: Zwei Kugeln, die 6 und die 9, klemmen nebeneinander im Maul der Mitteltasche fest.", focus: ["6", "9"] },
      { text: "Der Schiedsrichter prüft von oben: Würde die 6 fallen, wenn man die 9 wegnähme? Und die 9, wenn man die 6 wegnähme?", say: "Von oben prüfen", sayIcon: "mouth", focus: ["6", "9"] },
      { text: "Beide Mittelpunkte liegen über der Taschenöffnung: beide würden fallen. Beide Kugeln gelten als versenkt.", mark: { at: [110, 12.3], kind: "ok", delay: 200 } },
    ],
  },
  {
    label: "Fall B", verdict: "foul", verdictLabel: "Nur die 6 gilt als versenkt",
    reason: "Nur der Mittelpunkt der 6 liegt über der Taschenöffnung. Die 9 liegt sicher auf dem Tuch an der Bande und würde auch ohne die 6 nicht fallen: sie bleibt liegen.",
    balls: [...base(), pocketed(ball(6, ...B6)), ball(9, ...B9)],
    steps: [
      { text: "Ausgangslage: Die 6 und die 9 liegen nebeneinander am Maul der Mitteltasche, die 6 hängt über der Öffnung.", focus: ["6", "9"] },
      { text: "Der Schiedsrichter prüft von oben: Würde die 6 fallen, wenn man die 9 wegnähme? Und die 9, wenn man die 6 wegnähme?", say: "Von oben prüfen", sayIcon: "mouth", focus: ["6", "9"] },
      { text: "Die 6 würde fallen: sie gilt als versenkt. Die 9 liegt sicher auf dem Tuch und würde nicht fallen: sie bleibt liegen.", mark: { at: B6, kind: "ok", delay: 200 } },
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
  keywords: ["Kugeln in der Tasche eingeklemmt", "zwei Kugeln klemmen", "Kugel an der Taschenkante", "eingeklemmte Kugel", "von einer Kugel gestützt", "Kugel wackelt in der Tasche", "gilt als versenkt"],
  title: "Taschenrand: von oben prüfen",
  rule: "Oft klemmen zwei Kugeln gleichzeitig im Maul einer Tasche und halten sich gegenseitig. Der Schiedsrichter prüft von oben für jede Kugel, ob sie fallen würde, sobald man die andere wegnimmt: Dann gilt sie als versenkt. Liegt eine Kugel mit dem Mittelpunkt sicher auf dem Tuch, ist sie nicht versenkt und bleibt liegen. Eine Kugel, die am Taschenrand fünf Sekunden oder länger scheinbar still liegt, gilt nicht als versenkt, auch wenn sie später fällt.",
  sets: [{ discs: ALL_DISCS, tag: "Kugeln im Taschenmaul", variants }],
};

export const en = {
  "Taschenrand: von oben prüfen": "Pocket edge: check from above",
  "Oft klemmen zwei Kugeln gleichzeitig im Maul einer Tasche und halten sich gegenseitig. Der Schiedsrichter prüft von oben für jede Kugel, ob sie fallen würde, sobald man die andere wegnimmt: Dann gilt sie als versenkt. Liegt eine Kugel mit dem Mittelpunkt sicher auf dem Tuch, ist sie nicht versenkt und bleibt liegen. Eine Kugel, die am Taschenrand fünf Sekunden oder länger scheinbar still liegt, gilt nicht als versenkt, auch wenn sie später fällt.": "Often two balls jam in the mouth of a pocket at the same time and hold each other. The referee checks from above for each ball whether it would fall as soon as the other is removed: then it counts as pocketed. If the center of a ball lies safely on the cloth it is not pocketed and stays. A ball that seems to rest at the pocket edge for five seconds or longer does not count as pocketed, even if it falls later.",
  "Kugeln in der Tasche eingeklemmt": "balls jammed in the pocket",
  "zwei Kugeln klemmen": "two balls jam",
  "Kugel an der Taschenkante": "ball on the pocket edge",
  "eingeklemmte Kugel": "jammed ball",
  "von einer Kugel gestützt": "supported by a ball",
  "Kugel wackelt in der Tasche": "ball wobbles in the pocket",
  "gilt als versenkt": "counts as pocketed",
  "Kugeln im Taschenmaul": "Balls in the pocket mouth",
  "Von oben prüfen": "Check from above",
  "Beide Kugeln gelten als versenkt": "Both balls count as pocketed",
  "Nur die 6 gilt als versenkt": "Only the 6 counts as pocketed",
  "Beide Kugeln klemmen im Maul der Tasche: jede würde fallen, sobald man die andere wegnimmt. Beide gelten als versenkt.": "Both balls jam in the mouth of the pocket: each would fall as soon as the other is removed. Both count as pocketed.",
  "Nur der Mittelpunkt der 6 liegt über der Taschenöffnung. Die 9 liegt sicher auf dem Tuch an der Bande und würde auch ohne die 6 nicht fallen: sie bleibt liegen.": "Only the center of the 6 lies over the pocket opening. The 9 lies safely on the cloth at the cushion and would not fall even without the 6: it stays.",
  "Ausgangslage: Zwei Kugeln, die 6 und die 9, klemmen nebeneinander im Maul der Mitteltasche fest.": "Starting position: two balls, the 6 and the 9, are jammed side by side in the mouth of the side pocket.",
  "Der Schiedsrichter prüft von oben: Würde die 6 fallen, wenn man die 9 wegnähme? Und die 9, wenn man die 6 wegnähme?": "The referee checks from above: would the 6 fall if the 9 were removed? And the 9 if the 6 were removed?",
  "Beide Mittelpunkte liegen über der Taschenöffnung: beide würden fallen. Beide Kugeln gelten als versenkt.": "Both centers lie over the pocket opening: both would fall. Both balls count as pocketed.",
  "Ausgangslage: Die 6 und die 9 liegen nebeneinander am Maul der Mitteltasche, die 6 hängt über der Öffnung.": "Starting position: the 6 and the 9 lie side by side at the mouth of the side pocket, the 6 hangs over the opening.",
  "Die 6 würde fallen: sie gilt als versenkt. Die 9 liegt sicher auf dem Tuch und würde nicht fallen: sie bleibt liegen.": "The 6 would fall: it counts as pocketed. The 9 lies safely on the cloth and would not fall: it stays.",
};
