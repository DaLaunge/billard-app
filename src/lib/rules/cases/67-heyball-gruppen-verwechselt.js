import { cue, ball, cut } from "../../ruleEngine.js";
import { DHB, SOURCE_HEYBALL } from "../meta.js";

/* Heyball, Gruppen verwechselt (WPA Rules of Heyball 19): Nach dem Schliessen des Tisches spielt ein Spieler aus
   Versehen die falsche Gruppe. Das Foul muss vor dem naechsten Stoss ausgesprochen werden (Fall A: Weisse in der
   Hand fuer den Gegner). Wird die Verwechslung spaeter bemerkt (Fall B), wird das Rack sofort abgebrochen und neu
   aufgebaut. Geometrie wie cases/37. */
const W = [91.2, 88.2], T = [150, 50], P = [207, 13];
const wrong = cut(W, { id: "12", at: T }, P, { out: true });
const T3 = [130, 30], MID = [110, 8];
const WE = wrong.w.to;
const next = cut(WE, { id: "3", at: T3 }, MID, { out: true });
const balls = () => [cue(...W), ball(12, ...T), ball(3, ...T3), ball(5, 60, 95), ball(10, 40, 40)];
const SHOT = "Der Spieler hält die 12 für eine seiner Kugeln, spielt sie an und versenkt sie.";

const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Foul – Weiße in der Hand",
    reason: "Das Foul wird ausgesprochen, bevor der Spieler weiterstößt: ein normales Foul, der Gegner hat die Weiße in der Hand.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Der Tisch ist geschlossen, der Spieler hat Volle. Die 12 ist eine Halbe – die Kugel des Gegners.", focus: ["12"] },
      { text: SHOT, shot: { n: 1, of: 2, who: "Spieler" }, aim: [W, wrong.contact], wrongFirst: true, expectRail: true, moves: [wrong.w, wrong.obj] },
      { text: "Der Gegner ruft sofort Foul, bevor der nächste Stoß erfolgt: ein normales Foul mit der Weißen in der Hand für ihn.", shot: { n: 1, of: 2, who: "Spieler" }, say: "Foul!", sayIcon: "mouth", mark: { at: [200, 19], kind: "foul", delay: 200 } },
    ],
  },
  {
    label: "Fall B", verdict: "foul", verdictLabel: "Rack abbrechen, neu aufbauen",
    reason: "Die Verwechslung wird erst nach einem weiteren Stoß bemerkt: das Rack wird sofort abgebrochen und neu aufgebaut.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Der Tisch ist geschlossen, der Spieler hat Volle. Die 12 ist eine Halbe – die Kugel des Gegners.", focus: ["12"] },
      { text: SHOT + " Niemand bemerkt es.", shot: { n: 1, of: 2, who: "Spieler" }, aim: [W, wrong.contact], wrongFirst: true, expectRail: true, moves: [wrong.w, wrong.obj] },
      { text: "Er spielt weiter und versenkt seine 3. Jetzt ist das Foul schon überspielt.", shot: { n: 2, of: 2, who: "Spieler" }, aim: [WE, next.contact], expectRail: true, moves: [next.w, next.obj] },
      { text: "Dann fällt die Verwechslung auf: Das Rack wird sofort abgebrochen und neu aufgebaut.", say: "Gruppen verwechselt", sayIcon: "mouth", mark: { at: [200, 19], kind: "foul", delay: 200 } },
    ],
  },
];

export default {
  id: "heyball-gruppen-verwechselt",
  released: true,
  discs: DHB,
  src: SOURCE_HEYBALL,
  bookRef: "8.7",
  topic: "ablauf",
  tags: ["ablauf", "foul"],
  ref: "19",
  keywords: ["Gruppen verwechselt", "falsche Gruppe", "Volle und Halbe vertauscht", "Kugel des Gegners versenkt", "Verwechslung", "Rack neu aufbauen", "Heyball Gruppe"],
  title: "Heyball: Gruppen verwechselt",
  rule: "Wird nach dem Schließen des Tisches aus Versehen die falsche Gruppe gespielt, muss das Foul vor dem nächsten Stoß ausgesprochen werden (normales Foul: Weiße in der Hand für den Gegner). Bemerkt ein Spieler oder der Schiedsrichter die Verwechslung erst später, wird das Rack sofort abgebrochen und neu aufgebaut.",
  sets: [{ discs: DHB, tag: "Du spielst Volle", variants }],
};

export const en = {
  "Heyball: Gruppen verwechselt": "Heyball: groups mixed up",
  "Wird nach dem Schließen des Tisches aus Versehen die falsche Gruppe gespielt, muss das Foul vor dem nächsten Stoß ausgesprochen werden (normales Foul: Weiße in der Hand für den Gegner). Bemerkt ein Spieler oder der Schiedsrichter die Verwechslung erst später, wird das Rack sofort abgebrochen und neu aufgebaut.": "If the wrong group is played by mistake after the table is closed, the foul must be called before the next shot (normal foul: ball in hand for the opponent). If a player or the referee only notices the mix-up later, the rack is stopped at once and re-racked.",
  "falsche Gruppe": "wrong group",
  "Volle und Halbe vertauscht": "solids and stripes mixed up",
  "Kugel des Gegners versenkt": "opponent's ball pocketed",
  "Verwechslung": "mix-up",
  "Rack neu aufbauen": "re-rack",
  "Heyball Gruppe": "Heyball group",
  "Du spielst Volle": "You play solids",
  "Spieler": "Player",
  "Foul!": "Foul!",
  "Foul – Weiße in der Hand": "Foul – ball in hand",
  "Rack abbrechen, neu aufbauen": "Stop the rack and re-rack",
  "Das Foul wird ausgesprochen, bevor der Spieler weiterstößt: ein normales Foul, der Gegner hat die Weiße in der Hand.": "The foul is called before the player continues: a normal foul, the opponent has ball in hand.",
  "Die Verwechslung wird erst nach einem weiteren Stoß bemerkt: das Rack wird sofort abgebrochen und neu aufgebaut.": "The mix-up is only noticed after another shot: the rack is stopped at once and re-racked.",
  "Ausgangslage: Der Tisch ist geschlossen, der Spieler hat Volle. Die 12 ist eine Halbe – die Kugel des Gegners.": "Starting position: the table is closed, the player has solids. The 12 is a stripe – the opponent's ball.",
  "Der Spieler hält die 12 für eine seiner Kugeln, spielt sie an und versenkt sie.": "The player takes the 12 for one of his balls, plays it and pockets it.",
  "Der Spieler hält die 12 für eine seiner Kugeln, spielt sie an und versenkt sie. Niemand bemerkt es.": "The player takes the 12 for one of his balls, plays it and pockets it. Nobody notices.",
  "Der Gegner ruft sofort Foul, bevor der nächste Stoß erfolgt: ein normales Foul mit der Weißen in der Hand für ihn.": "The opponent calls foul at once, before the next shot: a normal foul with ball in hand for him.",
  "Er spielt weiter und versenkt seine 3. Jetzt ist das Foul schon überspielt.": "He plays on and pockets his 3. The foul has now been played over.",
  "Dann fällt die Verwechslung auf: Das Rack wird sofort abgebrochen und neu aufgebaut.": "Then the mix-up is noticed: the rack is stopped at once and re-racked.",
  "Gruppen verwechselt": "Groups mixed up",
};
