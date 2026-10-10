import { cue } from "../../ruleEngine.js";
import { DHB, SOURCE_HEYBALL } from "../meta.js";
import { rack, brake, hitOf, R15, W } from "../racks.js";

/* Heyball, Anstoss (WPA Rules of Heyball 6 c): Nach dem Anstoss muessen mindestens vier Objektkugeln eine Bande
   beruehren oder mindestens eine Kugel versenkt sein, sonst ist der Anstoss ungueltig. Fall A: nur drei Kugeln
   erreichen die Bande. Fall B: vier. Dasselbe Verfahren wie cases/09 (die Kugeln laufen radial vom Rack weg). */
const onWall = (m) => m.id !== "w" && (m.to[0] >= 204.4 || m.to[0] <= 15.6 || m.to[1] <= 15.6 || m.to[1] >= 104.4);
const withRails = (moves, want) => {
  const n = moves.filter(onWall).length;
  if (n !== want) throw new Error(`Heyball-Anstoss: ${n} statt ${want} Kugeln an der Bande`);
  return moves;
};
const balls = rack(R15);
const start = () => [cue(...W), ...balls.map((b) => ({ id: String(b.n), n: b.n, x: b.p[0], y: b.p[1] }))];
const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Ungültiger Anstoß",
    reason: "Keine Kugel versenkt, nur drei Kugeln erreichen die Bande: ungültiger Anstoß. Der Gegner wählt, ob er das Bild annimmt oder neu aufbauen lässt.",
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim Heyball. Es wird keine Kugel versenkt." },
      { text: "Die Weiße bricht das Rack.", aim: [W, hitOf(R15)] },
      { text: "Nur drei Kugeln laufen an eine Bande – zu wenig.", moves: withRails(brake(R15, balls, [11, 6, 15]), 3), mark: { at: [176, 60], kind: "foul", after: "w", delay: 450 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok",
    reason: "Vier Kugeln erreichen die Bande: der Anstoß ist gültig.",
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim Heyball. Es wird keine Kugel versenkt." },
      { text: "Die Weiße bricht das Rack.", aim: [W, hitOf(R15)] },
      { text: "Vier Kugeln laufen an eine Bande – regelgerecht.", moves: withRails(brake(R15, balls, [11, 6, 15, 12]), 4), mark: { at: [176, 60], kind: "ok", after: "w", delay: 450 } },
    ],
  },
];

export default {
  id: "heyball-anstoss",
  released: true,
  discs: DHB,
  src: SOURCE_HEYBALL,
  bookRef: "8.1",
  topic: "anstoss",
  tags: ["anstoss", "bande"],
  ref: "6",
  keywords: ["Heyball Anstoß", "Break", "vier Kugeln", "Bande", "Anstoß ungültig", "Rack", "weicher Anstoß"],
  title: "Heyball: Anstoß mit vier Kugeln an der Bande",
  rule: "Der Anstoß muss kräftig sein; nach ihm müssen mindestens vier Objektkugeln eine Bande berühren oder mindestens eine Kugel versenkt sein. Sonst ist es ein ungültiger Anstoß: Der Gegner darf das Bild annehmen und weiterspielen oder neu aufbauen lassen und selbst oder der Anstoßende stößt an – ohne Weiße in der Hand hinter der Kopflinie. Weiche Anstöße sind verboten (Verwarnung, dann Rackverlust, dann Matchverlust).",
  sets: [{ discs: DHB, tag: "Heyball-Dreieck", variants }],
};

export const en = {
  "Heyball: Anstoß mit vier Kugeln an der Bande": "Heyball: break with four balls to a cushion",
  "Der Anstoß muss kräftig sein; nach ihm müssen mindestens vier Objektkugeln eine Bande berühren oder mindestens eine Kugel versenkt sein. Sonst ist es ein ungültiger Anstoß: Der Gegner darf das Bild annehmen und weiterspielen oder neu aufbauen lassen und selbst oder der Anstoßende stößt an – ohne Weiße in der Hand hinter der Kopflinie. Weiche Anstöße sind verboten (Verwarnung, dann Rackverlust, dann Matchverlust).":
    "The break must be forceful; after it at least four object balls must touch a cushion or at least one ball must be pocketed. Otherwise the break is illegal: the opponent may accept the position and play on, or have the balls re-racked and either break himself or have the breaker break again – without ball in hand behind the head string. Soft breaks are prohibited (warning, then loss of rack, then loss of match).",
  "Heyball Anstoß": "Heyball break",
  "Break": "Break",
  "vier Kugeln": "four balls",
  "Bande": "Cushion",
  "Anstoß ungültig": "invalid break",
  "Rack": "Rack",
  "weicher Anstoß": "soft break",
  "Heyball-Dreieck": "Heyball triangle",
  "Ungültiger Anstoß": "Illegal break",
  "Keine Kugel versenkt, nur drei Kugeln erreichen die Bande: ungültiger Anstoß. Der Gegner wählt, ob er das Bild annimmt oder neu aufbauen lässt.": "No ball pocketed, only three balls reach a cushion: illegal break. The opponent chooses whether to accept the position or have the balls re-racked.",
  "Vier Kugeln erreichen die Bande: der Anstoß ist gültig.": "Four balls reach a cushion: the break is legal.",
  "Ausgangslage: Der Anstoß beim Heyball. Es wird keine Kugel versenkt.": "Starting position: the Heyball break. No ball is pocketed.",
  "Die Weiße bricht das Rack.": "The cue ball breaks the rack.",
  "Nur drei Kugeln laufen an eine Bande – zu wenig.": "Only three balls reach a cushion – too few.",
  "Vier Kugeln laufen an eine Bande – regelgerecht.": "Four balls reach a cushion – legal.",
};
