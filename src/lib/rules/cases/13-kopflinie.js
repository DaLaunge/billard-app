import { cue } from "../../ruleEngine.js";
import { D8, ALL_DISCS } from "../meta.js";
import { rack, R15, R9, R10, HIT } from "../racks.js";

/* Anstoss: die Weisse liegt mit Ball in Hand im Kopffeld. Fall A: genau AUF der
   Kopflinie (Foul), Fall B: dahinter (ok). Das Rack bleibt stehen, die Weisse
   rollt nur zur Spitze - es geht um den Ausgangsort. */
const build = (rows, startText) => {
  const balls = rack(rows).map((b) => ({ id: String(b.n), n: b.n, x: b.p[0], y: b.p[1] }));
  const mk = (label, verdict, wx, reason, markKind, text) => ({
    label, verdict, reason,
    table: { headLine: true },
    balls: [cue(wx, 60), ...balls],
    steps: [
      { text: startText },
      { text, aim: [[wx, 60], HIT] },
      { text: verdict === "foul" ? "Der Stoß beginnt von der Kopflinie aus – Foul." : "Der Stoß beginnt hinter der Kopflinie – regelgerecht.", moves: [{ id: "w", to: HIT }], mark: { at: [wx, 60], kind: markKind, delay: 0 } },
    ],
  });
  return [
    mk("Fall A", "foul", 60, "Die Weiße lag genau auf der Kopflinie.", "foul", "Die Weiße liegt genau auf der Kopflinie."),
    mk("Fall B", "ok", 42, "Die Weiße lag im Kopffeld hinter der Kopflinie.", "ok", "Die Weiße liegt hinter der Kopflinie."),
  ];
};

const start = "Ausgangslage: Anstoß. Die Weiße muss im Kopffeld liegen, also hinter der Kopflinie.";

export default {
  id: "kopflinie",
  released: false,
  discs: ALL_DISCS,
  topic: "weisse",
  ref: "3.10, 1.6",
  keywords: ["Kopflinie", "Kopffeld", "Weiße legen", "falsch positioniert", "Anstoß Weiße", "Ball in Hand Anstoß"],
  title: "Anstoß: Weiße auf der Kopflinie",
  rule: "Muss die Weiße mit Ball in Hand aus dem Kopffeld gespielt werden (zum Beispiel beim Anstoß), ist es ein Foul, sie genau auf der Kopflinie oder davor zu spielen. Im Zweifel kann der Spieler vor dem Stoß den Schiedsrichter bitten, die Lage zu prüfen. Das Kopffeld ist der Bereich zwischen Kopfbande und Kopflinie, die Linie selbst gehört nicht dazu.",
  sets: [
    { discs: D8, tag: "8-Ball-Dreieck", variants: build(R15, start) },
    { discs: ["9 Ball"], tag: "9-Ball-Raute", variants: build(R9, start) },
    { discs: ["10 Ball"], tag: "10-Ball-Dreieck", variants: build(R10, start) },
    { discs: ["14/1 Endlos"], tag: "14/1 · Eröffnungsstoß", variants: build(R15, start) },
  ],
};

export const en = {
  "Anstoß: Weiße auf der Kopflinie": "Break: cue ball on the head string",
  "Muss die Weiße mit Ball in Hand aus dem Kopffeld gespielt werden (zum Beispiel beim Anstoß), ist es ein Foul, sie genau auf der Kopflinie oder davor zu spielen. Im Zweifel kann der Spieler vor dem Stoß den Schiedsrichter bitten, die Lage zu prüfen. Das Kopffeld ist der Bereich zwischen Kopfbande und Kopflinie, die Linie selbst gehört nicht dazu.":
    "If the cue ball has to be played from the kitchen with ball in hand (for example on the break), playing it from exactly on the head string or in front of it is a foul. If in doubt the player may ask the referee to check the position before the shot. The kitchen is the area between the head cushion and the head string; the line itself is not part of it.",
  "Kopflinie": "head string",
  "Kopffeld": "kitchen",
  "Weiße legen": "placing the cue ball",
  "falsch positioniert": "wrongly placed",
  "Anstoß Weiße": "break cue ball",
  "Ball in Hand Anstoß": "ball in hand break",
  "8-Ball-Dreieck": "8-ball triangle",
  "9-Ball-Raute": "9-ball diamond",
  "10-Ball-Dreieck": "10-ball triangle",
  "14/1 · Eröffnungsstoß": "14.1 · opening break",
  "Die Weiße lag genau auf der Kopflinie.": "The cue ball lay exactly on the head string.",
  "Die Weiße lag im Kopffeld hinter der Kopflinie.": "The cue ball lay in the kitchen behind the head string.",
  "Ausgangslage: Anstoß. Die Weiße muss im Kopffeld liegen, also hinter der Kopflinie.": "Starting position: break. The cue ball must lie in the kitchen, i.e. behind the head string.",
  "Die Weiße liegt genau auf der Kopflinie.": "The cue ball lies exactly on the head string.",
  "Die Weiße liegt hinter der Kopflinie.": "The cue ball lies behind the head string.",
  "Der Stoß beginnt von der Kopflinie aus – Foul.": "The shot starts from the head string – foul.",
  "Der Stoß beginnt hinter der Kopflinie – regelgerecht.": "The shot starts behind the head string – legal.",
};
