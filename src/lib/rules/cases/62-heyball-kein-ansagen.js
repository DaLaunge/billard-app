import { cue, ball, cut } from "../../ruleEngine.js";
import { DHB, SOURCE_HEYBALL } from "../meta.js";

/* Heyball, kein Ansagen (WPA Rules of Heyball 11): Weder Kugel noch Tasche muessen angesagt werden, auch nicht
   fuer die 8 oder im Shootout; Flukes sind erlaubt. Dieselbe Stosssituation wie cases/29 (bekannte Geometrie).
   Fall A: eine Kugel faellt ohne Ansage - sie zaehlt. Fall B: die 8 faellt ohne Ansage, alle eigenen Kugeln sind
   versenkt - der Spieler gewinnt das Rack. */
const T = [150, 50], P = [207, 13], W = [91.2, 88.2];
const shot = cut(W, { id: "5", at: T }, P, { out: true });
const shot8 = cut(W, { id: "8", at: T }, P, { out: true });

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "Zählt ohne Ansage",
    reason: "Beim Heyball muss nichts angesagt werden: die Kugel zählt, auch wenn sie zufällig fällt.",
    tag: "Offener Tisch",
    balls: [cue(...W), ball(5, ...T), ball(12, 110, 95), ball(13, 60, 30), ball(2, 185, 95)],
    steps: [
      { text: "Ausgangslage: Der Spieler spielt ohne Ansage, es wird weder Kugel noch Tasche genannt.", focus: ["5"] },
      { text: "Die Weiße wird auf die 5 gespielt.", aim: [W, shot.contact] },
      { text: "Die 5 fällt in die Ecktasche – sie zählt, eine Ansage war nicht nötig.", expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: "ok", after: "w", delay: 300 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Rack gewonnen",
    reason: "Auch die 8 muss nicht angesagt werden: sie fällt regelgerecht, nachdem alle eigenen Kugeln versenkt sind.",
    tag: "Du spielst Volle · nur noch die 8",
    balls: [cue(...W), ball(8, ...T), ball(11, 110, 95), ball(13, 60, 30)],
    steps: [
      { text: "Ausgangslage: Alle Vollen sind versenkt, nur noch die 8 und zwei Halbe des Gegners liegen auf dem Tisch.", focus: ["8"] },
      { text: "Der Spieler spielt die 8, ohne Kugel oder Tasche anzusagen.", aim: [W, shot8.contact] },
      { text: "Die 8 fällt, ohne Foul – der Spieler gewinnt das Rack, auch ohne Ansage.", expectRail: true, moves: [shot8.w, shot8.obj], mark: { at: [200, 19], kind: "ok", after: "w", delay: 300 } },
    ],
  },
];

export default {
  id: "heyball-kein-ansagen",
  released: true,
  discs: DHB,
  src: SOURCE_HEYBALL,
  bookRef: "8.4",
  topic: "ablauf",
  tags: ["ansage", "tasche"],
  ref: "11",
  keywords: ["Ansage nötig", "ansagen", "Heyball ansagen", "Fluke", "Zufall", "Tasche ansagen", "ohne Ansage", "8 ansagen"],
  title: "Heyball: Kein Ansagen",
  rule: "Beim Heyball muss weder Kugel noch Tasche angesagt werden – auch nicht für die 8 oder im Shootout. Zufällig versenkte Kugeln zählen (Fluke erlaubt).",
  sets: [{ discs: DHB, variants }],
};

export const en = {
  "Heyball: Kein Ansagen": "Heyball: no calling",
  "Beim Heyball muss weder Kugel noch Tasche angesagt werden – auch nicht für die 8 oder im Shootout. Zufällig versenkte Kugeln zählen (Fluke erlaubt).": "In Heyball you do not have to call ball or pocket – not even for the 8 or in the shootout. Lucky pockets count (flukes are allowed).",
  "Ansage nötig": "call needed",
  "ansagen": "call",
  "Heyball ansagen": "Heyball calling",
  "Fluke": "fluke",
  "Zufall": "luck",
  "Tasche ansagen": "call pocket",
  "ohne Ansage": "without a call",
  "8 ansagen": "call the 8",
  "Offener Tisch": "Open table",
  "Du spielst Volle · nur noch die 8": "You play solids · only the 8 is left",
  "Zählt ohne Ansage": "Counts without a call",
  "Rack gewonnen": "Rack won",
  "Beim Heyball muss nichts angesagt werden: die Kugel zählt, auch wenn sie zufällig fällt.": "In Heyball nothing has to be called: the ball counts, even if it falls by luck.",
  "Auch die 8 muss nicht angesagt werden: sie fällt regelgerecht, nachdem alle eigenen Kugeln versenkt sind.": "The 8 does not have to be called either: it falls legally after all your own balls are pocketed.",
  "Ausgangslage: Der Spieler spielt ohne Ansage, es wird weder Kugel noch Tasche genannt.": "Starting position: the player shoots without a call, neither ball nor pocket is named.",
  "Die Weiße wird auf die 5 gespielt.": "The cue ball is played at the 5.",
  "Die 5 fällt in die Ecktasche – sie zählt, eine Ansage war nicht nötig.": "The 5 falls into the corner pocket – it counts, no call was needed.",
  "Ausgangslage: Alle Vollen sind versenkt, nur noch die 8 und zwei Halbe des Gegners liegen auf dem Tisch.": "Starting position: all solids are pocketed, only the 8 and two of the opponent's stripes are left on the table.",
  "Der Spieler spielt die 8, ohne Kugel oder Tasche anzusagen.": "The player plays the 8 without calling ball or pocket.",
  "Die 8 fällt, ohne Foul – der Spieler gewinnt das Rack, auch ohne Ansage.": "The 8 falls without a foul – the player wins the rack, even without a call.",
};
