/* Testet die Regelsuche (src/lib/rules/search.js) gegen alle Faelle - ohne Browser:
     node scripts/checkSearch.mjs
   Die Tests sind das, was jemand mitten im Match tippt: ein Wort, eine Frage, ein
   Tippfehler, eine Regelnummer, Englisch. Neue Faelle bekommen hier ihre Anfragen dazu.
   Eintrag: [Anfrage, [erwartete ids], N, Optionen]
     N        wie weit vorn die erwartete id stehen muss (Standard 1)
     all      true = JEDE erwartete id muss unter den ersten (Anzahl + 2) stehen
     lang     "en" sucht mit englischen Texten
   Exit-Code 1, wenn eine Anfrage ihr Ziel verfehlt. */
import { readdirSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { indexCase, searchIndexed } from "../src/lib/rules/search.js";
import { TOPICS, TOPICS_EN } from "../src/lib/rules/meta.js";

const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../src/lib/rules/cases");
const cases = [], en = { ...TOPICS_EN };
for (const f of readdirSync(dir).filter((n) => n.endsWith(".js")).sort()) {
  const m = await import(pathToFileURL(resolve(dir, f)).href);
  cases.push(m.default);
  Object.assign(en, m.en || {});
}
const DISC_NAMES = {
  "8 Ball": "Achtball eight ball 8-ball", "9 Ball": "Neunball nine ball 9-ball",
  "10 Ball": "Zehnball ten ball 10-ball", "14/1 Endlos": "Straight Pool 14.1 14-1 endlos",
};
const setsOf = (c) => c.sets || [{ discs: c.discs, variants: c.variants }];
const index = (lang) => cases.map((c) => indexCase(c, { tr: lang === "en" ? (s) => en[s] ?? s : (s) => s, topics: TOPICS, sets: setsOf, discNames: DISC_NAMES }));
const IX = { de: index("de"), en: index("en") };
const run = (q, lang = "de") => searchIndexed(IX[lang], q).map((c) => c.id);

const T = [
  // --- Weisse in der Tasche
  ["weiße versenkt", ["weisse-versenkt"]],
  ["weisse versenkt", ["weisse-versenkt"]],
  ["Weiße versenkt?", ["weisse-versenkt"]],
  ["scratch", ["weisse-versenkt"]],
  ["Scratch beim 9 Ball", ["weisse-versenkt"], 2],
  ["Weiße ist in die Tasche gefallen", ["weisse-versenkt"], 2],
  ["weiße im loch", ["weisse-versenkt"], 2],
  ["wann ist es ein foul wenn die weiße in die tasche fällt", ["weisse-versenkt"], 2],
  ["weise versenkt", ["weisse-versenkt"], 2],
  ["cue ball pocketed", ["weisse-versenkt"], 1, { lang: "en" }],
  ["scratch", ["weisse-versenkt"], 1, { lang: "en" }],
  // --- Erste Beruehrung
  ["falsche kugel", ["erste-beruehrung"]],
  ["erste berührung", ["erste-beruehrung"]],
  ["erste beruehrung", ["erste-beruehrung"]],
  ["niedrigste kugel", ["erste-beruehrung"], 2],
  ["eigene gruppe", ["erste-beruehrung"], 3],
  ["volle halbe", ["erste-beruehrung"], 3],
  ["welche kugel muss ich zuerst treffen", ["erste-beruehrung"], 3],
  ["first contact", ["erste-beruehrung"], 1, { lang: "en" }],
  ["wrong ball", ["erste-beruehrung"], 1, { lang: "en" }],
  ["lowest ball", ["erste-beruehrung"], 2, { lang: "en" }],
  // --- nach Treffer Bande
  ["keine bande", ["nach-treffer-bande"], 2],
  ["bande nach dem treffer", ["nach-treffer-bande"]],
  ["kein bandenkontakt", ["nach-treffer-bande"], 2],
  ["no rail", ["nach-treffer-bande"], 2],
  ["bande oder tasche", ["nach-treffer-bande"]],
  ["cushion after contact", ["nach-treffer-bande"], 2, { lang: "en" }],
  // --- Bande vor dem Treffer
  ["bande vor dem treffer", ["bande-vor-dem-treffer"]],
  ["erst bande dann kugel", ["bande-vor-dem-treffer"], 2],
  ["cushion before contact", ["bande-vor-dem-treffer"], 2, { lang: "en" }],
  // --- gleichzeitig
  ["gleichzeitig", ["gleichzeitiger-treffer"]],
  ["zwei kugeln gleichzeitig", ["gleichzeitiger-treffer"]],
  ["im zweifel", ["gleichzeitiger-treffer"], 2],
  ["two balls at the same time", ["gleichzeitiger-treffer"], 2, { lang: "en" }],
  ["simultaneous", ["gleichzeitiger-treffer"], 1, { lang: "en" }],
  // --- Kugel vom Tisch
  ["kugel springt vom tisch", ["kugel-vom-tisch"]],
  ["kugel vom tisch gesprungen", ["kugel-vom-tisch"]],
  ["kugel fliegt vom tisch", ["kugel-vom-tisch"]],
  ["kugel auf dem boden", ["kugel-vom-tisch"], 2],
  ["ball jumps off the table", ["kugel-vom-tisch"], 1, { lang: "en" }],
  // --- rollende Kugel
  ["kugel rollt noch", ["bewegende-kugeln"]],
  ["zu früh gestoßen", ["bewegende-kugeln"]],
  ["stoß während kugel sich bewegt", ["bewegende-kugeln"], 2],
  ["gespielt obwohl noch eine kugel läuft", ["bewegende-kugeln"], 3],
  ["shot while a ball is moving", ["bewegende-kugeln"], 2, { lang: "en" }],
  // --- Push Out
  ["push out", ["push-out"]],
  ["pushout", ["push-out"]],
  ["push-out", ["push-out"]],
  ["pushuot", ["push-out"], 2],
  ["zweiter stoß", ["push-out"], 2],
  ["push out ansagen", ["push-out"]],
  ["push out", ["push-out"], 1, { lang: "en" }],
  // --- Anstoss vier Kugeln
  ["anstoß vier kugeln", ["anstoss-vier-kugeln"]],
  ["anstoß", ["anstoss-vier-kugeln", "anstoss-vierzehn-eins", "kopflinie"], 3],
  ["break", ["anstoss-vier-kugeln"], 3],
  ["4 kugeln bande anstoß", ["anstoss-vier-kugeln"], 2],
  ["anstoß ungültig", ["anstoss-vier-kugeln"], 2],
  ["four balls break", ["anstoss-vier-kugeln"], 2, { lang: "en" }],
  // --- offener Tisch
  ["offener tisch", ["offener-tisch-acht"]],
  ["die 8 zuerst", ["offener-tisch-acht"], 2],
  ["darf ich die 8 zuerst spielen", ["offener-tisch-acht"], 2],
  ["schwarze kugel", ["offener-tisch-acht"], 2],
  ["open table", ["offener-tisch-acht"], 1, { lang: "en" }],
  // --- drei Fouls
  ["drei fouls", ["drei-fouls"]],
  ["3 fouls in folge", ["drei-fouls"]],
  ["3-foul-regel", ["drei-fouls"]],
  ["dritte foul", ["drei-fouls"]],
  ["spielverlust", ["drei-fouls"], 2],
  ["verwarnung", ["drei-fouls"], 2],
  ["wie oft darf man foul machen", ["drei-fouls"], 3],
  ["three fouls", ["drei-fouls"], 1, { lang: "en" }],
  ["three-foul rule", ["drei-fouls"], 1, { lang: "en" }],
  // --- 14/1 Anstoss
  ["eröffnungsstoß", ["anstoss-vierzehn-eins"]],
  ["anstoßfoul", ["anstoss-vierzehn-eins"], 2],
  ["14/1 anstoß", ["anstoss-vierzehn-eins"], 2],
  ["14.1 anstoß", ["anstoss-vierzehn-eins"], 2],
  ["straight pool break", ["anstoss-vierzehn-eins"], 2],
  ["opening break", ["anstoss-vierzehn-eins"], 1, { lang: "en" }],
  // --- Kopflinie / Kopffeld
  ["kopflinie", ["kopflinie", "spiel-aus-dem-kopffeld"], 2],
  ["kopflnie", ["kopflinie", "spiel-aus-dem-kopffeld"], 2],
  ["weiße auf der kopflinie", ["kopflinie"]],
  ["kopffeld", ["spiel-aus-dem-kopffeld", "kopflinie"], 2],
  ["aus dem kopffeld spielen", ["spiel-aus-dem-kopffeld"], 1],
  ["head string", ["kopflinie"], 2, { lang: "en" }],
  ["kitchen", ["spiel-aus-dem-kopffeld", "kopflinie"], 2, { lang: "en" }],
  // --- Taschenrand
  ["fünf sekunden", ["taschenrand"]],
  ["5 sekunden", ["taschenrand"]],
  ["kugel hängt", ["taschenrand"]],
  ["kugel wackelt am loch", ["taschenrand"], 2],
  ["taschenrand", ["taschenrand"]],
  ["kugel fällt später", ["taschenrand"], 2],
  ["pocket edge", ["taschenrand"], 1, { lang: "en" }],
  ["five seconds", ["taschenrand"], 1, { lang: "en" }],
  // --- Neuaufbau 14/1
  ["neuaufbau", ["neuaufbau-fuenfzehnte", "neuaufbau-kugel-behindert", "neuaufbau-weisse-behindert", "neuaufbau-beide"], 4, { all: true }],
  ["rack neu aufbauen", ["neuaufbau-fuenfzehnte", "neuaufbau-kugel-behindert", "neuaufbau-weisse-behindert", "neuaufbau-beide"], 4],
  ["letzte kugel", ["neuaufbau-fuenfzehnte"], 3],
  ["nur noch zwei kugeln auf dem tisch", ["neuaufbau-fuenfzehnte", "neuaufbau-kugel-behindert", "neuaufbau-weisse-behindert", "neuaufbau-beide"], 4],
  ["15. kugel", ["neuaufbau-fuenfzehnte", "neuaufbau-kugel-behindert", "neuaufbau-beide"], 3],
  ["weiße im dreieck", ["neuaufbau-weisse-behindert", "neuaufbau-beide"], 2],
  ["kopfpunkt", ["neuaufbau-kugel-behindert", "neuaufbau-weisse-behindert"], 2],
  ["mittelpunkt", ["neuaufbau-kugel-behindert"], 1],
  ["fußpunkt", ["neuaufbau-beide"], 3],
  ["14. kugel versenkt", ["neuaufbau-fuenfzehnte"], 4],
  ["re-rack", ["neuaufbau-fuenfzehnte", "neuaufbau-kugel-behindert", "neuaufbau-weisse-behindert", "neuaufbau-beide"], 4, { lang: "en" }],
  ["last ball", ["neuaufbau-fuenfzehnte"], 3, { lang: "en" }],
  // --- Formulierungen aus der Praxis
  ["was passiert wenn ich die weiße versenke", ["weisse-versenkt"]],
  ["Spielball in der Tasche", ["weisse-versenkt"]],
  ["wann ist der anstoß ungültig", ["anstoss-vier-kugeln"]],
  ["Kugel liegt im Weg beim Neuaufbau", ["neuaufbau-kugel-behindert"]],
  ["Kugel zu spät gefallen", ["taschenrand"]],
  ["tisch offen", ["offener-tisch-acht"]],
  ["falsche gruppe getroffen", ["erste-beruehrung"]],
  ["15 punkte abzug", ["drei-fouls"]],
  ["mehrere kugeln gleichzeitig getroffen", ["gleichzeitiger-treffer"]],
  ["kugel muss an bande", ["nach-treffer-bande", "bande-vor-dem-treffer"], 2],
  ["stoß verboten wenn kugel rollt", ["bewegende-kugeln"]],
  ["wie viele kugeln beim anstoß", ["anstoss-vier-kugeln", "anstoss-vierzehn-eins"], 2],
  // Regeln, die es noch nicht gibt: lieber "nichts gefunden" als etwas Falsches
  ["fuß auf dem boden", ["fuss-am-boden"], 1],
  ["kleiderordnung", null],
  ["queue", ["doppelstoss"], 1],
  ["jump shot", null],
  // --- Ausspielen
  ["ausspielen", ["ausspielen"]],
  ["lag", ["ausspielen"]],
  ["anstoßrecht", ["ausspielen"]],
  ["wer stößt an", ["ausspielen"]],
  ["längsachse", ["ausspielen"]],
  ["fußbande kopfbande", ["ausspielen"], 2],
  ["who breaks", ["ausspielen"], 1, { lang: "en" }],
  ["lag", ["ausspielen"], 1, { lang: "en" }],
  // --- Kugel faellt von selbst
  ["kugel fällt von selbst", ["kugel-faellt-von-selbst"]],
  ["kugel fällt allein", ["kugel-faellt-von-selbst"]],
  ["ohne stoß gefallen", ["kugel-faellt-von-selbst"]],
  ["kugel fällt vor dem treffer", ["kugel-faellt-von-selbst"]],
  ["ball falls by itself", ["kugel-faellt-von-selbst"], 1, { lang: "en" }],
  // --- Stoerung von aussen
  ["störung von außen", ["stoerung-von-aussen"]],
  ["störung von aussen", ["stoerung-von-aussen"]],
  ["zuschauer stößt an den tisch", ["stoerung-von-aussen"], 2],
  ["kugeln zurücklegen", ["stoerung-von-aussen"], 2],
  ["höhere gewalt", ["stoerung-von-aussen"]],
  ["outside disturbance", ["stoerung-von-aussen"], 1, { lang: "en" }],
  // --- Foul zu spaet
  ["foul zu spät", ["foul-zu-spaet"]],
  ["foul nicht angesagt", ["foul-zu-spaet"]],
  ["foul übersehen", ["foul-zu-spaet"]],
  ["nachträglich foul", ["foul-zu-spaet"], 2],
  ["foulansage", ["foul-zu-spaet"]],
  ["foul noticed too late", ["foul-zu-spaet"], 1, { lang: "en" }],
  // --- Doppelstoss
  ["doppelstoß", ["doppelstoss"]],
  ["doppelstoss", ["doppelstoss"]],
  ["weiße läuft nach", ["doppelstoss"]],
  ["halbe kugelbreite", ["doppelstoss"]],
  ["durchstoß", ["doppelstoss"], 2],
  ["double hit", ["doppelstoss"], 1, { lang: "en" }],
  // --- press an der Bande
  ["press an der bande", ["press-bande"]],
  ["pressliegende kugel", ["press-bande"]],
  ["kugel an der bande", ["press-bande"], 2],
  ["andere bande", ["press-bande"], 2],
  ["frozen ball", ["press-bande"], 1, { lang: "en" }],
  // --- Rack aufbauen
  ["rack aufbauen", ["rack-aufbau"], 2],
  ["aufbauhilfe", ["rack-aufbau"]],
  ["template", ["rack-aufbau"], 1, { lang: "en" }],
  ["9 ball raute", ["rack-aufbau"], 2],
  ["dreieck anlegen", ["rack-aufbau"]],
  ["wie wird das rack aufgebaut", ["rack-aufbau"], 2],
  ["racking", ["rack-aufbau"], 2, { lang: "en" }],
  // --- Sicherheit
  ["sicherheit", ["sicherheit"]],
  ["safe", ["sicherheit"]],
  ["sicherheit ansagen", ["sicherheit"]],
  ["kugel fällt trotz sicherheit", ["sicherheit"]],
  ["safety", ["sicherheit"], 1, { lang: "en" }],
  // --- falsche Tasche
  ["falsche tasche", ["falsche-tasche"]],
  ["nicht angesagte tasche", ["falsche-tasche"]],
  ["andere tasche", ["falsche-tasche"], 2],
  ["kugel und tasche ansagen", ["falsche-tasche"], 2],
  ["wrong pocket", ["falsche-tasche"], 1, { lang: "en" }],
  // --- die 8
  ["8 versenkt", ["acht-verloren"]],
  ["sieg mit der 8", ["acht-verloren"]],
  ["8 zu früh", ["acht-verloren", "offener-tisch-acht"], 2],
  ["8 in falsche tasche", ["acht-verloren", "falsche-tasche"], 2],
  ["8 springt vom tisch", ["acht-verloren", "kugel-vom-tisch"], 2],
  ["wann habe ich beim 8 ball verloren", ["acht-verloren"], 2],
  ["8 pocketed", ["acht-verloren"], 1, { lang: "en" }],
  // --- 8-Ball-Anstoss
  ["8 ball anstoß", ["acht-anstoss", "anstoss-vier-kugeln"], 2],
  ["weiße fällt beim anstoß", ["acht-anstoss"]],
  ["kugel springt beim anstoß", ["acht-anstoss"], 2],
  ["tisch offen anstoß", ["acht-anstoss", "offener-tisch-acht"], 2],
  ["cue ball falls on the break", ["acht-anstoss"], 2, { lang: "en" }],
  // --- Roll-up
  ["roll up", ["roll-up"]],
  ["roll-up", ["roll-up"], 2],
  ["abstand zur bande", ["roll-up"], 2],
  ["dritter roll up", ["roll-up"]],
  ["roll up limit", ["roll-up"], 2, { lang: "en" }],
  // --- Haltung und Stoss: Fuss, Schieben, Kugel beruehrt
  ["fuß am boden", ["fuss-am-boden"]],
  ["knie auf dem tisch", ["fuss-am-boden"]],
  ["kein fuß auf dem boden", ["fuss-am-boden"]],
  ["foot on the floor", ["fuss-am-boden"], 1, { lang: "en" }],
  ["schieben", ["schieben"]],
  ["queue schiebt die weiße", ["schieben"]],
  ["pomeranze bleibt an der weißen", ["schieben"]],
  ["pushing the cue ball", ["schieben"], 2, { lang: "en" }],
  ["kugel mit der hand berührt", ["kugel-beruehrt"]],
  ["ärmel", ["kugel-beruehrt"]],
  ["kugel versehentlich bewegt", ["kugel-beruehrt"], 2],
  ["touched a ball with my hand", ["kugel-beruehrt"], 2, { lang: "en" }],
  // --- Kugel im Kopffeld nach Neuaufbau
  ["kugel im kopffeld anspielen", ["neuaufbau-weisse-behindert", "spiel-aus-dem-kopffeld"], 2],
  ["15. kugel im kopffeld direkt spielen", ["neuaufbau-weisse-behindert", "spiel-aus-dem-kopffeld"], 3],
  // --- Kitchen Rule
  ["kitchen rule", ["kitchen-rule"]],
  ["dry break", ["kitchen-rule"]],
  ["drei punkte regel", ["kitchen-rule"]],
  ["3 punkte regel", ["kitchen-rule"]],
  ["wie viele kugeln muessen ins kopffeld", ["kitchen-rule"], 2],
  ["kitchen rule dry break", ["kitchen-rule"], 1, { lang: "en" }],
  // --- Regelnummern
  ["3.2", ["erste-beruehrung", "gleichzeitiger-treffer"], 2],
  ["regel 3.3", ["nach-treffer-bande", "bande-vor-dem-treffer"], 2],
  ["3.13", ["drei-fouls"], 1],
  ["5.4", ["push-out"], 1],
  ["2.2", ["taschenrand"], 1],
  ["7.8", ["neuaufbau-fuenfzehnte", "neuaufbau-kugel-behindert", "neuaufbau-weisse-behindert", "neuaufbau-beide"], 4],
  ["3.5", ["kugel-vom-tisch"], 1],
  ["3.9", ["bewegende-kugeln"], 1],
  ["4.4", ["offener-tisch-acht"], 1],
  // --- Disziplinnamen + Thema
  ["14/1", ["anstoss-vierzehn-eins", "drei-fouls", "neuaufbau-beide"], 6],
  ["8 ball gruppe", ["erste-beruehrung", "offener-tisch-acht", "gleichzeitiger-treffer"], 3],
];

let fail = 0;
for (const [q, want, n = 1, o = {}] of T) {
  const res = run(q, o.lang || "de");
  if (want === null) {
    if (res.length) { fail++; console.error(`✗ "${q}" sollte nichts finden, findet: ${res.slice(0, 3).join(", ")}`); }
    continue;
  }
  const need = o.all ? want.length + 2 : n;
  const top = res.slice(0, need);
  const ok = o.all ? want.every((id) => top.includes(id)) : want.some((id) => top.includes(id));
  if (!ok) {
    fail++;
    console.error(`✗ ${o.lang === "en" ? "[en] " : ""}"${q}"\n    erwartet (Top ${need}): ${want.join(", ")}\n    bekommen: ${res.slice(0, 5).join(", ") || "(nichts)"}`);
  }
}

// Allgemeine Eigenschaften
for (const c of cases) {
  const r = run(c.title);
  if (r[0] !== c.id) { fail++; console.error(`✗ Titel "${c.title}" findet ${r[0]} statt ${c.id}`); }
  for (const lang of ["de", "en"]) {
    const t = lang === "en" ? en[c.title] ?? c.title : c.title;
    const rr = run(t, lang);
    if (rr[0] !== c.id) { fail++; console.error(`✗ [${lang}] Titel "${t}" findet ${rr[0]} statt ${c.id}`); }
  }
  for (const k of c.keywords) {
    const r2 = run(k);
    if (!r2.includes(c.id)) { fail++; console.error(`✗ Suchbegriff "${k}" findet ${c.id} gar nicht`); }
  }
}
if (run("xyzabc").length) { fail++; console.error("✗ Unsinn findet etwas: " + run("xyzabc")); }
if (run("").length !== cases.length) { fail++; console.error("✗ Leere Suche zeigt nicht alles"); }

const wide = T.filter(([q, , , o]) => !(o && o.lang)).map(([q]) => [q, run(q).length]).filter(([, n]) => n > cases.length * 0.7);
if (wide.length) console.log("Hinweis, sehr breite Anfragen (>70 % der Faelle): " + wide.map(([q, n]) => `"${q}" ${n}`).join(", "));
if (fail) { console.error(`\n${fail} Suchtest(s) fehlgeschlagen.`); process.exit(1); }
console.log(`Alle ${T.length} Suchanfragen und die allgemeinen Pruefungen bestehen (${cases.length} Faelle).`);
