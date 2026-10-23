/* Rating-Punkte je Match, im Client nachgerechnet (Reiter "Verlauf" in "Meine Zahlen").

   Die Datenbank speichert pro Match keine Punkte, nur die Anker (Stand nach dem Match). Hier wird
   deshalb dieselbe Formel wie in elo_anchor_rows() (supabase/2026-10-20_decay_overall.sql) in einem
   Durchlauf ueber alle Matches nachgerechnet: K=4, Anfaenger-K 8 fuer die ersten 10 Spiele je
   (Spieler, Disziplin), Margin auf 16 gedeckelt, 14/1-Verschiebung, Doppel als Team-Durchschnitt,
   Verfall nur ueber 500 und erst 30 Tage nach dem letzten Match in IRGENDEINER Disziplin.
   Angezeigt wird nur die Aenderung durch das Match selbst (ohne Verfall), also genau ka * delta.
   Zur Anzeige reicht Double-Genauigkeit - die Datenbank rechnet exakt, hier geht es um eine Stelle.
   Aendert sich die Engine, muss diese Datei mit (Konstanten und Reihenfolge unten). */
import { t } from "./i18n";
import { fmtRating } from "./format";

const K = 4, KNEW = 8, NEWG = 10, GRACE = 30, HALF = 200;
const DAY = 86400000;

const decayed = (r, lastAny, at) =>
  (r > 500 && lastAny != null) ? 500 + (r - 500) * Math.pow(0.5, Math.max(0, (at - lastAny) / DAY - GRACE) / HALF) : r;

/* Liefert Map "matchId:playerId" -> Einzelheiten der Rating-Aenderung in der Disziplin des Matches
   (Doppel -> Rating "Doppel"): { change, before, after, k, games, share, ea, nf, own, opp, teamOwn, teamOpp, dbl, slot }.
   before = Stand vor dem Match NACH dem Verfall, share = Punkteanteil der eigenen Seite, ea = erwarteter Anteil. */
export function computeMatchRatings(matches, players) {
  const guest = new Set((players || []).filter((p) => p.is_guest).map((p) => p.id));
  const list = (matches || [])
    .filter((m) => m.confirmed && !m.walkover && (m.score1 !== m.score2 || m.winner_stays_session_id)
      && ![m.player1_id, m.player2_id, m.player1b_id, m.player2b_id].some((id) => id && guest.has(id)))
    .map((m) => ({ m, at: Date.parse(m.played_at) }))
    .sort((a, b) => (a.at - b.at) || (a.m.id < b.m.id ? -1 : a.m.id > b.m.id ? 1 : 0));

  const st = new Map();               // "slot|playerId" -> {r, g, t}
  const out = new Map();
  const get = (slot, pid) => st.get(`${slot}|${pid}`) || { r: 500, g: 0, t: null };

  for (const { m, at } of list) {
    const dbl = !!m.player1b_id;
    const sh = Math.max(0, -Math.min(m.score1, m.score2));
    const a1 = m.score1 + sh, a2 = m.score2 + sh;
    const n = a1 + a2;
    if (n <= 0) continue;
    const nf = Math.min(n, 16);
    const sideA = dbl ? [m.player1_id, m.player1b_id] : [m.player1_id];
    const sideB = dbl ? [m.player2_id, m.player2b_id] : [m.player2_id];
    const everyone = [...sideA, ...sideB];
    const lastAny = new Map(everyone.map((pid) => [pid, get("G", pid).t]));   // vor diesem Match gelesen

    for (const slot of ["G", dbl ? "D" : m.discipline]) {
      if (slot == null) continue;
      const cur = new Map(everyone.map((pid) => {
        const s = get(slot, pid);
        return [pid, { ...s, r: s.t == null ? 500 : decayed(s.r, lastAny.get(pid), at) }];
      }));
      const avg = (side) => side.reduce((sum, pid) => sum + cur.get(pid).r, 0) / side.length;
      const ea = 1 / (1 + Math.pow(2, (avg(sideB) - avg(sideA)) / 100));
      const delta = nf * (a1 / n - ea);
      const apply = (side, sign) => side.forEach((pid) => {
        const c = cur.get(pid);
        const k = c.g < NEWG ? KNEW : K;
        const change = sign * k * delta;
        st.set(`${slot}|${pid}`, { r: c.r + change, g: c.g + 1, t: at });
        if (slot !== "G") {
          const mineSide = sign > 0;
          out.set(`${m.id}:${pid}`, {
            change, before: c.r, after: c.r + change, k, games: c.g, nf,
            share: (mineSide ? a1 : a2) / n, ea: mineSide ? ea : 1 - ea,
            own: mineSide ? m.score1 : m.score2, opp: mineSide ? m.score2 : m.score1,
            teamOwn: mineSide ? avg(sideA) : avg(sideB), teamOpp: mineSide ? avg(sideB) : avg(sideA),
            dbl, slot: dbl ? "Doppel" : m.discipline,
          });
        }
      });
      apply(sideA, 1);
      apply(sideB, -1);
    }
  }
  return out;
}

/* Nur die Punkte (Zahl) je "matchId:playerId" - fuer die Historie. */
export function computeMatchPoints(matches, players) {
  const out = new Map();
  computeMatchRatings(matches, players).forEach((v, k) => out.set(k, v.change));
  return out;
}

/* Zeilen fuer die kleine Tabelle im Match-Protokoll: wer wie viele Punkte bekam oder verlor - und warum.
   Liefert { slot, rows: [{ pid, name, before, change, after, reason, formula }] } oder null, wenn das Match
   nicht ins Rating zaehlt (Gast, Walkover, Unentschieden, nicht bestaetigt). */
export function matchRatingBreakdown(match, matches, players) {
  if (!match?.confirmed) return null;
  const all = computeMatchRatings(matches, players);
  const ids = [match.player1_id, match.player1b_id, match.player2_id, match.player2b_id].filter(Boolean);
  const nick = (id) => players.find((p) => p.id === id)?.nickname || "?";
  const rows = ids.map((pid) => ({ pid, d: all.get(`${match.id}:${pid}`) })).filter((r) => r.d)
    .map(({ pid, d }) => ({
      pid, name: nick(pid), before: d.before, change: d.change, after: d.after, ...ratingReason(d),
    }));
  if (!rows.length) return null;
  return { slot: all.get(`${match.id}:${rows[0].pid}`).slot, rows };
}

const pct = (x) => Math.round(x * 100);
const signed = (v) => { const r = Math.round(v * 10) / 10; return (r > 0 ? "+" : r < 0 ? "−" : "±") + fmtRating(Math.abs(r)); };

/* Begruendung einer Rating-Aenderung in zwei Zeilen: was ist passiert (gegen Erwartung), und die Rechnung dazu. */
export function ratingReason(d) {
  const res = d.own > d.opp ? t("Sieg") : d.own < d.opp ? t("Niederlage") : t("Unentschieden");
  const reason = t("{res} {own}:{opp} - {share} % der Punkte geholt, erwartet waren {ea} % (Rating {a} gegen {b}).",
    { res, own: d.own, opp: d.opp, share: pct(d.share), ea: pct(d.ea), a: fmtRating(d.teamOwn), b: fmtRating(d.teamOpp) });
  const formula = t("Punkte = K {k}{newbie} × Gewicht {nf} × ({share} % − {ea} %) = {pts}",
    { k: d.k, newbie: d.k > K ? " " + t("(Anfänger-K, unter 10 Spielen)") : "", nf: d.nf, share: pct(d.share), ea: pct(d.ea), pts: signed(d.change) });
  return { reason, formula };
}
