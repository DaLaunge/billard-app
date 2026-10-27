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

const norm = (x) => x.trim().toLowerCase();
// Haengt " 2", " 3" ... an, bis der Name frei ist (taken = Set kleingeschriebener Namen bestehender Turniere)
export function uniqueName(base, taken) {
  if (!taken || !taken.has(norm(base))) return base;
  for (let i = 2; i < 100; i++) if (!taken.has(norm(`${base} ${i}`))) return `${base} ${i}`;
  return base;
}

/* Feste Auswahl (ohne Zufall): die Reihenfolge bleibt beim Tippen im Ortsfeld stabil. Bereits vergebene Namen werden nummeriert. */
export function suggestNames({ place = "", discipline = "", format = "ko", date = new Date(), taken } = {}) {
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
    `${p} ${discipline} Open ${month}`,
    de ? `${p} ${f} KW${kw}` : `${p} ${f} W${kw}`,
    de ? `${p} ${day}s-Cup` : `${p} ${day} Cup`,
  ];
  return [...new Set(list.map(clean).filter((x) => x.length > 3).map((x) => uniqueName(x, taken)))];
}

/* Ein kreativer Zufallsname, auf Wunsch mit Ort davor ("Koeoe 7 · Kreidestaub-Cup"). Bevorzugt einen Namen, den es noch nicht gibt
   und der nicht der aktuelle ist; sind alle vergeben, wird nummeriert. */
export function randomName({ place = "", exclude = "", taken } = {}) {
  const lang = L();
  const full = (n) => (place.trim() ? `${place.trim()} · ${n}` : n);
  const free = CREATIVE[lang].filter((n) => !(taken && taken.has(norm(full(n)))) && norm(full(n)) !== norm(exclude));
  if (free.length) return full(pick(free));
  return uniqueName(full(pick(CREATIVE[lang])), taken);
}
