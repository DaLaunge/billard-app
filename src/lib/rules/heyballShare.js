import { HEYBALL } from "./meta.js";

/* Regelfaelle, die beim Heyball GENAUSO gelten wie beim 8 Ball (WPA Rules of Heyball Kap. II, Nummer in
   Klammern) und deshalb dieselbe Animation zeigen: Heyball kommt zu `discs` des Falls und zum Satz dazu, der
   den 8 Ball enthaelt (oder zu dem Satz fuer alle vier Disziplinen). Die Regeln, in denen sich Heyball vom
   8 Ball unterscheidet (Anstoss, offener Tisch nach dem Anstoss, kein Ansagen, Rackverlust, ...), haben eigene
   Faelle in cases/6x-heyball-*.js. Reine Funktion der Falldaten (node-tauglich, auch fuer scripts/). */
export const HEYBALL_SHARED = [
  "erste-beruehrung",      // 12.1
  "weisse-versenkt",       // 17 a
  "nach-treffer-bande",    // 12.2
  "bewegende-kugeln",      // 17 c
  "doppelstoss",           // 12.6
  "schieben",              // 12.7
  "press-bande",           // 15.2
  "fuss-am-boden",         // 17 d
  "kugel-beruehrt",        // 12.4, 17 f
  "foul-zu-spaet",         // 12.5
  "unsportlich",           // 24
  "tuch-markieren",        // 24 f
  "kugel-faellt-von-selbst", // 14
  "stoerung-von-aussen",   // 22
  "patt",                  // 21
  "ausspielen",            // 5
  "rack-aufbau",           // 4
  "anstoss-vier-kugeln",   // 6 c (Folgen eines ungueltigen Anstosses wie beim 8 Ball)
  "gleichzeitiger-treffer", // 13
];

export function withHeyball(c) {
  if (!HEYBALL_SHARED.includes(c.id) || c.discs.includes(HEYBALL)) return c;
  const sets = c.sets || [{ discs: c.discs, variants: c.variants }];
  const at = sets.findIndex((s) => s.discs.includes("8 Ball"));
  if (at < 0) return c;
  const next = sets.map((s, i) => (i === at ? { ...s, discs: [...s.discs, HEYBALL] } : s));
  return { ...c, discs: [...c.discs, HEYBALL], sets: next };
}
