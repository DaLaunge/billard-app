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
    const res = await fetchFull(SELECT);
    if (undefinedColumn(res.error)) return fetchFull(LEGACY_SELECT);  // Migration fehlt noch
    if (res.error) return res;
    const syncMs = maxTs(res.data, "updated_at", 0);
    const rows = res.data.map(strip);
    if (syncMs) writeCache(rows, syncMs, Date.now());
    return { data: rows, error: null };
  }

  const since = new Date(cache.syncMs - OVERLAP_MS).toISOString();
  const [changed, deleted] = await Promise.all([
    fetchAllRows((from, to) => supabase.from("matches").select(SELECT)
      .gte("updated_at", since).order("updated_at", { ascending: true }).range(from, to)),
    fetchAllRows((from, to) => supabase.from("deleted_matches").select("match_id, deleted_at")
      .gte("deleted_at", since).order("deleted_at", { ascending: true }).range(from, to)),
  ]);
  const err = changed.error || deleted.error;
  if (err) return { data: cache.rows, error: err };

  const byId = new Map(cache.rows.map((r) => [r.id, r]));
  changed.data.forEach((r) => byId.set(r.id, strip(r)));
  deleted.data.forEach((d) => byId.delete(d.match_id));
  const rows = [...byId.values()].sort(byPlayedDesc);
  const syncMs = maxTs(deleted.data, "deleted_at", maxTs(changed.data, "updated_at", cache.syncMs));
  writeCache(rows, syncMs, cache.fetchedAt);
  return { data: rows, error: null };
}

// Setzt p1/p2/p1b/p2b ({nickname, is_guest}) aus der aktuellen Spielerliste
// ein - dieselbe Form, die frueher der Join in der Abfrage geliefert hat.
export function attachMatchPlayers(rows, players) {
  const byId = new Map(players.map((p) => [p.id, { nickname: p.nickname, is_guest: !!p.is_guest }]));
  const of = (id) => (id ? byId.get(id) || { nickname: "?", is_guest: false } : null);
  return rows.map((m) => ({ ...m, p1: of(m.player1_id), p2: of(m.player2_id), p1b: of(m.player1b_id), p2b: of(m.player2b_id) }));
}
