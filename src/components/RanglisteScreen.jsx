import { useState } from "react";
import { Check, X, Clock } from "lucide-react";
import { t } from "../lib/i18n";
import { isDoubles, mSide, fmtDate, initials } from "../lib/format";
import Ball from "./Ball";

export default function RanglisteScreen({ rangliste, disciplines, pending, me, onConfirm, onOpenProfile, myOpenReports, colorOf, badgeOf }) {
  const [disc, setDisc] = useState("Gesamt");
  const [showAll, setShowAll] = useState(false);

  const rows = rangliste
    .filter((r) => r.discipline === disc)
    .filter((r) => showAll || (r.aktiv && !r.vorlaeufig));
  const hidden = rangliste.filter((r) => r.discipline === disc).length - rows.length;

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>{t("Rangliste")}</h2>
        <span className="head-note">{t("Fargo-Skala - 100 Punkte = 2:1")}</span>
      </header>

      {pending.map((m) => {
        if (isDoubles(m)) {
          return (
            <div className="confirm-banner" key={m.id}>
              <div>
                <b>{t("Doppel bestätigen:")}</b> {mSide(m, 1)} <b>{m.score1}:{m.score2}</b> {mSide(m, 2)} ({t(m.discipline)}, {fmtDate(m.played_at)}).
                <span className="confirm-warn"> {t("Nur bestätigen, wenn du dieses Doppel wirklich gespielt hast.")}</span>
              </div>
              <div className="confirm-actions">
                <button className="chip-btn ok" onClick={() => onConfirm(m.id, true)}><Check size={15} /> {t("Passt")}</button>
                <button className="chip-btn no" onClick={() => onConfirm(m.id, false)}><X size={15} /> {t("Falsch")}</button>
              </div>
            </div>
          );
        }
        const other = m.player1_id === me.id ? m.p2.nickname : m.p1.nickname;
        const myScore = m.player1_id === me.id ? m.score1 : m.score2;
        const otherScore = m.player1_id === me.id ? m.score2 : m.score1;
        return (
          <div className="confirm-banner" key={m.id}>
            <div><b>{t("Match bestaetigen:")}</b> {other} {t("meldet ein")} {otherScore}:{myScore} {t("gegen dich")} ({t(m.discipline)}, {fmtDate(m.played_at)}).</div>
            <div className="confirm-actions">
              <button className="chip-btn ok" onClick={() => onConfirm(m.id, true)}><Check size={15} /> {t("Passt")}</button>
              <button className="chip-btn no" onClick={() => onConfirm(m.id, false)}><X size={15} /> {t("Falsch")}</button>
            </div>
          </div>
        );
      })}

      {myOpenReports.length > 0 && (
        <p className="open-note"><Clock size={14} /> {myOpenReports.length === 1 && !isDoubles(myOpenReports[0])
          ? t("1 gemeldetes Match wartet noch auf Bestätigung durch {name}.", { name: myOpenReports[0].p2.nickname })
          : t("{n} gemeldete Matches warten noch auf Bestätigung.", { n: myOpenReports.length })}</p>
      )}

      <div className="chips">
        {["Gesamt", ...disciplines].map((d) => (
          <button key={d} className={"chip" + (disc === d ? " active" : "")} onClick={() => setDisc(d)}>{t(d)}</button>
        ))}
      </div>

      <ol className="ranking">
        {rows.map((r, i) => {
          const medal = i < 3 && !r.vorlaeufig && r.aktiv ? ["gold", "silver", "bronze"][i] : null;
          return (
          <li key={r.nickname + r.discipline}>
            <button className="rank-row" onClick={() => onOpenProfile(r.nickname)}>
              <span className={"rank-pos" + (medal ? ` ${medal}` : "")}>{i + 1}</span>
              <Ball color={colorOf(r.nickname)} label={initials(r.nickname)} badge={badgeOf(r.nickname)} medal={medal} />
              <span className="rank-name">
                {r.nickname}
                <span className="rank-meta">
                  {r.spiele} {t("Spiele")} - {t("zuletzt")} {fmtDate(r.letzte_partie)}
                  {r.vorlaeufig && <em className="prov"> - vorlaeufig</em>}
                  {!r.aktiv && <em className="inactive"> - inaktiv</em>}
                </span>
              </span>
              <span className="rank-rating">{r.rating}</span>
            </button>
          </li>
          );
        })}
      </ol>
      {rows.length === 0 && <p className="hint center">{t("Noch keine Ratings in dieser Disziplin.")}</p>}
      {hidden > 0 && !showAll && (
        <button className="btn ghost" onClick={() => setShowAll(true)}>
          {hidden} {t("inaktive / vorlaeufige Spieler einblenden")}
        </button>
      )}
      {showAll && (
        <button className="btn ghost" onClick={() => setShowAll(false)}>{t("Nur aktive Rangliste zeigen")}</button>
      )}
      <p className="footnote">
        {t("Ratings werden nach jedem bestaetigten Match ueber die gesamte Historie neu berechnet. Juengere Matches zaehlen staerker. Unter 10 Spielen gilt ein Rating als vorlaeufig, ohne Match seit 180 Tagen als inaktiv.")}
      </p>
    </div>
  );
}
