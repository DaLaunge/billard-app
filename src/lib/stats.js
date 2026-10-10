// mode: "single" (Standard - nur Einzel, wie bisher), "double" (nur Doppel) oder
// "both". Ein Doppel zaehlt fuer BEIDE Spieler jeder Seite: Sieg, Niederlage,
// Serie und Racks, jeweils mit dem Ergebnis der eigenen Seite. Gast-Matches
// zaehlen nie (wie beim Einzel), auch wenn nur EIN Gast beteiligt ist.
export function computeStats(matches, mode = "single") {
  const s = {};
  const get = (n) => (s[n] ||= { name: n, spiele: 0, siege: 0, racksW: 0, racksT: 0, results: [] });
  const sorted = [...matches].sort((a, b) => new Date(a.played_at) - new Date(b.played_at));
  sorted.forEach((m) => {
    const dbl = !!m.player1b_id;
    if (dbl ? mode === "single" : mode === "double") return;
    const side1 = dbl ? [m.p1, m.p1b] : [m.p1];
    const side2 = dbl ? [m.p2, m.p2b] : [m.p2];
    if ([...side1, ...side2].some((p) => !p || p.is_guest)) return; // Gast-Matches zaehlen wie Ghost-Training nicht fuer Quote/Serien
    const total = m.score1 + m.score2;
    const side1Won = m.score1 > m.score2;
    side1.forEach((p) => {
      const x = get(p.nickname);
      x.spiele++; x.racksW += m.score1; x.racksT += total;
      if (side1Won) x.siege++;
      x.results.push(side1Won);
    });
    side2.forEach((p) => {
      const x = get(p.nickname);
      x.spiele++; x.racksW += m.score2; x.racksT += total;
      if (!side1Won) x.siege++;
      x.results.push(!side1Won);
    });
  });
  Object.values(s).forEach((p) => {
    p.quote = p.spiele ? Math.round((100 * p.siege) / p.spiele) : 0;
    let st = 0;
    for (let i = p.results.length - 1; i >= 0; i--) {
      if (st === 0) st = p.results[i] ? 1 : -1;
      else if (p.results[i] === (st > 0)) st += st > 0 ? 1 : -1;
      else break;
    }
    p.streak = st;
    let cur = 0, best = 0;
    p.results.forEach((r) => { if (r) { cur++; best = Math.max(best, cur); } else cur = 0; });
    p.longestStreak = best;
  });
  return s;
}

// Lokales Datum als 'YYYY-MM-DD'
export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function dateMinusDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return todayStr(d);
}
