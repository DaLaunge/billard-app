import { cue } from "../../ruleEngine.js";
import { DHB, SOURCE_HEYBALL } from "../meta.js";
import { rack, brake, hitOf, R15, W } from "../racks.js";

/* Heyball, Foul beim Anstoss (WPA Rules of Heyball 6 e, 6 g). Fall A: die Weisse faellt beim sonst kraeftigen Anstoss
   in die Tasche - Foul: der Gegner darf die Weisse hinter der Kopflinie in die Hand nehmen (oder neu aufbauen lassen
   und selbst oder den Gegner anstossen). Fall B: ein ungewollter Fehlstoss (Miscue), die Weisse trifft das Dreieck
   nicht - kein Foul im eigentlichen Sinn: der Gegner darf nur selbst anstossen oder den Anstossenden erneut anstossen
   lassen, OHNE Weisse in der Hand. */
const balls = rack(R15);
const start = () => [cue(...W), ...balls.map((b) => ({ id: String(b.n), n: b.n, x: b.p[0], y: b.p[1] }))];
const HIT = hitOf(R15);
const scratch = brake(R15, balls, [11, 6, 15, 12]);
scratch[0] = { id: "w", via: [HIT, [104.5, 104.5]], to: [11, 11], out: true, stop: true };

const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Foul – Weiße hinter der Kopflinie",
    reason: "Die Weiße fällt beim Anstoß in die Tasche: Foul. Der Gegner darf die Weiße hinter der Kopflinie in die Hand nehmen oder neu aufbauen lassen.",
    looseCollisions: true,
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim Heyball." },
      { text: "Die Weiße bricht das Rack.", aim: [W, HIT] },
      { text: "Der Anstoß ist kräftig, aber die Weiße fällt in die Tasche – Foul. Der Gegner wählt: Weiße in der Hand hinter der Kopflinie, oder neu aufbauen (selbst oder der Gegner stößt an).", moves: scratch, mark: { at: [176, 60], kind: "foul", after: "w", delay: 700 } },
    ],
  },
  {
    label: "Fall B", verdict: "foul", verdictLabel: "Fehlstoß – ohne Weiße in der Hand",
    reason: "Die Weiße trifft das Rack nicht (ungewollter Fehlstoß): der Gegner darf nur selbst anstoßen oder den Anstoßenden erneut anstoßen lassen – ohne Weiße in der Hand.",
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim Heyball." },
      { text: "Der Spieler stößt an, rutscht aber ab (Miscue).", aim: [W, HIT] },
      { text: "Die Weiße rollt am Rack vorbei und trifft keine Kugel. Der Gegner darf selbst anstoßen oder den Anstoßenden noch einmal anstoßen lassen – ohne Weiße in der Hand.", moves: [{ id: "w", to: [118, 104.5], stop: true }], mark: { at: [118, 98], kind: "foul", after: "w", afterEnd: true, delay: 200 } },
    ],
  },
];

export default {
  id: "heyball-anstoss-foul",
  released: true,
  discs: DHB,
  src: SOURCE_HEYBALL,
  bookRef: "8.9",
  topic: "anstoss",
  tags: ["anstoss", "foul", "weisse"],
  ref: "6 (e), 6 (g)",
  keywords: ["Foul beim Anstoß", "Weiße beim Anstoß versenkt", "Fehlstoß Anstoß", "Miscue Anstoß", "Weiße hinter der Kopflinie", "Anstoß wiederholen", "Heyball Anstoß Foul"],
  title: "Heyball: Foul oder Fehlstoß beim Anstoß",
  rule: "Bei einem Foul im Anstoß wählt der Gegner: die Weiße in der Hand hinter der Kopflinie, neu aufbauen und selbst anstoßen oder neu aufbauen und den Gegner anstoßen lassen. Misslingt der Anstoß ungewollt (Fehlstoß, die Weiße trifft das Dreieck nicht), darf der Gegner nur selbst anstoßen oder den Anstoßenden erneut anstoßen lassen, ohne Weiße in der Hand. Ein absichtlich ausgelassener Anstoß oder Fehlstoß ist ein absichtliches Foul (Rackverlust).",
  sets: [{ discs: DHB, tag: "Heyball-Anstoß", variants }],
};

export const en = {
  "Heyball: Foul oder Fehlstoß beim Anstoß": "Heyball: foul or miscue on the break",
  "Bei einem Foul im Anstoß wählt der Gegner: die Weiße in der Hand hinter der Kopflinie, neu aufbauen und selbst anstoßen oder neu aufbauen und den Gegner anstoßen lassen. Misslingt der Anstoß ungewollt (Fehlstoß, die Weiße trifft das Dreieck nicht), darf der Gegner nur selbst anstoßen oder den Anstoßenden erneut anstoßen lassen, ohne Weiße in der Hand. Ein absichtlich ausgelassener Anstoß oder Fehlstoß ist ein absichtliches Foul (Rackverlust).":
    "After a foul on the break the opponent chooses: ball in hand behind the head string, re-rack and break himself, or re-rack and have the opponent break. If the break fails unintentionally (miscue, the cue ball misses the triangle), the opponent may only break himself or have the breaker break again, with no ball in hand. Intentionally not breaking or miscuing is an intentional foul (loss of rack).",
  "Foul beim Anstoß": "foul on the break",
  "Weiße beim Anstoß versenkt": "cue ball pocketed on the break",
  "Fehlstoß Anstoß": "miscue on the break",
  "Miscue Anstoß": "break miscue",
  "Weiße hinter der Kopflinie": "cue ball behind the head string",
  "Anstoß wiederholen": "repeat the break",
  "Heyball Anstoß Foul": "Heyball break foul",
  "Heyball-Anstoß": "Heyball break",
  "Foul – Weiße hinter der Kopflinie": "Foul – ball in hand behind the head string",
  "Fehlstoß – ohne Weiße in der Hand": "Miscue – no ball in hand",
  "Die Weiße fällt beim Anstoß in die Tasche: Foul. Der Gegner darf die Weiße hinter der Kopflinie in die Hand nehmen oder neu aufbauen lassen.": "The cue ball falls into a pocket on the break: foul. The opponent may take ball in hand behind the head string or have the balls re-racked.",
  "Die Weiße trifft das Rack nicht (ungewollter Fehlstoß): der Gegner darf nur selbst anstoßen oder den Anstoßenden erneut anstoßen lassen – ohne Weiße in der Hand.": "The cue ball misses the rack (unintentional miscue): the opponent may only break himself or have the breaker break again – without ball in hand.",
  "Ausgangslage: Der Anstoß beim Heyball.": "Starting position: the Heyball break.",
  "Die Weiße bricht das Rack.": "The cue ball breaks the rack.",
  "Der Anstoß ist kräftig, aber die Weiße fällt in die Tasche – Foul. Der Gegner wählt: Weiße in der Hand hinter der Kopflinie, oder neu aufbauen (selbst oder der Gegner stößt an).": "The break is forceful but the cue ball falls into a pocket – foul. The opponent chooses: ball in hand behind the head string, or re-rack (he breaks or the opponent breaks).",
  "Der Spieler stößt an, rutscht aber ab (Miscue).": "The player breaks but slips (miscue).",
  "Die Weiße rollt am Rack vorbei und trifft keine Kugel. Der Gegner darf selbst anstoßen oder den Anstoßenden noch einmal anstoßen lassen – ohne Weiße in der Hand.": "The cue ball rolls past the rack and hits no ball. The opponent may break himself or have the breaker break again – without ball in hand.",
};
