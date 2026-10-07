import { cue, ball, CLOCK_MS } from "../../ruleEngine.js";
import { ALL_DISCS } from "../meta.js";

/* Eine Kugel bleibt am Rand der Ecktasche haengen. Bleibt sie fuenf Sekunden oder
   laenger scheinbar bewegungslos liegen, gilt sie nicht als versenkt, auch wenn
   sie spaeter von selbst faellt. */
const LIP = [202, 17], POCKET = [207, 12.5];
const balls = () => [cue(80, 82), ball(4, ...LIP), ball(9, 150, 50)];

const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Nicht versenkt",
    reason: "Die Kugel lag fünf Sekunden still, sie gilt nicht als versenkt.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Die 4 bleibt am Rand der Ecktasche liegen. Die Uhr läuft.", focus: ["4"], clock: { to: 0 } },
      { text: "Fünf Sekunden vergehen, die Kugel bewegt sich nicht.", clock: { to: 5 } },
      { text: "Jetzt fällt sie doch noch in die Tasche …", clock: { to: 7 }, moves: [{ id: "4", to: POCKET, out: true, delay: 2 * CLOCK_MS }] },
      { text: "… gilt aber nicht als versenkt und wird so nah wie möglich an ihrer letzten Position zurückgelegt.", moves: [{ id: "4", to: LIP }], mark: { at: LIP, kind: "foul", delay: 500 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Versenkt",
    reason: "Die Kugel ist gefallen, bevor fünf Sekunden vergangen waren.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Die 4 bleibt am Rand der Ecktasche liegen. Die Uhr läuft.", focus: ["4"], clock: { to: 0 } },
      { text: "Nach zwei Sekunden fällt die Kugel in die Tasche – versenkt.", clock: { to: 2 }, moves: [{ id: "4", to: POCKET, out: true, delay: 2 * CLOCK_MS }], mark: { at: LIP, kind: "ok", delay: 2 * CLOCK_MS + 500 } },
    ],
  },
];

export default {
  id: "taschenrand",
  released: true,
  discs: ALL_DISCS,
  topic: "bande",
  ref: "2.2, 1.8",
  keywords: ["Taschenrand", "Kugel hängt", "Kugel wackelt", "fünf Sekunden", "5 Sekunden", "versenkt", "Kugel fällt später", "am Loch"],
  title: "Kugel hängt am Taschenrand",
  rule: "Läuft eine Kugel an den Rand einer Tasche und bleibt dort scheinbar bewegungslos fünf Sekunden oder länger liegen, gilt sie nicht als versenkt – auch wenn sie später von allein hineinfällt. Fällt sie schon innerhalb dieser Zeit, ist sie versenkt. In den fünf Sekunden darf kein weiterer Stoß ausgeführt werden. Fällt eine Kugel nach dieser Zeit doch, wird sie so nah wie möglich an ihrer letzten Position zurückgelegt.",
  sets: [{ discs: ALL_DISCS, variants }],
};

export const en = {
  "Kugel hängt am Taschenrand": "Ball hangs on the pocket edge",
  "Läuft eine Kugel an den Rand einer Tasche und bleibt dort scheinbar bewegungslos fünf Sekunden oder länger liegen, gilt sie nicht als versenkt – auch wenn sie später von allein hineinfällt. Fällt sie schon innerhalb dieser Zeit, ist sie versenkt. In den fünf Sekunden darf kein weiterer Stoß ausgeführt werden. Fällt eine Kugel nach dieser Zeit doch, wird sie so nah wie möglich an ihrer letzten Position zurückgelegt.":
    "If a ball runs to the edge of a pocket and stays there apparently motionless for five seconds or longer, it does not count as pocketed – even if it later falls in by itself. If it falls within that time it is pocketed. No further shot may be played during the five seconds. If a ball does fall after that time it is placed back as near as possible to its last position.",
  "Taschenrand": "pocket edge",
  "Kugel hängt": "ball hanging",
  "Kugel wackelt": "ball wobbles",
  "fünf Sekunden": "five seconds",
  "5 Sekunden": "5 seconds",
  "versenkt": "pocketed",
  "Kugel fällt später": "ball falls later",
  "am Loch": "at the hole",
  "Nicht versenkt": "Not pocketed",
  "Versenkt": "Pocketed",
  "Die Kugel lag fünf Sekunden still, sie gilt nicht als versenkt.": "The ball lay still for five seconds, it does not count as pocketed.",
  "Die Kugel ist gefallen, bevor fünf Sekunden vergangen waren.": "The ball fell before five seconds had passed.",
  "Ausgangslage: Die 4 bleibt am Rand der Ecktasche liegen. Die Uhr läuft.": "Starting position: the 4 stays on the edge of the corner pocket. The clock is running.",
  "Fünf Sekunden vergehen, die Kugel bewegt sich nicht.": "Five seconds pass, the ball does not move.",
  "Jetzt fällt sie doch noch in die Tasche …": "Now it does fall into the pocket after all …",
  "… gilt aber nicht als versenkt und wird so nah wie möglich an ihrer letzten Position zurückgelegt.": "… but does not count as pocketed and is placed back as near as possible to its last position.",
  "Nach zwei Sekunden fällt die Kugel in die Tasche – versenkt.": "After two seconds the ball falls into the pocket – pocketed.",
};
