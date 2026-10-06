import { cue, ball, cut } from "../../ruleEngine.js";
import { D8 } from "../meta.js";

/* 8 Ball: wann gewinnt / verliert man mit der 8? Dieselbe Stosssituation zweimal.
   Fall A: die 8 faellt, obwohl noch eine eigene Kugel (die 5) auf dem Tisch liegt - Spiel verloren.
   Fall B: alle eigenen Kugeln sind versenkt, die 8 ist angesagt und faellt in die angesagte
   Tasche - Spiel gewonnen. */
const T = [150, 50], P = [207, 13], W = [91.2, 88.2];
const shot = cut(W, { id: "8", at: T }, P, { out: true });

const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Spiel verloren",
    reason: "Die 8 wurde versenkt, obwohl noch eine Kugel der eigenen Gruppe auf dem Tisch lag.",
    tag: "Du spielst Volle · die 5 liegt noch",
    balls: [cue(...W), ball(8, ...T), ball(5, 110, 95), ball(12, 60, 30)],
    steps: [
      { text: "Ausgangslage: Du spielst Volle. Die 5 liegt noch auf dem Tisch, die 8 liegt vor der Ecktasche.", focus: ["5", "8"] },
      { text: "Der Spieler spielt die 8 an, obwohl er noch eine eigene Kugel hat.", aim: [W, shot.contact] },
      { text: "Die 8 fällt, solange noch eine Kugel der eigenen Gruppe liegt – das Spiel ist verloren.", wrongFirst: true, expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: "foul", after: "w", delay: 300 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Spiel gewonnen",
    reason: "Alle eigenen Kugeln sind versenkt, die 8 fällt in die angesagte Tasche.",
    tag: "Du spielst Volle · nur noch die 8",
    balls: [cue(...W), ball(8, ...T), ball(11, 110, 95), ball(13, 60, 30)],
    steps: [
      { text: "Ausgangslage: Alle Vollen sind versenkt, nur noch die 8 und zwei Halbe des Gegners liegen auf dem Tisch.", focus: ["8"] },
      { text: "Der Spieler sagt die 8 in die Ecktasche rechts oben an.", say: "Ansage: 8 → rechts oben", aim: [W, shot.contact] },
      { text: "Die 8 fällt in die angesagte Tasche, ohne Foul – der Spieler gewinnt das Spiel.", expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: "ok", after: "w", delay: 300 } },
    ],
  },
];

export default {
  id: "acht-verloren",
  released: false,
  discs: D8,
  topic: "ablauf",
  ref: "4.8, 4.10, 4.4",
  keywords: ["8 versenkt", "Spielverlust", "Sieg mit der 8", "Spiel verloren gegangen", "Achter", "schwarze Kugel", "8 zu früh", "8 in falsche Tasche", "8 springt vom Tisch", "Spielende"],
  title: "Die 8: gewonnen oder verloren",
  rule: "Beim 8-Ball müssen zuerst alle Kugeln der eigenen Gruppe versenkt sein, bevor die 8 gespielt werden darf; sie wird angesagt (Kugel und Tasche). Ein Spieler verliert das Spiel, wenn er (a) beim Versenken der 8 ein Foul begeht, (b) die 8 versenkt, solange noch eine Kugel seiner Gruppe auf dem Tisch liegt, (c) die 8 in eine nicht angesagte Tasche versenkt oder (d) die 8 vom Tisch springen lässt. Das gilt nicht für den Anstoß. Beim Spiel auf die 8 bedeutet ein Foul oder das Versenken der Weißen keinen Spielverlust, solange die 8 nicht fällt oder springt; der Gegner hat dann Ball in Hand. Nach der Lehrunterlage muss ein Spielverlust angesagt werden, bevor der nächste Stoß erfolgt, sonst gilt er als nicht begangen.",
  sets: [{ discs: D8, tag: "Du spielst Volle", variants }],
};

export const en = {
  "Die 8: gewonnen oder verloren": "The 8: won or lost",
  "Beim 8-Ball müssen zuerst alle Kugeln der eigenen Gruppe versenkt sein, bevor die 8 gespielt werden darf; sie wird angesagt (Kugel und Tasche). Ein Spieler verliert das Spiel, wenn er (a) beim Versenken der 8 ein Foul begeht, (b) die 8 versenkt, solange noch eine Kugel seiner Gruppe auf dem Tisch liegt, (c) die 8 in eine nicht angesagte Tasche versenkt oder (d) die 8 vom Tisch springen lässt. Das gilt nicht für den Anstoß. Beim Spiel auf die 8 bedeutet ein Foul oder das Versenken der Weißen keinen Spielverlust, solange die 8 nicht fällt oder springt; der Gegner hat dann Ball in Hand. Nach der Lehrunterlage muss ein Spielverlust angesagt werden, bevor der nächste Stoß erfolgt, sonst gilt er als nicht begangen.":
    "In 8-ball all balls of your own group must be pocketed before the 8 may be played; it is called (ball and pocket). A player loses the game if he (a) commits a foul while pocketing the 8, (b) pockets the 8 while a ball of his group is still on the table, (c) pockets the 8 in an uncalled pocket or (d) lets the 8 jump off the table. This does not apply on the break. When playing the 8 a foul or a pocketed cue ball does not lose the game as long as the 8 does not fall or jump; the opponent then has ball in hand. According to the training material a loss of game must be announced before the next shot, otherwise it counts as not committed.",
  "8 versenkt": "8 pocketed",
  "Spielverlust": "loss of game",
  "Sieg mit der 8": "win with the 8",
  "Spiel verloren gegangen": "game lost",
  "Achter": "the eight",
  "schwarze Kugel": "black ball",
  "8 zu früh": "8 too early",
  "8 in falsche Tasche": "8 in the wrong pocket",
  "8 springt vom Tisch": "8 jumps off the table",
  "Spielende": "end of game",
  "Du spielst Volle": "You play solids",
  "Du spielst Volle · die 5 liegt noch": "You play solids · the 5 is still on the table",
  "Du spielst Volle · nur noch die 8": "You play solids · only the 8 is left",
  "Spiel verloren": "Game lost",
  "Spiel gewonnen": "Game won",
  "Ansage: 8 → rechts oben": "Call: 8 → top right",
  "Die 8 wurde versenkt, obwohl noch eine Kugel der eigenen Gruppe auf dem Tisch lag.": "The 8 was pocketed although a ball of your own group was still on the table.",
  "Alle eigenen Kugeln sind versenkt, die 8 fällt in die angesagte Tasche.": "All your own balls are pocketed, the 8 falls into the called pocket.",
  "Ausgangslage: Du spielst Volle. Die 5 liegt noch auf dem Tisch, die 8 liegt vor der Ecktasche.": "Starting position: you play solids. The 5 is still on the table, the 8 lies in front of the corner pocket.",
  "Der Spieler spielt die 8 an, obwohl er noch eine eigene Kugel hat.": "The player plays the 8 although he still has a ball of his own.",
  "Die 8 fällt, solange noch eine Kugel der eigenen Gruppe liegt – das Spiel ist verloren.": "The 8 falls while a ball of your own group is still on the table – the game is lost.",
  "Ausgangslage: Alle Vollen sind versenkt, nur noch die 8 und zwei Halbe des Gegners liegen auf dem Tisch.": "Starting position: all solids are pocketed, only the 8 and two of the opponent's stripes are left on the table.",
  "Der Spieler sagt die 8 in die Ecktasche rechts oben an.": "The player calls the 8 in the top right corner pocket.",
  "Die 8 fällt in die angesagte Tasche, ohne Foul – der Spieler gewinnt das Spiel.": "The 8 falls into the called pocket without a foul – the player wins the game.",
};
