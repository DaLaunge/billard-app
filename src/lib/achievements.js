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
    let my, opp, oppNick;
    if (m.p1.nickname === nickname) { my = m.score1; opp = m.score2; oppNick = m.p2.nickname; }
    else if (m.p2.nickname === nickname) { my = m.score2; opp = m.score1; oppNick = m.p1.nickname; }
    else return;
    if (oppBroken[oppNick]) return;
    if (my > opp) oppStreak[oppNick] = (oppStreak[oppNick] || 0) + 1;
    else oppBroken[oppNick] = true;
  });

  return {
    streak: s.streak,
    longestStreak: s.longestStreak,
    siege: s.siege,
    shutoutWins,
    highRun,
    recruitedCount,
    challengesAccepted,
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
  { test: (d) => /Siege in Folge$/.test(d), current: (e) => (e.streak > 0 ? e.streak : null), unit: () => t("Sieg(e) in Folge") },
  { test: (d) => /^\d+ Siege insgesamt$/.test(d), current: (e) => e.siege, unit: () => t("Sieg(e)") },
  { test: (d) => /zu null gewonnen/.test(d), current: (e) => e.shutoutWins, unit: () => t("Zu-Null-Sieg(e)") },
  { test: (d) => /Matches gegen denselben Gegner/.test(d), current: (e) => e.maxVsOpponent, unit: () => t("Match(es) gegen denselben Gegner") },
  { test: (d) => /Matches an einem Tag/.test(d), current: (e) => e.maxPerDay, unit: () => t("Match(es) an einem Tag") },
  { test: (d) => /14\/1: Höchstserie/.test(d), current: (e) => e.highRun, unit: () => t("Kugeln") },
  { test: (d) => /Spieler geworben/.test(d), current: (e) => e.recruitedCount, unit: () => t("geworbene Spieler") },
  { test: (d) => /Herausforderung(en)? angenommen/.test(d), current: (e) => e.challengesAccepted, unit: () => t("Herausforderungen") },
  { test: (d) => /Siege in Folge gegen denselben Gegner$/.test(d), current: (e) => (e.maxOpponentStreak > 0 ? e.maxOpponentStreak : null), unit: () => t("Sieg(e) in Folge gegen 1 Gegner") },
];

// Einfacher, deterministischer Streuwert aus einem String (kein Crypto-Anspruch,
// nur um taeglich + je Spieler eine andere, aber stabile Auswahl zu treffen).
const hashString = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

const CLOSE_CANDIDATES = 5; // aus den X naechstliegenden Erfolgen wird taeglich einer gewaehlt

/* Sammelt ueber alle bekannten Familien hinweg die naechstliegenden, noch nicht
   erreichten Schwellenwerte (aufsteigend nach Abstand) - Rohdaten, kein Text. */
function closestCandidates(catalog, extras) {
  const candidates = [];
  (catalog || []).forEach((b) => {
    const fam = FAMILIES.find((f) => f.test(b.description));
    if (!fam) return;
    const cur = fam.current(extras);
    if (cur == null) return;
    const gap = leadingNumber(b.description) - cur;
    if (gap <= 0) return;
    candidates.push({ gap, unit: fam.unit(), name: t(b.name) });
  });
  candidates.sort((a, b) => a.gap - b.gap);
  return candidates;
}

/* Waehlt aus den paar naechstliegenden, noch nicht erreichten Erfolgen einen
   Hinweistext aus - nicht immer denselben (sonst nutzt sich die Motivation ab),
   aber auch nicht bei jedem Rendern neu (das waere nur Geflacker): die Auswahl
   ist stabil fuer einen Tag und einen Spieler, wechselt aber von Tag zu Tag. */
export function nextAchievementHint(catalog, extras, seedKey = "") {
  const shortlist = closestCandidates(catalog, extras).slice(0, CLOSE_CANDIDATES);
  if (shortlist.length === 0) return null;
  const seed = hashString(todayStr(new Date()) + "|" + seedKey);
  const pick = shortlist[seed % shortlist.length];
  return t('Noch {gap} {unit} bis "{name}"', { gap: pick.gap, unit: pick.unit, name: pick.name });
}
