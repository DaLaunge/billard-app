import { cue, ball, cut, cutAngle } from "../../ruleEngine.js";
import { D89, D8, D141, tagSets } from "../meta.js";

/* Ein Foul muss angesagt werden, BEVOR der naechste Stoss ausgefuehrt wird, sonst gilt es als
   nicht begangen (Kap. 3, Einleitung; 8 Ball auch 4.8). Fall A: niemand sagt das Foul an, der
   Gegner spielt - es zaehlt nicht mehr. Fall B: der Schiedsrichter sagt es sofort an. */
const W0 = [60, 60];
const P2 = [140, 40], P6 = [125, 82], P9 = [190, 70];

const build = (lowId, wrongId, extra, soft, tx, inHand = true) => {
  const s1 = soft ? cutAngle(W0, { id: wrongId, at: P6 }, 10, 12) : cut(W0, { id: wrongId, at: P6 }, [150, 104.5]);
  const s2 = cut(s1.w.to, { id: lowId, at: P2 }, [160, 15.5]);
  const balls = () => [cue(...W0), ball(Number(lowId), ...P2), ball(Number(wrongId), ...P6), ball(9, ...P9), ...extra];
  const foul = { text: tx.foul, wrongFirst: !soft, expectRail: !soft, moves: [s1.w, s1.obj], mark: { at: P6, kind: "foul", after: "w" } };
  return [
    {
      label: "Fall A", verdict: "ok", verdictLabel: "Foul gilt nicht mehr",
      reason: "Das Foul wurde nicht vor dem nächsten Stoß angesagt: es gilt als nicht begangen.",
      balls: balls(),
      steps: [
        { text: tx.start, focus: [lowId] },
        foul,
        { text: tx.next, opponent: true, expectRail: true, moves: [s2.w, s2.obj] },
      ],
    },
    {
      label: "Fall B", verdict: "foul", verdictLabel: inHand ? "Foul gilt: Ball in Hand" : "Foul gilt: −1 Punkt",
      reason: inHand ? "Das Foul wurde sofort angesagt: der Gegner bekommt die Weiße in die Hand." : "Das Foul wurde sofort angesagt: ein Punkt Abzug, der Gegner spielt die Weiße, wo sie liegt.",
      balls: balls(),
      steps: [
        { text: tx.start, focus: [lowId] },
        { ...foul, say: "Foul!", sayIcon: "mouth", text: tx.foulCalled },
        inHand
          ? { text: "Der Gegner hat die Weiße in der Hand und legt sie, wohin er will.", moves: [{ id: "w", to: [98, 64], place: true }] }
          : { text: "Dem Spieler wird ein Punkt abgezogen, der Gegner spielt die Weiße von dort, wo sie liegt." },
      ],
    },
  ];
};

const nine = build("2", "6", [], false, {
  start: "Ausgangslage: Die 2 ist die niedrigste Kugel. Der Spieler stößt.",
  foul: "Die Weiße berührt zuerst die 6 statt der 2 – ein Foul, das aber niemand ansagt.",
  foulCalled: "Die Weiße berührt zuerst die 6 statt der 2. Der Schiedsrichter sagt sofort „Foul“ an.",
  next: "Der Gegner spielt seinen Stoß. Das Foul wurde nicht rechtzeitig angesagt und zählt jetzt nicht mehr.",
});
const eight = build("13", "11", [ball(3, 80, 100)], false, {
  start: "Ausgangslage: Du spielst Volle, der Gegner Halbe. Du stößt.",
  foul: "Die Weiße berührt zuerst die 11 des Gegners – ein Foul, das aber niemand ansagt.",
  foulCalled: "Die Weiße berührt zuerst die 11 des Gegners. Der Schiedsrichter sagt sofort „Foul“ an.",
  next: "Der Gegner spielt seine Halbe 13. Das Foul wurde nicht rechtzeitig angesagt und zählt jetzt nicht mehr.",
});
const straight = build("5", "6", [], true, {
  start: "Ausgangslage: Der Spieler sagt die 5 an und stößt.",
  foul: "Nach dem Treffer berührt keine Kugel eine Bande – ein Foul, das aber niemand ansagt.",
  foulCalled: "Nach dem Treffer berührt keine Kugel eine Bande. Der Schiedsrichter sagt sofort „Foul“ an.",
  next: "Der Gegner spielt seinen Stoß. Das Foul wurde nicht rechtzeitig angesagt und zählt jetzt nicht mehr.",
}, false);

export default {
  id: "foul-zu-spaet",
  released: true,
  discs: ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"],
  topic: "ablauf",
  ref: "3 (Einleitung), 3.13, 1.11",
  keywords: ["Foul zu spät", "Foul nicht angesagt", "Foul angesagt", "nächster Stoß", "Protest", "Foulansage", "nachträglich", "Foul übersehen"],
  title: "Foul zu spät erkannt",
  rule: "Wird ein Foul nicht erkannt, bevor der nächste Stoß ausgeführt wurde, gilt es als nicht begangen. Der Schiedsrichter sagt Fouls sofort, laut und deutlich an. Auch ein Protest oder eine Regelanfrage muss vor dem nächsten Stoß erfolgen, sonst wird sie nicht mehr berücksichtigt. Beim 8-Ball gilt dasselbe für Verstöße, die zum Spielverlust führen würden (außer dem Verwechseln der Gruppen, siehe dort). Der Schiedsrichter darf einen Spieler nicht auf einen möglicherweise unkorrekten Stoß aufmerksam machen, vor einem dritten Foul muss er aber warnen.",
  sets: [
    { discs: D89, tag: "Niedrigste Kugel: 2", variants: nine },
    { discs: D8, tag: "Du spielst Volle", variants: eight },
    { discs: ["14/1 Endlos"], tag: "14/1 · Ansage: 5", variants: straight },
  ],
};

export const en = {
  "Foul zu spät erkannt": "Foul noticed too late",
  "Wird ein Foul nicht erkannt, bevor der nächste Stoß ausgeführt wurde, gilt es als nicht begangen. Der Schiedsrichter sagt Fouls sofort, laut und deutlich an. Auch ein Protest oder eine Regelanfrage muss vor dem nächsten Stoß erfolgen, sonst wird sie nicht mehr berücksichtigt. Beim 8-Ball gilt dasselbe für Verstöße, die zum Spielverlust führen würden (außer dem Verwechseln der Gruppen, siehe dort). Der Schiedsrichter darf einen Spieler nicht auf einen möglicherweise unkorrekten Stoß aufmerksam machen, vor einem dritten Foul muss er aber warnen.":
    "If a foul is not noticed before the next shot is played, it counts as not committed. The referee calls fouls immediately, loudly and clearly. A protest or a rules question must also be made before the next shot, otherwise it is no longer considered. In 8-ball the same applies to violations that would lose the game (except mixing up the groups, see there). The referee must not point out a possibly incorrect shot to a player, but he must warn before a third foul.",
  "Foul zu spät": "foul too late",
  "Foul nicht angesagt": "foul not called",
  "Foul angesagt": "foul called",
  "nächster Stoß": "next shot",
  "Protest": "protest",
  "Foulansage": "foul call",
  "nachträglich": "afterwards",
  "Foul übersehen": "foul overlooked",
  "Niedrigste Kugel: 2": "Lowest ball: 2",
  "Du spielst Volle": "You play solids",
  "14/1 · Ansage: 5": "14.1 · call: 5",
  "Foul!": "Foul!",
  "Foul gilt nicht mehr": "Foul no longer counts",
  "Foul gilt: Ball in Hand": "Foul counts: ball in hand",
  "Das Foul wurde nicht vor dem nächsten Stoß angesagt: es gilt als nicht begangen.": "The foul was not called before the next shot: it counts as not committed.",
  "Das Foul wurde sofort angesagt: der Gegner bekommt die Weiße in die Hand.": "The foul was called immediately: the opponent gets ball in hand.",
  "Ausgangslage: Die 2 ist die niedrigste Kugel. Der Spieler stößt.": "Starting position: the 2 is the lowest ball. The player shoots.",
  "Die Weiße berührt zuerst die 6 statt der 2 – ein Foul, das aber niemand ansagt.": "The cue ball touches the 6 first instead of the 2 – a foul, but nobody calls it.",
  "Die Weiße berührt zuerst die 6 statt der 2. Der Schiedsrichter sagt sofort „Foul“ an.": "The cue ball touches the 6 first instead of the 2. The referee calls “foul” immediately.",
  "Der Gegner spielt seinen Stoß. Das Foul wurde nicht rechtzeitig angesagt und zählt jetzt nicht mehr.": "The opponent plays his shot. The foul was not called in time and no longer counts.",
  "Ausgangslage: Du spielst Volle, der Gegner Halbe. Du stößt.": "Starting position: you play solids, the opponent plays stripes. You shoot.",
  "Die Weiße berührt zuerst die 11 des Gegners – ein Foul, das aber niemand ansagt.": "The cue ball touches the opponent's 11 first – a foul, but nobody calls it.",
  "Die Weiße berührt zuerst die 11 des Gegners. Der Schiedsrichter sagt sofort „Foul“ an.": "The cue ball touches the opponent's 11 first. The referee calls “foul” immediately.",
  "Der Gegner spielt seine Halbe 13. Das Foul wurde nicht rechtzeitig angesagt und zählt jetzt nicht mehr.": "The opponent plays his stripe 13. The foul was not called in time and no longer counts.",
  "Ausgangslage: Der Spieler sagt die 5 an und stößt.": "Starting position: the player calls the 5 and shoots.",
  "Nach dem Treffer berührt keine Kugel eine Bande – ein Foul, das aber niemand ansagt.": "After the hit no ball touches a cushion – a foul, but nobody calls it.",
  "Nach dem Treffer berührt keine Kugel eine Bande. Der Schiedsrichter sagt sofort „Foul“ an.": "After the hit no ball touches a cushion. The referee calls “foul” immediately.",
  "Der Gegner hat die Weiße in der Hand und legt sie, wohin er will.": "The opponent has the cue ball in hand and places it wherever he wants.",
  "Foul gilt: −1 Punkt": "Foul counts: −1 point",
  "Das Foul wurde sofort angesagt: ein Punkt Abzug, der Gegner spielt die Weiße, wo sie liegt.": "The foul was called immediately: one point deducted, the opponent plays the cue ball where it lies.",
  "Dem Spieler wird ein Punkt abgezogen, der Gegner spielt die Weiße von dort, wo sie liegt.": "One point is deducted from the player, the opponent plays the cue ball from where it lies.",
};
