import { TUTORIAL_STEPS } from "./steps";

/* Welche Tutorial-Schritte hat dieses Geraet fuer diesen Spieler schon gesehen?

   localStorage pro Spieler (wie die anderen Geraete-Einstellungen, siehe
   uiPrefs.js): keine Migration noetig, und ein neues Geraet zeigt die Tour
   einmal - fuer ein Tutorial vertretbar. Gespeichert wird die Liste der
   gesehenen ids; "fehlend" ist alles im Katalog, was nicht drin steht. So
   erkennt die Tour nach einem Update von selbst, was neu ist (neuer Schritt in
   steps.js = automatisch "ungesehen"), ohne Versionsvergleich.

   Erststart (noch nichts gespeichert):
   - neuer Nutzer (noch kein eigenes Match): alles ungesehen -> volle Tour.
   - bestehender Nutzer: alle JETZT vorhandenen Schritte gelten als gesehen,
     sonst wuerde ihm die Tour beim ersten Start nach diesem Update komplett
     aufgedraengt. Nur spaeter hinzugekommene Schritte erscheinen. */
const key = (playerId) => `tutorialSeen:${playerId}`;

export function loadSeen(playerId) {
  try {
    const raw = localStorage.getItem(key(playerId));
    if (!raw) return null;
    const d = JSON.parse(raw);
    return Array.isArray(d?.seen) ? d.seen : null;
  } catch { return null; }
}

export function saveSeen(playerId, seen) {
  try { localStorage.setItem(key(playerId), JSON.stringify({ v: 1, seen: [...new Set(seen)] })); } catch { /* Privatmodus */ }
}

// Alle Katalog-Schritte, die noch nicht gesehen wurden (in Katalog-Reihenfolge).
export function pendingSteps(seen) {
  const s = new Set(seen || []);
  return TUTORIAL_STEPS.filter((st) => !s.has(st.id));
}

// Markiert Schritte als gesehen und gibt die neue Liste zurueck.
export function markSeen(playerId, ids) {
  const next = [...new Set([...(loadSeen(playerId) || []), ...ids])];
  saveSeen(playerId, next);
  return next;
}

/* Beim Start aufrufen. Gibt die Schritte zurueck, die automatisch gezeigt
   werden sollen ([] = nichts). hasOwnMatch: hat der Spieler schon ein Match? */
export function initialRun(playerId, hasOwnMatch) {
  const seen = loadSeen(playerId);
  if (seen == null) {
    if (hasOwnMatch) {
      saveSeen(playerId, TUTORIAL_STEPS.map((s) => s.id));
      return { steps: [], news: false };
    }
    return { steps: TUTORIAL_STEPS, news: false };
  }
  const pending = pendingSteps(seen);
  return { steps: pending, news: pending.length > 0 && seen.length > 0 };
}
