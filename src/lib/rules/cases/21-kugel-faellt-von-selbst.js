import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, D141, ALL_DISCS, tagSets } from "../meta.js";

/* Eine Kugel am Taschenrand faellt von selbst, waehrend die Weisse auf sie zuläuft.
   Fall A: sie faellt VOR dem Treffer - der Stoss wird wiederholt, alle Kugeln werden
   zurueckgelegt. Fall B: sie faellt durch den Treffer - normal versenkt. */
const W = [70, 82], LIP = [202, 17], POCKET = [207, 12.5], P9 = [150, 70];
const hit = cut(W, { id: "4", at: LIP }, POCKET, { out: true });

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "Stoß wird wiederholt",
    reason: "Die 4 ist ohne Stoßeinwirkung gefallen, bevor die Weiße sie traf: der Stoß wird wiederholt.",
    balls: [cue(...W), ball(4, ...LIP), ball(9, ...P9)],
    steps: [
      { text: "Ausgangslage: Die 4 liegt seit einiger Zeit ruhig am Taschenrand. Die Weiße wird auf sie gespielt.", focus: ["4"], aim: [W, LIP] },
      {
        text: "Noch bevor die Weiße ankommt, fällt die 4 von selbst in die Tasche. Die Weiße läuft ins Leere.",
        moves: [{ id: "w", to: [186, 27] }, { id: "4", to: POCKET, out: true, delay: 500 }],
      },
      {
        text: "Der Schiedsrichter legt Weiße und 4 an ihre alten Plätze zurück, der Stoß wird wiederholt.",
        say: "Stoß wiederholen", sayIcon: "mouth",
        moves: [{ id: "w", to: W, place: true }, { id: "4", to: LIP, place: true, delay: 150 }],
      },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Versenkt, Spieler spielt weiter",
    reason: "Die 4 fällt durch den Treffer der Weißen: sie gilt als regelgerecht versenkt.",
    balls: [cue(...W), ball(4, ...LIP), ball(9, ...P9)],
    steps: [
      { text: "Ausgangslage: Die 4 liegt am Taschenrand. Die Weiße wird auf sie gespielt.", focus: ["4"], aim: [W, LIP] },
      { text: "Die Weiße trifft die 4, sie fällt durch den Stoß in die Tasche – regelgerecht versenkt.", expectRail: true, moves: [hit.w, hit.obj], mark: { at: [200, 19], kind: "ok", after: "w", delay: 200 } },
    ],
  },
];

export default {
  id: "kugel-faellt-von-selbst",
  released: true,
  discs: ALL_DISCS,
  topic: "tisch",
  tags: ["tasche", "ablauf"],
  ref: "1.8, 2.2",
  keywords: ["fällt von selbst", "ohne Stoß gefallen", "Kugel fällt allein", "Stoß wiederholen", "Kugel fällt vor dem Treffer", "plötzlich bewegt"],
  title: "Kugel fällt von selbst",
  rule: "Bewegt sich eine Kugel von selbst oder fällt sie ohne Stoßeinwirkung (zum Beispiel vom Taschenrand), nachdem sie mindestens fünf Sekunden ruhig lag, wird sie so genau wie möglich zurückgelegt (siehe auch Kugel am Taschenrand). Fällt eine Kugel ohne Stoßeinwirkung, während die Weiße gerade auf sie gespielt wird und deshalb nicht mehr treffen kann, werden Weiße, diese Kugel und jede Kugel, die durch den Stoß bewegt wurde, zurückgelegt und der Stoß wird wiederholt. Fällt die Kugel erst durch den Treffer der Weißen, ist sie ganz normal versenkt.",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 4"],
    [D8, "Du spielst Volle"],
    [D141, "14/1 · Ansage: 4"],
  ]),
};

export const en = {
  "Kugel fällt von selbst": "Ball falls by itself",
  "Bewegt sich eine Kugel von selbst oder fällt sie ohne Stoßeinwirkung (zum Beispiel vom Taschenrand), nachdem sie mindestens fünf Sekunden ruhig lag, wird sie so genau wie möglich zurückgelegt (siehe auch Kugel am Taschenrand). Fällt eine Kugel ohne Stoßeinwirkung, während die Weiße gerade auf sie gespielt wird und deshalb nicht mehr treffen kann, werden Weiße, diese Kugel und jede Kugel, die durch den Stoß bewegt wurde, zurückgelegt und der Stoß wird wiederholt. Fällt die Kugel erst durch den Treffer der Weißen, ist sie ganz normal versenkt.":
    "If a ball moves by itself or falls without being hit (for example off the pocket edge) after having been at rest for at least five seconds, it is placed back as exactly as possible (see also ball on the pocket edge). If a ball falls without being hit while the cue ball is being played at it and can therefore no longer hit it, the cue ball, that ball and every ball moved by the shot are put back and the shot is replayed. If the ball only falls because the cue ball hits it, it is simply pocketed.",
  "fällt von selbst": "falls by itself",
  "ohne Stoß gefallen": "fell without a shot",
  "Kugel fällt allein": "ball falls on its own",
  "Stoß wiederholen": "replay the shot",
  "Kugel fällt vor dem Treffer": "ball falls before contact",
  "plötzlich bewegt": "suddenly moved",
  "Niedrigste Kugel: 4": "Lowest ball: 4",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 4": "14.1 · call: 4",
  "Stoß wird wiederholt": "Shot is replayed",
  "Versenkt, Spieler spielt weiter": "Pocketed, player continues",
  "Die 4 ist ohne Stoßeinwirkung gefallen, bevor die Weiße sie traf: der Stoß wird wiederholt.": "The 4 fell without being hit before the cue ball reached it: the shot is replayed.",
  "Die 4 fällt durch den Treffer der Weißen: sie gilt als regelgerecht versenkt.": "The 4 falls because the cue ball hits it: it counts as legally pocketed.",
  "Ausgangslage: Die 4 liegt seit einiger Zeit ruhig am Taschenrand. Die Weiße wird auf sie gespielt.": "Starting position: the 4 has been resting on the pocket edge for some time. The cue ball is played at it.",
  "Noch bevor die Weiße ankommt, fällt die 4 von selbst in die Tasche. Die Weiße läuft ins Leere.": "Before the cue ball arrives, the 4 falls into the pocket by itself. The cue ball runs into nothing.",
  "Der Schiedsrichter legt Weiße und 4 an ihre alten Plätze zurück, der Stoß wird wiederholt.": "The referee puts the cue ball and the 4 back in their old places, the shot is replayed.",
  "Ausgangslage: Die 4 liegt am Taschenrand. Die Weiße wird auf sie gespielt.": "Starting position: the 4 lies on the pocket edge. The cue ball is played at it.",
  "Die Weiße trifft die 4, sie fällt durch den Stoß in die Tasche – regelgerecht versenkt.": "The cue ball hits the 4, it falls into the pocket because of the shot – legally pocketed.",
};
