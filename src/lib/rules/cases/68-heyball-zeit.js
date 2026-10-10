import { cue, ball, cut } from "../../ruleEngine.js";
import { DHB, SOURCE_HEYBALL } from "../meta.js";

/* Heyball, Zeit pro Stoss (WPA Rules of Heyball 14): ueblich 45 Sekunden pro Stoss, ab noch 10 Sekunden gibt es eine
   Erinnerung. Wer die Zeit ueberschreitet, begeht ein Foul. Der Stoss selbst ist beide Male derselbe und regelgerecht
   (Geometrie wie cases/42). */
const T = [150, 50], P = [207, 13], W = [91.2, 88.2];
const shot = cut(W, { id: "4", at: T }, P, { out: true });
const balls = () => [cue(...W), ball(4, ...T), ball(9, 110, 95), ball(12, 60, 30)];
const mk = (label, verdict, verdictLabel, reason, t2, t3) => ({
  label, verdict, verdictLabel, reason, balls: balls(),
  steps: [
    { text: "Ausgangslage: Es wird mit Zeitlimit gespielt, 45 Sekunden pro Stoß. Alle Kugeln liegen still, die Zeit läuft.", focus: ["4"] },
    { text: "Bei noch 10 Sekunden erinnert der Schiedsrichter an die Zeit.", say: "Noch 10 Sekunden", sayIcon: "mouth" },
    { text: t2, aim: [W, shot.contact] },
    { text: t3, expectRail: true, moves: [shot.w, shot.obj], mark: { at: [200, 19], kind: verdict, after: "w", delay: 300 } },
  ],
});
const variants = [
  mk("Fall A", "foul", "Foul – Zeit überschritten",
    "Die Weiße wird erst nach Ablauf der Zeit berührt: Foul, auch wenn der Stoß selbst richtig ist.",
    "Der Spieler zögert, die 45 Sekunden laufen ab, und der Schiedsrichter ruft „Foul“.",
    "Er stößt erst jetzt und versenkt die 4 – trotzdem ein Foul wegen der überschrittenen Zeit."),
  mk("Fall B", "ok", "Kein Foul",
    "Der Spieler stößt innerhalb der Zeit.",
    "Der Spieler stößt nach 43 Sekunden – noch innerhalb der Zeit.",
    "Er versenkt die 4, kein Foul."),
];

export default {
  id: "heyball-zeit",
  released: true,
  discs: DHB,
  src: SOURCE_HEYBALL,
  bookRef: "8.8",
  topic: "ablauf",
  tags: ["foul", "zeit"],
  ref: "14, Kap. I",
  keywords: ["Zeit pro Stoß", "45 Sekunden", "Shot Clock", "Zeitlimit", "Verlängerung", "Zeit überschritten", "zu langsam", "Heyball Zeit"],
  title: "Heyball: Zeit pro Stoß",
  rule: "In der Regel gelten 45 Sekunden pro Stoß, ab noch 10 Sekunden gibt es eine Erinnerung, ab 5 Sekunden zählt der Schiedsrichter herunter. Die Zeit läuft ab dem Stillstand aller Kugeln bis zur Berührung der Weißen. Pro Rack darf jeder Spieler einmal verlängern (üblicherweise 30 Sekunden). Wird die Zeit überschritten, ist es ein Foul. Für den Anstoß gelten 30 Sekunden ohne Verlängerung.",
  sets: [{ discs: DHB, tag: "Du spielst Volle", variants }],
};

export const en = {
  "Heyball: Zeit pro Stoß": "Heyball: time per shot",
  "In der Regel gelten 45 Sekunden pro Stoß, ab noch 10 Sekunden gibt es eine Erinnerung, ab 5 Sekunden zählt der Schiedsrichter herunter. Die Zeit läuft ab dem Stillstand aller Kugeln bis zur Berührung der Weißen. Pro Rack darf jeder Spieler einmal verlängern (üblicherweise 30 Sekunden). Wird die Zeit überschritten, ist es ein Foul. Für den Anstoß gelten 30 Sekunden ohne Verlängerung.": "Usually 45 seconds per shot; there is a reminder at 10 seconds left and the referee counts down from 5. The time runs from the moment all balls are at rest until the cue ball is touched. Each player may call one extension per rack (usually 30 seconds). Exceeding the time is a foul. The break has 30 seconds with no extension.",
  "Zeit pro Stoß": "time per shot",
  "45 Sekunden": "45 seconds",
  "Shot Clock": "shot clock",
  "Zeitlimit": "time limit",
  "Verlängerung": "extension",
  "Zeit überschritten": "time exceeded",
  "zu langsam": "too slow",
  "Heyball Zeit": "Heyball time",
  "Du spielst Volle": "You play solids",
  "Noch 10 Sekunden": "10 seconds left",
  "Foul – Zeit überschritten": "Foul – time exceeded",
  "Kein Foul": "No foul",
  "Die Weiße wird erst nach Ablauf der Zeit berührt: Foul, auch wenn der Stoß selbst richtig ist.": "The cue ball is only touched after the time has expired: foul, even if the shot itself is right.",
  "Der Spieler stößt innerhalb der Zeit.": "The player shoots within the time.",
  "Ausgangslage: Es wird mit Zeitlimit gespielt, 45 Sekunden pro Stoß. Alle Kugeln liegen still, die Zeit läuft.": "Starting position: a time limit is in force, 45 seconds per shot. All balls are at rest, the time is running.",
  "Bei noch 10 Sekunden erinnert der Schiedsrichter an die Zeit.": "With 10 seconds left the referee reminds the player of the time.",
  "Der Spieler zögert, die 45 Sekunden laufen ab, und der Schiedsrichter ruft „Foul“.": "The player hesitates, the 45 seconds run out and the referee calls \"foul\".",
  "Er stößt erst jetzt und versenkt die 4 – trotzdem ein Foul wegen der überschrittenen Zeit.": "He only shoots now and pockets the 4 – still a foul because of the exceeded time.",
  "Der Spieler stößt nach 43 Sekunden – noch innerhalb der Zeit.": "The player shoots after 43 seconds – still within the time.",
  "Er versenkt die 4, kein Foul.": "He pockets the 4, no foul.",
};
