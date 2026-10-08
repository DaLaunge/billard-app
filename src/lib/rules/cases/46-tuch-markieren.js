import { cue, ball, cut, bankPoint } from "../../ruleEngine.js";
import { D89, D8, D141, tagSets } from "../meta.js";

/* Regel 3.16 (f) / OS19 3.42: Den Tisch zu markieren (Kreidepunkt oder -strich auf Tuch oder Bande) ist
   unsportlich bzw. ein Foul, wenn die Markierung beim Stoss noch da ist. Praxisbeispiel: ein Bandenstoss
   (die Weisse laeuft ueber die untere Bande zur 4, die in die Ecktasche faellt). Als Zielhilfe setzt der Spieler
   einen Kreidepunkt auf die Bande, genau an den Punkt, an dem die Weisse die Bande treffen soll - ebenso
   werden Kombinations- oder Bandenstoesse "ausgepeilt". Fall A: der Punkt bleibt beim Stoss liegen (Foul).
   Fall B: der Spieler wischt ihn vor dem Stoss weg. Der Stoss selbst ist beide Male regelgerecht (richtige
   Kugel zuerst, die 4 faellt). */
const W = [55, 45], T = [150, 45], P = [207, 13];
const c0 = cut(W, { id: "4", at: T }, P, { out: true });
const BANK = bankPoint(W, c0.contact, "bottom");
const shot = cut(BANK, { id: "4", at: T }, P, { out: true, bank: BANK });
const DOT = [BANK[0], 107.5];
const balls = () => [cue(...W), ball(4, ...T), ball(9, 60, 85)];
const hand = { kind: "hand", angle: -90, from: [DOT[0], 140], at: [DOT[0], DOT[1] + 9.5], dur: 600 };
const dot = { kind: "dot", at: DOT };

const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Foul – Bande markiert",
    reason: "Der Kreidepunkt auf der Bande bleibt beim Stoß liegen: das Markieren des Tisches ist ein Foul bzw. unsportliches Verhalten.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Ein Bandenstoß – die Weiße soll über die untere Bande die angesagte 4 in die Ecktasche spielen.", focus: ["4"] },
      { text: "Der Spieler setzt mit Kreide einen Punkt auf die Bande, an dem die Weiße abprallen soll, um den Bandenstoß besser einzuschätzen.", figs: [hand, dot] },
      { text: "Er lässt den Punkt liegen und stößt. Die 4 fällt, trotzdem ein Foul wegen der Markierung.", aim: [W, BANK, shot.contact], expectRail: true, figs: [dot], moves: [shot.w, shot.obj], mark: { at: DOT, kind: "foul", after: "w", delay: 200 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Kein Foul",
    reason: "Die Markierung wird vor dem Stoß entfernt: kein Foul.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Ein Bandenstoß – die Weiße soll über die untere Bande die angesagte 4 in die Ecktasche spielen.", focus: ["4"] },
      { text: "Der Spieler hat sich den Bandenpunkt mit Kreide markiert, wischt die Markierung aber vor dem Stoß wieder weg.", figs: [hand] },
      { text: "Der Spieler stößt, die Bande ist sauber. Die 4 fällt, kein Foul.", aim: [W, BANK, shot.contact], expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: "ok", after: "w", delay: 300 } },
    ],
  },
];

export default {
  id: "tuch-markieren",
  released: true,
  discs: ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "tisch",
  tags: ["verhalten", "tisch", "foul"],
  ref: "3.16 f",
  keywords: ["Tuch markieren", "Kreidepunkt", "Kreidestrich", "Tisch markieren", "Bande markieren", "Markierung auf dem Tuch", "Zielhilfe markieren"],
  title: "Tuch oder Bande markieren",
  rule: "Es ist unsportlich, das Tuch oder die Bande zu markieren, zum Beispiel mit einem Kreidepunkt, um einen Bandenstoß oder Kombinationsstoß besser einzuschätzen. Nach der Lehrunterlage ist es ein Foul, wenn die Markierung nicht vor dem Stoß entfernt wird. Der Spieler haftet für alles, was er an den Tisch bringt.",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 4"],
    [D8, "Du spielst Volle"],
    [D141, "14/1 · Ansage: 4"],
  ]),
};

export const en = {
  "Tuch oder Bande markieren": "Marking the cloth or cushion",
  "Es ist unsportlich, das Tuch oder die Bande zu markieren, zum Beispiel mit einem Kreidepunkt, um einen Bandenstoß oder Kombinationsstoß besser einzuschätzen. Nach der Lehrunterlage ist es ein Foul, wenn die Markierung nicht vor dem Stoß entfernt wird. Der Spieler haftet für alles, was er an den Tisch bringt.": "It is unsportsmanlike to mark the cloth or cushion, for example with a chalk dot to judge a bank shot or combination better. According to the training material it is a foul if the mark is not removed before the stroke. The player is liable for everything he brings to the table.",
  "Tuch markieren": "mark the cloth",
  "Kreidepunkt": "chalk dot",
  "Kreidestrich": "chalk line",
  "Tisch markieren": "mark the table",
  "Bande markieren": "mark the cushion",
  "Markierung auf dem Tuch": "mark on the cloth",
  "Zielhilfe markieren": "mark an aiming aid",
  "Niedrigste Kugel: 4": "Lowest ball: 4",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 4": "14.1 · call: 4",
  "Foul – Bande markiert": "Foul – cushion marked",
  "Der Kreidepunkt auf der Bande bleibt beim Stoß liegen: das Markieren des Tisches ist ein Foul bzw. unsportliches Verhalten.": "The chalk dot stays on the cushion during the stroke: marking the table is a foul or unsportsmanlike conduct.",
  "Die Markierung wird vor dem Stoß entfernt: kein Foul.": "The mark is removed before the stroke: no foul.",
  "Kein Foul": "No foul",
  "Ausgangslage: Ein Bandenstoß – die Weiße soll über die untere Bande die angesagte 4 in die Ecktasche spielen.": "Starting position: a bank shot – the cue ball is to play the called 4 into the corner pocket off the bottom cushion.",
  "Der Spieler setzt mit Kreide einen Punkt auf die Bande, an dem die Weiße abprallen soll, um den Bandenstoß besser einzuschätzen.": "The player puts a chalk dot on the cushion where the cue ball is to bounce, to judge the bank shot better.",
  "Er lässt den Punkt liegen und stößt. Die 4 fällt, trotzdem ein Foul wegen der Markierung.": "He leaves the dot and shoots. The 4 falls, still a foul because of the mark.",
  "Der Spieler hat sich den Bandenpunkt mit Kreide markiert, wischt die Markierung aber vor dem Stoß wieder weg.": "The player had marked the bank point with chalk but wipes the mark away before the stroke.",
  "Der Spieler stößt, die Bande ist sauber. Die 4 fällt, kein Foul.": "The player shoots, the cushion is clean. The 4 falls, no foul.",
};
