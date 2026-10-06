/* Prueft alle Regelfaelle (src/lib/rules/cases/*.js) ohne Browser:
     node scripts/checkRules.mjs
   - Pflichtfelder und gueltige Disziplinen/Themen
   - jede Szene: Kugel-ids eindeutig, `after` zeigt auf eine Kugel desselben Schritts
   - keine zwei Kugeln liegen nach einem Schritt uebereinander (Mittelpunkte >= 10.5
     auseinander) und alle Kugeln, die nicht `out` sind, liegen auf dem Tisch
   - jede englische Uebersetzung hat einen deutschen Schluessel, der im Fall vorkommt,
     und jeder deutsche Text des Falls (Titel, Regel, Untertitel, Grund, Suchbegriffe,
     Label) hat eine Uebersetzung
   - Physik: die Zeitplan-Berechnung liefert endliche Werte
   Exit-Code 1 bei Fehlern. */
import { readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stateAt, timeline, pathFrames } from "../src/lib/ruleEngine.js";
import { ALL_DISCS, TOPICS } from "../src/lib/rules/meta.js";

const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../src/lib/rules/cases");
const errors = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);
const MIN_DIST = 10.5;
// Texte, die bewusst nicht uebersetzt werden muessen (gleich in beiden Sprachen oder Zahlen).
const SKIP = new Set(["Break", "No Rail", "Pushout"]);
// Allgemeine Texte (Fall A/B, Scratch, Bande ...) stehen schon in src/lib/i18n.js.
const globalI18n = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../src/lib/i18n.js"), "utf8");
const inGlobal = (tx) => globalI18n.includes(JSON.stringify(tx) + ":");

for (const f of readdirSync(dir).filter((n) => n.endsWith(".js")).sort()) {
  const m = await import(pathToFileURL(resolve(dir, f)).href);
  const c = m.default, en = m.en || {};
  const id = f;
  for (const k of ["id", "discs", "topic", "ref", "keywords", "title", "rule", "variants"]) if (c[k] == null) err(id, `Feld ${k} fehlt`);
  if (typeof c.released !== "boolean") err(id, "released fehlt");
  (c.discs || []).forEach((d) => { if (!ALL_DISCS.includes(d)) err(id, `unbekannte Disziplin ${d}`); });
  if (!TOPICS[c.topic]) err(id, `unbekanntes Thema ${c.topic}`);

  const texts = new Set([c.title, c.rule, ...(c.keywords || [])]);
  for (const v of c.variants || []) {
    texts.add(v.label); texts.add(v.reason);
    if (!["foul", "ok"].includes(v.verdict)) err(id, `${v.label}: verdict`);
    const ids = v.balls.map((b) => b.id);
    if (new Set(ids).size !== ids.length) err(id, `${v.label}: doppelte Kugel-id`);
    const check = (pos, out, where) => {
      const live = ids.filter((i) => !out[i]);
      for (let a = 0; a < live.length; a++) {
        const p = pos[live[a]];
        if (p[0] < 15.4 || p[0] > 204.6 || p[1] < 15.4 || p[1] > 104.6) err(id, `${v.label} ${where}: Kugel ${live[a]} ausserhalb (${p})`);
        for (let b = a + 1; b < live.length; b++) {
          const q = pos[live[b]];
          if (Math.hypot(p[0] - q[0], p[1] - q[1]) < MIN_DIST) err(id, `${v.label} ${where}: Kugeln ${live[a]} und ${live[b]} ueberlappen`);
        }
      }
    };
    v.steps.forEach((s, i) => {
      texts.add(s.text); if (s.say) texts.add(s.say);
      const st = stateAt(v, i);
      check(st.pos, st.out, `Schritt ${i}`);
      const mv = s.moves || [];
      for (const mo of mv) {
        if (!ids.includes(mo.id)) err(id, `${v.label} Schritt ${i}: Kugel ${mo.id} unbekannt`);
        if (mo.after && !mv.some((o) => o.id === mo.after)) err(id, `${v.label} Schritt ${i}: after ${mo.after} nicht im Schritt`);
      }
      if (i > 0 && mv.length) {
        const tl = timeline(s, stateAt(v, i - 1).pos);
        for (const [bid, t] of Object.entries(tl)) {
          if (![t.dur, t.delay, t.firstEnd, ...t.vs, ...t.times].every(Number.isFinite)) err(id, `${v.label} Schritt ${i}: Zeitplan fuer ${bid} nicht endlich`);
          const fr = pathFrames(t);
          if (!fr.every((x, j) => j === 0 || x.offset >= fr[j - 1].offset)) err(id, `${v.label} Schritt ${i}: Keyframes von ${bid} nicht aufsteigend`);
        }
      }
    });
    if (v.steps[0].moves) err(id, `${v.label}: Schritt 0 darf keine Bewegung haben`);
  }
  for (const tx of texts) if (!SKIP.has(tx) && !en[tx] && !inGlobal(tx)) err(id, `keine englische Uebersetzung: ${String(tx).slice(0, 60)}`);
  for (const k of Object.keys(en)) if (!texts.has(k)) err(id, `Uebersetzung ohne Gegenstueck im Fall: ${k.slice(0, 60)}`);
}

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("Alle Regelfaelle in Ordnung.");
