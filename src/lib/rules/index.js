import { addTranslations, t, getLang } from "../i18n";
import { indexCase, searchIndexed } from "./search.js";
import { ensureEights } from "./fill.js";
import { withHeyball } from "./heyballShare.js";
import { FEATURES } from "../constants.js";
import { HEYBALL_RULES, HEYBALL_EN, HEYBALL_SOURCE } from "./heyball.js";
import { ALL_DISCS, TOPICS, TOPICS_EN, TAGS, TAGS_EN, SOURCE, SOURCES_EN } from "./meta.js";

/* Regelkunde-Katalog. Ein Regelfall = EINE Datei in ./cases/ (Dateiname
   bestimmt die Reihenfolge, daher die Nummer davor), die diese Dinge exportiert:
     default  der Fall: id, released, discs, topic, ref, keywords, title, rule, variants
     en       seine englischen Texte (Schluessel = deutscher Text)
   Mehr ist fuer einen neuen Fall nicht zu tun: er wird hier automatisch
   gefunden, seine Uebersetzungen werden angemeldet, und jede Stelle, die den
   Katalog nutzt (Verwaltung, spaeter Hilfe im laufenden Match), zeigt ihn.
   Das Format der Szenen steht in ../ruleEngine.js, die Faelle prueft
   scripts/checkRules.mjs.

   Diese Datei haengt an i18n; die Engine (ruleEngine.js) nicht - deshalb laesst
   sich die Engine auch ohne Browser pruefen. */

const files = import.meta.glob("./cases/*.js", { eager: true });
const modules = Object.keys(files).sort().map((k) => files[k]);
addTranslations("en", TOPICS_EN);
addTranslations("en", TAGS_EN);
addTranslations("en", SOURCES_EN);
modules.forEach((m) => addTranslations("en", m.en || {}));
addTranslations("en", HEYBALL_EN);
export { HEYBALL_RULES, HEYBALL_SOURCE };

export const RULE_CASES = modules.map((m) => ensureEights(withHeyball(m.default))); // jede Szene bekommt eine 8 auf den Tisch (siehe fill.js)
export { ALL_DISCS, TOPICS, TAGS, SOURCE };

/* Zeile fuer die Quellenangabe, z. B. "ÖPBV/WPA-Spielregeln, ... , Regel 3.2". */
/* Ein Fall hat einen oder mehrere SAETZE (sets): je Satz die Disziplinen, fuer die
   er gilt, ein Etikett fuer den Tisch (tag) und zwei Varianten. Ein Fall ohne
   sets hat genau einen (variants + discs). */
export const setsOf = (c) => c.sets || [{ discs: c.discs, variants: c.variants }];

/* Welcher Satz gilt fuer diese Disziplin (sonst der erste)? */
export const setFor = (c, disc) => setsOf(c).find((s) => disc && s.discs.includes(disc)) || setsOf(c)[0];

export const sourceLine = (c) => `${t(c.src || SOURCE)}, ${t("Regel")} ${c.ref}`;

/* Faelle fuer eine Disziplin (disc leer = alle). onlyReleased: nur freigegebene
   (fuer alle Nutzer), die Verwaltung zeigt auch die anderen. */
/* Heyball-Faelle erscheinen nur, solange der Admin-Schalter an ist; ohne Disziplinfilter (Alle) zaehlen sie nicht mit. */
const heyballOnly = (c) => c.discs.every((d) => d === "Heyball");
export const casesForDisc = (disc, { onlyReleased = true, ids } = {}) =>
  RULE_CASES.filter((c) => (!onlyReleased || c.released) && (!disc || c.discs.includes(disc)) && (!ids || ids.includes(c.id))
    && (FEATURES.heyball || !heyballOnly(c)));

/* Suche: siehe search.js (gewichtete Felder, Umlaut-/Tippfehler-Toleranz, Synonyme,
   Regelnummern). Der Index je Fall wird pro Sprache gemerkt. */
const DISC_NAMES = {
  "8 Ball": "Achtball eight ball 8-ball",
  "9 Ball": "Neunball nine ball 9-ball",
  "10 Ball": "Zehnball ten ball 10-ball",
  "14/1 Endlos": "Straight Pool 14.1 14-1 endlos",
  "Heyball": "Heyball chinesisches 8-ball chinese eight ball",
};
const _ix = new WeakMap();
const indexFor = (c) => {
  const lang = getLang();
  let m = _ix.get(c);
  if (!m) _ix.set(c, (m = {}));
  return m[lang] || (m[lang] = indexCase(c, { tr: t, topics: TOPICS, tagNames: TAGS, sets: setsOf, discNames: DISC_NAMES }));
};
export const searchCases = (list, q) => searchIndexed(list.map(indexFor), q);

/* Reihenfolge fuer die Hilfe-Seite. "book" = wie im Regelwerk (ÖPBV/WPA-Spielregeln 2026): nach Kapitel und
   Regelnummer der ERSTEN Fundstelle (`ref`); Faelle aus anderen Unterlagen (Lehrunterlage, Regularien,
   Doppel) tragen `bookRef`, die Stelle, an der sie im Regelwerk am besten passen. "az" = alphabetisch nach
   Ueberschrift. Gleicher Schluessel: alphabetisch. */
const numsOf = (c) => {
  const m = String(c.bookRef || c.ref).match(/(\d+)(?:\.(\d+))?/);
  return m ? [Number(m[1]), m[2] ? Number(m[2]) : 0] : [99, 0];
};
/* Kapitel 4-7 des Regelwerks sind je EINE Disziplin (8 / 9 / 10 Ball / 14/1). Ein Fall landet nur dann dort,
   wenn er genau diese Disziplin betrifft; gilt er fuer mehrere (z. B. "vier Kugeln an die Bande" fuer 8, 9 und
   10 Ball, Push Out fuer 9 und 10 Ball), steht er in der Gruppe "Mehrere Disziplinen" (3.5) - sonst stuende
   er faelschlich unter "8 Ball", nur weil die erste Fundstelle 4.3 ist (Nutzer-Feedback 2026-10-08). */
const DISC_CHAPTER = { "8 Ball": 4, "9 Ball": 5, "10 Ball": 6, "14/1 Endlos": 7, "Heyball": 8 };
export const bookChapter = (c) => {
  const n = numsOf(c)[0];
  if (n === 8) return 8; // Heyball-Faelle tragen bookRef "8.N" (Kapitel 8, Reihenfolge N)
  if (n < 4 || n > 7) return n;
  return c.discs && c.discs.length === 1 && DISC_CHAPTER[c.discs[0]] ? DISC_CHAPTER[c.discs[0]] : 3.5;
};
/* Angezeigter Titel: ohne vorangestellte Disziplin ("14/1: Eroeffnungsstoss" -> "Eroeffnungsstoss",
   "8-Ball-Anstoss: ..." -> "Anstoss: ..."), die zeigen schon die Kugeln und der Disziplinfilter; so sortiert die
   alphabetische Liste nach dem eigentlichen Thema (Nutzer-Feedback 2026-10-07). */
export const displayTitle = (c) => {
  const x = t(c.title).replace(/^14[/.]1:\s*/, "").replace(/^(?:8|9|10)-ball[- ]/i, "");
  return x.charAt(0).toUpperCase() + x.slice(1);
};
export const sortCases = (list, mode) => {
  const lang = getLang();
  const az = (a, b) => displayTitle(a).localeCompare(displayTitle(b), lang);
  if (mode !== "book") return [...list].sort(az);
  return [...list].sort((a, b) => {
    const ca = bookChapter(a), cb = bookChapter(b);
    return ca - cb || numsOf(a)[1] - numsOf(b)[1] || az(a, b);
  });
};
/* Kapitelueberschriften des Regelwerks (fuer die Gliederung in der Regelwerk-Reihenfolge). */
export const BOOK_CHAPTERS = {
  1: "1 · Allgemeine Regeln", 2: "2 · Begriffe", 3: "3 · Fouls", 3.5: "Mehrere Disziplinen", 4: "4 · 8 Ball", 5: "5 · 9 Ball",
  6: "6 · 10 Ball", 7: "7 · 14/1 Endlos", 8: "8 · Heyball", 99: "Doppel",
};
