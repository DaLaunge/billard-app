import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, D141, tagSets } from "../meta.js";

/* Regel 3.14 (Zeitspiel / Shot Clock): Wird mit Zeitlimit gespielt (Richtwert 35 s pro Stoss plus
   einmal 25 s Verlaengerung pro Spiel), ruft der Schiedsrichter 10 Sekunden vor Ablauf "Time".
   Wer die Zeit ueberschreitet (Weisse wird erst nach Ablauf beruehrt), begeht ein Standardfoul.
   Der Stoss selbst ist beide Male derselbe und regelgerecht. Die genauen Zeiten legt der
   Veranstalter fest (siehe Regelliste, Abweichungen). */
const T = [150, 50], P = [207, 13], W = [91.2, 88.2];
const shot = cut(W, { id: "4", at: T }, P, { out: true });
const balls = () => [cue(...W), ball(4, ...T), ball(9, 110, 95)];
const mk = (label, verdict, verdictLabel, reason, t2, t3) => ({
  label, verdict, verdictLabel, reason, balls: balls(),
  steps: [
    { text: "Ausgangslage: Es wird mit Zeitlimit gespielt, hier 35 Sekunden pro Stoß. Alle Kugeln liegen still, die Zeit läuft.", focus: ["4"] },
    { text: "Nach 25 Sekunden ruft der Schiedsrichter „Time“: noch 10 Sekunden.", say: "Time!", sayIcon: "mouth" },
    { text: t2, aim: [W, shot.contact] },
    { text: t3, expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: verdict, after: "w", delay: 300 } },
  ],
});
const variants = [
  mk("Fall A", "foul", "Standardfoul – Zeit überschritten",
    "Die Weiße wird erst nach Ablauf des Zeitlimits berührt: Standardfoul, auch wenn der Stoß selbst richtig ist.",
    "Der Spieler zögert, die 35 Sekunden laufen ab, und der Schiedsrichter ruft „Foul“.",
    "Er stößt erst jetzt und versenkt die 4 – trotzdem ein Foul wegen der überschrittenen Zeit."),
  mk("Fall B", "ok", "Kein Foul",
    "Der Spieler stößt innerhalb des Zeitlimits.",
    "Der Spieler stößt nach 33 Sekunden – noch innerhalb der Zeit.",
    "Er versenkt die 4, kein Foul."),
];

export default {
  id: "zeitspiel",
  released: true,
  discs: ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "ablauf",
  ref: "3.14, 3.16",
  keywords: ["Zeitspiel", "Shot Clock", "Zeitlimit", "Zeit abgelaufen", "zu langsam", "Verzögerung", "Time rufen", "35 Sekunden"],
  title: "Zeitspiel: das Zeitlimit",
  rule: "Spielt ein Spieler zu langsam, kann der Schiedsrichter zur Eile auffordern und dann ein Zeitlimit für beide Spieler festlegen. Richtwert: 35 Sekunden pro Stoß plus einmal 25 Sekunden Verlängerung pro Spiel, 10 Sekunden vor Ablauf ruft der Schiedsrichter „Time“. Die Zeit läuft ab dem Stillstand aller Kugeln (bei Ball in Hand ab Besitz der Weißen und fertigem Aufbau) bis zur Berührung der Weißen. Wird die Zeit überschritten, ist es ein Standardfoul; absichtliches Verzögern ist unsportliches Verhalten (3.16). Die genauen Zeiten legt der Veranstalter fest (Lehrunterlage: höchstens 50 Sekunden, nach dem Anstoß 60 Sekunden).",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 4"],
    [D8, "Du spielst Volle"],
    [D141, "14/1 · Ansage: 4"],
  ]),
};

export const en = {
  "Zeitspiel: das Zeitlimit": "Slow play: the time limit",
  "Spielt ein Spieler zu langsam, kann der Schiedsrichter zur Eile auffordern und dann ein Zeitlimit für beide Spieler festlegen. Richtwert: 35 Sekunden pro Stoß plus einmal 25 Sekunden Verlängerung pro Spiel, 10 Sekunden vor Ablauf ruft der Schiedsrichter „Time“. Die Zeit läuft ab dem Stillstand aller Kugeln (bei Ball in Hand ab Besitz der Weißen und fertigem Aufbau) bis zur Berührung der Weißen. Wird die Zeit überschritten, ist es ein Standardfoul; absichtliches Verzögern ist unsportliches Verhalten (3.16). Die genauen Zeiten legt der Veranstalter fest (Lehrunterlage: höchstens 50 Sekunden, nach dem Anstoß 60 Sekunden).": "If a player plays too slowly the referee can ask him to hurry and then set a time limit for both players. Guideline: 35 seconds per shot plus one 25-second extension per game; 10 seconds before the time is up the referee calls \"Time\". The time runs from the moment all balls are at rest (with ball in hand from possession of the cue ball and a finished rack) until the cue ball is touched. Exceeding the time is a standard foul; deliberate delay is unsportsmanlike conduct (3.16). The organizer sets the exact times (training material: at most 50 seconds, 60 seconds after the break).",
  "Zeitspiel": "slow play",
  "Shot Clock": "shot clock",
  "Zeitlimit": "time limit",
  "Zeit abgelaufen": "time expired",
  "zu langsam": "too slow",
  "Verzögerung": "delay",
  "Time rufen": "call time",
  "35 Sekunden": "35 seconds",
  "Niedrigste Kugel: 4": "Lowest ball: 4",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 4": "14.1 · call: 4",
  "Time!": "Time!",
  "Standardfoul – Zeit überschritten": "Standard foul – time exceeded",
  "Die Weiße wird erst nach Ablauf des Zeitlimits berührt: Standardfoul, auch wenn der Stoß selbst richtig ist.": "The cue ball is only touched after the time limit has expired: standard foul, even if the shot itself is right.",
  "Der Spieler stößt innerhalb des Zeitlimits.": "The player shoots within the time limit.",
  "Ausgangslage: Es wird mit Zeitlimit gespielt, hier 35 Sekunden pro Stoß. Alle Kugeln liegen still, die Zeit läuft.": "Starting position: a time limit is in force, here 35 seconds per shot. All balls are at rest, the time is running.",
  "Nach 25 Sekunden ruft der Schiedsrichter „Time“: noch 10 Sekunden.": "After 25 seconds the referee calls \"Time\": 10 seconds left.",
  "Der Spieler zögert, die 35 Sekunden laufen ab, und der Schiedsrichter ruft „Foul“.": "The player hesitates, the 35 seconds run out and the referee calls \"foul\".",
  "Er stößt erst jetzt und versenkt die 4 – trotzdem ein Foul wegen der überschrittenen Zeit.": "He only shoots now and pockets the 4 – still a foul because of the exceeded time.",
  "Der Spieler stößt nach 33 Sekunden – noch innerhalb der Zeit.": "The player shoots after 33 seconds – still within the time.",
  "Er versenkt die 4, kein Foul.": "He pockets the 4, no foul.",
};
