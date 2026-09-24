import { supabase, DB_REF } from "../supabase";
import { fetchAllRows } from "./data";

/* Match-Liste mit lokalem Cache (Gegenstueck zu snapshotCache.js).

   Frueher hat JEDES loadData() alle Matches geladen (Sept. 2026: 644 Stueck,
   ~450 KB, ~80 % des Supabase-Egress) - und das waechst mit jedem Match und
   jedem Spieler, der die App oeffnet. Jetzt: einmal komplett, danach nur
   noch Zeilen mit updated_at seit dem letzten Abgleich plus die IDs aus
   deleted_matches (beides aus supabase/2026-09-24_match_delta_sync.sql).

   Abgeglichen wird gegen die Server-Zeitstempel der empfangenen Zeilen, nicht
   gegen die Uhr des Geraets, und immer mit OVERLAP_MS Ueberlappung: updated_at
   ist der Start der schreibenden Transaktion, eine Zeile kann also "in der
   Vergangenheit" sichtbar werden. Doppelt empfangene Zeilen sind harmlos
   (Abgleich per id).

   Spielernamen (p1/p2/p1b/p2b) werden NICHT gecacht, sondern in
   attachMatchPlayers() aus der jedes Mal frisch geladenen Spielerliste
   eingesetzt - sonst stuende nach einer Namensaenderung ueberall der alte
   Name. Turnier-/Winner-Stays-Namen koennen nachtraeglich nicht geaendert
   werden und bleiben deshalb im Cache.

   Fehlt die Migration (Spalte updated_at unbekannt), wird wie frueher jedes
   Mal alles geladen. Sicherheitsnetz: nach FULL_REFRESH_DAYS komplett neu;
   CACHE_VERSION erhoehen, wenn sich COLS aendert. */

const CACHE_VERSION = 1;
const FULL_REFRESH_DAYS = 14;
const OVERLAP_MS = 10 * 60000;
const KEY = `matchCache:${DB_REF}`;
const COLS = ["id", "played_at", "score1", "score2", "high_run1", "high_run2", "discipline", "confirmed",
  "reported_by", "player1_id", "player2_id", "player1b_id", "player2b_id", "run_log", "tournament_id",
  "winner_stays_session_id", "manual_entry_note", "tournament", "winner_stays_session"];
const JOINS = "tournament:tournaments(name, format, organizer_id), winner_stays_session:winner_stays_sessions(name, is_doubles)";
const BASE = COLS.filter((c) => c !== "tournament" && c !== "winner_stays_session").join(", ");
const SELECT = `${BASE}, updated_at, ${JOINS}`;
const LEGACY_SELECT = `${BASE}, ${JOINS}`;

const ts = (s) => (s ? Date.parse(s) : 0);
const byPlayedDesc = (a, b) => ts(b.played_at) - ts(a.played_at);

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!c || c.v !== CACHE_VERSION || !Array.isArray(c.rows) || !c.syncMs) return null;
    if (Date.now() - (c.fetchedAt || 0) > FULL_REFRESH_DAYS * 86400000) return null;
    return { ...c, rows: c.rows.map((a) => Object.fromEntries(COLS.map((k, i) => [k, a[i] ?? null]))) };
  } catch { return null; }
}

function writeCache(rows, syncMs, fetchedAt) {
  try {
    // Kompakt als Arrays (ohne Schluessel) - localStorage fasst nur ~5 MB.
    const packed = rows.map((r) => COLS.map((k) => r[k] ?? null));
    localStorage.setItem(KEY, JSON.stringify({ v: CACHE_VERSION, syncMs, fetchedAt, rows: packed }));
  } catch {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }
}

const maxTs = (rows, field, start) => rows.reduce((m, r) => Math.max(m, ts(r[field])), start);
const strip = (r) => { const { updated_at: _u, ...rest } = r; return rest; };
const undefinedColumn = (err) => err && (err.code === "42703" || /updated_at/.test(err.message || ""));

async function fetchFull(select) {
  return fetchAllRows((from, to) => supabase.from("matches").select(select)
    .order("played_at", { ascending: false }).range(from, to));
}

// Ergebnis wie fetchAllRows: { data, error }, data absteigend nach played_at,
// OHNE p1/p2/p1b/p2b (siehe attachMatchPlayers).
export async function loadMatches() {
  const cache = readCache();
  if (!cache) {
    lastSync.mode = "full"; lastSync.repaired = false;
    const res = await fetchFull(SELECT);
    if (undefinedColumn(res.error)) return fetchFull(LEGACY_SELECT);  // Migration fehlt noch
    if (res.error) return res;
    const syncMs = maxTs(res.data, "updated_at", 0);
    const rows = res.data.map(strip);
    if (syncMs) writeCache(rows, syncMs, Date.now());
    return { data: rows, error: null };
  }

  const since = new Date(cache.syncMs - OVERLAP_MS).toISOString();
  // Bevorzugt matches_sync() (supabase/2026-09-24c_matches_sync.sql): Aenderungen
  // UND Pruefsumme aus demselben Datenbank-Stand. Fehlt die Funktion noch,
  // wie bisher zwei getrennte Abfragen ohne Pruefsumme.
  let changed, deleted, check = null;
  const sync = await supabase.rpc("matches_sync", { p_since: since });
  if (!sync.error && sync.data) {
    changed = sync.data.rows || []; deleted = sync.data.deleted || [];
    check = { count: sync.data.count, hash: sync.data.hash };
  } else if (missingFunction(sync.error)) {
    const [c, d] = await Promise.all([
      fetchAllRows((from, to) => supabase.from("matches").select(SELECT)
        .gte("updated_at", since).order("updated_at", { ascending: true }).range(from, to)),
      fetchAllRows((from, to) => supabase.from("deleted_matches").select("match_id, deleted_at")
        .gte("deleted_at", since).order("deleted_at", { ascending: true }).range(from, to)),
    ]);
    if (c.error || d.error) return { data: cache.rows, error: c.error || d.error };
    changed = c.data; deleted = d.data;
  } else {
    return { data: cache.rows, error: sync.error };
  }

  const byId = new Map(cache.rows.map((r) => [r.id, r]));
  changed.forEach((r) => byId.set(r.id, strip(r)));
  deleted.forEach((d) => byId.delete(d.match_id));
  const syncMs = maxTs(deleted, "deleted_at", maxTs(changed, "updated_at", cache.syncMs));

  lastSync.mode = check ? "delta+check" : "delta";
  lastSync.repaired = false;
  if (check && !(await matchesCheck(byId, check))) await repair(byId);

  const rows = [...byId.values()].sort(byPlayedDesc);
  writeCache(rows, syncMs, cache.fetchedAt);
  return { data: rows, error: null };
}

// Was der letzte Abgleich gemacht hat - nur zum Nachvollziehen/Testen
// (z.B. in der Browser-Konsole), die App selbst liest das nicht.
export const lastSync = { mode: null, repaired: false, missing: 0, extra: 0 };

const missingFunction = (err) => err && (err.code === "PGRST202" || err.code === "42883");

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Stimmt der Stand auf dem Geraet mit dem Server ueberein? Gleiche Anzahl und
// gleiche SHA-256 ueber die sortierten IDs wie in matches_sync(). Die simple
// Zeichen-Sortierung entspricht der uuid-Sortierung dort (Kleinbuchstaben-Hex,
// Bindestriche an festen Stellen). Ohne crypto.subtle (nur ueber https bzw.
// localhost verfuegbar) wird nicht geprueft - dann gilt der Stand als ok.
async function matchesCheck(byId, check) {
  if (byId.size !== check.count) return false;
  if (!globalThis.crypto?.subtle || !check.hash) return true;
  try { return (await sha256Hex([...byId.keys()].sort().join(","))) === check.hash; }
  catch { return true; }
}

// Pruefsumme passt nicht: es ist wirklich etwas verloren gegangen. Statt alles
// neu zu laden nur die ID-Liste holen (~40 Byte je Match), fehlende Matches
// gezielt nachladen, ueberzaehlige entfernen. Die ID-Liste ist ein etwas
// spaeterer Stand als der Abgleich - was dazwischen geaendert wurde, holt der
// naechste Abgleich ueber die Ueberlappung ohnehin. Schlaegt die Reparatur
// fehl, bleibt der (ungepruefte) Stand; der naechste Abgleich prueft erneut.
async function repair(byId) {
  const ids = await fetchAllRows((from, to) => supabase.from("matches").select("id").order("id").range(from, to));
  if (ids.error) return;
  const server = new Set(ids.data.map((r) => r.id));
  const extra = [...byId.keys()].filter((id) => !server.has(id));
  const missing = [...server].filter((id) => !byId.has(id));
  for (let i = 0; i < missing.length; i += 100) {
    const { data, error } = await supabase.from("matches").select(SELECT).in("id", missing.slice(i, i + 100));
    if (error) return;
    data.forEach((r) => byId.set(r.id, strip(r)));
  }
  extra.forEach((id) => byId.delete(id));
  Object.assign(lastSync, { repaired: true, missing: missing.length, extra: extra.length });
}

// Setzt p1/p2/p1b/p2b ({nickname, is_guest}) aus der aktuellen Spielerliste
// ein - dieselbe Form, die frueher der Join in der Abfrage geliefert hat.
export function attachMatchPlayers(rows, players) {
  const byId = new Map(players.map((p) => [p.id, { nickname: p.nickname, is_guest: !!p.is_guest }]));
  const of = (id) => (id ? byId.get(id) || { nickname: "?", is_guest: false } : null);
  return rows.map((m) => ({ ...m, p1: of(m.player1_id), p2: of(m.player2_id), p1b: of(m.player1b_id), p2b: of(m.player2b_id) }));
}
