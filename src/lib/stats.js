export function computeStats(matches) {
  const s = {};
  const get = (n) => (s[n] ||= { name: n, spiele: 0, siege: 0, racksW: 0, racksT: 0, results: [] });
  const sorted = [...matches].sort((a, b) => new Date(a.played_at) - new Date(b.played_at));
  sorted.forEach((m) => {
    if (m.player1b_id) return;
    const a = get(m.p1.nickname), b = get(m.p2.nickname);
    a.spiele++; b.spiele++;
    a.racksW += m.score1; a.racksT += m.score1 + m.score2;
    b.racksW += m.score2; b.racksT += m.score1 + m.score2;
    const aWon = m.score1 > m.score2;
    if (aWon) a.siege++; else b.siege++;
    a.results.push(aWon); b.results.push(!aWon);
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

/* ISO-Wochen-String ("2026-W05") -> Date des Wochen-Montags */
export function isoWeekToDate(wk) {
  if (!wk || wk.length < 7) return null;
  const y = parseInt(wk.slice(0, 4), 10);
  const w = parseInt(wk.slice(6), 10);
  const simple = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
  const dow = simple.getUTCDay();
  const monday = new Date(simple);
  if (dow <= 4) monday.setUTCDate(simple.getUTCDate() - dow + 1);
  else monday.setUTCDate(simple.getUTCDate() + 8 - dow);
  return monday;
}

// Aktuelle ISO-Woche im DB-Format 'YYYY-Wnn' (wie to_char(now(),'IYYY-"W"IW'))
export function currentIsoWeek(dd = new Date()) {
  const d = new Date(Date.UTC(dd.getFullYear(), dd.getMonth(), dd.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);              // Donnerstag dieser Woche
  const isoYear = d.getUTCFullYear();
  const firstThu = new Date(Date.UTC(isoYear, 0, 4));
  const ftDay = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - ftDay + 3); // Donnerstag der Woche 1
  const week = 1 + Math.round((d - firstThu) / (7 * 86400000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
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
