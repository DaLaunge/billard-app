import { useMemo } from "react";
import { t } from "../../lib/i18n";
import { fmtRating } from "../../lib/format";
import { matchRatingBreakdown } from "../../lib/ratingHistory";
import InfoButton from "./InfoButton";

/* Kleine Tabelle im Match-Protokoll: wer wie viele Rating-Punkte gewonnen oder verloren hat und warum.
   Gerechnet wird im Client nachgerechnet (lib/ratingHistory.js, gleiche Formel wie die Datenbank). Zaehlt das
   Match nicht fuers Rating (Gast, Walkover, Unentschieden, noch nicht bestaetigt), erscheint nichts. */
export default function MatchRatingTable({ match, matches, players }) {
  const info = useMemo(() => (matches && players ? matchRatingBreakdown(match, matches, players) : null),
    [match, matches, players]);
  if (!info) return null;
  return (
    <section className="protokoll-rating">
      <h3 className="protokoll-rating-head">
        {t("Rating-Punkte")} · {t(info.slot)}
        <InfoButton title={t("Rating-Punkte")}>
          {t("Wie viel ein Match wert ist, hängt vom Ergebnis ab: Wer mehr Punkte holt, als sein Rating erwarten lässt, gewinnt Rating – der Gegner verliert entsprechend. Der Punkteabstand zählt bis 16 Punkte, in den ersten 10 Spielen gilt ein höherer Faktor (Anfänger-K). Doppel wird mit dem Durchschnitt beider Partner gerechnet.")}
        </InfoButton>
      </h3>
      <div className="protokoll-table-wrap">
        <table className="protokoll-table rating-table">
          <thead>
            <tr><th>{t("Spieler")}</th><th>{t("Vorher")}</th><th>{t("Punkte")}</th><th>{t("Nachher")}</th><th>{t("Grund")}</th></tr>
          </thead>
          <tbody>
            {info.rows.map((r) => (
              <tr key={r.pid}>
                <td>{r.name}</td>
                <td>{fmtRating(r.before)}</td>
                <td style={{ fontWeight: 700, color: r.change >= 0 ? "var(--win)" : "var(--loss)" }}>
                  {(r.change > 0 ? "+" : r.change < 0 ? "−" : "±") + fmtRating(Math.abs(r.change))}
                </td>
                <td>{fmtRating(r.after)}</td>
                <td className="rating-why">{r.reason}<br /><span className="rank-meta">{r.formula}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
