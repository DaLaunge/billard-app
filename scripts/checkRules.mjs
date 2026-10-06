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
import { stateAt, timeline, pathFrames, contactErrors, posAt } from "../src/lib/ruleEngine.js";
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
  for (const k of ["id", "discs", "topic", "ref", "keywords", "title", "rule"]) if (c[k] == null) err(id, `Feld ${k} fehlt`);
  if (!c.sets && !c.variants) err(id, "weder sets noch variants");
  if (typeof c.released !== "boolean") err(id, "released fehlt");
  (c.discs || []).forEach((d) => { if (!ALL_DISCS.includes(d)) err(id, `unbekannte Disziplin ${d}`); });
  if (!TOPICS[c.topic]) err(id, `unbekanntes Thema ${c.topic}`);

  const texts = new Set([c.title, c.rule, ...(c.keywords || [])]);
  const sets = c.sets || [{ discs: c.discs, variants: c.variants }];
  const covered = new Set(sets.flatMap((st) => st.discs || []));
  if (!(c.discs || []).every((d) => covered.has(d)) || ![...covered].every((d) => (c.discs || []).includes(d))) err(id, "discs des Falls und der Saetze passen nicht zusammen");
  for (const st of sets) {
    if (!st.discs || !st.discs.length || !st.variants) err(id, "Satz ohne discs/variants");
    (st.discs || []).forEach((d) => { if (!ALL_DISCS.includes(d)) err(id, `Satz: unbekannte Disziplin ${d}`); });
    if (st.tag) texts.add(st.tag);
  }
  for (const v of [...new Set(sets.flatMap((st) => st.variants || []))]) {
    texts.add(v.label); texts.add(v.reason); if (v.verdictLabel) texts.add(v.verdictLabel);
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
        for (const e of contactErrors(s, stateAt(v, i - 1).pos)) {
          err(id, `${v.label} Schritt ${i}: ` + (e.kind === "objekt"
            ? `Kugel ${e.id} laeuft ${e.dev} Grad neben der Mittelpunktslinie (cut() verwenden)`
            : `Weisse bleibt bei ${e.phi} Grad Schnitt stehen, muesste noch ${e.need} weiterlaufen (cut() verwenden)`));
        }
        const tl = timeline(s, stateAt(v, i - 1).pos);
        // Kollisionen waehrend der Bewegung: keine zwei sichtbaren Kugeln naeher als 9.8
        // (beruehrende Kugeln liegen bei 11). Gesampelt alle 15 ms.
        const from = stateAt(v, i - 1), to0 = stateAt(v, i);
        const tEnd = Math.max(...Object.values(tl).map((x) => x.delay + x.dur));
        const where = (bid, tt) => {
          const x = tl[bid];
          if (!x) return from.pos[bid];
          return posAt(x, tt - x.delay);
        };
        const gone = (bid, tt) => (from.out[bid] && !tl[bid]) || (tl[bid] && tl[bid].out && tt >= tl[bid].delay + tl[bid].dur * 0.85);
        for (let tt = 0; tt <= tEnd; tt += 15) {
          for (let a2 = 0; a2 < ids.length; a2++) for (let b2 = a2 + 1; b2 < ids.length; b2++) {
            if (gone(ids[a2], tt) || gone(ids[b2], tt) || (to0.out[ids[a2]] && !tl[ids[a2]]) || (to0.out[ids[b2]] && !tl[ids[b2]])) continue;
            const pa = where(ids[a2], tt), pb = where(ids[b2], tt);
            const dd = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
            if (dd < 9.8) { err(id, `${v.label} Schritt ${i}: Kugeln ${ids[a2]} und ${ids[b2]} laufen bei ${Math.round(tt)} ms durcheinander (Abstand ${dd.toFixed(1)})`); tt = tEnd + 1; a2 = ids.length; break; }
          }
        }
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

// Uebersetzungen: kein Schluessel doppelt in einer Datei (im Objekt gewinnt sonst still der letzte)
// und derselbe deutsche Text darf in zwei Faellen nicht verschieden uebersetzt sein.
const seenEn = {};
for (const f of readdirSync(dir).filter((n) => n.endsWith(".js")).sort()) {
  const src = readFileSync(resolve(dir, f), "utf8");
  const part = src.slice(src.indexOf("export const en"));
  const keys = [...part.matchAll(/^\s*("(?:[^"\\]|\\.)*"):/gm)].map((m) => JSON.parse(m[1]));
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  dup.forEach((k) => err(f, `Uebersetzungsschluessel doppelt: ${k.slice(0, 50)}`));
  const m = await import(pathToFileURL(resolve(dir, f)).href);
  for (const [k, v] of Object.entries(m.en || {})) {
    if (seenEn[k] && seenEn[k].v !== v) err(f, `"${k.slice(0, 40)}" ist in ${seenEn[k].f} anders uebersetzt`);
    seenEn[k] = seenEn[k] || { f, v };
  }
}

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("Alle Regelfaelle in Ordnung.");
