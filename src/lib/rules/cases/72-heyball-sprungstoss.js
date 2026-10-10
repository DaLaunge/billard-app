import { cue, ball, cut } from "../../ruleEngine.js";
import { DHB, SOURCE_HEYBALL } from "../meta.js";

/* Heyball, Sprungstoss (WPA Rules of Heyball 16): Die Weisse darf ueber Kugeln springen und eine Kugel der eigenen
   Gruppe treffen, wenn sie in der OBEREN Haelfte getroffen wird. Trifft man die untere Haelfte oder springt die Weisse
   durch einen Fehlstoss ueber eine Kugel, ist es ein ungueltiger Sprungstoss (Foul). Beide Faelle sehen von oben gleich
   aus - die Weisse fliegt (im Bild gross gezeichnet, `hop`) ueber die 11 und trifft die 4; der Unterschied steht in
   der Sprechblase. Die Wege kreuzen sich, daher looseCollisions. */
const W = [60, 60], T = [140, 60], OBST = [100, 60], POCKET = [207, 107];
const shot = cut(W, { id: "4", at: T }, POCKET, { out: true });
const jump = { ...shot.w, hop: true };
const mk = (label, verdict, verdictLabel, reason, say, text3) => ({
  label, verdict, verdictLabel, reason,
  looseCollisions: true,
  balls: [cue(...W), ball(11, ...OBST), ball(4, ...T), ball(13, 160, 95)],
  steps: [
    { text: "Ausgangslage: Du spielst Volle. Die 11 des Gegners liegt genau zwischen der Weißen und deiner 4.", focus: ["11", "4"] },
    { text: "Der Spieler will über die 11 springen und die 4 treffen.", say, aim: [W, shot.contact] },
    { text: text3, expectRail: true, moves: [jump, shot.obj], mark: { at: [200, 101], kind: verdict, after: "w", delay: 300 } },
  ],
});
const variants = [
  mk("Fall A", "ok", "Erlaubter Sprungstoß",
    "Die Weiße wird in der oberen Hälfte getroffen, springt über die 11 und trifft die eigene 4: erlaubter Sprungstoß.",
    "Obere Hälfte",
    "Die Weiße springt über die 11 und trifft die 4, die fällt – regelgerecht."),
  mk("Fall B", "foul", "Foul – ungültiger Sprungstoß",
    "Die Weiße wurde in der unteren Hälfte getroffen (oder springt durch einen Fehlstoß über die Kugel): ungültiger Sprungstoß, Foul.",
    "Untere Hälfte",
    "Die Weiße springt über die 11, wurde aber unten getroffen – ungültiger Sprungstoß, Foul."),
];

export default {
  id: "heyball-sprungstoss",
  released: true,
  discs: DHB,
  src: SOURCE_HEYBALL,
  bookRef: "8.12",
  topic: "stoss",
  tags: ["foul", "stoss"],
  ref: "16",
  keywords: ["Sprungstoß", "Jump", "Jump Shot", "über eine Kugel springen", "Weiße springt", "obere Hälfte", "untere Hälfte", "Heyball Sprung"],
  title: "Heyball: Sprungstoß",
  rule: "Erlaubt: Die Weiße über andere Kugeln springen lassen und dabei eine Kugel der eigenen Gruppe treffen. Die Weiße muss dabei in der oberen Hälfte getroffen werden. Trifft man die untere Hälfte oder springt die Weiße durch einen Fehlstoß oder anderen Grund über eine Kugel, ist es ein ungültiger Sprungstoß (Foul, die Weiße in der Hand für den Gegner). Springt die Weiße nicht über eine Hindernis-Kugel und trifft regelgerecht eine eigene Kugel, bleibt der Stoß gültig.",
  sets: [{ discs: DHB, tag: "Du spielst Volle", variants }],
};

export const en = {
  "Heyball: Sprungstoß": "Heyball: jump shot",
  "Erlaubt: Die Weiße über andere Kugeln springen lassen und dabei eine Kugel der eigenen Gruppe treffen. Die Weiße muss dabei in der oberen Hälfte getroffen werden. Trifft man die untere Hälfte oder springt die Weiße durch einen Fehlstoß oder anderen Grund über eine Kugel, ist es ein ungültiger Sprungstoß (Foul, die Weiße in der Hand für den Gegner). Springt die Weiße nicht über eine Hindernis-Kugel und trifft regelgerecht eine eigene Kugel, bleibt der Stoß gültig.": "Allowed: make the cue ball jump over other balls and hit a ball of your own group. The cue ball must be struck in its upper half. Hitting the lower half, or the cue ball jumping over a ball because of a miscue or another reason, is an illegal jump shot (foul, ball in hand for the opponent). If the cue ball does not jump over an obstructing ball and legally hits a ball of your own group, the shot stays legal.",
  "Sprungstoß": "jump shot",
  "Jump": "jump",
  "Jump Shot": "jump shot",
  "über eine Kugel springen": "jump over a ball",
  "Weiße springt": "cue ball jumps",
  "obere Hälfte": "upper half",
  "untere Hälfte": "lower half",
  "Heyball Sprung": "Heyball jump",
  "Du spielst Volle": "You play solids",
  "Obere Hälfte": "Upper half",
  "Untere Hälfte": "Lower half",
  "Erlaubter Sprungstoß": "Legal jump shot",
  "Foul – ungültiger Sprungstoß": "Foul – illegal jump shot",
  "Die Weiße wird in der oberen Hälfte getroffen, springt über die 11 und trifft die eigene 4: erlaubter Sprungstoß.": "The cue ball is struck in its upper half, jumps over the 11 and hits your own 4: legal jump shot.",
  "Die Weiße wurde in der unteren Hälfte getroffen (oder springt durch einen Fehlstoß über die Kugel): ungültiger Sprungstoß, Foul.": "The cue ball was struck in its lower half (or jumps over the ball because of a miscue): illegal jump shot, foul.",
  "Ausgangslage: Du spielst Volle. Die 11 des Gegners liegt genau zwischen der Weißen und deiner 4.": "Starting position: you play solids. The opponent's 11 lies exactly between the cue ball and your 4.",
  "Der Spieler will über die 11 springen und die 4 treffen.": "The player wants to jump over the 11 and hit the 4.",
  "Die Weiße springt über die 11 und trifft die 4, die fällt – regelgerecht.": "The cue ball jumps over the 11 and hits the 4, which falls – legal.",
  "Die Weiße springt über die 11, wurde aber unten getroffen – ungültiger Sprungstoß, Foul.": "The cue ball jumps over the 11 but was struck low – illegal jump shot, foul.",
};
