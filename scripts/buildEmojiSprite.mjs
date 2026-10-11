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

/* Zahlen in Pfaden auf 2 Nachkommastellen: reicht bei Symbolen bis ~64 px locker (Raster 36x36) und spart gut ein Viertel. */
const shorten = (n) => String(+(+n).toFixed(2)).replace(/^(-?)0\./, "$1.");
const round = (inner) => inner.replace(/\b(d|points)="([^"]*)"/g, (_, a, v) => `${a}="${v.replace(/-?\d*\.\d{3,}/g, shorten)}"`);

const missing = [];
const build = (map, out, label) => {
  const sprite = {};
  for (const [k, e] of [...map].sort()) {
    const p = join(svgDir, k + ".svg");
    if (!existsSync(p)) { missing.push(`${e} (${k})`); continue; }
    sprite[k] = round(readFileSync(p, "utf8").trim().replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, ""));
  }
  mkdirSync(dirname(out), { recursive: true });
  const body = Object.entries(sprite).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");
  writeFileSync(out, `/* GENERIERT von scripts/buildEmojiSprite.mjs - nicht von Hand aendern. Emoji-Grafiken: Twemoji (CC-BY 4.0). */\nexport default {\n${body}\n};\n`);
  console.log(`${label}: ${Object.keys(sprite).length} Emoji, ${(statSync(out).size / 1024).toFixed(1)} KB (${out.replace(root, "")})`);
};
build(core, OUT, "Kern");
build(common, join(dirname(OUT), "spriteCommon.js"), "Haeufig");
if (missing.length) console.log("Nicht im Twemoji-Satz (native Darstellung):", missing.join(" "));
