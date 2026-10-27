import { getLang } from "./i18n";

/* Namensvorschlaege fuer neue Turniere (Nutzer-Wunsch 2026-10-27): "Koeoe 7 Freitagsturnier KW12" oder kreativer. Alles aus Ort (optional),
   Wochentag, Kalenderwoche, Disziplin und Format - ohne Netz, ohne Datenbank. suggestNames() liefert eine feste Auswahl, randomName() wuerfelt
   einen kreativen Namen. Die Texte gibt es auf Deutsch und Englisch (getLang()). */
const DAYS = {
  de: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
const MONTHS = {
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const CREATIVE = {
  de: ["Der große Break", "Kreidestaub-Cup", "Das letzte Rack", "Kugelblitz-Turnier", "Queue-Königs-Cup", "Break & Bier", "Die Acht-Ball-Eskalation",
    "Schwarze-Acht-Showdown", "Tisch-Titanen", "Filz-Fiesta", "Die Tasche ruft", "Kreide, Köpfchen, Kugeln", "Rack ’n’ Roll", "Das Duell am grünen Tisch",
    "Bandenstoß-Brawl", "Der goldene Queue", "Pocket Party", "Sieben Kugeln, null Gnade", "Das Break-Gewitter", "Grüner Filz, heißes Blut"],
  en: ["The Big Break", "Chalk Dust Cup", "The Last Rack", "Ball Lightning Open", "Cue Kings Cup", "Break & Beer", "The Eight Ball Showdown",
    "Table Titans", "Felt Fiesta", "The Pocket Calls", "Chalk, Brains & Balls", "Rack ’n’ Roll", "Duel at the Green Table", "Bank Shot Brawl",
    "The Golden Cue", "Pocket Party", "Seven Balls, No Mercy", "Break Storm", "Green Felt, Hot Blood"],
};

// ISO-Kalenderwoche
function isoWeek(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x - y0) / 86400000 + 1) / 7);
}

const L = () => (getLang() === "en" ? "en" : "de");
const clean = (s) => s.replace(/\s+/g, " ").trim();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* Feste Auswahl (ohne Zufall): die Reihenfolge bleibt beim Tippen im Ortsfeld stabil. */
export function suggestNames({ place = "", discipline = "", format = "ko", date = new Date() } = {}) {
  const lang = L();
  const p = place.trim();
  const day = DAYS[lang][date.getDay()];
  const kw = isoWeek(date);
  const month = MONTHS[lang][date.getMonth()];
  const de = lang === "de";
  const fmtDe = { ko: "K.o.-Turnier", double_ko: "Doppel-K.o.", round_robin: "Liga", winner_stays: "Winner Stays" };
  const fmtEn = { ko: "Knockout", double_ko: "Double Knockout", round_robin: "League", winner_stays: "Winner Stays" };
  const f = (de ? fmtDe : fmtEn)[format] || "";
  const list = [
    de ? `${p} ${day}sturnier KW${kw}` : `${p} ${day} Tournament W${kw}`,
    de ? `${p} ${discipline} Open ${month}` : `${p} ${discipline} Open ${month}`,
    de ? `${p} ${f} KW${kw}` : `${p} ${f} W${kw}`,
    de ? `${p} ${day}s-Cup` : `${p} ${day} Cup`,
  ];
  return [...new Set(list.map(clean).filter((s) => s.length > 3))];
}

/* Ein kreativer Zufallsname, auf Wunsch mit Ort davor ("Koeoe 7 · Kreidestaub-Cup"). */
export function randomName({ place = "", exclude = "" } = {}) {
  const lang = L();
  let n = pick(CREATIVE[lang]);
  for (let i = 0; i < 5 && n === exclude; i++) n = pick(CREATIVE[lang]);
  return place.trim() ? `${place.trim()} · ${n}` : n;
}
