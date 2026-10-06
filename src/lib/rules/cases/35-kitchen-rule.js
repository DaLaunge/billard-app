import { cue } from "../../ruleEngine.js";
import { rack, brake, hitOf, R9, W } from "../racks.js";

/* 9 Ball, Drei-Punkte-Regel (Kitchen Rule, OEPBV 5.3 c, WPA-Regularien 18): Wird mit ihr gespielt,
   muessen beim Anstoss mindestens 3 Objektkugeln das Kopffeld erreichen (ihr Mittelpunkt muss
   JENSEITS der Kopflinie liegen) oder versenkt werden. Sonst ist es ein "Dry Break": der Gegner
   uebernimmt die Lage (kein Push Out) oder gibt sie zurueck (dann darf der Anstossende ein Push
   Out spielen). Der Anstoss selbst ist beide Male regelgerecht (vier Kugeln an der Bande);
   nur die Zahl der Kugeln im Kopffeld entscheidet. Die Kopffeld-Kugeln laufen in einem Winkel
   weit zurueck, die anderen verlassen das Rack radial wie bei jedem Anstoss. */
const balls = rack(R9);
const start = () => [cue(...W), ...balls.map((b) => ({ id: String(b.n), n: b.n, x: b.p[0], y: b.p[1] }))];
const HEAD_LINE = 60;
const inKitchen = (m) => m.id !== "w" && m.to[0] < HEAD_LINE - 0.5;

/* Die Kopffeld-Kugeln kommen nur ueber Banden dorthin: Kugel 2 und 3 verlassen das Rack in genau dem
   30-Grad-Winkel, in dem sie von ihren Nachbarn wegrollen koennen, und laufen ueber obere und untere
   Bande zurueck ins Kopffeld; die 8 laeuft ueber Fuss- und untere Bande. Jeder Knick ist eine
   Reflexion (Einfallswinkel = Ausfallswinkel). Kugel 4 laeuft gerade an die Bande. */
const run = {
  "2": [[128, 15.5], [76.6, 104.5], [44, 48]],
  "3": [[128, 104.5], [76.6, 15.5], [44, 72]],
  "8": [[204.5, 74.7], [152.9, 104.5], [36, 37]],
};
const moves = (kitchen) => {
  const m = brake(R9, balls, [4]).filter((x) => ["w", "4"].includes(x.id));
  const ids = kitchen === 3 ? ["2", "3", "8"] : ["2", "3"];
  ids.forEach((id, i) => {
    const pts = run[id];
    m.push({ id, via: pts.slice(0, -1), to: pts[pts.length - 1], after: "w", delay: id === "3" ? 400 : id === "8" ? 0 : 0 });
  });
  const n = m.filter(inKitchen).length;
  if (n !== kitchen) throw new Error(`Kitchen Rule: ${n} statt ${kitchen} Kugeln im Kopffeld`);
  return m;
};

const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Dry Break – Gegner wählt",
    reason: "Nur zwei Objektkugeln erreichen das Kopffeld, keine wird versenkt: Dry Break. Der Gegner übernimmt die Lage (kein Push Out) oder gibt sie zurück (dann darf der Anstoßende ein Push Out spielen).",
    table: { headLine: true },
    balls: start(),
    steps: [
      { text: "Ausgangslage: 9-Ball-Anstoß, es wird mit der Drei-Punkte-Regel (Kitchen Rule) gespielt. Es werden mindestens 3 Kugeln im Kopffeld verlangt." },
      { text: "Die Weiße bricht das Rack.", aim: [W, hitOf(R9)] },
      { text: "Vier Kugeln laufen an die Bande, aber nur zwei Kugeln kommen über die Kopflinie ins Kopffeld – Dry Break.", count: { label: "Kugeln im Kopffeld", n: 2, of: 3 }, moves: moves(2), mark: { at: [176, 60], kind: "foul", after: "w", delay: 450 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Anstoß gültig",
    reason: "Drei Objektkugeln erreichen das Kopffeld: die Drei-Punkte-Regel ist erfüllt.",
    table: { headLine: true },
    balls: start(),
    steps: [
      { text: "Ausgangslage: 9-Ball-Anstoß, es wird mit der Drei-Punkte-Regel (Kitchen Rule) gespielt. Es werden mindestens 3 Kugeln im Kopffeld verlangt." },
      { text: "Die Weiße bricht das Rack.", aim: [W, hitOf(R9)] },
      { text: "Vier Kugeln laufen an die Bande und drei Kugeln kommen über die Kopflinie ins Kopffeld – regelgerecht.", count: { label: "Kugeln im Kopffeld", n: 3, of: 3, good: true }, moves: moves(3), mark: { at: [176, 60], kind: "ok", after: "w", delay: 450 } },
    ],
  },
];

export default {
  id: "kitchen-rule",
  released: false,
  discs: ["9 Ball"],
  topic: "anstoss",
  ref: "5.3 c",
  keywords: ["Kitchen Rule", "Drei-Punkte-Regel", "3-Punkte-Regel", "Dry Break", "drei Kugeln im Kopffeld", "Kopflinie überschreiten", "Break ungültig"],
  title: "Kitchen Rule: drei Kugeln ins Kopffeld",
  rule: "Wird mit der Drei-Punkte-Regel (Kitchen Rule) gespielt, müssen beim Anstoß mindestens 3 Objektkugeln das Kopffeld erreichen oder versenkt werden; jede versenkte Kugel verringert die Zahl. Eine Kugel hat das Kopffeld erreicht, wenn ihr Mittelpunkt jenseits der Kopflinie liegt (ÖPBV; die WPA-Regularien verlangen, dass sie die Kopflinie berührt). Wird die Bedingung nicht erfüllt, ist es ein Dry Break, auch wenn der Anstoß sonst korrekt war: der Gegner übernimmt die Lage (dann ohne Push Out) oder gibt sie dem Anstoßenden zurück (der dann ein Push Out spielen darf). Eine beim Dry Break versenkte 9 wird wieder aufgebaut. Die Regel gilt nur, wenn sie vereinbart ist; auf WPA-Veranstaltungen wird sie gespielt.",
  sets: [{ discs: ["9 Ball"], tag: "9-Ball-Anstoß · Kitchen Rule", variants }],
};

export const en = {
  "Kitchen Rule: drei Kugeln ins Kopffeld": "Kitchen rule: three balls into the kitchen",
  "Wird mit der Drei-Punkte-Regel (Kitchen Rule) gespielt, müssen beim Anstoß mindestens 3 Objektkugeln das Kopffeld erreichen oder versenkt werden; jede versenkte Kugel verringert die Zahl. Eine Kugel hat das Kopffeld erreicht, wenn ihr Mittelpunkt jenseits der Kopflinie liegt (ÖPBV; die WPA-Regularien verlangen, dass sie die Kopflinie berührt). Wird die Bedingung nicht erfüllt, ist es ein Dry Break, auch wenn der Anstoß sonst korrekt war: der Gegner übernimmt die Lage (dann ohne Push Out) oder gibt sie dem Anstoßenden zurück (der dann ein Push Out spielen darf). Eine beim Dry Break versenkte 9 wird wieder aufgebaut. Die Regel gilt nur, wenn sie vereinbart ist; auf WPA-Veranstaltungen wird sie gespielt.":
    "If the three-point rule (kitchen rule) is played, at least 3 object balls must reach the kitchen or be pocketed on the break; every pocketed ball reduces the number. A ball has reached the kitchen when its center lies beyond the head string (ÖPBV; the WPA regulations require it to touch the head string). If the condition is not met it is a dry break even if the break was otherwise correct: the opponent accepts the position (then without a push out) or hands it back to the breaker (who may then play a push out). A 9 pocketed on a dry break is re-spotted. The rule only applies if agreed; it is played at WPA events.",
  "Kitchen Rule": "Kitchen rule",
  "Drei-Punkte-Regel": "three-point rule",
  "3-Punkte-Regel": "3-point rule",
  "Dry Break": "dry break",
  "drei Kugeln im Kopffeld": "three balls in the kitchen",
  "Kopflinie überschreiten": "cross the head string",
  "Break ungültig": "invalid break",
  "9-Ball-Anstoß · Kitchen Rule": "9-ball break · kitchen rule",
  "Kugeln im Kopffeld": "Balls in the kitchen",
  "Dry Break – Gegner wählt": "Dry break – opponent chooses",
  "Anstoß gültig": "Break valid",
  "Nur zwei Objektkugeln erreichen das Kopffeld, keine wird versenkt: Dry Break. Der Gegner übernimmt die Lage (kein Push Out) oder gibt sie zurück (dann darf der Anstoßende ein Push Out spielen).": "Only two object balls reach the kitchen, none is pocketed: dry break. The opponent accepts the position (no push out) or hands it back (then the breaker may play a push out).",
  "Drei Objektkugeln erreichen das Kopffeld: die Drei-Punkte-Regel ist erfüllt.": "Three object balls reach the kitchen: the three-point rule is met.",
  "Ausgangslage: 9-Ball-Anstoß, es wird mit der Drei-Punkte-Regel (Kitchen Rule) gespielt. Es werden mindestens 3 Kugeln im Kopffeld verlangt.": "Starting position: 9-ball break, played with the three-point rule (kitchen rule). At least 3 balls in the kitchen are required.",
  "Die Weiße bricht das Rack.": "The cue ball breaks the rack.",
  "Vier Kugeln laufen an die Bande, aber nur zwei Kugeln kommen über die Kopflinie ins Kopffeld – Dry Break.": "Four balls reach a cushion, but only two balls cross the head string into the kitchen – dry break.",
  "Vier Kugeln laufen an die Bande und drei Kugeln kommen über die Kopflinie ins Kopffeld – regelgerecht.": "Four balls reach a cushion and three balls cross the head string into the kitchen – legal.",
};
