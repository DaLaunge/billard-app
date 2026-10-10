import { computeStats, todayStr } from "./stats";
import { t } from "./i18n";

/* Zusatz-Kennzahlen fuer einen Spieler, die sich aus den geladenen
   matches/players/challenges berechnen lassen (siehe auch ProfilScreen).
   Zentral hier, damit ProfilScreen und MatchScreen dieselbe Logik nutzen. */
export function computeAchievementExtras(nickname, matches, players, challenges) {
  const s = computeStats(matches)[nickname] || { streak: 0, longestStreak: 0, siege: 0 };
  let shutoutWins = 0, highRun = 0;
  const perOpp = {}, perDay = {};
  matches.forEach((m) => {
    if (m.player1b_id) return;
    if (m.p1.is_guest || m.p2.is_guest) return; // Gast-Matches zaehlen wie Ghost-Training nicht fuer Achievements
    let my, opp, oppNick, myRun;
    if (m.p1.nickname === nickname) { my = m.score1; opp = m.score2; oppNick = m.p2.nickname; myRun = m.high_run1; }
    else if (m.p2.nickname === nickname) { my = m.score2; opp = m.score1; oppNick = m.p1.nickname; myRun = m.high_run2; }
    else return;
    if (my > opp && opp === 0) shutoutWins++;
    if (myRun != null && myRun > highRun) highRun = myRun;
    perOpp[oppNick] = (perOpp[oppNick] || 0) + 1;
    const day = todayStr(new Date(m.played_at));
    perDay[day] = (perDay[day] || 0) + 1;
  });
  // Heyball-Erfolge (Kategorie "Heyball"): nur Einzel, ohne Gaeste, wie die Vergabe in
  // compute_heyball_badges(). Die Serie ist die AKTUELLE (wie bei den allgemeinen Serien).
  const hb = { matches: 0, wins: 0, shutouts: 0, streak: 0, opps: new Set() };
  matches
    .filter((m) => m.discipline === "Heyball" && !m.player1b_id && !m.p1.is_guest && !m.p2.is_guest
      && (m.p1.nickname === nickname || m.p2.nickname === nickname))
    .sort((a, b) => new Date(a.played_at) - new Date(b.played_at))
    .forEach((m) => {
      const first = m.p1.nickname === nickname;
      const my = first ? m.score1 : m.score2, opp = first ? m.score2 : m.score1;
      hb.matches++;
      hb.opps.add(first ? m.p2.nickname : m.p1.nickname);
      if (my > opp) { hb.wins++; hb.streak++; if (opp === 0) hb.shutouts++; } else hb.streak = 0;
    });
  const myId = players.find((p) => p.nickname === nickname)?.id;
  const recruitedCount = myId ? players.filter((p) => p.invited_by === myId).length : 0;
  const challengesAccepted = myId
    ? (challenges || []).filter((c) => c.challenged_id === myId && c.status === "fulfilled").length
    : 0;

  // Aktuelle (ununterbrochene) Gewinnserie je Gegner: von den neuesten Matches
  // rueckwaerts durchgehen, sobald gegen einen Gegner verloren wird, ist dessen
  // Serie beendet (fruehere Matches gegen ihn zaehlen nicht mehr mit).
  const byDateDesc = [...matches].sort((a, b) => new Date(b.played_at) - new Date(a.played_at));
  const oppStreak = {}, oppBroken = {};
  byDateDesc.forEach((m) => {
    if (m.player1b_id) return;
    if (m.p1.is_guest || m.p2.is_guest) return;
    let my, opp, oppNick;
    if (m.p1.nickname === nickname) { my = m.score1; opp = m.score2; oppNick = m.p2.nickname; }
    else if (m.p2.nickname === nickname) { my = m.score2; opp = m.score1; oppNick = m.p1.nickname; }
    else return;
    if (oppBroken[oppNick]) return;
    if (my > opp) oppStreak[oppNick] = (oppStreak[oppNick] || 0) + 1;
    else oppBroken[oppNick] = true;
  });

  // Wer der "derselbe Gegner" der Bestmarke ist (bei Gleichstand der erste).
  const argmax = (o) => Object.entries(o).reduce((best, e) => (!best || e[1] > best[1] ? e : best), null)?.[0] ?? null;

  return {
    maxVsOpponentNick: argmax(perOpp),
    maxOpponentStreakNick: argmax(oppStreak),
    streak: s.streak,
    longestStreak: s.longestStreak,
    siege: s.siege,
    shutoutWins,
    highRun,
    recruitedCount,
    challengesAccepted,
    heyballMatches: hb.matches,
    heyballWins: hb.wins,
    heyballShutouts: hb.shutouts,
    heyballStreak: hb.streak,
    heyballOpponents: hb.opps.size,
    maxVsOpponent: Math.max(0, ...Object.values(perOpp)),
    maxPerDay: Math.max(0, ...Object.values(perDay)),
    maxOpponentStreak: Math.max(0, ...Object.values(oppStreak)),
  };
}

const leadingNumber = (desc) => {
  // Letzte Zahl im Text nehmen, nicht die erste: "14/1: Höchstserie von 25" enthaelt
  // mit der "14" aus "14/1" sonst faelschlich eine fruehere Zahl als die echte Schwelle.
  const all = desc.match(/\d+/g);
  return all ? parseInt(all[all.length - 1], 10) : 1; // "Ein Match zu null gewonnen" / "1 Herausforderung ..." -> 1
};

/* Erfolgs-Familien, die sich lokal berechnen lassen (siehe computeAchievementExtras) -
   dieselben, die auch in ProfilScreen als Live-Kennzahl je Kategorie erscheinen. */
const FAMILIES = [
  // Heyball ZUERST: ihre Beschreibungen ("3 Heyball-Siege in Folge", "Ein Heyball-Match zu null gewonnen")
  // wuerden sonst von den allgemeinen Serien-/Zu-Null-Familien weiter unten gefangen und bekaemen deren Zahl.
  { metric: "heyballStreak", test: (d) => /Heyball-Siege in Folge$/.test(d), current: (e) => (e.heyballStreak > 0 ? e.heyballStreak : null), unit: () => t("Heyball-Sieg(e) in Folge") },
  { metric: "heyballShutouts", test: (d) => /Heyball-Match zu null gewonnen$/.test(d), current: (e) => e.heyballShutouts, unit: () => t("Heyball-Zu-Null-Sieg(e)") },
  { metric: "heyballWins", test: (d) => /Heyball-Siege$|erstes Heyball-Match gewonnen$/.test(d), current: (e) => e.heyballWins, unit: () => t("Heyball-Sieg(e)") },
  { metric: "heyballMatches", test: (d) => /Heyball-Matches? gespielt$/.test(d), current: (e) => e.heyballMatches, unit: () => t("Heyball-Match(es)") },
  { metric: "heyballOpponents", test: (d) => /^Heyball gegen \d+ verschiedene Gegner gespielt$/.test(d), current: (e) => e.heyballOpponents, unit: () => t("verschiedene Gegner") },
  { metric: "longestStreak", test: (d) => /Siege in Folge$/.test(d), current: (e) => (e.streak > 0 ? e.streak : null), unit: () => t("Sieg(e) in Folge") },
  { metric: "siege", test: (d) => /^\d+ Siege insgesamt$/.test(d), current: (e) => e.siege, unit: () => t("Sieg(e)") },
  { metric: "shutoutWins", test: (d) => /zu null gewonnen/.test(d), current: (e) => e.shutoutWins, unit: () => t("Zu-Null-Sieg(e)") },
  { metric: "maxVsOpponent", test: (d) => /Matches gegen denselben Gegner/.test(d), current: (e) => e.maxVsOpponent, unit: () => t("Match(es) gegen denselben Gegner") },
  { metric: "maxPerDay", test: (d) => /Matches an einem Tag/.test(d), current: (e) => e.maxPerDay, unit: () => t("Match(es) an einem Tag") },
  { metric: "highRun", test: (d) => /14\/1: Höchstserie/.test(d), current: (e) => e.highRun, unit: () => t("Kugeln") },
  { metric: "recruitedCount", test: (d) => /Spieler geworben/.test(d), current: (e) => e.recruitedCount, unit: () => t("geworbene Spieler") },
  { metric: "challengesAccepted", test: (d) => /Herausforderung(en)? angenommen/.test(d), current: (e) => e.challengesAccepted, unit: () => t("Herausforderungen") },
  { metric: "maxOpponentStreak", test: (d) => /Siege in Folge gegen denselben Gegner$/.test(d), current: (e) => (e.maxOpponentStreak > 0 ? e.maxOpponentStreak : null), unit: () => t("Sieg(e) in Folge gegen 1 Gegner") },
  // Ghost/Turnier-Zaehler kommen nicht aus matches/players/challenges, sondern
  // aus my_achievement_counters() (server-only: ghost_games hat keine RLS-Policy
  // fuers Lesen, Turnierplatzierungen brauchen die Bracket-Aufloesung von
  // tournament_final_standings()) - siehe extras.ghostGames/tournamentWins/....
  { metric: "ghostGames", test: (d) => /Spiele? gegen den Ghost$/.test(d), current: (e) => e.ghostGames, unit: () => t("Spiel(e) gegen den Ghost") },
  { metric: "tournamentWins", test: (d) => /Turniere? gewonnen$/.test(d), current: (e) => e.tournamentWins, unit: () => t("Turniersieg(e)") },
  { metric: "tournament2nd", test: (d) => /Turnier-Zweiter$/.test(d), current: (e) => e.tournament2nd, unit: () => t("zweite Plätze") },
  { metric: "rulesViewed", test: (d) => /Regeln? angesehen$/.test(d), current: (e) => e.rulesViewed, unit: () => t("Regel(n)") },
  { metric: "tournament3rd", test: (d) => /Turnier-Dritter$/.test(d), current: (e) => e.tournament3rd, unit: () => t("dritte Plätze") },
];

// Tage pro Einheit fuer die Mitgliedschafts-Familie ("1 Woche/Monat/Jahr(e)
// dabei") - anders als alle anderen Familien nicht EIN gemeinsames Ziel-Maß
// (mal Wochen, mal Monate, mal Jahre), daher kein FAMILIES-Eintrag, sondern
// eigene Umrechnung auf Tage seit players.created_at (kalendergenau statt
// grob mit 30/365 multipliziert, damit z.B. Schaltjahre nicht staendig zu
// einem Tag Differenz gegenueber der echten Serverpruefung fuehren).
function membershipTargetDays(description, joinedAt) {
  if (!joinedAt) return null;
  const m = description.match(/^(\d+)\s+(Woche|Wochen|Monat|Monate|Jahr|Jahre)\s+dabei$/);
  if (!m) return null;
  const amount = parseInt(m[1], 10);
  const join = new Date(joinedAt);
  const target = new Date(join);
  if (m[2].startsWith("Woche")) target.setDate(target.getDate() + amount * 7);
  else if (m[2].startsWith("Monat")) target.setMonth(target.getMonth() + amount);
  else target.setFullYear(target.getFullYear() + amount);
  return Math.round((target - join) / 86400000);
}

/* Gemeinsamer Fortschritts-Ermittler fuer badgeProgress() UND closestCandidates()
   (Naechste-Erfolge-Vorschlaege) - Mitgliedschaft zuerst (eigene Tage-Umrechnung),
   sonst FAMILIES. null, wenn der Beschreibungstext zu keiner bekannten Familie
   passt oder die dafuer noetigen Rohdaten (noch) fehlen. */
function progressFor(description, extras) {
  const days = membershipTargetDays(description, extras?.joinedAt);
  if (days != null) {
    const current = Math.floor((Date.now() - new Date(extras.joinedAt)) / 86400000);
    return { current: Math.max(0, current), target: days, unit: t("Tage") };
  }
  const fam = FAMILIES.find((f) => f.test(description));
  if (!fam) return null;
  const current = fam.current(extras);
  if (current == null) return null;
  // "Alle Regeln angesehen": das Ziel ist die aktuelle Regelzahl (waechst mit dem Katalog), keine Zahl im Text.
  const target = /^Alle Regeln angesehen/.test(description) ? (extras.rulesTotal || 1) : leadingNumber(description);
  return { current: Math.max(0, current), target, unit: fam.unit() };
}

/* Sammelt ueber alle bekannten Familien hinweg die naechstliegenden, noch nicht
   erreichten Schwellenwerte (aufsteigend nach Abstand) - Rohdaten, kein Text.
   earnedBadges (Set von badge_key) schliesst bereits freigeschaltete Erfolge
   explizit aus: bei Serien-Familien (aktuelle Gewinnserie, aktuelle Serie
   gegen 1 Gegner) sinkt der live berechnete Wert nach einer Niederlage
   wieder, ohne das den Erfolg selbst wieder aberkennt - ohne diesen Check
   wuerde ein laengst erreichter Serien-Erfolg dann faelschlich erneut als
   "naechstes Ziel" vorgeschlagen. */
function closestCandidates(catalog, extras, earnedBadges) {
  const candidates = [];
  (catalog || []).forEach((b) => {
    if (earnedBadges && earnedBadges.has(b.badge_key)) return;
    const p = progressFor(b.description, extras);
    if (!p) return;
    const gap = p.target - p.current;
    if (gap <= 0) return;
    // current/target wandern mit, damit die Anzeige daraus einen
    // Fortschrittsbalken bauen kann statt nur den Abstand zu zeigen -
    // "noch 1 Spiel" heisst etwas voellig anderes bei 9/10 als bei 0/1.
    candidates.push({ gap, current: p.current, target: p.target, unit: p.unit, name: t(b.name), badgeKey: b.badge_key, emoji: b.emoji });
  });
  candidates.sort((a, b) => a.gap - b.gap);
  return candidates;
}

/* Live-Fortschritt zu einem einzelnen, noch nicht erreichten Katalog-Eintrag
   (Beschreibungstext genuegt, keine Kategorie noetig - siehe FAMILIES oben).
   null, wenn die Familie nicht lokal aus matches/players/challenges berechenbar
   ist (z.B. Rangliste/Ghost/Turnier-Erfolge, die serverseitige Historie
   brauchen) - dafuer zeigt die Erfolge-Kachel dann einfach keinen Fortschritt. */
export function badgeProgress(description, extras) {
  return progressFor(description, extras);
}

/* Die paar naechstliegenden, noch nicht erreichten Erfolge als Rohdaten
   (fuer eine kompakte Fortschritts-Anzeige, z.B. im Desktop-Sidebar-Panel) -
   als Liste zum selbst Rendern. */
export function upcomingAchievements(catalog, extras, earnedBadges, count = 3) {
  return closestCandidates(catalog, extras, earnedBadges).slice(0, count);
}

/* Emoji des bereits erreichten Erfolgs zu einer Rekord-Kennzahl (z.B.
   "highRun" -> Emoji des hoechsten erreichten 14/1-Serien-Erfolgs), oder
   null, wenn dazu noch kein Erfolg freigeschaltet ist. Bei mehreren
   erreichten Stufen derselben Familie zaehlt die mit der hoechsten
   Schwelle (die anderen sind automatisch mit erreicht). */
export function recordBadgeEmoji(catalog, earnedBadges, metric) {
  const fam = FAMILIES.find((f) => f.metric === metric);
  if (!fam || !catalog || !earnedBadges) return null;
  let best = null, bestN = -1;
  catalog.forEach((b) => {
    if (!fam.test(b.description)) return;
    if (!earnedBadges.has(b.badge_key)) return;
    const n = leadingNumber(b.description);
    if (n > bestN) { bestN = n; best = b; }
  });
  return best ? best.emoji : null;
}
