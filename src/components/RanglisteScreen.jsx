import { useState, useMemo } from "react";
import { Check, X, Clock, FileText, ArrowUp, ArrowDown, Minus, ChevronsUp, ChevronsDown, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { t } from "../lib/i18n";
import { isDoubles, mSide, fmtDate, initials, isDecaying } from "../lib/format";
import { computeAchievementExtras } from "../lib/achievements";
import Ball from "./Ball";
import LiveStatusCard from "./widgets/LiveStatusCard";
import AchievementsProgressCard from "./widgets/AchievementsProgressCard";
import UserPanel from "./widgets/UserPanel";

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];

/* Die "Uebersicht" (frueher "Rangliste"): die Tabelle bleibt das
   Wichtigste und steht zentral/breit. Links die immer gleiche UserPanel-
   Konstante (siehe widgets/UserPanel - dieselbe Spalte auch auf Statistik
   und im eigenen Profil), rechts Erfolge-Fortschritt + Live-Stand. Ab 900px
   dreispaltig, darunter alles untereinander (Ranking zuerst). */
export default function RanglisteScreen({ rangliste, disciplines, pending, me, onConfirm, onOpenProfile, onOpenProtokoll, myOpenReports, colorOf, badgeOf, photoOf,
  matches, players, challenges, catalog, earnedBadges, pings, openChallengesToMe, onGoToLive, onInvite, snapshots }) {
  const [disc, setDisc] = useState("Gesamt");
  const [showAll, setShowAll] = useState(false);

  const rows = rangliste
    .filter((r) => r.discipline === disc)
    .filter((r) => showAll || (r.aktiv && !r.vorlaeufig));
  const hidden = rangliste.filter((r) => r.discipline === disc).length - rows.length;

  const myExtras = useMemo(
    () => computeAchievementExtras(me.nickname, matches, players, challenges),
    [matches, players, challenges, me.nickname]
  );

  // Rang- UND Rating-Verschiebung, kombiniert zu einem einzigen Symbol -
  // basiert auf rating_snapshots (taeglich befuellt). App.jsx laedt
  // inzwischen alle Disziplinen (fuer die Statistik-Seite), hier wird
  // bewusst auf "Gesamt" gefiltert - daher nur auf dem "Gesamt"-Tab
  // verfuegbar. Vergleichsanker ist der letzte gespeicherte Tag VOR dem
  // letzten Match der Person - nicht einfach "gestern" - damit ein Match
  // auch dann noch als "das war der Grund" sichtbar bleibt, wenn seither
  // ein paar ruhige Tage vergangen sind. Wer laenger nicht spielt,
  // verliert trotzdem taeglich leise Punkte (Inaktivitaets-Verfall, siehe
  // rebuild_elo() in Supabase) - deshalb faellt der Anker ohne
  // verwertbaren Match-Tag (oder wenn das Match vor dem Beginn der
  // Snapshot-Historie liegt) auf "gestern" zurueck, damit dieser Verfall
  // trotzdem taeglich sichtbar bleibt statt monatelang eingefroren zu sein.
  const idByNick = useMemo(() => {
    const m = {}; players.forEach((p) => { m[p.nickname] = p.id; }); return m;
  }, [players]);
  const lastMatchDayByNick = useMemo(() => {
    const m = {};
    (matches || []).forEach((mt) => {
      const day = mt.played_at.slice(0, 10);
      [mt.p1?.nickname, mt.p2?.nickname, mt.p1b?.nickname, mt.p2b?.nickname].forEach((nick) => {
        if (nick && (!m[nick] || day > m[nick])) m[nick] = day;
      });
    });
    return m;
  }, [matches]);
  const snapshotsByPlayer = useMemo(() => {
    const m = {};
    (snapshots || []).forEach((s) => { if (s.discipline === "Gesamt") (m[s.player_id] ||= []).push(s); }); // kommt bereits aufsteigend nach snap_date
    return m;
  }, [snapshots]);
  const latestSnapDate = useMemo(
    () => (snapshots || []).reduce((max, s) => (s.discipline === "Gesamt" && s.snap_date > max ? s.snap_date : max), ""),
    [snapshots]
  );
  const referenceFor = (nick) => {
    const list = snapshotsByPlayer[idByNick[nick]];
    if (!list || !latestSnapDate) return null;
    const lastBefore = (d) => { let ref = null; for (const s of list) { if (s.snap_date < d) ref = s; else break; } return ref; };
    const matchDay = lastMatchDayByNick[nick];
    if (matchDay) {
      const ref = lastBefore(matchDay <= latestSnapDate ? matchDay : latestSnapDate);
      if (ref) return ref;
    }
    return lastBefore(latestSnapDate);
  };
  // 7 Zustaende: bei Uneinigkeit (z.B. Rang rauf, Rating aber nicht mit -
  // passiert, wenn v.a. andere sich bewegt haben) gewinnt die Rang-
  // Richtung, da sie das eigentliche "Ranking" ist.
  const moveKindFor = (r, currentRank) => {
    const ref = referenceFor(r.nickname);
    if (!ref) return null;
    const rankDir = currentRank < ref.rank ? "up" : currentRank > ref.rank ? "down" : "same";
    const prevRating = Math.round(ref.rating);
    const ratingDir = r.rating > prevRating ? "up" : r.rating < prevRating ? "down" : "same";
    if (rankDir === "up") return ratingDir === "up" ? "both-up" : "rank-up";
    if (rankDir === "down") return ratingDir === "down" ? "both-down" : "rank-down";
    return ratingDir === "up" ? "rating-up" : ratingDir === "down" ? "rating-down" : "same";
  };
  const MOVE_ICON = {
    "both-up": ChevronsUp, "rank-up": ArrowUp, "rating-up": TrendingUp,
    same: Minus,
    "rating-down": TrendingDown, "rank-down": ArrowDown, "both-down": ChevronsDown,
  };
  const MOVE_LABEL = {
    "both-up": t("Rang und Rating gestiegen"), "rank-up": t("Rang gestiegen"), "rating-up": t("Rating gestiegen"),
    same: t("Unveraendert seit letztem Match"),
    "rating-down": t("Rating gesunken"), "rank-down": t("Rang gesunken"), "both-down": t("Rang und Rating gesunken"),
  };

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>{t("Übersicht")}</h2>
        <span className="head-note">{t("Fargo-Skala - 100 Punkte = 2:1")}</span>
      </header>

      <div className="ov-layout">
      <aside className="ov-side">
        {/* Diese Karten stehen inhaltsgleich schon im eigenen Profil - am
            Handy reine Redundanz, die nur Scroll-Weg vor dem Ranking kostet.
            Ab 900px (Dashboard-Look) bleiben sie sichtbar. */}
        <div className="ov-side-extra">
          <UserPanel nickname={me.nickname} matches={matches} rangliste={rangliste} players={players}
            challenges={challenges} catalog={catalog} earnedBadges={earnedBadges}
            colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} onInvite={onInvite} />
        </div>
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
        const hasLog = m.run_log?.length > 0;
        return (
          <div className="confirm-banner" key={m.id}>
            <div><b>{t("Match bestaetigen:")}</b> {other} {t("meldet ein")} {otherScore}:{myScore} {t("gegen dich")} ({t(m.discipline)}, {fmtDate(m.played_at)}).</div>
            <div className="confirm-actions">
              {hasLog && (
                <button className="chip-btn" onClick={() => onOpenProtokoll(m)} aria-label={t("Protokoll ansehen")} title={t("Protokoll ansehen")}>
                  <FileText size={15} />
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
            : t("{n} gemeldete Matches warten noch auf Bestätigung.", { n: myOpenReports.length })}{" "}
            {t("Ohne Bestätigung fließt das nicht ins Rating ein.")}</p>
          {myOpenReports.map((m) => (
            <div key={m.id} className="match-row">
              <span className="m-date">{fmtDate(m.played_at)}</span>
              <span className="m-txt">{mSide(m, 1)} <b>{m.score1}:{m.score2}</b> {mSide(m, 2)}</span>
              <span className="m-disc">{t(m.discipline)}</span>
              {m.run_log?.length > 0 && (
                <button className="m-download" onClick={() => onOpenProtokoll(m)} aria-label={t("Protokoll ansehen")} title={t("Protokoll ansehen")}>
                  <FileText size={15} />
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
          const currentRank = i + 1;
          const moveKind = disc === "Gesamt" ? moveKindFor(r, currentRank) : null;
          const MoveIcon = moveKind ? MOVE_ICON[moveKind] : null;
          return (
          <li key={r.nickname + r.discipline}>
            <button className="rank-row" onClick={() => onOpenProfile(r.nickname)}>
              <span className="rank-pos">{medalEmoji || i + 1}</span>
              {/* Auf "Gesamt" immer reserviert (auch leer), damit Zeilen ohne
                  Verlaufsdaten (z.B. ganz neue Spieler) die Spalten der
                  anderen Zeilen nicht verschieben. Auf Einzeldisziplinen
                  ganz weggelassen, da es dort nie Bewegungsdaten gibt. */}
              {disc === "Gesamt" && (
                <span className={"rank-move" + (moveKind ? " " + moveKind : "")} title={moveKind ? MOVE_LABEL[moveKind] : undefined}>
                  {MoveIcon && <MoveIcon size={14} />}
                </span>
              )}
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
              {isDecaying(r.letzte_partie) && (
                <span className="rank-decay-warn" title={t("Punkteverfall - lange kein Match, Rating sinkt Richtung 500")}>
                  <AlertTriangle size={16} />
                </span>
              )}
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

      {/* Beide rechten Module stecken ab 900px in EINEM Grid-Feld (siehe
          .ov-right-col), das sie per Flexbox stapelt - so bestimmt allein
          ihre eigene Hoehe den Abstand zwischen ihnen, statt dass CSS Grid
          Zeile 1/2 anhand der viel hoeheren linken/mittleren Spalte
          aufteilt (das erzeugte vorher eine grosse Luecke). Am Handy bleibt
          .ov-right-col unsichtbar (display: contents) - beide Module
          behalten dort ihre eigene order/display-Regel. */}
      <div className="ov-right-col">
      {/* Live-Status ist keine Profil-Info, sondern eine Handlungsauf-
          forderung (offene Pings/Herausforderungen) - bleibt daher, anders
          als das Erfolge-Modul, auch am Handy sichtbar. */}
      <div className="ov-live">
        <LiveStatusCard pings={pings} openChallengesToMe={openChallengesToMe} onGoToLive={onGoToLive} />
      </div>

      {/* Am Handy wie .ov-side-extra ausgeblendet, ab 900px sichtbar. */}
      <aside className="ov-side-right">
        <AchievementsProgressCard catalog={catalog} extras={myExtras} earnedBadges={earnedBadges}
          onOpenProfile={onOpenProfile} nickname={me.nickname} />
      </aside>
      </div>
      </div>
    </div>
  );
}
