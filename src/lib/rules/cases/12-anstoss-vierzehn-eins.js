import { cue } from "../../ruleEngine.js";
import { D141 } from "../meta.js";
import { rack, brake, R15, W, HIT } from "../racks.js";

/* 14/1: Wird beim Eroeffnungsstoss keine angesagte Kugel versenkt, muessen die
   Weisse UND zwei Objektkugeln nach dem Kontakt mit dem Rack je eine Bande
   anlaufen. Die Weisse laeuft hier mit Rueckläufer zur Kopfbande zurueck. */
const balls = rack(R15);
const start = () => [cue(...W), ...balls.map((b) => ({ id: String(b.n), n: b.n, x: b.p[0], y: b.p[1] }))];
const onWall = (m) => m.id !== "w" && (m.to[0] >= 204.4 || m.to[0] <= 15.6 || m.to[1] <= 15.6 || m.to[1] >= 104.4);
const moves = (rails, wantObjects) => {
  const m = brake(R15, balls, rails);
  if (m.filter(onWall).length !== wantObjects) throw new Error("14/1-Anstoss: falsche Zahl Kugeln an der Bande");
  // Die Weisse laeuft mit Rueckläufer von der Spitze zurueck zur Kopfbande.
  m[0] = { id: "w", via: [HIT], to: [15.5, 60], stop: true };
  return m;
};

const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Anstoßfoul (−2)",
    reason: "Nur eine Objektkugel läuft an die Bande, es müssen zwei sein.",
    balls: start(),
    steps: [
      { text: "Ausgangslage: Eröffnungsstoß. Es wird keine angesagte Kugel versenkt." },
      { text: "Die Weiße bricht das Rack und läuft zurück.", aim: [W, HIT] },
      { text: "Die Weiße läuft an die Bande, aber nur eine Objektkugel erreicht eine Bande – Anstoßfoul.", moves: moves([11], 1), mark: { at: [176, 60], kind: "foul", after: "w", delay: 450 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok",
    reason: "Die Weiße und zwei Objektkugeln laufen je an eine Bande.",
    balls: start(),
    steps: [
      { text: "Ausgangslage: Eröffnungsstoß. Es wird keine angesagte Kugel versenkt." },
      { text: "Die Weiße bricht das Rack und läuft zurück.", aim: [W, HIT] },
      { text: "Die Weiße und zwei Objektkugeln erreichen je eine Bande – regelgerecht.", moves: moves([11, 6], 2), mark: { at: [176, 60], kind: "ok", after: "w", delay: 450 } },
    ],
  },
];

export default {
  id: "anstoss-vierzehn-eins",
  released: false,
  discs: D141,
  topic: "anstoss",
  ref: "7.3, 7.10, 7.11",
  keywords: ["Eröffnungsstoß", "Anstoßfoul", "Break", "zwei Kugeln", "zwei Punkte Abzug", "Rack"],
  title: "14/1: Eröffnungsstoß",
  rule: "Wird beim Eröffnungsstoß keine angesagte Kugel versenkt, müssen nach dem Kontakt mit dem Rack die Weiße und zwei Objektkugeln je eine Bande anlaufen. Sonst ist es ein Anstoßfoul: 2 Punkte Abzug, und der Gegner übernimmt die Lage oder lässt den Spieler erneut anstoßen. Ein Anstoßfoul zählt nicht für die Drei-Foul-Regel.",
  sets: [{ discs: D141, tag: "14/1 · Eröffnungsstoß", variants }],
};

export const en = {
  "14/1: Eröffnungsstoß": "14.1: opening break",
  "Wird beim Eröffnungsstoß keine angesagte Kugel versenkt, müssen nach dem Kontakt mit dem Rack die Weiße und zwei Objektkugeln je eine Bande anlaufen. Sonst ist es ein Anstoßfoul: 2 Punkte Abzug, und der Gegner übernimmt die Lage oder lässt den Spieler erneut anstoßen. Ein Anstoßfoul zählt nicht für die Drei-Foul-Regel.":
    "If no called ball is pocketed on the opening break, the cue ball and two object balls must each reach a cushion after contact with the rack. Otherwise it is a break foul: 2 points are deducted, and the opponent accepts the position or has the player break again. A break foul does not count towards the three-foul rule.",
  "Eröffnungsstoß": "opening break",
  "Anstoßfoul": "break foul",
  "Break": "Break",
  "zwei Kugeln": "two balls",
  "zwei Punkte Abzug": "two points deducted",
  "Rack": "Rack",
  "14/1 · Eröffnungsstoß": "14.1 · opening break",
  "Anstoßfoul (−2)": "Break foul (−2)",
  "Nur eine Objektkugel läuft an die Bande, es müssen zwei sein.": "Only one object ball reaches a cushion, it must be two.",
  "Die Weiße und zwei Objektkugeln laufen je an eine Bande.": "The cue ball and two object balls each reach a cushion.",
  "Ausgangslage: Eröffnungsstoß. Es wird keine angesagte Kugel versenkt.": "Starting position: opening break. No called ball is pocketed.",
  "Die Weiße bricht das Rack und läuft zurück.": "The cue ball breaks the rack and runs back.",
  "Die Weiße läuft an die Bande, aber nur eine Objektkugel erreicht eine Bande – Anstoßfoul.": "The cue ball reaches a cushion, but only one object ball does – break foul.",
  "Die Weiße und zwei Objektkugeln erreichen je eine Bande – regelgerecht.": "The cue ball and two object balls each reach a cushion – legal.",
};
