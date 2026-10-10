import { cue, ball } from "../../ruleEngine.js";
import { DHB, SOURCE_HEYBALL } from "../meta.js";

/* Heyball, Kugel zuruecklegen (WPA Rules of Heyball 7): Muss eine Kugel (hier die 8 nach dem Anstoss) zurueckgelegt
   werden, setzt der Schiedsrichter sie auf ihren urspruenglichen Platz, den Fusspunkt (160, 60). Ist der Fusspunkt
   von einer Kugel besetzt, kommt sie auf die Laengsmittellinie zwischen Fusspunkt und oberer (rechter) Bande, moeglichst
   nahe am Fusspunkt, ohne eine andere Kugel zu beruehren. Die Weisse ist hier nur Kulisse. */
const W = [60, 60], FOOT = [160, 60];
const hidden8 = { id: "8", n: 8, x: FOOT[0], y: FOOT[1], hidden: true };

const variants = [
  {
    label: "Fall A", verdict: "ok", verdictLabel: "Auf den Fußpunkt",
    reason: "Der Fußpunkt ist frei: der Schiedsrichter legt die 8 genau dorthin.",
    balls: [cue(...W), ball(11, 120, 30), ball(3, 125, 90), hidden8],
    steps: [
      { text: "Ausgangslage: Die 8 ist beim Anstoß gefallen und muss zurückgelegt werden. Der Fußpunkt ist frei." },
      { text: "Der Schiedsrichter legt die 8 auf den Fußpunkt.", moves: [{ id: "8", to: FOOT, place: true }], mark: { at: FOOT, kind: "ok", delay: 500 } },
    ],
  },
  {
    label: "Fall B", verdict: "ok", verdictLabel: "Auf die Längsmittellinie",
    reason: "Der Fußpunkt ist besetzt: die 8 kommt auf die Längsmittellinie Richtung Bande, so nah wie möglich an den Fußpunkt, ohne eine Kugel zu berühren.",
    balls: [cue(...W), ball(11, ...FOOT), ball(3, 125, 90), hidden8],
    steps: [
      { text: "Ausgangslage: Die 8 muss zurückgelegt werden, aber die 11 liegt auf dem Fußpunkt.", focus: ["11"] },
      { text: "Der Schiedsrichter legt die 8 auf die Längsmittellinie hinter den Fußpunkt, so nah wie möglich, ohne die 11 zu berühren.", moves: [{ id: "8", to: [172, 60], place: true }], mark: { at: [172, 60], kind: "ok", delay: 500 } },
    ],
  },
];

export default {
  id: "heyball-zuruecklegen",
  released: true,
  discs: DHB,
  src: SOURCE_HEYBALL,
  bookRef: "8.11",
  topic: "tisch",
  tags: ["aufbau", "tisch"],
  ref: "7",
  keywords: ["Kugel zurücklegen", "zurücklegen", "Fußpunkt", "Fußpunkt besetzt", "8 zurücklegen", "Längsmittellinie", "Heyball zurücklegen"],
  title: "Heyball: Kugel zurücklegen",
  rule: "Müssen Kugeln zurückgelegt werden, setzt der Schiedsrichter sie möglichst auf ihre ursprüngliche Stelle (die 8 nach dem Anstoß auf den Fußpunkt). Ist die blockiert, kommt die Kugel auf die Längsmittellinie zwischen Fußpunkt und oberer Bande, möglichst nahe am Fußpunkt, ohne eine andere Kugel zu berühren. Ist die ganze Strecke zwischen Fußpunkt und Bande belegt, kommt sie so nah wie möglich an den Fußpunkt auf die Längsmittellinie. Der Spieler muss die vom Schiedsrichter bestimmte Lage akzeptieren.",
  sets: [{ discs: DHB, variants }],
};

export const en = {
  "Heyball: Kugel zurücklegen": "Heyball: re-spotting a ball",
  "Müssen Kugeln zurückgelegt werden, setzt der Schiedsrichter sie möglichst auf ihre ursprüngliche Stelle (die 8 nach dem Anstoß auf den Fußpunkt). Ist die blockiert, kommt die Kugel auf die Längsmittellinie zwischen Fußpunkt und oberer Bande, möglichst nahe am Fußpunkt, ohne eine andere Kugel zu berühren. Ist die ganze Strecke zwischen Fußpunkt und Bande belegt, kommt sie so nah wie möglich an den Fußpunkt auf die Längsmittellinie. Der Spieler muss die vom Schiedsrichter bestimmte Lage akzeptieren.": "If balls must be re-spotted, the referee places them as close to their original position as possible (the 8 on the foot spot after the break). If that is blocked, the ball goes on the long axis between the foot spot and the top cushion, as close to the foot spot as possible without touching another ball. If the whole line between the foot spot and the cushion is covered, it goes as close to the foot spot as possible on the long axis. The player must accept the position set by the referee.",
  "Kugel zurücklegen": "re-spot a ball",
  "zurücklegen": "re-spot",
  "Fußpunkt": "foot spot",
  "Fußpunkt besetzt": "foot spot occupied",
  "8 zurücklegen": "re-spot the 8",
  "Längsmittellinie": "long axis",
  "Heyball zurücklegen": "Heyball re-spot",
  "Auf den Fußpunkt": "On the foot spot",
  "Auf die Längsmittellinie": "On the long axis",
  "Der Fußpunkt ist frei: der Schiedsrichter legt die 8 genau dorthin.": "The foot spot is free: the referee places the 8 exactly there.",
  "Der Fußpunkt ist besetzt: die 8 kommt auf die Längsmittellinie Richtung Bande, so nah wie möglich an den Fußpunkt, ohne eine Kugel zu berühren.": "The foot spot is occupied: the 8 goes on the long axis towards the cushion, as close to the foot spot as possible without touching a ball.",
  "Ausgangslage: Die 8 ist beim Anstoß gefallen und muss zurückgelegt werden. Der Fußpunkt ist frei.": "Starting position: the 8 dropped on the break and must be re-spotted. The foot spot is free.",
  "Der Schiedsrichter legt die 8 auf den Fußpunkt.": "The referee places the 8 on the foot spot.",
  "Ausgangslage: Die 8 muss zurückgelegt werden, aber die 11 liegt auf dem Fußpunkt.": "Starting position: the 8 must be re-spotted, but the 11 lies on the foot spot.",
  "Der Schiedsrichter legt die 8 auf die Längsmittellinie hinter den Fußpunkt, so nah wie möglich, ohne die 11 zu berühren.": "The referee places the 8 on the long axis behind the foot spot, as close as possible without touching the 11.",
};
