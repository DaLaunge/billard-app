import { cue, ball, cut, along, clampTable } from "../../ruleEngine.js";
import { DHB, SOURCE_HEYBALL } from "../meta.js";

/* Heyball, gleichzeitiger Treffer (WPA Rules of Heyball 13): Ist bei einer erlaubten und einer nicht erlaubten Kugel
   nicht zu erkennen, welche zuerst getroffen wurde, gilt die erlaubte Kugel als zuerst getroffen. Dieselbe Geometrie
   wie cases/04 (Fall A: Weisse trifft genau zwischen zwei Kugeln, Fall B: die falsche Kugel liegt erkennbar vorn). */
const W = [60, 60];
const A1 = [130, 54.5], A2 = [130, 65.5];
const F = [125, 62], S = [150, 56];
const legal = "2", other = "11";

const hitA = [120.47, 60];
const dirUp = [A1[0] + 9.53, A1[1] - 5.5], dirDown = [A2[0] + 9.53, A2[1] + 5.5];
const toL = clampTable(along(A1, dirUp, 90)), toO = clampTable(along(A2, dirDown, 90));
const c2 = cut(F, { id: legal, at: S }, [204.5, 43], { striker: other });
const c1 = cut(W, { id: other, at: F }, c2.contact);

const variants = [
  {
    label: "Fall A", verdict: "ok",
    reason: "Nicht zu erkennen, welche zuerst – im Zweifel gilt die eigene 2.",
    balls: [cue(...W), ball(Number(legal), ...A1), ball(Number(other), ...A2), ball(9, 95, 92)],
    steps: [
      { text: "Ausgangslage: Du spielst Volle. Deine 2 liegt direkt neben der 11 des Gegners.", focus: [legal] },
      { text: "Die Weiße zielt genau zwischen die beiden Kugeln.", aim: [W, [130, 60]] },
      {
        text: "Beide Kugeln werden gleichzeitig berührt. Im Zweifel gilt die erlaubte: deine 2.",
        expectRail: true,
        moves: [
          { id: "w", to: hitA, stop: true },
          { id: legal, to: toL, after: "w" },
          { id: other, to: toO, after: "w" },
        ],
        mark: { at: [130, 60], kind: "ok", after: "w" },
      },
    ],
  },
  {
    label: "Fall B", verdict: "foul",
    reason: "Die 11 des Gegners wurde erkennbar vor der 2 berührt.",
    balls: [cue(...W), ball(Number(legal), ...S), ball(Number(other), ...F), ball(9, 95, 92)],
    steps: [
      { text: "Ausgangslage: Du spielst Volle. Die 11 des Gegners liegt deutlich weiter vorn.", focus: [legal] },
      { text: "Die Weiße wird auf die 11 gespielt.", aim: [W, F] },
      {
        text: "Die Weiße trifft eindeutig zuerst die 11, erst danach läuft diese gegen die 2.",
        wrongFirst: true,
        expectRail: true,
        moves: [c1.w, { ...c2.w, after: "w" }, c2.obj],
        mark: { at: F, kind: "foul", after: "w" },
      },
    ],
  },
];

export default {
  id: "heyball-gleichzeitiger-treffer",
  released: true,
  discs: DHB,
  src: SOURCE_HEYBALL,
  bookRef: "8.6",
  topic: "kontakt",
  tags: ["foul", "erstkontakt"],
  ref: "13, 10.4",
  keywords: ["Heyball gleichzeitig", "gleichzeitig getroffen", "zwei Kugeln gleichzeitig", "welche zuerst", "Doppeltreffer", "im Zweifel", "erlaubte Kugel zuerst"],
  title: "Heyball: Gleichzeitiger Treffer",
  rule: "Berührt die Weiße eine erlaubte und eine nicht erlaubte Kugel fast gleichzeitig und ist nicht zu erkennen, welche zuerst getroffen wurde, gilt die erlaubte Kugel als zuerst getroffen – kein Foul. Wird die nicht erlaubte Kugel erkennbar zuerst berührt, ist es ein Foul. Bei offenem Tisch: Berührt die Weiße zwei Kugeln verschiedener Gruppen gleichzeitig und fallen beide (oder Kugeln beider Gruppen), darf der Spieler eine Gruppe wählen; der nächste Spieler bekommt dann die andere.",
  sets: [{ discs: DHB, tag: "Du spielst Volle", variants }],
};

export const en = {
  "Heyball: Gleichzeitiger Treffer": "Heyball: simultaneous contact",
  "Berührt die Weiße eine erlaubte und eine nicht erlaubte Kugel fast gleichzeitig und ist nicht zu erkennen, welche zuerst getroffen wurde, gilt die erlaubte Kugel als zuerst getroffen – kein Foul. Wird die nicht erlaubte Kugel erkennbar zuerst berührt, ist es ein Foul. Bei offenem Tisch: Berührt die Weiße zwei Kugeln verschiedener Gruppen gleichzeitig und fallen beide (oder Kugeln beider Gruppen), darf der Spieler eine Gruppe wählen; der nächste Spieler bekommt dann die andere.":
    "If the cue ball touches a legal and an illegal ball almost simultaneously and it cannot be seen which was hit first, the legal ball is assumed to have been hit first – no foul. If the illegal ball is clearly touched first, it is a foul. On an open table: if the cue ball touches two balls of different groups simultaneously and both (or balls of both groups) are pocketed, the player may choose a group; the next player then gets the other group.",
  "Heyball gleichzeitig": "Heyball simultaneous",
  "gleichzeitig getroffen": "hit simultaneously",
  "zwei Kugeln gleichzeitig": "two balls at once",
  "welche zuerst": "which first",
  "Doppeltreffer": "double hit",
  "im Zweifel": "in doubt",
  "erlaubte Kugel zuerst": "legal ball first",
  "Du spielst Volle": "You play solids",
  "Nicht zu erkennen, welche zuerst – im Zweifel gilt die eigene 2.": "Cannot be told which came first – in doubt your own 2 counts.",
  "Die 11 des Gegners wurde erkennbar vor der 2 berührt.": "The opponent's 11 was clearly touched before the 2.",
  "Ausgangslage: Du spielst Volle. Deine 2 liegt direkt neben der 11 des Gegners.": "Starting position: you play solids. Your 2 lies right next to the opponent's 11.",
  "Die Weiße zielt genau zwischen die beiden Kugeln.": "The cue ball aims exactly between the two balls.",
  "Beide Kugeln werden gleichzeitig berührt. Im Zweifel gilt die erlaubte: deine 2.": "Both balls are touched simultaneously. In doubt the legal one counts: your 2.",
  "Ausgangslage: Du spielst Volle. Die 11 des Gegners liegt deutlich weiter vorn.": "Starting position: you play solids. The opponent's 11 lies clearly further ahead.",
  "Die Weiße wird auf die 11 gespielt.": "The cue ball is played at the 11.",
  "Die Weiße trifft eindeutig zuerst die 11, erst danach läuft diese gegen die 2.": "The cue ball clearly hits the 11 first; only then does it run into the 2.",
};
