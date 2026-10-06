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

/* Suche, deutsch und in der aktuellen Sprache, mehrere Woerter muessen ALLE
   vorkommen. Zwei Stufen, damit ein Begriff nicht alles trifft: ein Regeltext
   erwaehnt andere Regeln ("wie beim Scratch"), deshalb zaehlen zuerst nur Name,
   Suchbegriffe, Thema und Disziplin. Nur wenn dort nichts passt, wird der
   volle Text (Regel, Untertitel, Begruendungen) durchsucht - so findet auch
   "Ball in Hand" noch etwas. Treffer im Namen stehen vor Treffern in den
   Suchbegriffen. */
const lower = (list) => list.filter(Boolean).flatMap((s) => [s, t(s)]).join("\n").toLowerCase();
const nameHay = (c) => lower([c.title]);
const tagHay = (c) => lower([...c.keywords, TOPICS[c.topic], ...c.discs]);
const textHay = (c) => lower([c.rule, ...c.variants.flatMap((v) => [v.reason, ...v.steps.map((s) => s.text)])]);
const hasAll = (hay, words) => words.every((w) => hay.includes(w));

export const searchCases = (list, q) => {
  const words = (q || "").trim().toLowerCase().split(/\s+/).filter((w) => w.length > 1); // 1 Zeichen filtert nur Rauschen
  if (!words.length) return list;
  const byName = list.filter((c) => hasAll(nameHay(c), words));
  const byTag = list.filter((c) => !byName.includes(c) && hasAll(nameHay(c) + "\n" + tagHay(c), words));
  const primary = [...byName, ...byTag];
  if (primary.length) return primary;
  return list.filter((c) => hasAll(nameHay(c) + "\n" + tagHay(c) + "\n" + textHay(c), words));
};
