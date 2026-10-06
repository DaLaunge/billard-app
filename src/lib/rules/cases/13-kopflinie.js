import { cue } from "../../ruleEngine.js";
import { D8, ALL_DISCS } from "../meta.js";
import { rack, brake, hitOf, R15, R9, R10 } from "../racks.js";

/* Anstoss: die Weisse liegt mit Ball in Hand im Kopffeld. Fall A: genau AUF der
   Kopflinie (Foul), Fall B: dahinter (ok). Der Anstoss selbst ist in beiden Faellen
   ein regelgerechter Break (Weisse trifft die Spitze, vier Kugeln bzw. beim 14/1 die
   Weisse und zwei Kugeln laufen an die Bande) - gezeigt wird nur EIN Fehler: der
   Ausgangsort der Weissen. */
const onWall = (m) => m.id !== "w" && (m.to[0] >= 204.4 || m.to[0] <= 15.6 || m.to[1] <= 15.6 || m.to[1] >= 104.4);

const build = (rows, rails, startText, fourteenOne = false) => {
  const balls = rack(rows).map((b) => ({ id: String(b.n), n: b.n, x: b.p[0], y: b.p[1] }));
  const moves = brake(rows, rack(rows), rails);
  if (moves.filter(onWall).length !== rails.length) throw new Error("Kopflinie: Bandenzahl des Anstosses stimmt nicht");
  // 14/1: die Weisse laeuft zusaetzlich zurueck zur Kopfbande (Weisse + zwei Kugeln je an eine Bande)
  if (fourteenOne) moves[0] = { id: "w", via: [hitOf(rows)], to: [15.5, 60], stop: true };
  const mk = (label, verdict, wx, reason, text) => ({
    label, verdict, reason,
    table: { headLine: true },
    balls: [cue(wx, 60), ...balls],
    steps: [
      { text: startText },
      { text, aim: [[wx, 60], hitOf(rows)] },
      {
        text: verdict === "foul" ? "Der Stoß beginnt von der Kopflinie aus – Foul, obwohl der Anstoß sonst regelgerecht ist." : "Der Stoß beginnt hinter der Kopflinie – regelgerecht.",
        expectRail: true,
        moves,
        mark: { at: [wx, 60], kind: verdict === "foul" ? "foul" : "ok", delay: 0 },
      },
    ],
  });
  return [
    mk("Fall A", "foul", 60, "Die Weiße lag genau auf der Kopflinie.", "Die Weiße liegt genau auf der Kopflinie."),
    mk("Fall B", "ok", 42, "Die Weiße lag im Kopffeld hinter der Kopflinie.", "Die Weiße liegt hinter der Kopflinie."),
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
    { discs: D8, tag: "8-Ball-Dreieck", variants: build(R15, [11, 6, 15, 12], start) },
    { discs: ["9 Ball"], tag: "9-Ball-Raute", variants: build(R9, [4, 5, 7, 8], start) },
    { discs: ["10 Ball"], tag: "10-Ball-Dreieck", variants: build(R10, [6, 9, 8, 2], start) },
    { discs: ["14/1 Endlos"], tag: "14/1 · Eröffnungsstoß", variants: build(R15, [11, 6], start, true) },
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
  "Der Stoß beginnt von der Kopflinie aus – Foul, obwohl der Anstoß sonst regelgerecht ist.": "The shot starts from the head string – foul, although the break is otherwise legal.",
  "Der Stoß beginnt hinter der Kopflinie – regelgerecht.": "The shot starts behind the head string – legal.",
};
