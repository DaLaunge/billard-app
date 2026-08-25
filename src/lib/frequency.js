/* Wie oft hat "me" in letzter Zeit gegen wen gespielt? Zeitfenster von eng
   nach weit: erstes Fenster mit genug Matches gewinnt. Trifft keines die
   Schwelle, zaehlt die gesamte Historie (Infinity) – gibt es ueberhaupt
   keine gemeinsamen Matches, bleibt das Ergebnis leer (Aufrufer sortieren
   dann ueblicherweise alphabetisch als Fallback). Zentral hier definiert,
   damit Statistik-Filter, Match-Erfassung und Admin-Formulare dieselbe
   Reihenfolge "haeufigste Mitspieler zuerst" anzeigen. */
const RECENT_WINDOWS_DAYS = [90, 180, 365, Infinity];
const MIN_SIGNIFICANT_MATCHES = 3;

export function recentOpponentFreq(matches, me) {
  if (!me) return {};
  const now = Date.now();
  for (const days of RECENT_WINDOWS_DAYS) {
    const cutoff = days === Infinity ? 0 : now - days * 86400000;
    const f = {};
    let total = 0;
    (matches || []).forEach((m) => {
      if (m.player1b_id) return;
      if (new Date(m.played_at).getTime() < cutoff) return;
      let opp = null;
      if (m.p1?.nickname === me.nickname) opp = m.p2?.nickname;
      else if (m.p2?.nickname === me.nickname) opp = m.p1?.nickname;
      if (opp) { f[opp] = (f[opp] || 0) + 1; total++; }
    });
    if (total >= MIN_SIGNIFICANT_MATCHES || days === Infinity) return f;
  }
  return {};
}
