import { cue, ball, cut } from "../../ruleEngine.js";
import { D89 } from "../meta.js";

/* Beide Faelle spielen denselben Stoss: nur die Ansage unterscheidet sie. */
const W = [70, 60], B2 = [140, 36], B5 = [130, 80];
const balls = () => [cue(...W), ball(2, ...B2), ball(5, ...B5), ball(8, 175, 62), ball(9, 190, 100)];
const shot = cut(W, { id: "5", at: B5 }, [150, 88]);

const variants = [
  {
    label: "Mit Ansage", verdict: "ok",
    reason: "Als Push Out angesagt: 3.2 und 3.3 gelten nicht.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Zweiter Stoß nach dem Anstoß. Die 2 ist die niedrigste Kugel.", focus: ["2"] },
      { text: "Der Spieler sagt „Push Out“ an und spielt die 5 an.", say: "Push Out", aim: [W, B5] },
      {
        text: "Die Weiße trifft die 5 statt der 2 und es läuft keine Kugel an die Bande. Als Push Out erlaubt.",
        say: "Push Out",
        moves: [shot.w, shot.obj],
        mark: { at: B5, kind: "ok", after: "w" },
      },
    ],
  },
  {
    label: "Ohne Ansage", verdict: "foul",
    reason: "Ohne Ansage zählt der Stoß normal: falsche Kugel, keine Bande.",
    balls: balls(),
    steps: [
      { text: "Ausgangslage: Zweiter Stoß nach dem Anstoß. Die 2 ist die niedrigste Kugel.", focus: ["2"] },
      { text: "Der Spieler sagt nichts an und spielt die 5 an.", aim: [W, B5] },
      {
        text: "Die Weiße trifft die 5 statt der 2 und es läuft keine Kugel an die Bande – Foul.",
        moves: [shot.w, shot.obj],
        mark: { at: B5, kind: "foul", after: "w" },
      },
    ],
  },
];

export default {
  id: "push-out",
  released: false,
  discs: D89,
  topic: "ablauf",
  ref: "5.4, 6.4",
  keywords: ["Push-Out", "zweiter Stoß", "Ansage", "Pushout", "nach dem Anstoß"],
  title: "Push Out",
  rule: "Nach einem regelgerechten Anstoß darf die Spielerin oder der Spieler am Tisch den zweiten Stoß als Push Out spielen, muss ihn aber vorher dem Schiedsrichter oder dem Gegner ansagen. Beim Push Out entfallen Erste Berührung (3.2) und Bande nach dem Treffer (3.3): die Weiße darf irgendwohin gespielt werden. Danach wählt der Gegner, ob er die Lage übernimmt oder zurückgibt. Ohne Ansage ist es ein normaler Stoß, und dann gelten alle Regeln.",
  sets: [{ discs: D89, tag: "Niedrigste Kugel: 2", variants }],
};

export const en = {
  "Push Out": "Push out",
  "Nach einem regelgerechten Anstoß darf die Spielerin oder der Spieler am Tisch den zweiten Stoß als Push Out spielen, muss ihn aber vorher dem Schiedsrichter oder dem Gegner ansagen. Beim Push Out entfallen Erste Berührung (3.2) und Bande nach dem Treffer (3.3): die Weiße darf irgendwohin gespielt werden. Danach wählt der Gegner, ob er die Lage übernimmt oder zurückgibt. Ohne Ansage ist es ein normaler Stoß, und dann gelten alle Regeln.":
    "After a legal break the player at the table may play the second shot as a push out, but must announce it to the referee or the opponent first. On a push out first contact (3.2) and cushion after contact (3.3) do not apply: the cue ball may be played anywhere. The opponent then chooses whether to accept the position or hand it back. Without an announcement it is a normal shot and all rules apply.",
  "Push-Out": "Push-out",
  "zweiter Stoß": "second shot",
  "Ansage": "announcement",
  "Pushout": "Pushout",
  "nach dem Anstoß": "after the break",
  "Niedrigste Kugel: 2": "Lowest ball: 2",
  "Mit Ansage": "With announcement",
  "Ohne Ansage": "Without announcement",
  "Als Push Out angesagt: 3.2 und 3.3 gelten nicht.": "Announced as a push out: 3.2 and 3.3 do not apply.",
  "Ohne Ansage zählt der Stoß normal: falsche Kugel, keine Bande.": "Without an announcement the shot counts normally: wrong ball, no cushion.",
  "Ausgangslage: Zweiter Stoß nach dem Anstoß. Die 2 ist die niedrigste Kugel.": "Starting position: second shot after the break. The 2 is the lowest ball.",
  "Der Spieler sagt „Push Out“ an und spielt die 5 an.": "The player announces “push out” and plays the 5.",
  "Die Weiße trifft die 5 statt der 2 und es läuft keine Kugel an die Bande. Als Push Out erlaubt.": "The cue ball hits the 5 instead of the 2 and no ball reaches a cushion. Allowed as a push out.",
  "Der Spieler sagt nichts an und spielt die 5 an.": "The player announces nothing and plays the 5.",
  "Die Weiße trifft die 5 statt der 2 und es läuft keine Kugel an die Bande – Foul.": "The cue ball hits the 5 instead of the 2 and no ball reaches a cushion – foul.",
};
