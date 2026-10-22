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
  { version: "419.2", icon: "🖼️",
    items: ["Dein Profilbild: Die Kugel wird beim Scrollen groß und rückt in die Mitte, ein gewählter Erfolg fliegt sanft in die Kugel, und dein Foto kannst du in voller Größe ansehen."],
    en: ["Your profile picture: the ball grows and moves to the center as you scroll, a chosen achievement glides smoothly into the ball, and you can view your photo at full size."] },
  { version: "419", icon: "🔤",
    items: ["Neu in den Einstellungen unter Aussehen: ein Regler macht die Schrift der ganzen App größer oder kleiner."],
    en: ["New in Settings under Appearance: a slider makes the text of the whole app larger or smaller."] },
  { version: "415.5", icon: "📑",
    items: ["Tab-Freak und Doomscroller gelten jetzt in allen Menüs: Statistik, Einstellungen, Verwaltung, Regelkunde, Erfolge und Bestenlisten zeigen entweder Kapitel-Tabs oder eine lange Liste mit angepinnten Überschriften.", "Am PC haben alle Seiten eine einheitliche, mittige Spalte."],
    en: ["Tab freak and Doomscroller now apply in every menu: Statistics, Settings, Admin, Rules, Achievements and the leaderboards show either chapter tabs or one long list with pinned headings.", "On desktop all pages now share one centered column."] },
  { version: "415.4", icon: "🧲",
    items: ["Neue Erfolge fürs Werben: bei 10, 15 und 20 geworbenen Mitgliedern gibt es jetzt Magnet, Gemeinschaft und Großfamilie."],
    en: ["New achievements for recruiting: at 10, 15 and 20 recruited members you now earn Magnet, Community and Big family."] },
  { version: "412.27", icon: "🔬",
    items: ["Ratings werden jetzt mit einer Nachkommastelle angezeigt (z. B. 503,4 statt 503) – so siehst du auch kleine Bewegungen."],
    en: ["Ratings now show one decimal place (e.g. 503.4 instead of 503) – so you can see even small movements."] },
  { version: "412.26", icon: "📈",
    items: ["Das Club-Profil zeigt jetzt gleich die Statistik des Clubs: Mitglieder, Durchschnitts-Rating, Matches, Siegquote gegen andere und das stärkste Mitglied – die Mitglieder stehen als Club-Rangliste mit Rating."],
    en: ["The club profile now shows the club's stats right away: members, average rating, matches, win rate against others and the strongest member – members are listed as a club ranking with their rating."] },
  { version: "412.19", icon: "📊",
    items: ["„Auf einen Blick“ in deiner Identität zeigt jetzt deine wichtigsten Rekorde (beste Serie, Zu-Null-Siege, Höchstserie …) und den Angstgegner. Ein Tipp darauf öffnet „Meine Zahlen“."],
    en: ["\"At a glance\" in your identity now shows your key records (best streak, shutout wins, high run …) and your nemesis. Tap it to open \"My stats\"."] },
  { version: "412.18", icon: "🏛️",
    items: ["Club-Profile: Unter „Clubs entdecken“ (und per Klick auf einen Club-Tag) siehst du zu jedem Club Logo, Motto, Gründer, Mitglieder und das Durchschnitts-Rating. Die Club-Leitung kann ein Motto setzen."],
    en: ["Club profiles: under \"Discover clubs\" (and by tapping a club tag) you see each club's logo, motto, founder, members and average rating. Club leaders can set a motto."] },
  { version: "412.15", icon: "👥",
    items: ["In Listen steht neben Spielern jetzt das Tag ihres Clubs. Ein Tipp darauf zeigt alle Mitglieder des Clubs – und wenn du noch nicht dabei bist, kannst du gleich Beitritt anfragen."],
    en: ["Lists now show the tag of a player's club next to their name. Tap it to see all members of the club – and if you are not in yet, you can request to join right away."] },
  { version: "412.14", icon: "🛡️",
    items: ["Neu auf deiner Identitätskarte: eine Kachel mit deinem Club (Tipp = Logo groß, bei mehreren Clubs mit Wechsel) und deine stärkste Disziplin samt Punkten in der Zahlenreihe. Club-Logos sind jetzt schärfer."],
    en: ["New on your identity card: a tile with your club (tap = big logo, with a switch if you have several clubs) and your strongest discipline with its points in the numbers row. Club logos are now sharper."] },
  { version: "412.9", icon: "🖼️",
    items: ["Clubs können ein Logo bekommen: Die Club-Leitung wählt ein Bild, und es erscheint im Club-Tag."],
    en: ["Clubs can have a logo: the club leader picks an image and it shows in the club tag."] },
  { version: "412.8", icon: "🍇",
    items: ["Neue Farbdesigns: „Pink“ mit knalligem Rosa und „Indigo“ (blauviolett, vorher „Lila“). „Petrol“ ist weggefallen, weil es Grün zu ähnlich sah – wer Petrol hatte, bekommt Grün."],
    en: ["New color themes: \"Pink\" with a vivid pink accent and \"Indigo\" (blue-violet, formerly \"Purple\"). \"Teal\" is gone because it looked too much like Green – if you had Teal you now get Green."] },
  { version: "412.6", icon: "💌",
    items: [
      "Club-Einladungen: Die Club-Leitung kann Spieler einladen – du entscheidest per Zusage. Oder du fragst selbst bei einem Club an, dann bestätigt ihn die Leitung.",
      "Neu auf deiner Profilseite: „Clubs“ führt dich zu allen Club-Einstellungen, und „Club-Post“ zeigt offene Einladungen und Anfragen. QR-Codes zum Beitreten gibt es weiterhin.",
    ],
    en: [
      "Club invitations: club leaders can invite players – you decide with a yes. Or request to join a club yourself and the leader confirms.",
      "New on your profile page: \"Clubs\" takes you to all club settings, and \"Club mail\" shows open invitations and requests. QR codes to join are still there.",
    ] },
  { version: "412.5", icon: "🏷️",
    items: [
      "Clubs: Gründe deinen eigenen Club mit Kürzel und Farbe – er erscheint als Tag in deinem Profil. Du wirst Club-Leiter, kannst weitere Admins ernennen und die Leitung übergeben.",
      "Mitglieder treten per Einladungs-Code oder Link bei. Spieler ohne Club sind ganz normal – nichts ändert sich für dich, wenn du keinem Club angehörst.",
    ],
    en: [
      "Clubs: found your own club with a tag and color – it shows as a tag in your profile. You become club leader, can appoint more admins and hand over the leadership.",
      "Members join with an invite code or link. Players without a club are perfectly normal – nothing changes for you if you are not in a club.",
    ] },
  { version: "412.4", icon: "🌱",
    items: [
      "Anfänger-Bonus: In den ersten 10 Spielen zählt jedes Match doppelt so stark – dein Rating findet schneller seinen Platz.",
      "Du erscheinst schon nach deinem ersten Spiel in der Rangliste (unter den gefestigten Ratings, mit „vorläufig“-Zeichen). Nach dem 10. Spiel verschwindet das Zeichen.",
    ],
    en: [
      "Beginner bonus: in your first 10 games every match counts twice as much – your rating finds its place faster.",
      "You show up in the ranking after your very first game (below the settled ratings, with a \"provisional\" mark). The mark disappears after your 10th game.",
    ] },
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
