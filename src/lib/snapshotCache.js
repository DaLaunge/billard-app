import { supabase, DB_REF } from "../supabase";
import { fetchAllRows } from "./data";

/* Rating-Verlauf (rating_snapshots) mit lokalem Cache.

   Hintergrund: die Tabelle hat eine Zeile pro Spieler, Disziplin und TAG
   (Sept. 2026: ~26.000 Zeilen, ~4 MB als JSON) und wurde frueher bei JEDEM
   loadData() komplett neu geladen - also nach jedem Speichern, in Winner
   Stays nach jedem Spiel. Das allein hat das Egress-Kontingent des Supabase-
   Gratisplans (5 GB/Monat) gesprengt.

   Vergangene Tage aendern sich nie: snapshot_ratings() schreibt ausschliesslich
   current_date (Insert bzw. Update derselben Zeile), rebuild_elo() schreibt
   nur elo_anchors/ratings. Darum reicht es, ab dem juengsten bereits
   bekannten Tag nachzuladen (inklusive dieses Tages, weil dessen Zeile sich
   bis Mitternacht noch aendern kann).

   Geloeschte Spieler bleiben als Zeilen im Cache liegen - harmlos, alle
   Verbraucher (EntwicklungBlock, peakRating) ignorieren Zeilen, deren
   player_id nicht mehr in players steht. Sollte je wieder eine Migration die
   Historie umschreiben (z.B. ein Backfill), CACHE_VERSION erhoehen; als
   Sicherheitsnetz wird ausserdem nach FULL_REFRESH_DAYS komplett neu geladen.

   Gespeichert wird kompakt (Spieler/Disziplinen als Index-Tabellen, Datum als
   Tagesnummer), weil localStorage nur ~5 MB fasst: ~20 Byte statt ~150 pro
   Zeile. Nur die vier Spalten, die die App wirklich liest. */

const CACHE_VERSION = 1;
const FULL_REFRESH_DAYS = 14;
const KEY = `snapCache:${DB_REF}`;
const DAY_MS = 86400000;
const COLS = "player_id, snap_date, discipline, rating";

const dayNo = (d) => Math.round(Date.parse(d + "T00:00:00Z") / DAY_MS);
const dayStr = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!c || c.v !== CACHE_VERSION || !Array.isArray(c.rows)) return null;
    if (Date.now() - (c.fetchedAt || 0) > FULL_REFRESH_DAYS * DAY_MS) return null;
    return c;
  } catch { return null; }
}

function writeCache(rows, fetchedAt) {
  try {
    const pIdx = new Map(), dIdx = new Map(), players = [], discs = [];
    const packed = rows.map((r) => {
      if (!pIdx.has(r.player_id)) { pIdx.set(r.player_id, players.length); players.push(r.player_id); }
      if (!dIdx.has(r.discipline)) { dIdx.set(r.discipline, discs.length); discs.push(r.discipline); }
      return [pIdx.get(r.player_id), dIdx.get(r.discipline), dayNo(r.snap_date), r.rating];
    });
    localStorage.setItem(KEY, JSON.stringify({ v: CACHE_VERSION, fetchedAt, players, discs, rows: packed }));
  } catch {
    // Speicher voll / privates Fenster: dann eben beim naechsten Mal wieder komplett laden.
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }
}

function unpack(c) {
  return c.rows.map(([p, d, day, rating]) => ({
    player_id: c.players[p], discipline: c.discs[d], snap_date: dayStr(day), rating,
  }));
}

// Ergebnis wie fetchAllRows: { data, error }, data aufsteigend nach snap_date.
export async function loadSnapshots() {
  const cache = readCache();
  if (!cache || !cache.rows.length) {
    const res = await fetchAllRows((from, to) => supabase.from("rating_snapshots")
      .select(COLS).order("snap_date", { ascending: true }).range(from, to));
    if (!res.error) writeCache(res.data, Date.now());
    return res;
  }

  const old = unpack(cache);
  const since = old[old.length - 1].snap_date;
  const res = await fetchAllRows((from, to) => supabase.from("rating_snapshots")
    .select(COLS).gte("snap_date", since).order("snap_date", { ascending: true }).range(from, to));
  if (res.error) return { data: old, error: res.error };
  const data = old.filter((r) => r.snap_date < since).concat(res.data);
  writeCache(data, cache.fetchedAt);
  return { data, error: null };
}
