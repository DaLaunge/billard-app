import { cue, ball, cut } from "../../ruleEngine.js";
import { DHB, SOURCE_HEYBALL } from "../meta.js";

/* Heyball, Rackverlust (WPA Rules of Heyball 20): Wer die 8 versenkt, bevor die eigene Gruppe leer ist, verliert das
   Rack. Dieselbe Stosssituation wie cases/29. Fall A: die 8 faellt, obwohl noch eine eigene Kugel liegt. Fall B: alle
   eigenen Kugeln sind versenkt, die 8 faellt regelgerecht. */
const T = [150, 50], P = [207, 13], W = [91.2, 88.2];
const shot = cut(W, { id: "8", at: T }, P, { out: true });

const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Rack verloren",
    reason: "Die 8 wurde versenkt, obwohl noch eine Kugel der eigenen Gruppe auf dem Tisch lag.",
    tag: "Du spielst Volle · die 5 liegt noch",
    balls: [cue(...W), ball(8, ...T), ball(5, 110, 95), ball(12, 60, 30)],
    steps: [
      { text: "Ausgangslage: Du spielst Volle. Die 5 liegt noch auf dem Tisch, die 8 liegt vor der Ecktasche.", focus: ["5", "8"] },
      { text: "Der Spieler spielt die 8 an, obwohl er noch eine eigene Kugel hat.", aim: [W, shot.contact] },
      { text: "Die 8 fällt, solange noch eine Kugel der eigenen Gruppe liegt – das Rack ist verloren.", wrongFirst: true, expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: "foul", after: "w", delay: 300 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Rack gewonnen",
    reason: "Alle eigenen Kugeln sind versenkt, die 8 fällt ohne Foul.",
    tag: "Du spielst Volle · nur noch die 8",
    balls: [cue(...W), ball(8, ...T), ball(11, 110, 95), ball(13, 60, 30)],
    steps: [
      { text: "Ausgangslage: Alle Vollen sind versenkt, nur noch die 8 und zwei Halbe des Gegners liegen auf dem Tisch.", focus: ["8"] },
      { text: "Der Spieler spielt die 8 – eine Ansage ist nicht nötig.", aim: [W, shot.contact] },
      { text: "Die 8 fällt ohne Foul – der Spieler gewinnt das Rack.", expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: "ok", after: "w", delay: 300 } },
    ],
  },
];

export default {
  id: "heyball-rackverlust",
  released: true,
  discs: DHB,
  src: SOURCE_HEYBALL,
  bookRef: "8.5",
  topic: "ablauf",
  tags: ["ablauf", "tasche"],
  ref: "20",
  keywords: ["Rackverlust", "Rack verloren", "8 zu früh", "8 versenkt", "Spielverlust", "Sieg mit der 8", "8 vom Tisch", "Heyball 8"],
  title: "Heyball: Rack gewonnen oder verloren",
  rule: "Das Rack verliert, wer die 8 versenkt und dabei foult (außer im Anstoß), die 8 zusammen mit seiner letzten Gruppen-Kugel versenkt, die 8 vom Tisch spielt oder sie versenkt, bevor die eigene Gruppe leer ist. Solange die 8 auf dem Tisch liegt, gibt es nur Fouls (Weiße in der Hand für den Gegner); liegt sie nicht mehr auf dem Tisch, ist es Rackverlust. Gewonnen hat, wer nach seiner Gruppe die 8 regelgerecht versenkt – ohne Ansage.",
  sets: [{ discs: DHB, tag: "Du spielst Volle", variants }],
};

export const en = {
  "Heyball: Rack gewonnen oder verloren": "Heyball: rack won or lost",
  "Das Rack verliert, wer die 8 versenkt und dabei foult (außer im Anstoß), die 8 zusammen mit seiner letzten Gruppen-Kugel versenkt, die 8 vom Tisch spielt oder sie versenkt, bevor die eigene Gruppe leer ist. Solange die 8 auf dem Tisch liegt, gibt es nur Fouls (Weiße in der Hand für den Gegner); liegt sie nicht mehr auf dem Tisch, ist es Rackverlust. Gewonnen hat, wer nach seiner Gruppe die 8 regelgerecht versenkt – ohne Ansage.":
    "You lose the rack if you pocket the 8 while fouling (except on the break), pocket the 8 together with your last group ball, drive the 8 off the table, or pocket it before your group is cleared. As long as the 8 is on the table there are only fouls (ball in hand for the opponent); if it is no longer on the table, it is loss of rack. You win by legally pocketing the 8 after your group – without a call.",
  "Rackverlust": "loss of rack",
  "Rack verloren": "rack lost",
  "8 zu früh": "8 too early",
  "8 versenkt": "8 pocketed",
  "Spielverlust": "loss of game",
  "Sieg mit der 8": "win with the 8",
  "8 vom Tisch": "8 off the table",
  "Heyball 8": "Heyball 8",
  "Du spielst Volle": "You play solids",
  "Du spielst Volle · die 5 liegt noch": "You play solids · the 5 is still on the table",
  "Du spielst Volle · nur noch die 8": "You play solids · only the 8 is left",
  "Rack gewonnen": "Rack won",
  "Die 8 wurde versenkt, obwohl noch eine Kugel der eigenen Gruppe auf dem Tisch lag.": "The 8 was pocketed although a ball of your own group was still on the table.",
  "Alle eigenen Kugeln sind versenkt, die 8 fällt ohne Foul.": "All your own balls are pocketed, the 8 falls without a foul.",
  "Ausgangslage: Du spielst Volle. Die 5 liegt noch auf dem Tisch, die 8 liegt vor der Ecktasche.": "Starting position: you play solids. The 5 is still on the table, the 8 lies in front of the corner pocket.",
  "Der Spieler spielt die 8 an, obwohl er noch eine eigene Kugel hat.": "The player plays the 8 although he still has a ball of his own.",
  "Die 8 fällt, solange noch eine Kugel der eigenen Gruppe liegt – das Rack ist verloren.": "The 8 falls while a ball of your own group is still on the table – the rack is lost.",
  "Ausgangslage: Alle Vollen sind versenkt, nur noch die 8 und zwei Halbe des Gegners liegen auf dem Tisch.": "Starting position: all solids are pocketed, only the 8 and two of the opponent's stripes are left on the table.",
  "Der Spieler spielt die 8 – eine Ansage ist nicht nötig.": "The player plays the 8 – no call is needed.",
  "Die 8 fällt ohne Foul – der Spieler gewinnt das Rack.": "The 8 falls without a foul – the player wins the rack.",
};
