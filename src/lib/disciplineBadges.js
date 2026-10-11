/* Erfolge je Disziplin ("Disziplinen"): EINE Datenquelle fuer die Migration (scripts/genDisciplineBadges.mjs ->
   supabase/2026-10-11_discipline_badges.sql), die englischen Texte (i18n) und - ueber die Katalog-Spalten family,
   threshold, discipline - die Fortschrittsanzeige. Reine Daten, node-tauglich.

   Familien (Kuerzel = Spalte badge_catalog.family):
     je Disziplin: m Matches gespielt | w Siege | n zu null gewonnen | s Siege in Folge (in dieser Disziplin) | g verschiedene Gegner
     in JEDER Disziplin (kleinster Wert ueber alle fuenf): xw Siege | xm Matches | xn zu null
     Doppel: dm Doppel gespielt | dw Doppel-Siege | ds Doppel-Siege in Folge | dp verschiedene Partner
   Gezaehlt wird wie bei allen Erfolgen: nur bestaetigte Matches ohne Gast-Beteiligung; je Disziplin und "Alle" nur Einzel,
   "Doppel" nur Doppel (ein Doppelmatch zaehlt fuer alle vier mit dem Ergebnis der eigenen Seite).
   Emoji: katalogweit eindeutig (Pflicht, siehe Erinnerung zu badge_catalog) - vor dem Einspielen pruefen. */

export const DISCIPLINES = ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos", "Heyball"];
export const SLUG = { "8 Ball": "8ball", "9 Ball": "9ball", "10 Ball": "10ball", "14/1 Endlos": "141", "Heyball": "heyball" };

// Stufen je Familie
export const TIERS = { m: [1, 10, 50, 100, 200, 500], w: [1, 10, 25, 50, 100], n: [1, 5, 10], s: [3, 5], g: [5, 10] };
const ORDER = ["m", "w", "n", "s", "g"];

// [Emoji, Name, englischer Name] je Stufe, in der Reihenfolge m(6) w(5) n(3) s(2) g(2)
const SETS = {
  "8 Ball": [
    ["🤠", "Greenhorn", "Greenhorn"], ["🥾", "Stiefelträger", "Boot Wearer"], ["🪕", "Saloon-Stammgast", "Saloon Regular"],
    ["🌄", "Weitreiter", "Long Rider"], ["🚂", "Eisenbahnbaron", "Railroad Baron"], ["🛤️", "Pionier des Westens", "Pioneer of the West"],
    ["🌵", "Steppenläufer", "Tumbleweed"], ["🐎", "Mustang-Reiter", "Mustang Rider"], ["🦬", "Büffeljäger", "Buffalo Hunter"],
    ["🏜️", "Herr der Prärie", "Lord of the Prairie"], ["🐂", "Rinderbaron", "Cattle Baron"],
    ["🐍", "Klapperschlange", "Rattlesnake"], ["🕷️", "Schwarze Witwe", "Black Widow"], ["🐺", "Einsamer Wolf", "Lone Wolf"],
    ["🐪", "Karawane", "Caravan"], ["🦂", "Skorpionstich", "Scorpion Sting"],
    ["🍺", "Saloon-Gesellschaft", "Saloon Crowd"], ["🏇", "Pony-Express", "Pony Express"],
  ],
  "9 Ball": [
    ["🐚", "Muschelsucher", "Shell Collector"], ["⚓", "Anker geworfen", "Anchors Aweigh"], ["🦑", "Tiefseetaucher", "Deep-Sea Diver"],
    ["🚢", "Kapitän", "Captain"], ["⛵", "Weltumsegler", "Circumnavigator"], ["🏝️", "Inselkönig", "Island King"],
    ["🦀", "Strandkrabbe", "Beach Crab"], ["🐠", "Korallenfisch", "Coral Fish"], ["🐬", "Delfinreiter", "Dolphin Rider"],
    ["🐳", "Großwal", "Great Whale"], ["🌊", "Tsunami", "Tsunami"],
    ["🦈", "Haifischbiss", "Shark Bite"], ["🐡", "Kugelfisch", "Pufferfish"], ["🦭", "Eisscholle", "Ice Floe"],
    ["🐟", "Fischschwarm", "School of Fish"], ["🐙", "Krakenarme", "Kraken Arms"],
    ["🦞", "Hafenbekanntschaft", "Harbor Acquaintance"], ["🛥️", "Hafenmeister", "Harbor Master"],
  ],
  "10 Ball": [
    ["🌴", "Palmenschatten", "Palm Shade"], ["🍌", "Bananenpflücker", "Banana Picker"], ["🥥", "Kokosknacker", "Coconut Cracker"],
    ["🌺", "Dschungelblüte", "Jungle Bloom"], ["🍃", "Blätterdach", "Canopy"], ["🪵", "Urwaldriese", "Rainforest Giant"],
    ["🦜", "Papageienruf", "Parrot Call"], ["🐒", "Lianenschwinger", "Vine Swinger"], ["🦥", "Faultier-Taktik", "Sloth Tactics"],
    ["🐆", "Jaguar", "Jaguar"], ["🦍", "Herr des Urwalds", "Lord of the Rainforest"],
    ["🐊", "Krokodilsbiss", "Crocodile Bite"], ["🐸", "Giftfrosch", "Poison Frog"], ["🦟", "Moskitoschwarm", "Mosquito Swarm"],
    ["🦧", "Baumwipfelsprung", "Treetop Leap"], ["🦎", "Chamäleon", "Chameleon"],
    ["🦩", "Flamingoschwarm", "Flamingo Flock"], ["🦒", "Weitblick", "Far-Sighted"],
  ],
  "14/1 Endlos": [
    ["🎵", "Erster Ton", "First Note"], ["🎶", "Melodie", "Melody"], ["🎼", "Notenblatt", "Sheet Music"],
    ["🎧", "Studiotag", "Studio Day"], ["📻", "Radiohit", "Radio Hit"], ["🎙️", "Live-Legende", "Live Legend"],
    ["🎸", "Erster Akkord", "First Chord"], ["🎷", "Jazz-Sieger", "Jazz Winner"], ["🎺", "Fanfare", "Fanfare"],
    ["🎻", "Konzertmeister", "Concertmaster"], ["🎹", "Maestro", "Maestro"],
    ["🪗", "Generalpause", "General Rest"], ["🪘", "Trommelwirbel", "Drum Roll"], ["🎚️", "Mute-Taste", "Mute Button"],
    ["🔔", "Dreiklang", "Triad"], ["🎤", "Zugabe!", "Encore!"],
    ["📯", "Jam-Session", "Jam Session"], ["💿", "Sampler", "Sampler"],
  ],
  "Heyball": [
    ["🀄", "Heyball-Debüt", "Heyball Debut"], ["🏮", "Laternenträger", "Lantern Bearer"], ["🐼", "Heyball-Stammgast", "Heyball Regular"],
    ["🎎", "Puppenspieler", "Puppeteer"], ["🎑", "Mondfest", "Moon Festival"], ["🎍", "Bambuswald", "Bamboo Forest"],
    ["🧧", "Glücksbringer", "Lucky Charm"], ["🥢", "Feine Klinge", "Fine Blade"], ["🐘", "Dickes Fell", "Thick Skin"],
    ["🏯", "Festungsherr", "Lord of the Fortress"], ["🍵", "Teemeister", "Tea Master"],
    ["🥋", "Weiße Weste", "Clean Sheet"], ["🍜", "Kein Tropfen Suppe", "Not a Drop of Soup"], ["🥟", "Leere Schüssel", "Empty Bowl"],
    ["🐅", "Tigersprung", "Tiger Leap"], ["🦚", "Pfauenrad", "Peacock Display"],
    ["🎏", "Karpfenschwarm", "Carp School"], ["🥮", "Mondkuchen-Runde", "Mooncake Round"],
  ],
};

// Die zwoelf frueheren Heyball-Erfolge (supabase/2026-10-10b) wandern auf die neuen Schluessel - vergebene bleiben erhalten.
export const OLD_HEYBALL = {
  heyball_1: "d_heyball_m1", heyball_10: "d_heyball_m10", heyball_50: "d_heyball_m50",
  heyball_win1: "d_heyball_w1", heyball_win10: "d_heyball_w10", heyball_win25: "d_heyball_w25", heyball_win50: "d_heyball_w50", heyball_win100: "d_heyball_w100",
  heyball_shutout: "d_heyball_n1", heyball_streak3: "d_heyball_s3", heyball_streak5: "d_heyball_s5", heyball_opp5: "d_heyball_g5",
};

// "Alle Disziplinen" und "Doppel": [Familie, Stufe, Emoji, Name, englischer Name]
const CROSS = [
  ["xw", 1, "🎪", "Zirkusdirektor", "Ringmaster"], ["xw", 5, "🗺️", "Weltenbummler", "World Wanderer"], ["xw", 10, "🧳", "Globetrotter", "Globetrotter"],
  ["xw", 25, "🛕", "Jahrmarktskönig", "Fairground King"], ["xw", 50, "🌐", "Universalgenie", "Universal Genius"],
  ["xm", 10, "🎡", "Riesenrad", "Ferris Wheel"], ["xm", 50, "🎢", "Achterbahn", "Roller Coaster"], ["xm", 100, "🎀", "Goldene Schleife", "Golden Ribbon"],
  ["xn", 1, "🤹", "Jongleur", "Juggler"], ["xn", 5, "🤡", "Clown mit Biss", "Clown with Bite"],
];
const DOUBLES = [
  ["dm", 1, "👯", "Erstes Duo", "First Duo"], ["dm", 10, "👫", "Stammduo", "Regular Duo"], ["dm", 50, "👭", "Dreamteam", "Dream Team"],
  ["dm", 100, "👬", "Eingespielt", "In Sync"], ["dm", 200, "🤼", "Tag-Team-Veteran", "Tag Team Veteran"],
  ["dw", 1, "🙌", "Hand drauf", "High Five"], ["dw", 10, "👏", "Applaus im Doppel", "Applause in Doubles"], ["dw", 25, "💪", "Starkes Team", "Strong Team"],
  ["dw", 50, "🛶", "Im selben Boot", "In the Same Boat"], ["dw", 100, "🚲", "Tandem-Meister", "Tandem Master"],
  ["ds", 3, "🤾", "Pass-Spiel", "Passing Play"], ["ds", 5, "🏓", "Ballwechsel", "Rally"],
  ["dp", 5, "💃", "Tanzpartner", "Dance Partner"], ["dp", 10, "💑", "Die ganze Tanzschule", "The Whole Dance School"],
];

/* Beschreibungen (deutsch/englisch) je Familie und Stufe; {D} = Disziplin (Eigenname, bleibt in beiden Sprachen). */
const DESC = {
  m: (n, D) => [n === 1 ? `1 Match in ${D} gespielt` : `${n} Matches in ${D} gespielt`, n === 1 ? `Played 1 match in ${D}` : `Played ${n} matches in ${D}`],
  w: (n, D) => [n === 1 ? `Erstes Match in ${D} gewonnen` : `${n} Siege in ${D}`, n === 1 ? `Won your first match in ${D}` : `${n} wins in ${D}`],
  n: (n, D) => [n === 1 ? `Ein Match in ${D} zu null gewonnen` : `${n} Matches in ${D} zu null gewonnen`, n === 1 ? `Won a match in ${D} to zero` : `Won ${n} matches in ${D} to zero`],
  s: (n, D) => [`${n} Siege in Folge in ${D}`, `${n} wins in a row in ${D}`],
  g: (n, D) => [`Gegen ${n} verschiedene Gegner in ${D} gespielt`, `Played ${n} different opponents in ${D}`],
  xw: (n) => [n === 1 ? "In jeder Disziplin mindestens 1 Sieg (in allen 5 Disziplinen gesiegt)" : `In jeder Disziplin mindestens ${n} Siege`,
    n === 1 ? "At least 1 win in every discipline (won in all 5 disciplines)" : `At least ${n} wins in every discipline`],
  xm: (n) => [`In jeder Disziplin mindestens ${n} Matches gespielt`, `At least ${n} matches played in every discipline`],
  xn: (n) => [n === 1 ? "In jeder Disziplin mindestens 1 Match zu null gewonnen" : `In jeder Disziplin mindestens ${n} Matches zu null gewonnen`,
    n === 1 ? "At least 1 match won to zero in every discipline" : `At least ${n} matches won to zero in every discipline`],
  dm: (n) => [n === 1 ? "1 Doppel gespielt" : `${n} Doppel gespielt`, n === 1 ? "Played 1 doubles match" : `Played ${n} doubles matches`],
  dw: (n) => [n === 1 ? "Erstes Doppel gewonnen" : `${n} Doppel-Siege`, n === 1 ? "Won your first doubles match" : `${n} doubles wins`],
  ds: (n) => [`${n} Doppel-Siege in Folge`, `${n} doubles wins in a row`],
  dp: (n) => [`Doppel mit ${n} verschiedenen Partnern gespielt`, `Played doubles with ${n} different partners`],
};

const SUBS = { cross: "Alle Disziplinen", doubles: "Doppel" };

/* Alle neuen Erfolge als flache Liste. sort: ab 1000 (hinter dem bisherigen Katalog), Reihenfolge = Block, Familie, Stufe. */
export const BADGES = (() => {
  const out = [];
  let sort = 1000;
  for (const disc of DISCIPLINES) {
    let i = 0;
    for (const fam of ORDER) {
      TIERS[fam].forEach((n, ti) => {
        const [emoji, name, nameEn] = SETS[disc][i++];
        const [descDe, descEn] = DESC[fam](n, disc);
        out.push({ key: `d_${SLUG[disc]}_${fam}${n}`, emoji, name, nameEn, descDe, descEn, family: fam, threshold: n, discipline: disc, sub: disc, tier: ti + 1, sort: sort++ });
      });
    }
  }
  const extra = (list, sub, prefix) => {
    const seen = {};
    for (const [fam, n, emoji, name, nameEn] of list) {
      const [descDe, descEn] = DESC[fam](n);
      seen[fam] = (seen[fam] || 0) + 1;
      out.push({ key: `${prefix}_${fam}${n}`, emoji, name, nameEn, descDe, descEn, family: fam, threshold: n, discipline: null, sub, tier: seen[fam], sort: sort++ });
    }
  };
  extra(CROSS, SUBS.cross, "dx");
  extra(DOUBLES, SUBS.doubles, "dd");
  return out;
})();

export const CATEGORY = "Disziplinen";
/* Zusatz an Beschreibungen der alten Gesamt-Erfolge (zaehlen ueber alle Disziplinen). */
export const ALL_SUFFIX = " (alle Disziplinen)";
/* Diese alten Erfolge bekommen den Zusatz (Siege insgesamt, Serien, Matches insgesamt, zu null, verschiedene Gegner). */
export const OLD_ALL = [
  "wins1", "wins10", "wins25", "wins50", "wins100", "wins250", "wins500",
  "streak2", "streak3", "streak4", "streak5", "streak7", "streak10", "streak15", "streak20",
  "matches10", "matches50", "matches100", "matches250",
  "shutout", "shutout5", "shutout10", "shutout25", "shutout50", "shutout100",
  "opponents5", "opponents10",
];
