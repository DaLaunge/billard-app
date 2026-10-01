import { rpcRetry } from "./rpcRetry";

/* Optionale Zusatzzaehler pro Match (Nutzer-Wunsch 2026-10-01: Fluke, Runout,
   Scratch, Foul - "alle optional, aber pro Match abspeichern, eventuell bauen
   wir danach eine Statistik daraus").

   Form: { fluke: [a, b], runout: [a, b], scratch: [a, b], foul: [a, b] } -
   Index 0 = die MELDENDE Seite (matches.reported_by, im Doppel deren Team),
   Index 1 = die andere Seite. Bewusst relativ zur meldenden Person und nicht
   zu score1/score2: bei Turnierpartien steht die meldende Person nicht immer
   auf Platz 1 der Partie, reported_by ist dagegen immer eindeutig.

   Gespeichert wird in einer EIGENEN Tabelle (match_counters, siehe supabase/
   2026-10-01_match_counters.sql), nicht als Spalte an matches: jedes UPDATE
   auf matches loest per Trigger eine komplette Neuberechnung aller Ratings
   aus, und die Zaehler duerfen das Rating weder beruehren noch verteuern. */
export const COUNTER_KEYS = ["fluke", "runout", "scratch", "foul"];
export const MAX_COUNT = 99;

export const emptyCounters = () => ({ fluke: [0, 0], runout: [0, 0], scratch: [0, 0], foul: [0, 0] });

const clamp = (n) => Math.max(0, Math.min(MAX_COUNT, Math.floor(Number(n) || 0)));

// Aus einem Entwurf/gespeicherten Wert wieder eine vollstaendige Form machen.
export function normalizeCounters(c) {
  const out = emptyCounters();
  if (c && typeof c === "object") {
    COUNTER_KEYS.forEach((k) => {
      if (Array.isArray(c[k])) out[k] = [clamp(c[k][0]), clamp(c[k][1])];
    });
  }
  return out;
}

export const hasCounters = (c) => !!c && COUNTER_KEYS.some((k) => (c[k]?.[0] || 0) + (c[k]?.[1] || 0) > 0);

export const bumpCounter = (c, key, side, delta) => ({
  ...c,
  [key]: c[key].map((v, i) => (i === side ? clamp(v + delta) : v)),
});

/* Plausibilitaets-HINWEISE zu den Zaehlern - blockieren nie etwas, sie sagen nur,
   dass eine Eingabe nicht stimmen kann (Nutzer-Wunsch 2026-10-01). Gespeichert
   wird trotzdem, was der Nutzer eingibt.

   - Runout = ein gewonnenes Spiel: mehr Runouts als gewonnene Spiele einer Seite
     geht nicht (nicht bei 14/1, dort sind die Punkte keine Spiele).
   - Drei Fouls (Foul oder Scratch) derselben Seite hintereinander im selben Spiel
     sind bei 9 und 10 Ball der Spielverlust (Drei-Foul-Regel). foulLog =
     [[key, side, Spielnummer beim Klick]] in Eingabereihenfolge; "hintereinander"
     heisst: kein Foul der Gegenseite dazwischen.
   Rueckgabe: Liste von {id, text} (text bereits uebersetzt). */
export function counterWarnings({ counters, foulLog, scores, disc, names, t }) {
  const out = [];
  if (!counters || disc === "14/1 Endlos") return out;
  [0, 1].forEach((i) => {
    const runouts = counters.runout?.[i] || 0;
    if (runouts > (scores?.[i] || 0)) {
      out.push({ id: "runout" + i, text: t("{name}: {n} Runout(s), aber nur {g} gewonnene(s) Spiel(e) – ein Runout ist ein gewonnenes Spiel. Stimmt die Eingabe?", { name: names[i], n: runouts, g: scores?.[i] || 0 }) });
    }
  });
  if (disc === "9 Ball" || disc === "10 Ball") {
    const flagged = new Set();
    let run = { game: null, side: null, n: 0 };
    (foulLog || []).forEach(([, side, game]) => {
      if (run.game === game && run.side === side) run.n += 1;
      else run = { game, side, n: 1 };
      if (run.n >= 3) flagged.add(side);
    });
    flagged.forEach((side) => out.push({ id: "foul3" + side, text: t("{name}: 3 Fouls hintereinander im selben Spiel – bei {disc} ist das der Spielverlust. Stimmt die Eingabe?", { name: names[side], disc }) }));
  }
  return out;
}

// Nach dem Melden aufrufen. Nichts zu speichern -> keine Anfrage. Ein Fehler
// (z.B. Migration noch nicht eingespielt) darf das gemeldete Match nie
// beeintraechtigen: das Match steht schon, die Zaehler sind Beiwerk.
export async function saveMatchCounters(matchId, counters) {
  if (!matchId || !hasCounters(counters)) return;
  try {
    const { error } = await rpcRetry("set_match_counters", { p_match_id: matchId, p_counters: counters });
    if (error) console.warn("Zusatzzaehler nicht gespeichert:", error.message);
  } catch (e) { console.warn("Zusatzzaehler nicht gespeichert:", e?.message || e); }
}
