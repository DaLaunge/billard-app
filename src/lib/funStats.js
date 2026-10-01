/* Fun-Stats aus den optionalen Zusatzzaehlern (Fluke, Runout, Scratch, Foul -
   siehe lib/matchCounters.js). Reiner Spass: keine Auswirkung auf Rating oder
   Erfolge, deshalb in der Rekord-Karte ausdruecklich als "FUN" gekennzeichnet.

   Gezaehlt werden nur EINZEL-Matches mit Mitgliedern auf beiden Seiten: im
   Doppel gehoert ein Zaehler einem Team, nicht einer Person, und ein Gast
   kann keinen Rekord halten. Die Zaehler sind relativ zur MELDENDEN Person
   gespeichert (Index 0 = reported_by, 1 = Gegner) und werden hier wieder
   den beiden Spielern zugeordnet. Es zaehlen nur Matches, in denen jemand
   Zaehler benutzt hat (die Zeile existiert) - fehlende Zaehler heissen
   "nicht mitgezaehlt", nicht "null".

   Ergebnis: Liste von Rekord-Zeilen im Format der Rekord-Karte
   ({ key, label, holder, fmt, info, type?, matchRef?, fun: true }), nur mit
   Eintraegen, die einen Halter haben. */
import { t } from "./i18n";

const KEYS = ["fluke", "runout", "scratch", "foul"];
const MIN_MATCHES_FAIR = 3; // "Fairplay" erst ab so vielen Matches mit Zaehlern

export function computeFunRecords(matches, rows) {
  if (!rows) return [];
  const per = {};     // Name -> Summen
  const sides = [];   // jede (Spieler, Match)-Seite einzeln, fuer Bestwerte je Match
  const chaos = [];   // je Match: Fouls + Scratches beider Seiten

  matches.forEach((m) => {
    const c = rows[m.id];
    if (!c || m.player1b_id) return;
    if (!m.p1 || !m.p2 || m.p1.is_guest || m.p2.is_guest || m.p1.is_ghost || m.p2.is_ghost) return;
    let me; let other;
    if (m.reported_by === m.player1_id) { me = m.p1; other = m.p2; }
    else if (m.reported_by === m.player2_id) { me = m.p2; other = m.p1; }
    else return;
    const val = (k, i) => Number(c[k]?.[i]) || 0;
    [[me, 0, other], [other, 1, me]].forEach(([p, i, opp]) => {
      const a = (per[p.nickname] ||= { name: p.nickname, n: 0, fluke: 0, runout: 0, scratch: 0, foul: 0 });
      a.n += 1;
      const one = { name: p.nickname, match: m, opp: opp.nickname };
      KEYS.forEach((k) => { a[k] += val(k, i); one[k] = val(k, i); });
      sides.push(one);
    });
    chaos.push({ match: m, p1Name: m.p1.nickname, p2Name: m.p2.nickname, discipline: m.discipline,
      total: val("foul", 0) + val("foul", 1) + val("scratch", 0) + val("scratch", 1) });
  });

  const players = Object.values(per);
  const earlier = (a, b) => new Date(a.played_at) < new Date(b.played_at);

  // Meiste Summe einer Kennzahl; bei Gleichstand alphabetisch (stabil, damit der
  // Rekordhalter nicht von der Match-Reihenfolge abhaengt).
  const topTotal = (k) => players.filter((p) => p[k] > 0).sort((a, b) => b[k] - a[k] || a.name.localeCompare(b.name))[0] || null;
  // Bester Einzelwert in EINEM Match; bei Gleichstand das frueheste Match.
  const topMatch = (k) => {
    let best = null;
    sides.forEach((s) => {
      if (s[k] <= 0) return;
      if (!best || s[k] > best[k] || (s[k] === best[k] && earlier(s.match, best.match))) best = s;
    });
    return best;
  };
  const fair = players
    .filter((p) => p.n >= MIN_MATCHES_FAIR)
    .map((p) => ({ ...p, rate: (p.foul + p.scratch) / p.n }))
    .sort((a, b) => a.rate - b.rate || b.n - a.n || a.name.localeCompare(b.name))[0] || null;
  const chaosBest = chaos.filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total || new Date(a.match.played_at) - new Date(b.match.played_at))[0] || null;

  const noImpact = t("Reiner Spaß – ohne Einfluss auf Rating und Erfolge.");
  const only = t("Zählt nur Einzel-Matches, in denen die Zusatzzähler benutzt wurden.");
  const fmtRate = (x) => (Math.round(x * 10) / 10).toString().replace(".", ",");
  const list = [
    { key: "funFlukeTotal", label: t("Glückspilz"), holder: topTotal("fluke"), fmt: (h) => h.fluke,
      info: `${t("Meiste gezählte Flukes (Glückstreffer) insgesamt.")} ${only} ${noImpact}` },
    { key: "funFlukeMatch", label: t("Meiste Flukes in 1 Match"), holder: topMatch("fluke"), fmt: (h) => h.fluke, matchRef: topMatch("fluke")?.match,
      info: `${t("Meiste Flukes, die eine Person in einem einzigen Match hatte.")} ${noImpact}` },
    { key: "funRunoutTotal", label: t("Runout-König"), holder: topTotal("runout"), fmt: (h) => h.runout,
      info: `${t("Meiste gezählte Runouts (Tisch leergeräumt) insgesamt.")} ${only} ${noImpact}` },
    { key: "funRunoutMatch", label: t("Meiste Runouts in 1 Match"), holder: topMatch("runout"), fmt: (h) => h.runout, matchRef: topMatch("runout")?.match,
      info: `${t("Meiste Runouts, die eine Person in einem einzigen Match hatte.")} ${noImpact}` },
    { key: "funScratch", label: t("Scratch-Meister"), holder: topTotal("scratch"), fmt: (h) => h.scratch,
      info: `${t("Meiste gezählte Scratches (weiße Kugel versenkt) insgesamt.")} ${only} ${noImpact}` },
    { key: "funFoul", label: t("Foul-Weltmeister"), holder: topTotal("foul"), fmt: (h) => h.foul,
      info: `${t("Meiste gezählte Fouls insgesamt.")} ${only} ${noImpact}` },
    { key: "funFair", label: t("Fairplay-König"), holder: fair, fmt: (h) => `${fmtRate(h.rate)} / ${t("Match")}`,
      info: `${t("Wenigste Fouls und Scratches pro Match, ab {n} Matches mit Zusatzzählern.", { n: MIN_MATCHES_FAIR })} ${noImpact}` },
    { key: "funChaos", label: t("Chaos-Match"), holder: chaosBest, type: "match", fmt: (h) => `${h.total} ${t("Fouls & Scratches")}`, matchRef: chaosBest?.match,
      info: `${t("Match mit den meisten Fouls und Scratches beider Seiten zusammen.")} ${noImpact}` },
  ];
  return list.map((r) => ({ ...r, fun: true }));
}
