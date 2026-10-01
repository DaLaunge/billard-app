import { rpcRetry } from "./rpcRetry";

/* Spieldauer der Match-Uhr (widgets/MatchClock.jsx) speichern - Tabelle
   match_clock, supabase/2026-10-01_match_clock.sql. Wie bei den Zusatzzaehlern:
   erst NACH dem Melden, und ein Fehler (z.B. Migration noch nicht eingespielt)
   darf das gemeldete Match nie beeintraechtigen.

   clock = { net, total } in ms: net ohne Pausen, total mit Pausen. */
export async function saveMatchClock(matchId, clock) {
  if (!matchId || !clock || !(clock.net >= 1000)) return;
  try {
    const { error } = await rpcRetry("set_match_clock", {
      p_match_id: matchId, p_net_ms: Math.round(clock.net), p_total_ms: Math.round(Math.max(clock.total, clock.net)),
    });
    if (error) console.warn("Spieldauer nicht gespeichert:", error.message);
  } catch (e) { console.warn("Spieldauer nicht gespeichert:", e?.message || e); }
}
