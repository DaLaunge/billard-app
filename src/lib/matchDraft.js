/* Zwischenspeicher fuer eine laufende, noch nicht gemeldete Match-Eingabe.

   Alles, was die App gegen ein Neuladen tun kann, tut sie bereits (kein
   Update und kein Wisch-Reload auf LIVE_ENTRY_TABS, siehe App.jsx). Gegen
   das, was sie NICHT verhindern kann, hilft nur Mitschreiben: das Handy
   beendet die App im Hintergrund, eine zweite offene Instanz spielt ein
   Update ein, die Anmeldung geht verloren. Deshalb schreibt MatchScreen
   (samt StraightPoolScorer fuer 14/1) seinen Stand bei jeder Aenderung hierher,
   und App.jsx bietet nach einem Neustart "Unfertiges Match fortsetzen?" an.

   localStorage statt sessionStorage (siehe CLAUDE.md, Known gotchas): ein
   Neustart der PWA ist ein neuer Tab. Pro Spieler, damit ein anderer Login
   auf demselben Geraet nicht das Match eines Fremden angeboten bekommt.
   Nach MAX_AGE_H Stunden verfaellt ein Entwurf - ein Match von gestern Nacht
   will morgen niemand mehr fortsetzen.

   Gemeldet wird weiterhin NUR ueber die normalen RPCs; dieser Entwurf geht
   nie an Supabase und wird nach erfolgreichem Melden oder Abbrechen
   geloescht. */

const MAX_AGE_H = 12;
const key = (playerId) => `matchDraft:${playerId}`;

export function loadMatchDraft(playerId) {
  if (!playerId) return null;
  try {
    const d = JSON.parse(localStorage.getItem(key(playerId)) || "null");
    if (!d || d.v !== 1 || !d.match) return null;
    if (Date.now() - (d.savedAt || 0) > MAX_AGE_H * 3600000) { clearMatchDraft(playerId); return null; }
    return d;
  } catch { return null; }
}

export function saveMatchDraft(playerId, match, scorer) {
  if (!playerId) return;
  try {
    localStorage.setItem(key(playerId), JSON.stringify({ v: 1, savedAt: Date.now(), match, scorer: scorer ?? null }));
  } catch { /* Speicher voll: dann eben ohne Sicherung */ }
}

export function clearMatchDraft(playerId) {
  if (!playerId) return;
  try { localStorage.removeItem(key(playerId)); } catch { /* ignore */ }
}

// Kurzbeschreibung fuer die Nachfrage beim Neustart, z.B. "gegen Odko · 9 Ball · 3:2".
export function describeDraft(d) {
  const m = d.match || {};
  const names = [m.opp?.nickname, m.opp2?.nickname].filter(Boolean).join(" & ");
  const sc = d.scorer?.sc || [m.s1 ?? 0, m.s2 ?? 0];
  return { opponent: names || "?", discipline: m.disc || "", score: `${sc[0]}:${sc[1]}` };
}

// Winner Stays: nur der Spielstand der aktuellen Partie liegt lokal (die Session
// selbst ist serverseitig). Gilt nur, solange seither kein Spiel gemeldet wurde.
const wsKey = (sessionId) => `wsDraft:${sessionId}`;
export function loadWsDraft(sessionId, gamesCount) {
  try {
    const d = JSON.parse(localStorage.getItem(wsKey(sessionId)) || "null");
    if (!d || d.gamesCount !== gamesCount || Date.now() - d.savedAt > MAX_AGE_H * 3600000) return null;
    return d;
  } catch { return null; }
}
export function saveWsDraft(sessionId, gamesCount, sA, sB) {
  try {
    if (!sA && !sB) localStorage.removeItem(wsKey(sessionId));
    else localStorage.setItem(wsKey(sessionId), JSON.stringify({ gamesCount, sA, sB, savedAt: Date.now() }));
  } catch { /* ignore */ }
}
