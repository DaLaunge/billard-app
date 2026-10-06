import { addTranslations, t, getLang } from "../i18n";
import { indexCase, searchIndexed } from "./search.js";
import { ALL_DISCS, TOPICS, TOPICS_EN, SOURCE } from "./meta.js";

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
modules.forEach((m) => addTranslations("en", m.en || {}));

export const RULE_CASES = modules.map((m) => m.default);
export { ALL_DISCS, TOPICS, SOURCE };

/* Zeile fuer die Quellenangabe, z. B. "ÖPBV/WPA-Spielregeln, ... , Regel 3.2". */
/* Ein Fall hat einen oder mehrere SAETZE (sets): je Satz die Disziplinen, fuer die
   er gilt, ein Etikett fuer den Tisch (tag) und zwei Varianten. Ein Fall ohne
   sets hat genau einen (variants + discs). */
export const setsOf = (c) => c.sets || [{ discs: c.discs, variants: c.variants }];

/* Welcher Satz gilt fuer diese Disziplin (sonst der erste)? */
export const setFor = (c, disc) => setsOf(c).find((s) => disc && s.discs.includes(disc)) || setsOf(c)[0];

export const sourceLine = (c) => `${t(SOURCE)}, ${t("Regel")} ${c.ref}`;

/* Faelle fuer eine Disziplin (disc leer = alle). onlyReleased: nur freigegebene
   (fuer alle Nutzer), die Verwaltung zeigt auch die anderen. */
export const casesForDisc = (disc, { onlyReleased = true, ids } = {}) =>
  RULE_CASES.filter((c) => (!onlyReleased || c.released) && (!disc || c.discs.includes(disc)) && (!ids || ids.includes(c.id)));

/* Suche: siehe search.js (gewichtete Felder, Umlaut-/Tippfehler-Toleranz, Synonyme,
   Regelnummern). Der Index je Fall wird pro Sprache gemerkt. */
const DISC_NAMES = {
  "8 Ball": "Achtball eight ball 8-ball",
  "9 Ball": "Neunball nine ball 9-ball",
  "10 Ball": "Zehnball ten ball 10-ball",
  "14/1 Endlos": "Straight Pool 14.1 14-1 endlos",
};
const _ix = new WeakMap();
const indexFor = (c) => {
  const lang = getLang();
  let m = _ix.get(c);
  if (!m) _ix.set(c, (m = {}));
  return m[lang] || (m[lang] = indexCase(c, { tr: t, topics: TOPICS, sets: setsOf, discNames: DISC_NAMES }));
};
export const searchCases = (list, q) => searchIndexed(list.map(indexFor), q);
