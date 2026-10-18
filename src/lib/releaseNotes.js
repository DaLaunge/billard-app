import { addTranslations } from "./i18n";
import { APP_VERSION } from "./constants";

/* "Neu in dieser Version": ein Popup nach einem Update, das die Neuerungen seit der
   zuletzt gesehenen Version auflistet. Der Katalog ist die einzige Quelle:

   - NEUER EINTRAG OBEN, `version` = APP_VERSION des Pushes, `items` = kurze Saetze fuer
     Spieler (keine Technik), `en` = englische Texte in gleicher Reihenfolge.
   - Pro Geraet merkt sich localStorage `releaseNotesSeen` die zuletzt gesehene Version.
     Gezeigt werden alle Eintraege mit seen < version <= APP_VERSION, zusammengefasst.
   - Fehlt der Wert (erster Start nach diesem Feature), gilt BASELINE als gesehen: so
     erscheinen nur Neuerungen ab jetzt, nicht die ganze Vorgeschichte.
   - Neue Nutzer (die volle Tutorial-Tour bekommen) sehen das Popup nicht; fuer sie wird
     die aktuelle Version still als gesehen markiert.
   Ein Eintrag ohne spuerbare Neuerung (Fehlerbehebung, Technik) wird gar nicht erst
   aufgenommen. */
const BASELINE = "410.2";
const KEY = "releaseNotesSeen";

export const RELEASE_NOTES = [
  { version: "412.3", icon: "📈",
    items: [
      "Neue Liste „Aufsteiger“ bei den Bestenlisten: wer in den letzten 30 Tagen die meisten Rating-Punkte gewonnen hat – so kann auch ganz oben stehen, wer von unten aufholt.",
      "12 neue Aktivitäts-Erfolge: Wochen in Folge gespielt, Spieltage insgesamt und Rückkehr nach einer Pause.",
    ],
    en: [
      "New \"Climbers\" list in the leaderboards: who gained the most rating points in the last 30 days – so players catching up from below can top the list.",
      "12 new activity achievements: weeks played in a row, days played in total and coming back after a break.",
    ] },
  { version: "412.1", icon: "⚖️",
    items: [
      "Fairere Rangliste: Pausieren bringt keine Punkte mehr – ein Rating unter 500 bleibt in der Pause unverändert, nur Ratings über 500 sinken Richtung 500.",
      "Wer 60 Tage nicht gespielt hat, gilt als „ruhend“ und steht nicht mehr in der Rating-Rangliste, bis er wieder ein Match spielt.",
    ],
    en: [
      "Fairer ranking: pausing no longer earns points – a rating below 500 stays unchanged during a break, only ratings above 500 drop toward 500.",
      "After 60 days without a match a player counts as \"dormant\" and is left out of the rating ranking until they play again.",
    ] },
  { version: "412", icon: "✨",
    items: [
      "Neues Menü: Über den Hamburger-Knopf erreichst du alle Bereiche (am PC steht es links). Die Punkte in der Leiste unten wählst du selbst – ziehen zum Ordnen, mit der Nadel anheften.",
      "Das Profil ist jetzt in drei Seiten geteilt: Meine Identität, Meine Zahlen und Meine Erfolge – mit „So sehen dich andere“ und „Auf einen Blick“ (beste Disziplin, Angstgegner).",
      "Tippe auf deine Kugel: Foto aufnehmen oder wählen und einen freigeschalteten Erfolg als Avatar nehmen – mit Suche und fliegender Kugel.",
      "Listen nach Geschmack (Einstellungen): „Tab-Freak“ zeigt Kapitel als Tabs, „Doomscroller“ eine lange Liste mit angepinnten Überschriften.",
      "Schmalere Ränder, rundere Karten und Wischen von Menüpunkt zu Menüpunkt in der Reihenfolge deiner Leiste.",
    ],
    en: [
      "New menu: the hamburger button reaches every section (on a computer it stays on the left). You choose the items in the bar at the bottom – drag to reorder, pin to add.",
      "Your profile is now split into three pages: My identity, My numbers and My achievements – with \"How others see you\" and \"At a glance\" (best discipline, nemesis).",
      "Tap your ball: take or pick a photo and use an unlocked achievement as your avatar – with search and a flying ball.",
      "Lists your way (Settings): \"Tab freak\" shows chapters as tabs, \"Doomscroller\" one long list with pinned headings.",
      "Slimmer margins, rounder cards and swiping from item to item in the order of your bar.",
    ] },
  { version: "410.9", icon: "🪃",
    items: ["Zwei neue Turnier-Erfolge: „Bumerang“ (Verliererbaum gewonnen) und „Comeback-Sieger“ (Turnier gewonnen, obwohl du im Gewinnerbaum verloren hast)."],
    en: ["Two new tournament achievements: \"Boomerang\" (won the losers bracket) and \"Comeback winner\" (won the tournament despite losing in the winners bracket)."] },
  { version: "410.8", icon: "⏸️",
    items: ["Match: Der Pause-Knopf (Timeout) ist jetzt gut sichtbar. Während der Pause ist die Eingabe gesperrt, die Zeit läuft nicht weiter."],
    en: ["Match: the pause button (timeout) is now easy to see. While paused, input is locked and the clock stops."] },
  { version: "410.7", icon: "📜",
    items: ["Unter Profil bearbeiten → Konto & Hilfe findest du jetzt alle Neuerungen im Überblick („Was ist neu?“)."],
    en: ["Under Edit profile → Account & help you now find all new features at a glance (\"What's new?\")."] },
  { version: "410.5", icon: "🧭",
    items: ["Turnierbaum: Mit dem Weg-Symbol siehst du deinen eigenen Turnierweg – deine Partien und die Linien dazwischen leuchten."],
    en: ["Tournament bracket: the route icon shows your own path – your matches and the lines between them light up."] },
  { version: "410.4", icon: "✨",
    items: ["Nach einem Update zeigt dir ein Hinweis, was neu dazugekommen ist."],
    en: ["After an update, a notice shows you what's new."] },
  { version: "410.3", icon: "🎱",
    items: ["8 Ball: Merke dir, wer Volle und wer Halbe spielt – ein Tipp unter den Punkten genügt."],
    en: ["8 Ball: remember who plays solids and who plays stripes – one tap below the score."] },
];

for (const n of RELEASE_NOTES) {
  addTranslations("en", Object.fromEntries(n.items.map((de, i) => [de, n.en[i]])));
}

const parse = (v) => String(v).split(".").map((x) => parseInt(x, 10) || 0);
export function cmpVersion(a, b) {
  const [a1, a2] = parse(a), [b1, b2] = parse(b);
  return a1 - b1 || a2 - b2;
}

export function loadReleaseSeen() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function markReleaseSeen() {
  try { localStorage.setItem(KEY, String(APP_VERSION)); } catch { /* Privatmodus */ }
}

// Neuerungen seit der zuletzt gesehenen Version ([] = nichts zu zeigen).
export function pendingReleaseItems() {
  const seen = loadReleaseSeen() || BASELINE;
  return RELEASE_NOTES.filter((n) => cmpVersion(n.version, seen) > 0 && cmpVersion(n.version, APP_VERSION) <= 0)
    .flatMap((n) => n.items.map((text) => ({ text, icon: n.icon })));
}
