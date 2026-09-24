import { supabase } from "../supabase";

/* Automatische Wiederholung fuer RPCs, die Matches schreiben.

   Jede Aenderung an matches loest eine KOMPLETTE Rating-Neuberechnung aus
   (trg_rebuild_ratings -> rebuild_elo(), ~1 s). Seit
   supabase/2026-09-24d_serialize_rating_rebuild.sql laufen gleichzeitige
   Neuberechnungen nacheinander statt gegeneinander - melden aber viele Spieler
   im selben Moment, wartet der letzte in der Schlange laenger als Supabases
   Statement-Timeout (8 s) und wird abgebrochen (Stresstest 2026-09-24: 2 von
   10 gleichzeitigen Meldungen). Solche Fehler sind voruebergehend: Postgres
   nimmt die abgebrochene Transaktion komplett zurueck, ein zweiter Versuch
   kann also nichts doppelt speichern. Deshalb hier bis zu ATTEMPTS Versuche
   mit wachsender, leicht zufaelliger Pause (damit nicht alle Wartenden
   gleichzeitig wieder anklopfen).

   Nur fuer diese Fehlerklassen - alles andere ("Match ist bereits
   bestaetigt", fehlende Rechte, Netzwerk weg) kommt sofort zurueck, das
   Netzwerk-Fehler-Handling (lib/offlineReport.js) bleibt unberuehrt. */

const ATTEMPTS = 4;
const PAUSE_MS = [1500, 3000, 5000];

export function isTransientDbError(err) {
  if (!err) return false;
  if (["57014", "40P01", "40001", "55P03"].includes(err.code)) return true;  // Timeout, Deadlock, Serialisierung, Sperre
  // Kollision zweier Rating-Neuberechnungen (sollte seit der Sperre nicht mehr vorkommen)
  return err.code === "23505" && /ratings_pkey|elo_anchors/.test(err.message || "");
}

export async function rpcRetry(fn, params) {
  let res;
  for (let i = 0; i < ATTEMPTS; i++) {
    res = await supabase.rpc(fn, params);
    if (!res.error || !isTransientDbError(res.error) || i === ATTEMPTS - 1) return res;
    await new Promise((r) => setTimeout(r, PAUSE_MS[i] + Math.random() * 1000));
  }
  return res;
}
