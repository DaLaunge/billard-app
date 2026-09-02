import { useState, useMemo } from "react";
import { Check, X, Clock, Download } from "lucide-react";
import { t } from "../lib/i18n";
import { isDoubles, mSide, fmtDate, initials } from "../lib/format";
import { downloadRunLogFile } from "../lib/runLog";
import { computeStats } from "../lib/stats";
import { computeAchievementExtras } from "../lib/achievements";
import Ball from "./Ball";
import MyStatusCard from "./widgets/MyStatusCard";
import LiveStatusCard from "./widgets/LiveStatusCard";
import AchievementsProgressCard from "./widgets/AchievementsProgressCard";
import HeadToHeadCard from "./widgets/HeadToHeadCard";
import RecordsCard from "./widgets/RecordsCard";

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];

/* Die "Uebersicht" (frueher "Rangliste"): die Tabelle bleibt das
   Wichtigste und steht immer zuerst, ergaenzt um modulare Dashboard-
   Karten (eigener Status, Live-Stand, Erfolge, Head-to-Head, Rekorde) -
   dieselben Karten sind auch anderswo wiederverwendbar (z.B. Head-to-
   Head im Profil). Ab 900px zweispaltig, darunter alles untereinander -
   die Zusatzinfos sind also auf jedem Geraet sichtbar, nicht nur Desktop. */
export default function RanglisteScreen({ rangliste, disciplines, pending, me, onConfirm, onOpenProfile, myOpenReports, colorOf, badgeOf, photoOf,
  matches, players, challenges, catalog, earnedBadges, ratingOf, pings, openChallengesToMe, onGoToLive }) {
  const [disc, setDisc] = useState("Gesamt");
  const [showAll, setShowAll] = useState(false);

  const rows = rangliste
    .filter((r) => r.discipline === disc)
    .filter((r) => showAll || (r.aktiv && !r.vorlaeufig));
  const hidden = rangliste.filter((r) => r.discipline === disc).length - rows.length;

  const myStats = useMemo(() => computeStats(matches)[me.nickname], [matches, me.nickname]);
  const myExtras = useMemo(
    () => computeAchievementExtras(me.nickname, matches, players, challenges),
    [matches, players, challenges, me.nickname]
  );

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>{t("Übersicht")}</h2>
        <span className="head-note">{t("Fargo-Skala - 100 Punkte = 2:1")}</span>
      </header>

      <div className="ov-layout">
      <aside className="ov-side">
        <MyStatusCard nickname={me.nickname} rating={ratingOf(me.nickname)} stats={myStats}
          colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} />
        <LiveStatusCard pings={pings} openChallengesToMe={openChallengesToMe} onGoToLive={onGoToLive} />
        <AchievementsProgressCard catalog={catalog} extras={myExtras} earnedBadges={earnedBadges}
          onOpenProfile={onOpenProfile} nickname={me.nickname} />
        <HeadToHeadCard nickname={me.nickname} matches={matches} onOpenProfile={onOpenProfile}
          colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} />
        <RecordsCard extras={myExtras} catalog={catalog} earnedBadges={earnedBadges} />
      </aside>

      <div className="ov-main">
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
        const has141Log = m.discipline === "14/1 Endlos" && m.run_log?.length > 0;
        return (
          <div className="confirm-banner" key={m.id}>
            <div><b>{t("Match bestaetigen:")}</b> {other} {t("meldet ein")} {otherScore}:{myScore} {t("gegen dich")} ({t(m.discipline)}, {fmtDate(m.played_at)}).</div>
            <div className="confirm-actions">
              {has141Log && (
                <button className="chip-btn" onClick={() => downloadRunLogFile(m)} aria-label={t("Protokoll herunterladen")} title={t("Protokoll herunterladen")}>
                  <Download size={15} />
                </button>
              )}
              <button className="chip-btn ok" onClick={() => onConfirm(m.id, true)}><Check size={15} /> {t("Passt")}</button>
              <button className="chip-btn no" onClick={() => onConfirm(m.id, false)}><X size={15} /> {t("Falsch")}</button>
            </div>
          </div>
        );
      })}

      {myOpenReports.length > 0 && (
        <div className="open-reports">
          <p className="open-note"><Clock size={14} /> {myOpenReports.length === 1 && !isDoubles(myOpenReports[0])
            ? t("1 gemeldetes Match wartet noch auf Bestätigung durch {name}.", { name: myOpenReports[0].p2.nickname })
            : t("{n} gemeldete Matches warten noch auf Bestätigung.", { n: myOpenReports.length })}</p>
          {myOpenReports.map((m) => (
            <div key={m.id} className="match-row">
              <span className="m-date">{fmtDate(m.played_at)}</span>
              <span className="m-txt">{mSide(m, 1)} <b>{m.score1}:{m.score2}</b> {mSide(m, 2)}</span>
              <span className="m-disc">{t(m.discipline)}</span>
              {m.discipline === "14/1 Endlos" && m.run_log?.length > 0 && (
                <button className="m-download" onClick={() => downloadRunLogFile(m)} aria-label={t("Protokoll herunterladen")} title={t("Protokoll herunterladen")}>
                  <Download size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="chips">
        {["Gesamt", ...disciplines].map((d) => (
          <button key={d} className={"chip" + (disc === d ? " active" : "")} onClick={() => setDisc(d)}>{t(d)}</button>
        ))}
      </div>

      <ol className="ranking">
        {rows.map((r, i) => {
          const medalEmoji = i < 3 && !r.vorlaeufig && r.aktiv ? MEDAL_EMOJI[i] : null;
          return (
          <li key={r.nickname + r.discipline}>
            <button className="rank-row" onClick={() => onOpenProfile(r.nickname)}>
              <span className="rank-pos">{medalEmoji || i + 1}</span>
              <Ball color={colorOf(r.nickname)} label={initials(r.nickname)} badge={badgeOf(r.nickname)} photo={photoOf(r.nickname)} />
              <span className="rank-name">
                {r.nickname}
                <span className="rank-meta">
                  {r.spiele} {t("Spiele")} - {t("zuletzt")} {fmtDate(r.letzte_partie)}
                  {r.vorlaeufig && <em className="prov"> {t("- vorlaeufig")}</em>}
                  {!r.aktiv && <em className="inactive"> {t("- inaktiv")}</em>}
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
      </div>
    </div>
  );
}
