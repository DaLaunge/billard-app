import { supabase, DB_REF } from "../supabase";
import { fetchAllRows } from "./data";

/* Zusatzzaehler aller Matches (Tabelle match_counters, siehe lib/matchCounters.js
   und supabase/2026-10-01_match_counters.sql) fuer die Fun-Stats.

   Wie bei den Matches (matchCache.js) wegen des Egress-Limits mit lokalem
   Cache: einmal komplett, danach nur Zeilen mit updated_at seit dem letzten
   Abgleich (10 Min Ueberlappung, Abgleich gegen den Server-Zeitstempel der
   empfangenen Zeilen). Es gibt nur Zeilen fuer Matches, in denen jemand
   Zaehler benutzt hat - die Tabelle bleibt also klein. Geloeschte Matches
   nehmen ihre Zeile per ON DELETE CASCADE mit; im Cache bleibt sie bis zum
   naechsten Voll-Abgleich (nach 14 Tagen) liegen, was nichts schadet, weil
   die Auswertung nur Zeilen zu Matches zaehlt, die es noch gibt.

   Fehlt die Tabelle (Migration nicht eingespielt) oder ist man offline, kommt
   der letzte Stand bzw. nichts - die Fun-Stats erscheinen dann einfach nicht. */
const VERSION = 1;
const OVERLAP_MS = 10 * 60000;
const FULL_REFRESH_DAYS = 14;
const KEY = `matchCounters:${DB_REF}`;

const read = () => {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    return c && c.v === VERSION ? c : null;
  } catch { return null; }
};
const write = (c) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* Speicher voll */ } };

let inflight = null;
let last = null; // { at, rows } - kurzer Speicher gegen Mehrfach-Anfragen beim Bildschirmwechsel
// Liefert { [match_id]: counters }. maxAgeMs > 0: ein frisches Ergebnis wiederverwenden.
export function loadMatchCounters({ maxAgeMs = 0 } = {}) {
  if (maxAgeMs > 0 && last && Date.now() - last.at < maxAgeMs) return Promise.resolve(last.rows);
  if (inflight) return inflight;
  inflight = (async () => {
    const cache = read();
    const full = !cache || Date.now() - (cache.fullAt || 0) > FULL_REFRESH_DAYS * 86400000;
    const since = full ? null : cache.since;
    const { data, error } = await fetchAllRows((from, to) => {
      let q = supabase.from("match_counters").select("match_id, counters, updated_at")
        .order("updated_at", { ascending: true }).order("match_id");
      if (since) q = q.gte("updated_at", new Date(Date.parse(since) - OVERLAP_MS).toISOString());
      return q.range(from, to);
    });
    if (error) return cache?.rows || {};
    const rows = full ? {} : { ...cache.rows };
    let newest = full ? 0 : Date.parse(cache.since) || 0;
    data.forEach((r) => {
      rows[r.match_id] = r.counters;
      newest = Math.max(newest, Date.parse(r.updated_at) || 0);
    });
    write({
      v: VERSION, rows, since: newest ? new Date(newest).toISOString() : null,
      fullAt: full ? Date.now() : cache.fullAt,
    });
    last = { at: Date.now(), rows };
    return rows;
  })().finally(() => { inflight = null; });
  return inflight;
}
