import { cue, ball, cut } from "../../ruleEngine.js";
import { D89, D8, D141, tagSets } from "../meta.js";

/* Regel 3.16 (Unsportliches Verhalten): Der Schiedsrichter darf nach Ermessen strafen - Verwarnung,
   Standardfoul (zaehlt zur Drei-Foul-Strafe), schwerwiegendes Foul, Verlust von Spiel/Satz/Match,
   Disqualifikation. Unsportlich ist u. a. das Ablenken oder Stoeren des Gegners (a), Uebungsstoesse (e),
   Verzoegern (g). Gezeigt: der Gegner redet/winkt waehrend des Stosses (Hand- und Mund-Symbol).
   Der Stoss selbst ist beide Male derselbe und regelgerecht. */
const T = [150, 50], P = [207, 13], W = [91.2, 88.2];
const shot = cut(W, { id: "4", at: T }, P, { out: true });
const balls = () => [cue(...W), ball(4, ...T), ball(9, 110, 95)];
const hand = { kind: "hand", at: [196, 108], from: [196, 128], angle: -90, dur: 500 };
const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Unsportliches Verhalten",
    reason: "Der Gegner lenkt den Spieler absichtlich ab (Zurufe, Winken). Der Schiedsrichter straft nach Ermessen: von der Verwarnung bis zum Verlust des Spiels, Satzes oder Matches.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Der Spieler hat die angesagte 4 vor der Ecktasche. Sein Gegner sitzt am Tisch.", focus: ["4"] },
      { text: "Der Spieler beginnt seinen Stoß. Der Gegner winkt und ruft etwas, um ihn zu stören.", say: "Zuruf!", sayIcon: "mouth", figs: [hand], aim: [W, shot.contact] },
      { text: "Der Spieler stößt trotzdem und versenkt die 4. Der Schiedsrichter wertet die Störung als unsportliches Verhalten des Gegners.", expectRail: true, figs: [hand], moves: [shot.w, shot.obj], mark: { at: [196, 108], kind: "foul", delay: 200 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Kein Foul",
    reason: "Der Gegner sitzt ruhig: kein unsportliches Verhalten.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Der Spieler hat die angesagte 4 vor der Ecktasche. Sein Gegner sitzt am Tisch.", focus: ["4"] },
      { text: "Der Spieler beginnt seinen Stoß. Der Gegner sitzt ruhig auf seinem Platz.", aim: [W, shot.contact] },
      { text: "Der Spieler stößt und versenkt die 4 – ohne Störung, kein Foul.", expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: "ok", after: "w", delay: 300 } },
    ],
  },
];

export default {
  id: "unsportlich",
  released: true,
  discs: ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "ablauf",
  ref: "3.16",
  keywords: ["Unsportliches Verhalten", "Gegner ablenken", "Gegner stören", "Zurufe", "Winken", "Verwarnung", "Disqualifikation", "Spielverlust durch Verhalten"],
  title: "Unsportliches Verhalten",
  rule: "Bei unsportlichem Verhalten darf der Schiedsrichter frei strafen: Verwarnung, Standardfoul (zählt zur Drei-Foul-Regel), schwerwiegendes Foul, Verlust von Spiel, Satz oder Match, Disqualifikation samt Preisgeld und Punkten. Unsportlich sind unter anderem: (a) Ablenken oder Stören des Gegners, (b) Kugeln anders als durch einen Stoß verändern, (c) absichtliches Abrutschen, (d) Weiterspielen nach einem Foul oder einer Unterbrechung, (e) Übungsstöße, (f) das Tuch markieren, (g) Verzögern, (h) unpassendes Zubehör.",
  sets: tagSets(variants, [
    [D89, "Niedrigste Kugel: 4"],
    [D8, "Du spielst Volle"],
    [D141, "14/1 · Ansage: 4"],
  ]),
};

export const en = {
  "Unsportliches Verhalten": "Unsportsmanlike conduct",
  "Bei unsportlichem Verhalten darf der Schiedsrichter frei strafen: Verwarnung, Standardfoul (zählt zur Drei-Foul-Regel), schwerwiegendes Foul, Verlust von Spiel, Satz oder Match, Disqualifikation samt Preisgeld und Punkten. Unsportlich sind unter anderem: (a) Ablenken oder Stören des Gegners, (b) Kugeln anders als durch einen Stoß verändern, (c) absichtliches Abrutschen, (d) Weiterspielen nach einem Foul oder einer Unterbrechung, (e) Übungsstöße, (f) das Tuch markieren, (g) Verzögern, (h) unpassendes Zubehör.": "For unsportsmanlike conduct the referee may penalize freely: warning, standard foul (counts towards the three-foul rule), serious foul, loss of game, set or match, disqualification including prize money and points. Unsportsmanlike are, among others: (a) distracting or disturbing the opponent, (b) changing balls other than by a stroke, (c) deliberate miscue, (d) playing on after a foul or interruption, (e) practice strokes, (f) marking the cloth, (g) delaying, (h) unsuitable equipment.",
  "Gegner ablenken": "distract the opponent",
  "Gegner stören": "disturb the opponent",
  "Zurufe": "shouting",
  "Winken": "waving",
  "Verwarnung": "caution",
  "Disqualifikation": "disqualification",
  "Spielverlust durch Verhalten": "loss of game for conduct",
  "Niedrigste Kugel: 4": "Lowest ball: 4",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 4": "14.1 · call: 4",
  "Zuruf!": "Shout!",
  "Der Gegner lenkt den Spieler absichtlich ab (Zurufe, Winken). Der Schiedsrichter straft nach Ermessen: von der Verwarnung bis zum Verlust des Spiels, Satzes oder Matches.": "The opponent deliberately distracts the player (shouting, waving). The referee penalizes at his discretion: from a warning to loss of the game, set or match.",
  "Der Gegner sitzt ruhig: kein unsportliches Verhalten.": "The opponent sits quietly: no unsportsmanlike conduct.",
  "Ausgangslage: Der Spieler hat die angesagte 4 vor der Ecktasche. Sein Gegner sitzt am Tisch.": "Starting position: the player has the called 4 in front of the corner pocket. His opponent sits at the table.",
  "Der Spieler beginnt seinen Stoß. Der Gegner winkt und ruft etwas, um ihn zu stören.": "The player begins his stroke. The opponent waves and shouts to disturb him.",
  "Der Spieler stößt trotzdem und versenkt die 4. Der Schiedsrichter wertet die Störung als unsportliches Verhalten des Gegners.": "The player shoots anyway and pockets the 4. The referee counts the disturbance as unsportsmanlike conduct by the opponent.",
  "Der Spieler beginnt seinen Stoß. Der Gegner sitzt ruhig auf seinem Platz.": "The player begins his stroke. The opponent sits quietly in his seat.",
  "Der Spieler stößt und versenkt die 4 – ohne Störung, kein Foul.": "The player shoots and pockets the 4 – without disturbance, no foul.",
};
