/* Baut die Emoji-Sammlung als Vektorgrafik: node scripts/buildEmojiSprite.mjs
   Alle Emoji sollen auf jedem Geraet gleich aussehen und auch auf aelteren Geraeten (und Windows-Flaggen) erscheinen,
   deshalb werden sie als SVG gezeichnet statt vom Betriebssystem. Quelle der Grafiken: Twemoji (jdecked, Version 15)
   ueber das Entwicklungs-Paket @twemoji/svg, Lizenz der Grafiken CC-BY 4.0 (Namensnennung im Impressum).

   Gesammelt werden die Emoji aus: dem Code (src/, public/), den Datenbank-Migrationen (supabase/*.sql: Erfolgs-Katalog
   und Benachrichtigungstexte) und scripts/emojiExtra.txt. Zwei Sammlungen:
     KERN     (src/lib/emoji/sprite.js)        Code, Migrationen, neue Erfolge - wird beim ersten Emoji nachgeladen
     HAEUFIG  (src/lib/emoji/spriteCommon.js)  nur die Emoji fuer Nutzertexte (emojiExtra.txt, Abschnitt "Haeufige") -
                                               wird erst geladen, wenn ein Nutzertext eines davon enthaelt
   Schluessel = Codepunkte wie "1f3c6", Wert = Inhalt des SVG (viewBox 0 0 36 36).
   Fehlt ein Symbol im Satz, wird es gemeldet; die App zeigt dann das normale Emoji (components/Emoji.jsx). */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EMOJI_RE, emojiKey } from "../src/lib/emoji/emojiKey.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svgDir = join(root, "node_modules", "@twemoji", "svg");
const OUT = join(root, "src", "lib", "emoji", "sprite.js");

const files = [];
const walk = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (!["node_modules", "dist", ".git"].includes(n)) walk(p); }
    else if (/\.(jsx?|mjs|css|html)$/.test(n) && !/emoji[\\/]sprite/i.test(p)) files.push(p);
  }
};
walk(join(root, "src")); walk(join(root, "public"));
for (const n of readdirSync(join(root, "supabase"))) if (n.endsWith(".sql")) files.push(join(root, "supabase", n));

const collect = (text, into) => {
  for (const m of text.matchAll(EMOJI_RE)) { const k = emojiKey(m[0]); if (k && !into.has(k)) into.set(k, m[0]); }
};
const core = new Map(), common = new Map();
for (const f of files) collect(readFileSync(f, "utf8"), core);
let inCommon = false;
for (const line of readFileSync(join(root, "scripts", "emojiExtra.txt"), "utf8").split("\n")) {
  if (line.startsWith("#")) { inCommon = /Haeufige/.test(line); continue; }
  collect(line, inCommon ? common : core);
}
for (const k of core.keys()) common.delete(k); // was im Kern steckt, steht nicht noch einmal in HAEUFIG

/* Zahlen in Pfaden auf 2 Nachkommastellen: reicht bei Symbolen bis ~64 px locker (Raster 36x36) und spart gut ein Fuenftel.
   WICHTIG: richtig nach der SVG-Pfad-Grammatik lesen, nicht per Muster auf der Zeichenkette - bei Kreisboegen (a/A) stehen die
   zwei Flaggen (0/1) ohne Trennzeichen vor der naechsten Zahl ("a1 1 0 011.5"), ein Zahlenmuster frisst sie (so entstanden
   zerstoerte Symbole wie 🙌 🐪 🕸️ in Version 406.1-408). Flaggen werden unveraendert uebernommen. */
const NUM = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/y;
const shorten = (n) => String(+(+n).toFixed(2)).replace(/^(-?)0\./, "$1.");
const ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
/* Zerlegt einen Pfad in Befehle, Trennzeichen und Zahlen; fn(zahl) liefert die Ersatzzeichenkette. Gibt den neuen Pfad zurueck. */
function mapPath(d, fn) {
  let out = "", i = 0, cmd = "", arg = 0;
  while (i < d.length) {
    const ch = d[i];
    if (/[a-zA-Z]/.test(ch)) { cmd = ch.toLowerCase(); arg = 0; out += ch; i++; continue; }
    if (/[\s,]/.test(ch)) { out += ch; i++; continue; }
    if (cmd === "a" && (arg % 7 === 3 || arg % 7 === 4)) { out += ch; i++; arg++; continue; } // Bogen-Flagge: ein Zeichen
    NUM.lastIndex = i;
    const m = NUM.exec(d);
    if (!m) throw new Error("Pfad nicht lesbar bei: " + d.slice(i, i + 20));
    const r = fn(m[0]);
    // Kleben zwei Zahlen/Flaggen zusammen (".5" hinter "5"), braucht es ein Leerzeichen; vor "-" nicht
    out += (/[0-9.]$/.test(out) && r[0] !== "-" ? " " : "") + r;
    i += m[0].length; arg++;
    if (ARGS[cmd] && arg >= ARGS[cmd] && ARGS[cmd] > 0) arg = 0; // naechste Wiederholung desselben Befehls
  }
  return out;
}
const round = (inner) => inner.replace(/\bd="([^"]*)"/g, (_, v) => `d="${mapPath(v, shorten)}"`)
  .replace(/\bpoints="([^"]*)"/g, (_, v) => `points="${v.replace(/-?\d*\.\d{3,}/g, shorten)}"`);

/* Selbstpruefung: derselbe Pfad vor und nach dem Runden muss gleich viele Zahlen haben und jede darf hoechstens 0,006 abweichen
   (und nur dort, wo gerundet wurde). Bricht den Bau ab, statt kaputte Symbole auszuliefern. */
function verify(key, before, after) {
  const grab = (svg) => [...svg.matchAll(/\bd="([^"]*)"/g)].map((m) => { const n = []; mapPath(m[1], (x) => { n.push(+x); return x; }); return n; });
  const A = grab(before), B = grab(after);
  if (A.length !== B.length) throw new Error(`${key}: Pfadzahl ${A.length} -> ${B.length}`);
  A.forEach((a, i) => {
    if (a.length !== B[i].length) throw new Error(`${key}: Pfad ${i}: ${a.length} Zahlen -> ${B[i].length}`);
    a.forEach((x, j) => { if (Math.abs(x - B[i][j]) > 0.006) throw new Error(`${key}: Pfad ${i} Zahl ${j}: ${x} -> ${B[i][j]}`); });
  });
}

/* Beim Pixelvergleich mit den Originalen (alle 380 Symbole, 72 px) wichen diese vier um 1-2 % der Flaeche ab (duenne Linien,
   viele relative Befehle - die Rundungsfehler summieren sich): sie bleiben ungerundet. Neu pruefen, wenn der Satz wechselt. */
const NO_ROUND = new Set(["2728", "1f578", "1f981", "1f99e"]);

const missing = [];
const build = (map, out, label) => {
  const sprite = {};
  for (const [k, e] of [...map].sort()) {
    const p = join(svgDir, k + ".svg");
    if (!existsSync(p)) { missing.push(`${e} (${k})`); continue; }
    const before = readFileSync(p, "utf8").trim().replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    sprite[k] = NO_ROUND.has(k) ? before : round(before);
    verify(k, before, sprite[k]);
  }
  mkdirSync(dirname(out), { recursive: true });
  const body = Object.entries(sprite).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");
  writeFileSync(out, `/* GENERIERT von scripts/buildEmojiSprite.mjs - nicht von Hand aendern. Emoji-Grafiken: Twemoji (CC-BY 4.0). */\nexport default {\n${body}\n};\n`);
  console.log(`${label}: ${Object.keys(sprite).length} Emoji, ${(statSync(out).size / 1024).toFixed(1)} KB (${out.replace(root, "")})`);
};
build(core, OUT, "Kern");
build(common, join(dirname(OUT), "spriteCommon.js"), "Haeufig");
if (missing.length) console.log("Nicht im Twemoji-Satz (native Darstellung):", missing.join(" "));
