import { cue } from "../../ruleEngine.js";
import { DHB, SOURCE_HEYBALL } from "../meta.js";
import { rack, brake, hitOf, R15, W } from "../racks.js";

/* Heyball, weicher Anstoss (WPA Rules of Heyball 6 a, 6 b, 18): Der Anstoss muss kraeftig sein. Fall A: die Weisse
   rollt nur sanft gegen das Dreieck, kaum eine Kugel bewegt sich - weicher Anstoss: Verwarnung, beim zweiten Mal
   Rackverlust, beim dritten Mal Matchverlust. Fall B: ein kraeftiger Anstoss ist erlaubt. */
const balls = rack(R15);
const start = () => [cue(...W), ...balls.map((b) => ({ id: String(b.n), n: b.n, x: b.p[0], y: b.p[1] }))];
const HIT = hitOf(R15);

const variants = [
  {
    label: "Fall A", verdict: "foul", verdictLabel: "Weicher Anstoß – Verwarnung",
    reason: "Die Weiße rollt nur sanft ans Dreieck: weicher Anstoß. Beim ersten Mal gibt es eine Verwarnung, beim zweiten Rackverlust, beim dritten Matchverlust.",
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim Heyball." },
      { text: "Der Spieler stößt die Weiße nur ganz sanft an.", aim: [W, HIT] },
      { text: "Die Weiße berührt das Dreieck kaum, keine Kugel läuft an die Bande – weicher Anstoß.", moves: [{ id: "w", to: HIT, stop: true }], mark: { at: [176, 60], kind: "foul", after: "w", afterEnd: true, delay: 300 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok",
    reason: "Der Anstoß ist kräftig, das Dreieck zerstiebt und die Kugeln laufen an die Bande.",
    balls: start(),
    steps: [
      { text: "Ausgangslage: Der Anstoß beim Heyball." },
      { text: "Der Spieler stößt kräftig an.", aim: [W, HIT] },
      { text: "Das Dreieck zerstiebt, mehrere Kugeln laufen an die Bande – ein kräftiger, regelgerechter Anstoß.", moves: brake(R15, balls, [11, 6, 15, 12]), mark: { at: [176, 60], kind: "ok", after: "w", delay: 450 } },
    ],
  },
];

export default {
  id: "heyball-weicher-anstoss",
  released: true,
  discs: DHB,
  src: SOURCE_HEYBALL,
  bookRef: "8.13",
  topic: "anstoss",
  tags: ["anstoss", "verhalten"],
  ref: "6 (a), 6 (b), 18",
  keywords: ["weicher Anstoß", "kräftiger Anstoß", "Anstoß zu leicht", "absichtlich nicht anstoßen", "Verwarnung", "Heyball Anstoß weich"],
  title: "Heyball: Weicher Anstoß",
  rule: "Der Anstoß muss kräftig sein; weiche Anstöße sind verboten. Ob der Anstoß regelgerecht ist, entscheidet der Schiedsrichter. Beim ersten Mal gibt es eine Verwarnung, beim zweiten Mal Rackverlust, beim dritten Mal Matchverlust. Wer den Anstoß absichtlich auslässt oder absichtlich einen Fehlstoß macht, begeht ein absichtliches Foul: Rackverlust beim ersten Mal, Matchverlust beim zweiten Mal.",
  sets: [{ discs: DHB, tag: "Heyball-Anstoß", variants }],
};

export const en = {
  "Heyball: Weicher Anstoß": "Heyball: soft break",
  "Der Anstoß muss kräftig sein; weiche Anstöße sind verboten. Ob der Anstoß regelgerecht ist, entscheidet der Schiedsrichter. Beim ersten Mal gibt es eine Verwarnung, beim zweiten Mal Rackverlust, beim dritten Mal Matchverlust. Wer den Anstoß absichtlich auslässt oder absichtlich einen Fehlstoß macht, begeht ein absichtliches Foul: Rackverlust beim ersten Mal, Matchverlust beim zweiten Mal.": "The break must be forceful; soft breaks are prohibited. The referee decides whether the break is legal. The first time there is a warning, the second time loss of rack, the third time loss of match. Intentionally not breaking or miscuing is an intentional foul: loss of rack the first time, loss of match the second time.",
  "weicher Anstoß": "soft break",
  "kräftiger Anstoß": "forceful break",
  "Anstoß zu leicht": "break too soft",
  "absichtlich nicht anstoßen": "intentionally not breaking",
  "Heyball Anstoß weich": "Heyball soft break",
  "Verwarnung": "caution",
  "Heyball-Anstoß": "Heyball break",
  "Weicher Anstoß – Verwarnung": "Soft break – warning",
  "Die Weiße rollt nur sanft ans Dreieck: weicher Anstoß. Beim ersten Mal gibt es eine Verwarnung, beim zweiten Rackverlust, beim dritten Matchverlust.": "The cue ball only rolls gently against the triangle: soft break. The first time there is a warning, the second time loss of rack, the third time loss of match.",
  "Der Anstoß ist kräftig, das Dreieck zerstiebt und die Kugeln laufen an die Bande.": "The break is forceful, the triangle scatters and the balls run to the cushions.",
  "Ausgangslage: Der Anstoß beim Heyball.": "Starting position: the Heyball break.",
  "Der Spieler stößt die Weiße nur ganz sanft an.": "The player hits the cue ball only very gently.",
  "Die Weiße berührt das Dreieck kaum, keine Kugel läuft an die Bande – weicher Anstoß.": "The cue ball barely touches the triangle, no ball runs to a cushion – soft break.",
  "Der Spieler stößt kräftig an.": "The player breaks forcefully.",
  "Das Dreieck zerstiebt, mehrere Kugeln laufen an die Bande – ein kräftiger, regelgerechter Anstoß.": "The triangle scatters, several balls run to the cushions – a forceful, legal break.",
};
