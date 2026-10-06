import { addTranslations, t } from "../i18n";
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
export const sourceLine = (c) => `${t(SOURCE)}, ${t("Regel")} ${c.ref}`;

/* Faelle fuer eine Disziplin (disc leer = alle). onlyReleased: nur freigegebene
   (fuer alle Nutzer), die Verwaltung zeigt auch die anderen. */
export const casesForDisc = (disc, { onlyReleased = true, ids } = {}) =>
  RULE_CASES.filter((c) => (!onlyReleased || c.released) && (!disc || c.discs.includes(disc)) && (!ids || ids.includes(c.id)));

/* Freitextsuche ueber Name, Suchbegriffe, Thema, Regeltext und Disziplinen -
   deutsch und in der aktuellen Sprache. */
const hay = (c) => [c.title, ...c.keywords, TOPICS[c.topic], c.rule, ...c.discs]
  .filter(Boolean).flatMap((s) => [s, t(s)]).join("\n").toLowerCase();
export const searchCases = (list, q) => {
  const needle = (q || "").trim().toLowerCase();
  return needle ? list.filter((c) => hay(c).includes(needle)) : list;
};
