import { useMemo, useState } from "react";
import { t } from "../../lib/i18n";
import { fmtDate, fmtRating } from "../../lib/format";
import { computeMatchPoints } from "../../lib/ratingHistory";
import { LIST_COUNT_OPTIONS, DEFAULT_LIST_COUNT } from "../../lib/constants";
import DiscBall, { DiscPickRow } from "./DiscBall";

/* Komplette Match-Historie eines Spielers mit Ausgang UND den Rating-Punkten, die das Match
   gebracht oder gekostet hat (Reiter "Verlauf" in "Meine Zahlen"). Die Punkte kommen aus
   lib/ratingHistory.js; Gaeste-, Walkover- und unentschiedene Matches zaehlen im Rating nicht
   und zeigen deshalb nur den Ausgang. Neueste zuerst; Disziplin-Filter und die
   uebliche Mengenwahl 10/20/50/100/Alle wie bei Head-to-Head. */

const fmtPts = (v) => {
  const r = Math.round(v * 10) / 10;
  return (r > 0 ? "+" : r < 0 ? "−" : "±") + fmtRating(Math.abs(r));
};

export default function MyMatchHistory({ nickname, matches, players }) {
  const pid = players.find((p) => p.nickname === nickname)?.id;
  const points = useMemo(() => computeMatchPoints(matches, players), [matches, players]);
  const [disc, setDisc] = useState("all");
  const [count, setCount] = useState(DEFAULT_LIST_COUNT);
  const mine = useMemo(() => (matches || [])
    .filter((m) => m.confirmed && pid && [m.player1_id, m.player1b_id, m.player2_id, m.player2b_id].includes(pid))
    .sort((a, b) => Date.parse(b.played_at) - Date.parse(a.played_at)), [matches, pid]);
  const discs = useMemo(() => [...new Set(mine.map((m) => m.discipline).filter(Boolean))], [mine]);
  const rows = disc === "all" ? mine : mine.filter((m) => m.discipline === disc);
  const visible = count === "all" ? rows : rows.slice(0, count);

  if (mine.length === 0) return <p className="hint">{t("Noch keine Matches.")}</p>;

  return (
    <>
      {discs.length > 1 && <DiscPickRow discs={discs} value={disc} onChange={setDisc} all="all" />}
      {mine.length > DEFAULT_LIST_COUNT && (
        <div className="chips small">
          {LIST_COUNT_OPTIONS.map((c) => (
            <button key={c} className={"chip" + (count === c ? " active" : "")} onClick={() => setCount(c)}>
              {c === "all" ? t("Alle") : c}
            </button>
          ))}
        </div>
      )}
      <p className="hint">{t("{n} von {total} Matches", { n: visible.length, total: rows.length })}</p>
      {visible.map((m) => {
        const dbl = !!m.player1b_id;
        const side1 = m.player1_id === pid || m.player1b_id === pid;
        const my = side1 ? m.score1 : m.score2, their = side1 ? m.score2 : m.score1;
        const oppSide = side1 ? [m.p2, m.p2b] : [m.p1, m.p1b];
        const partner = dbl ? (side1 ? (m.player1_id === pid ? m.p1b : m.p1) : (m.player2_id === pid ? m.p2b : m.p2)) : null;
        const opp = oppSide.filter(Boolean).map((p) => p.nickname).join(" & ") || "?";
        const res = my > their ? "win" : my < their ? "loss" : "draw";
        const pts = points.get(`${m.id}:${pid}`);
        return (
          <div key={m.id} className="stat-row mh-row">
            <span className="stat-name mh-main">
              <DiscBall disc={m.discipline} size={16} />{" "}
              <span style={{ fontWeight: 700, color: res === "win" ? "var(--win)" : res === "loss" ? "var(--loss)" : undefined }}>{res === "win" ? t("S") : res === "loss" ? t("N") : "="}</span>{" "}
              {my}:{their} {t("gegen")} {opp}
              {partner && <span className="rank-meta"> · {t("mit")} {partner.nickname}</span>}
              <span className="rank-meta"> · {fmtDate(m.played_at)}</span>
            </span>
            <span className="stat-val" style={{ color: pts == null ? "var(--ivory-dim)" : pts >= 0 ? "var(--win)" : "var(--loss)" }}
              title={pts == null ? t("Zählt nicht fürs Rating") : t("Rating-Punkte")}>
              {pts == null ? "–" : fmtPts(pts)}
            </span>
          </div>
        );
      })}
    </>
  );
}
