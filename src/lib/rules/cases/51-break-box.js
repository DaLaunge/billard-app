import { cue, ball } from "../../ruleEngine.js";
import { D89, SOURCE_REGULARIEN } from "../meta.js";

/* WPA-Regularien 17 (Bedingungen fuer den Anstoss): Bei offenen Anstoessen (9-Ball, 10-Ball) kann die
   Turnierleitung eine "Break-Box" verlangen: die Weisse darf nur in einer oder mehreren eingeschraenkten
   Flaechen hinter der Kopflinie aufgelegt werden. Lage und Groesse der Box legt die Turnierleitung fest;
   gezeigt ist ein Beispiel (gestrichelt). Welche Folge ein Verstoss hat, steht nicht in den Regularien -
   ueblich ist, dass der Schiedsrichter vor dem Anstoss hinweist und die Weisse versetzt wird.
   Fall A: Weisse in der Box. Fall B: Weisse im Kopffeld, aber ausserhalb der Box. */
const IN = [38, 60], OUT = [38, 24];
const table = { headLine: true, breakBox: true };
const racked = () => [
  ball(1, 141, 60), ball(2, 150.5, 54.5), ball(3, 150.5, 65.5), ball(4, 160, 49), ball(9, 160, 60), ball(5, 160, 71), ball(6, 169.5, 54.5), ball(7, 169.5, 65.5), ball(8, 179, 60),
];
const start = () => [{ ...cue(...IN), hidden: true }, ...racked()];

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "In der Break-Box – erlaubt",
    reason: "Die Weiße liegt innerhalb der von der Turnierleitung festgelegten Break-Box: der Anstoß ist zulässig.",
    table, balls: start(),
    steps: [
      { text: "Ausgangslage: Die Turnierleitung verlangt für den Anstoß eine Break-Box (gestrichelt, hinter der Kopflinie)." },
      { text: "Der Spieler legt die Weiße in die Box – erlaubt.", moves: [{ id: "w", to: IN, place: true }], mark: { at: IN, kind: "ok", delay: 400 } },
    ],
  },
  {
    label: "Fall B", verdict: "foul", verdictLabel: "Außerhalb der Box – nicht erlaubt",
    reason: "Die Weiße liegt zwar im Kopffeld, aber außerhalb der Break-Box: nicht zulässig. Der Schiedsrichter weist darauf hin, die Weiße muss in die Box gelegt werden.",
    table, balls: [{ ...cue(...OUT), hidden: true }, ...racked()],
    steps: [
      { text: "Ausgangslage: Die Turnierleitung verlangt für den Anstoß eine Break-Box (gestrichelt, hinter der Kopflinie)." },
      { text: "Der Spieler legt die Weiße ins Kopffeld, aber außerhalb der Box. Der Schiedsrichter weist ihn darauf hin.", say: "Außerhalb der Box", sayIcon: "mouth", moves: [{ id: "w", to: OUT, place: true }], mark: { at: OUT, kind: "foul", delay: 400 } },
    ],
  },
];

export default {
  id: "break-box",
  released: true,
  src: SOURCE_REGULARIEN,
  discs: D89,
  topic: "anstoss",
  tags: ["anstoss", "kopffeld", "weisse"],
  ref: "17",
  bookRef: "5.3",
  keywords: ["Break-Box", "Breakbox", "Weiße beim Anstoß auflegen", "eingeschränkte Fläche", "Anstoß Bedingungen"],
  title: "Break-Box: Weiße beim Anstoß",
  rule: "Bei Spielen mit offenem Anstoß wie 9-Ball und 10-Ball kann die Turnierleitung zusätzliche Bedingungen für den Anstoß festlegen. Zum Beispiel kann sie eine Break-Box verlangen: Die Weiße darf dann nur in einer oder mehreren eingeschränkten Flächen hinter der Kopflinie aufgelegt werden. Lage und Größe der Box bestimmt die Turnierleitung (die Zeichnung ist ein Beispiel). Zusätzlich kann sie die Drei-Punkte-Regel (Kitchen Rule) verlangen.",
  sets: [{ discs: D89, tag: "Anstoß · Break-Box", variants }],
};

export const en = {
  "Break-Box: Weiße beim Anstoß": "Break box: cue ball on the break",
  "Bei Spielen mit offenem Anstoß wie 9-Ball und 10-Ball kann die Turnierleitung zusätzliche Bedingungen für den Anstoß festlegen. Zum Beispiel kann sie eine Break-Box verlangen: Die Weiße darf dann nur in einer oder mehreren eingeschränkten Flächen hinter der Kopflinie aufgelegt werden. Lage und Größe der Box bestimmt die Turnierleitung (die Zeichnung ist ein Beispiel). Zusätzlich kann sie die Drei-Punkte-Regel (Kitchen Rule) verlangen.": "In games with an open break such as 9-ball and 10-ball the tournament director may set additional conditions for the break. For example a break box may be required: the cue ball may then only be placed in one or more restricted areas behind the head string. The tournament director decides position and size of the box (the drawing is an example). The three-point rule (kitchen rule) may be required in addition.",
  "Break-Box": "break box",
  "Breakbox": "breakbox",
  "Weiße beim Anstoß auflegen": "place the cue ball on the break",
  "eingeschränkte Fläche": "restricted area",
  "Anstoß Bedingungen": "break conditions",
  "Anstoß · Break-Box": "Break · break box",
  "Außerhalb der Box": "Outside the box",
  "In der Break-Box – erlaubt": "In the break box – allowed",
  "Außerhalb der Box – nicht erlaubt": "Outside the box – not allowed",
  "Die Weiße liegt innerhalb der von der Turnierleitung festgelegten Break-Box: der Anstoß ist zulässig.": "The cue ball lies inside the break box set by the tournament director: the break is allowed.",
  "Die Weiße liegt zwar im Kopffeld, aber außerhalb der Break-Box: nicht zulässig. Der Schiedsrichter weist darauf hin, die Weiße muss in die Box gelegt werden.": "The cue ball lies in the kitchen but outside the break box: not allowed. The referee points it out, the cue ball must be placed in the box.",
  "Ausgangslage: Die Turnierleitung verlangt für den Anstoß eine Break-Box (gestrichelt, hinter der Kopflinie).": "Starting position: the tournament director requires a break box for the break (dashed, behind the head string).",
  "Der Spieler legt die Weiße in die Box – erlaubt.": "The player places the cue ball in the box – allowed.",
  "Der Spieler legt die Weiße ins Kopffeld, aber außerhalb der Box. Der Schiedsrichter weist ihn darauf hin.": "The player places the cue ball in the kitchen but outside the box. The referee points it out.",
};
