import { useState, useMemo } from "react";
import { Check, X, Clock, Award, Swords } from "lucide-react";
import { t } from "../lib/i18n";
import { isDoubles, mSide, fmtDate, initials } from "../lib/format";
import { computeAchievementExtras, upcomingAchievements } from "../lib/achievements";
import Ball from "./Ball";

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];

export default function RanglisteScreen({ rangliste, disciplines, pending, me, onConfirm, onOpenProfile, myOpenReports, colorOf, badgeOf, photoOf,
  matches, players, challenges, catalog, earnedBadges }) {
  const [disc, setDisc] = useState("Gesamt");
  const [showAll, setShowAll] = useState(false);

  const rows = rangliste
    .filter((r) => r.discipline === disc)
    .filter((r) => showAll || (r.aktiv && !r.vorlaeufig));
  const hidden = rangliste.filter((r) => r.discipline === disc).length - rows.length;

  // Nur fuers Desktop-Seitenpanel: eigener Erfolgs-Fortschritt + Head-to-Head.
  // Auf dem Handy bleibt kein Platz dafuer (siehe .rang-side in App.css).
  const myExtras = useMemo(
    () => (matches && players) ? computeAchievementExtras(me.nickname, matches, players, challenges) : null,
    [matches, players, challenges, me.nickname]
  );
  const upcoming = useMemo(
    () => (myExtras && catalog) ? upcomingAchievements(catalog, myExtras, earnedBadges, 3) : [],
    [myExtras, catalog, earnedBadges]
  );
  const h2h = useMemo(() => {
    if (!matches) return [];
    const map = {};
    matches.forEach((m) => {
      if (m.player1b_id) return;
      let opp = null, w = 0, l = 0;
      if (m.p1.nickname === me.nickname) { opp = m.p2.nickname; w = m.score1 > m.score2 ? 1 : 0; l = 1 - w; }
      if (m.p2.nickname === me.nickname) { opp = m.p1.nickname; w = m.score2 > m.score1 ? 1 : 0; l = 1 - w; }
      if (!opp) return;
      map[opp] ||= { opp, w: 0, l: 0 };
      map[opp].w += w; map[opp].l += l;
    });
    return Object.values(map).sort((a, b) => (b.w + b.l) - (a.w + a.l)).slice(0, 5);
  }, [matches, me.nickname]);

  return (
    <div className="screen">
      <div className="rang-layout">
      <div className="rang-main">
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

      <aside className="rang-side">
        {catalog && catalog.length > 0 && (
          <section className="stat-block">
            <h3><Award size={17} /> {t("Erfolge")} ({earnedBadges?.size ?? 0} / {catalog.length})</h3>
            {upcoming.length === 0 && <p className="hint" style={{ marginTop: 0 }}>{t("Alle erreichbaren Erfolge freigeschaltet!")}</p>}
            {upcoming.map((c) => (
              <div key={c.badgeKey} className="side-row">
                <span className="side-row-emoji">{c.emoji}</span>
                <span className="side-row-name">{c.name}</span>
                <span className="side-row-gap">{t("noch {n}", { n: c.gap })}</span>
              </div>
            ))}
            <button className="btn ghost small" onClick={() => onOpenProfile(me.nickname)}>{t("Alle Erfolge ansehen")}</button>
          </section>
        )}
        <section className="stat-block">
          <h3><Swords size={17} /> {t("Head-to-Head (Match-Siege)")}</h3>
          {h2h.map(({ opp, w, l }) => (
            <button key={opp} className="h2h-row as-btn" onClick={() => onOpenProfile(opp)}>
              <Ball color={colorOf(opp)} label={initials(opp)} badge={badgeOf(opp)} photo={photoOf(opp)} size={30} />
              <span className="stat-name">{opp}</span>
              <div className="h2h-bar"><div className="h2h-w" style={{ width: `${(100 * w) / Math.max(1, w + l)}%` }} /></div>
              <span className="h2h-score">{w}:{l}</span>
            </button>
          ))}
          {h2h.length === 0 && <p className="hint">{t("Noch keine Matches.")}</p>}
        </section>
      </aside>
      </div>
    </div>
  );
}
