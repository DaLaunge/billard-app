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
