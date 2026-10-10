import { cue, ball, cut } from "../../ruleEngine.js";
import { DHB, SOURCE_HEYBALL } from "../meta.js";

/* Heyball, Weisse in der Hand hinter der Kopflinie (WPA Rules of Heyball 8): Nach einem Foul im Anstoss legt der
   Gegner die Weisse hinter der Kopflinie (Mittelpunkt dahinter) und darf nicht direkt auf eine Kugel spielen, die
   ebenfalls hinter der Kopflinie liegt. Eine Kugel genau AUF der Linie darf direkt gespielt werden. Fall A: direkter
   Stoss auf eine Kugel im Kopffeld - Foul. Fall B: die Kugel liegt genau auf der Kopflinie - erlaubt. Die Kopflinie
   liegt bei x = 60 (wie cases/13), das Kopffeld ist x < 60. */
const WA = [30, 45], BA = [45, 88];
const WB = [30, 60], BB = [60, 88];
const shotA = cut(WA, { id: "5", at: BA }, [45, 104.5]);
const shotB = cut(WB, { id: "5", at: BB }, [60, 104.5]);
const others = [ball(12, 150, 40), ball(11, 165, 82)];

const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Foul – direkt auf eine Kugel im Kopffeld",
    reason: "Die Weiße wird direkt auf eine Kugel gespielt, die ebenfalls hinter der Kopflinie liegt: Foul.",
    table: { headLine: true },
    balls: [cue(...WA), ball(5, ...BA), ...others],
    steps: [
      { text: "Ausgangslage: Foul im Anstoß. Der Gegner legt die Weiße hinter die Kopflinie. Die 5 liegt ebenfalls im Kopffeld.", focus: ["5"] },
      { text: "Er spielt die Weiße direkt auf die 5.", aim: [WA, shotA.contact] },
      { text: "Die 5 liegt hinter der Kopflinie und wird direkt angespielt – Foul.", expectRail: true, moves: [{ ...shotA.w, from: WA }, shotA.obj], mark: { at: BA, kind: "foul", after: "w" } },
    ],
  },
  {
    label: "Fall B", verdict: "ok",
    reason: "Eine Kugel genau auf der Kopflinie darf direkt angespielt werden.",
    table: { headLine: true },
    balls: [cue(...WB), ball(5, ...BB), ...others],
    steps: [
      { text: "Ausgangslage: Foul im Anstoß. Der Gegner legt die Weiße hinter die Kopflinie. Die 5 liegt genau auf der Kopflinie.", focus: ["5"] },
      { text: "Er spielt die Weiße direkt auf die 5.", aim: [WB, shotB.contact] },
      { text: "Eine Kugel genau auf der Kopflinie darf direkt gespielt werden – regelgerecht.", expectRail: true, moves: [{ ...shotB.w, from: WB }, shotB.obj], mark: { at: BB, kind: "ok", after: "w" } },
    ],
  },
];

export default {
  id: "heyball-kopflinie-ball-in-hand",
  released: true,
  discs: DHB,
  src: SOURCE_HEYBALL,
  bookRef: "8.10",
  topic: "weisse",
  tags: ["foul", "kopffeld", "weisse"],
  ref: "8, 9",
  keywords: ["Ball in Hand Kopflinie", "hinter der Kopflinie", "Kopffeld", "Weiße legen", "Kugel auf der Kopflinie", "direkt anspielen", "Heyball Kopflinie"],
  title: "Heyball: Weiße hinter der Kopflinie",
  rule: "Nach einem Foul im Anstoß darf der Gegner die Weiße hinter der Kopflinie (Mittelpunkt dahinter) in die Hand nehmen. Er darf sie dann nicht direkt auf eine Kugel spielen, die ebenfalls hinter der Kopflinie liegt; er kann sie aber erst über die Linie hinaus spielen und dann zurücklaufen lassen. Eine Kugel genau auf der Kopflinie darf direkt gespielt werden. Liegen alle erlaubten Kugeln hinter der Linie, darf der Spieler die der Linie nächste Kugel auf den Fußpunkt zurücklegen lassen. Nach jedem anderen Foul darf die Weiße überall auf dem Tisch platziert werden.",
  sets: [{ discs: DHB, tag: "Du spielst Volle", variants }],
};

export const en = {
  "Heyball: Weiße hinter der Kopflinie": "Heyball: cue ball behind the head string",
  "Nach einem Foul im Anstoß darf der Gegner die Weiße hinter der Kopflinie (Mittelpunkt dahinter) in die Hand nehmen. Er darf sie dann nicht direkt auf eine Kugel spielen, die ebenfalls hinter der Kopflinie liegt; er kann sie aber erst über die Linie hinaus spielen und dann zurücklaufen lassen. Eine Kugel genau auf der Kopflinie darf direkt gespielt werden. Liegen alle erlaubten Kugeln hinter der Linie, darf der Spieler die der Linie nächste Kugel auf den Fußpunkt zurücklegen lassen. Nach jedem anderen Foul darf die Weiße überall auf dem Tisch platziert werden.": "After a foul on the break the opponent may take ball in hand behind the head string (center behind it). He may then not play directly at a ball that is also behind the head string; he can, however, first play the cue ball past the line and let it come back. A ball exactly on the head string can be shot directly. If all legal balls are behind the line, the player may have the ball nearest the line re-spotted on the foot spot. After any other foul the cue ball may be placed anywhere on the table.",
  "Ball in Hand Kopflinie": "ball in hand head string",
  "hinter der Kopflinie": "behind the head string",
  "Kopffeld": "kitchen",
  "Weiße legen": "placing the cue ball",
  "Kugel auf der Kopflinie": "ball on the head string",
  "direkt anspielen": "play directly",
  "Heyball Kopflinie": "Heyball head string",
  "Du spielst Volle": "You play solids",
  "Foul – direkt auf eine Kugel im Kopffeld": "Foul – directly at a ball in the kitchen",
  "Die Weiße wird direkt auf eine Kugel gespielt, die ebenfalls hinter der Kopflinie liegt: Foul.": "The cue ball is played directly at a ball that is also behind the head string: foul.",
  "Eine Kugel genau auf der Kopflinie darf direkt angespielt werden.": "A ball exactly on the head string may be played directly.",
  "Ausgangslage: Foul im Anstoß. Der Gegner legt die Weiße hinter die Kopflinie. Die 5 liegt ebenfalls im Kopffeld.": "Starting position: foul on the break. The opponent places the cue ball behind the head string. The 5 also lies in the kitchen.",
  "Er spielt die Weiße direkt auf die 5.": "He plays the cue ball directly at the 5.",
  "Die 5 liegt hinter der Kopflinie und wird direkt angespielt – Foul.": "The 5 lies behind the head string and is played directly – foul.",
  "Ausgangslage: Foul im Anstoß. Der Gegner legt die Weiße hinter die Kopflinie. Die 5 liegt genau auf der Kopflinie.": "Starting position: foul on the break. The opponent places the cue ball behind the head string. The 5 lies exactly on the head string.",
  "Eine Kugel genau auf der Kopflinie darf direkt gespielt werden – regelgerecht.": "A ball exactly on the head string may be played directly – legal.",
};
