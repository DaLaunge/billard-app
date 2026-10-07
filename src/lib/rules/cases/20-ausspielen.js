import { cue } from "../../ruleEngine.js";
import { ALL_DISCS } from "../meta.js";

/* Ausspielen (Lag): beide Spieler stossen gleichzeitig eine Kugel vom Kopffeld an die
   Fussbande und zurueck, die naehere zur Kopfbande gewinnt. Weiss = Spieler 1, Gelb = Spieler 2.
   Fall A: gueltig, die naehere gewinnt. Fall B: die Gelbe ueberquert auf dem Rueckweg die
   Laengsachse und verliert - obwohl sie naeher an der Kopfbande liegt. */
const FOOT = 204.5;
const yellow = (x, y) => ({ id: "g", n: 0, x, y, fill: "#E8D36A" });
const wStart = [58, 45], gStart = [58, 75];
const table = { headLine: true };

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "Weiß gewinnt das Ausspielen",
    reason: "Beide Kugeln sind gültig, die weiße liegt näher an der Kopfbande.",
    table,
    balls: [cue(...wStart), yellow(...gStart)],
    steps: [
      { text: "Ausgangslage: Beide Spieler legen ihre Kugel im Kopffeld an und stoßen ungefähr gleichzeitig.", focus: ["w", "g"] },
      {
        text: "Beide Kugeln laufen an die Fußbande und zurück. Die weiße liegt näher an der Kopfbande – sie gewinnt.",
        moves: [
          { id: "w", via: [[FOOT, 45]], to: [24, 45] },
          { id: "g", via: [[FOOT, 75]], to: [40, 75] },
        ],
        mark: { at: [24, 45], kind: "ok", afterEnd: "w" },
      },
    ],
  },
  {
    label: "Fall B", verdict: "foul", verdictLabel: "Gelb: Ausspielen verloren",
    reason: "Die gelbe Kugel hat die Längsachse überquert – sie ist verloren, auch wenn sie näher liegt.",
    table,
    balls: [cue(...wStart), yellow(...gStart)],
    steps: [
      { text: "Ausgangslage: Beide Spieler legen ihre Kugel im Kopffeld an und stoßen ungefähr gleichzeitig.", focus: ["w", "g"] },
      {
        text: "Die gelbe Kugel rollt auf dem Rückweg über die Längsachse – das Ausspielen ist für sie verloren, obwohl sie näher an der Kopfbande liegt.",
        moves: [
          { id: "w", via: [[FOOT, 45]], to: [30, 45] },
          { id: "g", via: [[FOOT, 72]], to: [20, 52] },
        ],
        mark: { at: [20, 52], kind: "foul", afterEnd: "g" },
      },
    ],
  },
];

export default {
  id: "ausspielen",
  released: true,
  discs: ALL_DISCS,
  topic: "anstoss",
  ref: "1.2",
  keywords: ["Ausspielen", "Lag", "Anstoßrecht", "wer stößt an", "Kopfbande", "Fußbande", "Längsachse", "Ausstoßen"],
  title: "Ausspielen um den Anstoß",
  rule: "Das Ausspielen ist der erste Stoß des Spiels und entscheidet, wer anstößt: Der Schiedsrichter legt je eine Kugel auf jede Seite des Kopffeldes nahe der Kopflinie, beide Spieler stoßen ungefähr gleichzeitig gegen die Fußbande, die Kugel, die nach dem Stillstand näher an der Kopfbande liegt, gewinnt. Wer gewinnt, bestimmt, wer anstößt. Verloren ist das Ausspielen, wenn die eigene Kugel über die Längsachse rollt, die Fußbande öfter als einmal berührt, in eine Tasche fällt oder vom Tisch springt, eine Seitenbande berührt oder in einer Ecktasche hinter der Kante der Kopfbande liegen bleibt. Auch ein Foul beim Stoß verliert. Wiederholt wird, wenn ein Spieler erst stößt, nachdem die Kugel des anderen schon die Fußbande berührt hat, wenn der Schiedsrichter nicht entscheiden kann, welche Kugel näher liegt, oder wenn beide einen Fehler machen.",
  sets: [{ discs: ALL_DISCS, variants }],
};

export const en = {
  "Ausspielen um den Anstoß": "Lagging for the break",
  "Das Ausspielen ist der erste Stoß des Spiels und entscheidet, wer anstößt: Der Schiedsrichter legt je eine Kugel auf jede Seite des Kopffeldes nahe der Kopflinie, beide Spieler stoßen ungefähr gleichzeitig gegen die Fußbande, die Kugel, die nach dem Stillstand näher an der Kopfbande liegt, gewinnt. Wer gewinnt, bestimmt, wer anstößt. Verloren ist das Ausspielen, wenn die eigene Kugel über die Längsachse rollt, die Fußbande öfter als einmal berührt, in eine Tasche fällt oder vom Tisch springt, eine Seitenbande berührt oder in einer Ecktasche hinter der Kante der Kopfbande liegen bleibt. Auch ein Foul beim Stoß verliert. Wiederholt wird, wenn ein Spieler erst stößt, nachdem die Kugel des anderen schon die Fußbande berührt hat, wenn der Schiedsrichter nicht entscheiden kann, welche Kugel näher liegt, oder wenn beide einen Fehler machen.":
    "Lagging is the first shot of the game and decides who breaks: the referee places one ball on each side of the kitchen near the head string, both players shoot at about the same time against the foot cushion, and the ball that comes to rest closer to the head cushion wins. The winner decides who breaks. The lag is lost if your ball rolls across the long axis, touches the foot cushion more than once, falls into a pocket or leaves the table, touches a side cushion or comes to rest in a corner pocket behind the nose of the head cushion. A foul on the shot also loses. The lag is repeated if a player shoots only after the other ball has already touched the foot cushion, if the referee cannot tell which ball is closer, or if both players make a mistake.",
  "Ausspielen": "lag",
  "Lag": "lag",
  "Anstoßrecht": "right to break",
  "wer stößt an": "who breaks",
  "Kopfbande": "head cushion",
  "Fußbande": "foot cushion",
  "Längsachse": "long axis",
  "Ausstoßen": "stringing",
  "Weiß gewinnt das Ausspielen": "White wins the lag",
  "Gelb: Ausspielen verloren": "Yellow: lag lost",
  "Beide Kugeln sind gültig, die weiße liegt näher an der Kopfbande.": "Both balls are valid, the white one is closer to the head cushion.",
  "Die gelbe Kugel hat die Längsachse überquert – sie ist verloren, auch wenn sie näher liegt.": "The yellow ball crossed the long axis – it is lost, even if it is closer.",
  "Ausgangslage: Beide Spieler legen ihre Kugel im Kopffeld an und stoßen ungefähr gleichzeitig.": "Starting position: both players place their ball in the kitchen and shoot at about the same time.",
  "Beide Kugeln laufen an die Fußbande und zurück. Die weiße liegt näher an der Kopfbande – sie gewinnt.": "Both balls run to the foot cushion and back. The white one is closer to the head cushion – it wins.",
  "Die gelbe Kugel rollt auf dem Rückweg über die Längsachse – das Ausspielen ist für sie verloren, obwohl sie näher an der Kopfbande liegt.": "On its way back the yellow ball rolls across the long axis – the lag is lost for it, although it is closer to the head cushion.",
};
