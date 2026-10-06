import { cue, ball, cut } from "../../ruleEngine.js";
import { D8, SOURCE_REGULARIEN } from "../meta.js";

/* 8 Ball, WPA-Regularien 10: Die Gruppen sind verteilt (der Spieler spielt Volle). Aus Versehen spielt er
   eine Kugel der Gegner-Gruppe (die 12, Halbe) an und versenkt sie. Das Foul muss gegeben werden, BEVOR
   er seinen naechsten Stoss ausfuehrt (Fall A: normales Foul, Ball in Hand fuer den Gegner). Wird die
   Verwechslung erst spaeter bemerkt (Fall B: er hat schon einen weiteren Stoss gespielt), wird das
   Spiel angehalten und vom urspruenglichen Anstosser neu angestoessen. */
const W = [91.2, 88.2], T = [150, 50], P = [207, 13];
const wrong = cut(W, { id: "12", at: T }, P, { out: true });
// naechster Stoss: die eigene 3 in die Mitteltasche
const T3 = [130, 30], MID = [110, 8];
const WE = wrong.w.to;
const next = cut(WE, { id: "3", at: T3 }, MID, { out: true });
const balls = () => [cue(...W), ball(12, ...T), ball(3, ...T3), ball(5, 60, 95), ball(10, 40, 40)];
const SHOT = "Der Spieler hält die 12 für eine seiner Kugeln, spielt sie an und versenkt sie.";

const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Foul – Ball in Hand",
    reason: "Das Foul wird gegeben, bevor der Spieler weiterstößt: ein normales Foul, der Gegner hat Ball in Hand auf dem ganzen Tisch.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Die Gruppen sind verteilt, der Spieler hat Volle. Die 12 ist eine Halbe – die Kugel des Gegners.", focus: ["12"] },
      { text: SHOT, shot: { n: 1, of: 2, who: "Spieler" }, aim: [W, wrong.contact], wrongFirst: true, expectRail: true, moves: [wrong.w, wrong.obj] },
      { text: "Der Gegner ruft sofort Foul, bevor der nächste Stoß erfolgt: ein normales Foul mit Ball in Hand für ihn.", shot: { n: 1, of: 2, who: "Spieler" }, say: "Foul!", sayIcon: "mouth", mark: { at: [200, 19], kind: "foul", delay: 200 } },
    ],
  },
  {
    label: "Fall B", verdict: "foul", verdictLabel: "Spiel neu anstoßen",
    reason: "Die Verwechslung wird erst nach einem weiteren Stoß bemerkt: das Spiel wird angehalten und vom ursprünglichen Anstoßer neu angestoßen.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Die Gruppen sind verteilt, der Spieler hat Volle. Die 12 ist eine Halbe – die Kugel des Gegners.", focus: ["12"] },
      { text: SHOT + " Niemand bemerkt es.", shot: { n: 1, of: 2, who: "Spieler" }, aim: [W, wrong.contact], wrongFirst: true, expectRail: true, moves: [wrong.w, wrong.obj] },
      { text: "Er spielt weiter und versenkt seine 3. Jetzt ist das Foul schon überspielt.", shot: { n: 2, of: 2, who: "Spieler" }, aim: [WE, next.contact], expectRail: true, moves: [next.w, next.obj] },
      { text: "Dann fällt die Verwechslung auf: Das Spiel wird angehalten und vom ursprünglichen Anstoßer neu angestoßen.", say: "Gruppen verwechselt", sayIcon: "mouth", mark: { at: [200, 19], kind: "foul", delay: 200 } },
    ],
  },
];

export default {
  id: "gruppen-verwechselt",
  released: false,
  src: SOURCE_REGULARIEN,
  discs: D8,
  topic: "ablauf",
  ref: "10",
  keywords: ["falsche Gruppe versenkt", "Volle und Halbe vertauscht", "Kugel des Gegners versenkt", "versehentlich gegnerische Kugel", "Verwechslung der Gruppen"],
  title: "Gruppen verwechselt",
  rule: "Sind beim 8-Ball die Gruppen bestimmt und spielt ein Spieler aus Versehen eine Kugel der gegnerischen Gruppe an und versenkt sie, muss das Foul gegeben werden, bevor er seinen nächsten Stoß ausführt (normales Foul: Ball in Hand für den Gegner). Wird die Verwechslung erst später von einem Spieler oder dem Schiedsrichter erkannt, wird das Spiel angehalten und von dem Spieler neu angestoßen, der den ursprünglichen Anstoß in diesem Spiel hatte.",
  sets: [{ discs: D8, tag: "Du spielst Volle", variants }],
};

export const en = {
  "Gruppen verwechselt": "Groups mixed up",
  "Sind beim 8-Ball die Gruppen bestimmt und spielt ein Spieler aus Versehen eine Kugel der gegnerischen Gruppe an und versenkt sie, muss das Foul gegeben werden, bevor er seinen nächsten Stoß ausführt (normales Foul: Ball in Hand für den Gegner). Wird die Verwechslung erst später von einem Spieler oder dem Schiedsrichter erkannt, wird das Spiel angehalten und von dem Spieler neu angestoßen, der den ursprünglichen Anstoß in diesem Spiel hatte.": "In 8-ball, when the groups are determined and a player by mistake plays and pockets a ball of the opponent's group, the foul must be called before he plays his next shot (normal foul: ball in hand for the opponent). If the mix-up is only noticed later by a player or the referee, the game is stopped and broken again by the player who had the original break in that game.",
  "falsche Gruppe versenkt": "wrong group pocketed",
  "Volle und Halbe vertauscht": "solids and stripes mixed up",
  "Kugel des Gegners versenkt": "opponent's ball pocketed",
  "versehentlich gegnerische Kugel": "opponent's ball by mistake",
  "Verwechslung der Gruppen": "mix-up of the groups",
  "Du spielst Volle": "You play solids",
  "Spieler": "Player",
  "Foul!": "Foul!",
  "Foul – Ball in Hand": "Foul – ball in hand",
  "Spiel neu anstoßen": "Break the game again",
  "Das Foul wird gegeben, bevor der Spieler weiterstößt: ein normales Foul, der Gegner hat Ball in Hand auf dem ganzen Tisch.": "The foul is called before the player continues: a normal foul, the opponent has ball in hand on the whole table.",
  "Die Verwechslung wird erst nach einem weiteren Stoß bemerkt: das Spiel wird angehalten und vom ursprünglichen Anstoßer neu angestoßen.": "The mix-up is only noticed after another shot: the game is stopped and broken again by the original breaker.",
  "Ausgangslage: Die Gruppen sind verteilt, der Spieler hat Volle. Die 12 ist eine Halbe – die Kugel des Gegners.": "Starting position: the groups are assigned, the player has solids. The 12 is a stripe – the opponent's ball.",
  "Der Spieler hält die 12 für eine seiner Kugeln, spielt sie an und versenkt sie.": "The player takes the 12 for one of his balls, plays it and pockets it.",
  "Der Spieler hält die 12 für eine seiner Kugeln, spielt sie an und versenkt sie. Niemand bemerkt es.": "The player takes the 12 for one of his balls, plays it and pockets it. Nobody notices.",
  "Der Gegner ruft sofort Foul, bevor der nächste Stoß erfolgt: ein normales Foul mit Ball in Hand für ihn.": "The opponent calls foul at once, before the next shot: a normal foul with ball in hand for him.",
  "Er spielt weiter und versenkt seine 3. Jetzt ist das Foul schon überspielt.": "He plays on and pockets his 3. The foul has now been played over.",
  "Dann fällt die Verwechslung auf: Das Spiel wird angehalten und vom ursprünglichen Anstoßer neu angestoßen.": "Then the mix-up is noticed: the game is stopped and broken again by the original breaker.",
};
