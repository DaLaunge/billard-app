import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, D141, tagSets } from "../meta.js";

/* Regel 3.8 (Schieben): Die Pomeranze darf nur den kurzen Moment des Stosses Kontakt mit der Weissen
   haben. Bleibt das Queue an der rollenden Weissen (Fall A), ist es ein Foul; loest sich die Weisse
   sofort und das Queue bleibt stehen (Fall B), ist alles in Ordnung. Der Stoss selbst ist beide Male
   gleich und regelgerecht (richtige Kugel, Kugel faellt). */
const T = [150, 50], P = [207, 13], W = [91.2, 88.2];
const shot = cut(W, { id: "4", at: T }, P, { out: true });
shot.w.delay = 200; // erst nach dem Stoss des Queues rollt die Weisse
const d = (() => { const l = Math.hypot(shot.contact[0] - W[0], shot.contact[1] - W[1]); return [(shot.contact[0] - W[0]) / l, (shot.contact[1] - W[1]) / l]; })();
const ang = (Math.atan2(d[1], d[0]) * 180) / Math.PI;
const tip = (c) => [Math.round((c[0] - d[0] * 5.5) * 100) / 100, Math.round((c[1] - d[1] * 5.5) * 100) / 100];
const rest = tip(W), back = [rest[0] - d[0] * 14, rest[1] - d[1] * 14], atHit = tip(shot.contact);
const balls = () => [cue(...W), ball(4, ...T), ball(9, 110, 95)];
const mk = (label, verdict, verdictLabel, reason, t3, fig) => ({
  label, verdict, verdictLabel, reason, balls: balls(),
  steps: [
    { text: "Ausgangslage: Der Spieler hat die angesagte 4 vor der Ecktasche.", focus: ["4"] },
    { text: "Der Spieler stößt zu.", aim: [W, shot.contact] },
    { text: t3, expectRail: true, figs: [fig], moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: verdict, after: "w", delay: 300 } },
  ],
});
const variants = [
  mk("Fall A", "foul", "Foul – Schieben",
    "Die Pomeranze bleibt an der rollenden Weißen, statt sich sofort zu lösen: Das Queue schiebt die Weiße.",
    "Das Queue bleibt an der Weißen und schiebt sie bis zur 4 mit – Foul (Schieben).",
    { kind: "cue", at: atHit, from: back, angle: ang, until: "hit" }),
  mk("Fall B", "ok", "Kein Foul",
    "Das Queue stoppt, die Weiße rollt allein weiter: ein normaler Stoß.",
    "Das Queue stoppt nach dem Kontakt, die Weiße rollt allein zur 4 – regelgerecht.",
    { kind: "cue", at: rest, from: back, angle: ang, dur: 200 }),
];

export default {
  id: "schieben",
  released: true,
  discs: ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "stoss",
  tags: ["foul", "stoss", "weisse"],
  ref: "3.8",
  keywords: ["Schieben", "Queue schiebt die Weiße", "Pomeranze bleibt an der Weißen", "Kontakt zu lang", "Schiebestoß", "mitschieben"],
  title: "Schieben der Weißen",
  rule: "Die Pomeranze darf die Weiße nur für den kurzen Moment des Stoßes berühren. Bleibt der Kontakt länger bestehen als bei einem normalen Stoß (das Queue schiebt die Weiße mit), ist es ein Schiebefoul. Nach dem Stoß löst sich die Weiße sofort vom Queue.",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 4"],
    [D8, "Du spielst Volle"],
    [D141, "14/1 · Ansage: 4"],
  ]),
};

export const en = {
  "Schieben der Weißen": "Pushing the cue ball",
  "Die Pomeranze darf die Weiße nur für den kurzen Moment des Stoßes berühren. Bleibt der Kontakt länger bestehen als bei einem normalen Stoß (das Queue schiebt die Weiße mit), ist es ein Schiebefoul. Nach dem Stoß löst sich die Weiße sofort vom Queue.": "The tip may touch the cue ball only for the brief moment of the stroke. If the contact lasts longer than in a normal stroke (the cue pushes the ball along) it is a pushing foul. After the stroke the cue ball leaves the cue at once.",
  "Schieben": "pushing",
  "Queue schiebt die Weiße": "cue pushes the cue ball",
  "Pomeranze bleibt an der Weißen": "tip stays on the cue ball",
  "Kontakt zu lang": "contact too long",
  "Schiebestoß": "push stroke",
  "mitschieben": "push along",
  "Niedrigste Kugel: 4": "Lowest ball: 4",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 4": "14.1 · call: 4",
  "Foul – Schieben": "Foul – pushing",
  "Die Pomeranze bleibt an der rollenden Weißen, statt sich sofort zu lösen: Das Queue schiebt die Weiße.": "The tip stays on the rolling cue ball instead of leaving at once: the cue pushes the ball.",
  "Das Queue stoppt, die Weiße rollt allein weiter: ein normaler Stoß.": "The cue stops, the cue ball rolls on by itself: a normal stroke.",
  "Ausgangslage: Der Spieler hat die angesagte 4 vor der Ecktasche.": "Starting position: the player has the called 4 in front of the corner pocket.",
  "Der Spieler stößt zu.": "The player strikes.",
  "Das Queue bleibt an der Weißen und schiebt sie bis zur 4 mit – Foul (Schieben).": "The cue stays on the cue ball and pushes it all the way to the 4 – foul (pushing).",
  "Das Queue stoppt nach dem Kontakt, die Weiße rollt allein zur 4 – regelgerecht.": "The cue stops after contact, the cue ball rolls to the 4 by itself – legal.",
};
