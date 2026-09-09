import { useState, useMemo, useEffect } from "react";
import { Trophy, BarChart3, Flame, X, FileText, Check, Clock, SlidersHorizontal, Zap, Timer, Star } from "lucide-react";
import { t } from "../lib/i18n";
import { computeStats } from "../lib/stats";
import { computeAchievementExtras } from "../lib/achievements";
import { initials, fmtDate, fmtDuration, isDoubles, mSide } from "../lib/format";
import { computeSpeedStats, matchDurationMs } from "../lib/runLog";
import { DISC_LABEL } from "../lib/constants";
import Ball from "./Ball";
import EntwicklungBlock from "./EntwicklungBlock";
import UserPanel from "./widgets/UserPanel";
import DecayBadge from "./widgets/DecayBadge";
import LiveStatusCard from "./widgets/LiveStatusCard";
import InfoButton from "./widgets/InfoButton";
import ImprintFooter from "./widgets/ImprintFooter";

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];
const COUNT_OPTIONS = [3, 10, "all"];

// Eigene Komponente statt Definition innerhalb von StatistikScreen: sonst
// waere Block bei jedem Render der Eltern-Komponente eine neue Funktion,
// React wuerde sie als anderen Komponententyp behandeln und ihren
// useState (die gewaehlte Anzahl) jedes Mal verwerfen.
//
// count/nearby kommen jetzt von AUSSEN (globale Auswahl ganz oben auf der
// Seite, siehe StatGlobalFilter) statt aus eigenem State - Nutzer-Feedback:
// jede Bestenliste hatte vorher ihre eigenen Top-3/10/Alle-Knoepfe, das war
// zu viele Buttons. Die eigene Position bleibt trotzdem IMMER sichtbar -
// auch bei Top-3/Top-10, nicht nur als Zahl, sondern als echte Zeile mit
// Name/Wert (Beispiel: "wenn ich Platz 40 bin, will ich das trotzdem in der
// Top-3-Ansicht sehen"). Der eigene Rang wird deshalb IMMER aus der vollen,
// ungekuerzten "rows"-Liste ermittelt (nicht aus "visible") - liegt er
// ausserhalb der gerade sichtbaren Top-N, wird die eigene Zeile per Trenner
// angehaengt statt nur als Text erwaehnt.
function LeaderboardBlock({ icon, title, rows, fmt, colorOf, badgeOf, photoOf, onOpenProfile, me, count, nearby, info }) {
  const myIndex = rows.findIndex((p) => p.name === me?.nickname);
  const showNearby = nearby && myIndex >= 0;
  const sliceStart = showNearby ? Math.max(0, myIndex - 2) : 0;
  const visible = showNearby ? rows.slice(sliceStart, myIndex + 3) : (count === "all" ? rows : rows.slice(0, count));
  const myRowShown = showNearby || count === "all" || (myIndex >= 0 && myIndex < count);
  const pinMyRow = myIndex >= 0 && !myRowShown;
  return (
    <section className="stat-block">
      <div className="stat-block-head">
        <h3>{icon} {title}</h3>
        {info && <InfoButton title={title}>{info}</InfoButton>}
      </div>
      {myIndex < 0 && <p className="stat-my-rank hint">{t("Du bist in dieser Liste nicht vertreten.")}</p>}
      {visible.length === 0 && <p className="hint">{t("Noch keine Daten.")}</p>}
      {visible.map((p, i) => (
        <button key={p.name} className={"stat-row as-btn" + (p.name === me?.nickname ? " mine" : "")} onClick={() => onOpenProfile(p.name)}>
          <span className="medal">{sliceStart + i + 1}.</span>
          <Ball color={colorOf(p.name)} label={initials(p.name)} badge={badgeOf(p.name)} photo={photoOf(p.name)} size={34} />
          <span className="stat-name">{p.name}</span>
          <span className="stat-val">{fmt(p)}</span>
        </button>
      ))}
      {pinMyRow && (
        <>
          <div className="stat-row-sep">···</div>
          <button className="stat-row as-btn mine" onClick={() => onOpenProfile(rows[myIndex].name)}>
            <span className="medal">{myIndex + 1}.</span>
            <Ball color={colorOf(rows[myIndex].name)} label={initials(rows[myIndex].name)} badge={badgeOf(rows[myIndex].name)} photo={photoOf(rows[myIndex].name)} size={34} />
            <span className="stat-name">{rows[myIndex].name}</span>
            <span className="stat-val">{fmt(rows[myIndex])}</span>
          </button>
        </>
      )}
    </section>
  );
}

// Die fruehere eigene "Uebersicht"/Rangliste-Seite: hier als weiterer
// Bestenlisten-Block eingegliedert (gleiches Muster wie "Meiste Siege" &
// Co.). disc/count/nearby kommen ebenfalls von der globalen Auswahl.
function RankingBlock({ rangliste, disc, count, nearby, colorOf, badgeOf, photoOf, onOpenProfile, me }) {
  const rows = rangliste.filter((r) => r.discipline === disc && r.aktiv && !r.vorlaeufig);
  const myIndex = rows.findIndex((r) => r.nickname === me?.nickname);
  const showNearby = nearby && myIndex >= 0;
  const sliceStart = showNearby ? Math.max(0, myIndex - 2) : 0;
  const visible = showNearby ? rows.slice(sliceStart, myIndex + 3) : (count === "all" ? rows : rows.slice(0, count));
  const myRowShown = showNearby || count === "all" || (myIndex >= 0 && myIndex < count);
  const pinMyRow = myIndex >= 0 && !myRowShown;
  return (
    <section className="stat-block">
      <div className="stat-block-head">
        <h3><Trophy size={17} /> {t("Rangliste")}</h3>
        <InfoButton title={t("Rangliste")}>
          {t("Rating nach einem Fargo-ähnlichen Elo-System: mehr Punkte = besser, 100 Punkte Unterschied entsprechen ungefähr einer Gewinnchance von 2:1. Ohne bestätigtes Match bewegt sich das Rating mit der Zeit wieder Richtung 500 (Startwert). Unter 10 Spielen gilt ein Rating als vorläufig, ohne Match seit 180 Tagen als inaktiv.")}
        </InfoButton>
      </div>
      {myIndex < 0 && <p className="stat-my-rank hint">{t("Du bist in dieser Liste nicht vertreten.")}</p>}
      {visible.length === 0 && <p className="hint">{t("Noch keine Ratings in dieser Disziplin.")}</p>}
      {visible.map((r, i) => {
        const rank = sliceStart + i;
        return (
          <button key={r.nickname + r.discipline} className={"stat-row as-btn" + (r.nickname === me?.nickname ? " mine" : "")} onClick={() => onOpenProfile(r.nickname)}>
            <span className="medal">{rank < 3 ? MEDAL_EMOJI[rank] : `${rank + 1}.`}</span>
            <Ball color={colorOf(r.nickname)} label={initials(r.nickname)} badge={badgeOf(r.nickname)} photo={photoOf(r.nickname)} size={34} />
            <span className="stat-name">{r.nickname}</span>
            <span className="stat-val">{r.rating}</span>
            <span className="stat-decay-slot"><DecayBadge player={r} iconSize={15} /></span>
          </button>
        );
      })}
      {pinMyRow && (
        <>
          <div className="stat-row-sep">···</div>
          <button className="stat-row as-btn mine" onClick={() => onOpenProfile(rows[myIndex].nickname)}>
            <span className="medal">{myIndex + 1}.</span>
            <Ball color={colorOf(rows[myIndex].nickname)} label={initials(rows[myIndex].nickname)} badge={badgeOf(rows[myIndex].nickname)} photo={photoOf(rows[myIndex].nickname)} size={34} />
            <span className="stat-name">{rows[myIndex].nickname}</span>
            <span className="stat-val">{rows[myIndex].rating}</span>
            <span className="stat-decay-slot"><DecayBadge player={rows[myIndex]} iconSize={15} /></span>
          </button>
        </>
      )}
    </section>
  );
}

// EIN Satz Disziplin-/Top-N-Buttons ganz oben auf der Seite statt in jeder
// einzelnen Bestenliste - Nutzer-Feedback: zu viele Buttons, wenn Rangliste
// + 3 Bestenlisten je eigene Chips haben. Gilt fuer alle Karten der Seite,
// inklusive Disziplin fuer den Verlaufs-Graph (der behaelt nur seine
// eigene Zeitraum-Auswahl, weil die sonst nirgends vorkommt).
function StatGlobalFilter({ disc, disciplines, onDisc, count, nearby, onCount, onNearby, me, colorOf, badgeOf, photoOf }) {
  return (
    <section className="stat-block stat-global-filter">
      <div className="stat-block-head">
        <h3><SlidersHorizontal size={17} /> {t("Auswahl fuer alle Statistiken")}</h3>
      </div>
      <div className="chips small" style={{ marginBottom: 8 }}>
        {["Gesamt", ...disciplines].map((d) => (
          <button key={d} className={"chip" + (disc === d ? " active" : "")} onClick={() => onDisc(d)}>{t(DISC_LABEL[d] || d)}</button>
        ))}
      </div>
      <div className="chips small" style={{ marginBottom: 0 }}>
        {COUNT_OPTIONS.map((c) => (
          <button key={c} className={"chip" + (!nearby && count === c ? " active" : "")}
            onClick={() => { onCount(c); onNearby(false); }}>
            {c === "all" ? t("Alle") : c}
          </button>
        ))}
        <button className={"chip chip-icon" + (nearby ? " active" : "")} onClick={() => onNearby((n) => !n)}
          aria-label={t("Meine Umgebung")} title={t("Meine Umgebung")}>
          <Ball color={colorOf(me?.nickname)} label={initials(me?.nickname)} badge={badgeOf(me?.nickname)} photo={photoOf(me?.nickname)} size={18} />
        </button>
      </div>
    </section>
  );
}

// Club-weite Rekorde statt der eigenen Zahlen (siehe RecordsCard.jsx im
// Profil) - fuer jede Kennzahl wird gezeigt, WER sie gerade haelt, nicht
// nur "wie viel". Jeder Eintrag: Label darueber, darunter entweder eine
// normale Ranglisten-Zeile (Ball-Avatar + Name + Wert, ein eindeutiger
// Rekordhalter) oder - bei type "match" (Schnellstes/Laengstes Match) -
// eine Match-Zeile mit BEIDEN beteiligten Spielern, da so ein Rekord nicht
// EINER Person allein gehoert. Eintraege ohne Halter (noch keine Daten)
// werden ausgeblendet statt eine leere/falsche Zeile zu zeigen.
function RecordsBoard({ records, colorOf, badgeOf, photoOf, onOpenProfile }) {
  const shown = records.filter((r) => r.holder);
  return (
    <section className="stat-block">
      <div className="stat-block-head">
        <h3><Star size={17} /> {t("Rekorde")}</h3>
        <InfoButton title={t("Rekorde")}>
          {t("Aktuelle Bestwerte der gesamten Gruppe aus allen bestätigten Einzel-Matches (bzw. dem bisherigen Rating-Verlauf beim Rating-Rekord) - wer hält gerade welchen Rekord? Schnellstes/Längstes Match zählen nur Matches mit gespeichertem Zeit-Protokoll (über den digitalen Zähler gemeldet) und sind unabhängig von der Disziplin-Auswahl oben, genau wie alle anderen Rekorde dieser Karte.")}
        </InfoButton>
      </div>
      {shown.length === 0 && <p className="hint">{t("Noch keine Rekorde.")}</p>}
      {shown.map(({ key, label, holder, fmt, type }) => (
        <div key={key} className="record-entry">
          <p className="record-entry-label">{label}</p>
          {type === "match" ? (
            <div className="match-row">
              <span className="m-txt">
                <button className="name-link" onClick={() => onOpenProfile(holder.p1Name)}>{holder.p1Name}</button>
                {" vs. "}
                <button className="name-link" onClick={() => onOpenProfile(holder.p2Name)}>{holder.p2Name}</button>
              </span>
              <span className="m-disc">{t(holder.discipline)}</span>
              <span className="stat-val">{fmt(holder)}</span>
            </div>
          ) : (
            <button className="stat-row as-btn" onClick={() => onOpenProfile(holder.name)}>
              <Ball color={colorOf(holder.name)} label={initials(holder.name)} badge={badgeOf(holder.name)} photo={photoOf(holder.name)} size={30} />
              <span className="stat-name">{holder.name}</span>
              <span className="stat-val">{fmt(holder)}</span>
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

export default function StatistikScreen({ matches, onOpenProfile, onOpenProtokoll, colorOf, badgeOf, photoOf, snapshots, players, rangliste, me, challenges,
  catalog, earnedBadges, onInvite, disciplines, pending, onConfirm, myOpenReports, pings, openChallengesToMe, onGoToLive }) {
  // Globale Auswahl (Disziplin + Top-N/Meine Umgebung): letzte Wahl wird
  // geraeteweise gemerkt, wie bei den Live-Bereichen (siehe LiveScreen).
  const [globalDisc, setGlobalDisc] = useState(() => {
    try { return localStorage.getItem("statGlobalDisc") || "Gesamt"; } catch { return "Gesamt"; }
  });
  const [globalCount, setGlobalCount] = useState(() => {
    try {
      const raw = localStorage.getItem("statGlobalCount");
      return raw === "all" ? "all" : raw ? Number(raw) : 3;
    } catch { return 3; }
  });
  const [globalNearby, setGlobalNearby] = useState(() => {
    try { return localStorage.getItem("statGlobalNearby") === "1"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("statGlobalDisc", globalDisc); } catch { /* ignore */ } }, [globalDisc]);
  useEffect(() => { try { localStorage.setItem("statGlobalCount", String(globalCount)); } catch { /* ignore */ } }, [globalCount]);
  useEffect(() => { try { localStorage.setItem("statGlobalNearby", globalNearby ? "1" : "0"); } catch { /* ignore */ } }, [globalNearby]);

  // Meiste Siege/Beste Siegquote/Aktuelle Serien nach der globalen Disziplin
  // filtern - computeStats() selbst kennt keine Disziplin, zaehlt aber
  // ohnehin nur Einzel-Matches (Doppel wird intern uebersprungen), daher
  // fuer "Doppel" direkt leer lassen statt auf einen nie zutreffenden
  // matches.discipline-Wert zu filtern.
  const discFilteredMatches = useMemo(() => {
    if (globalDisc === "Gesamt") return matches;
    if (globalDisc === "Doppel") return [];
    return matches.filter((m) => m.discipline === globalDisc);
  }, [matches, globalDisc]);
  const stats = useMemo(() => computeStats(discFilteredMatches), [discFilteredMatches]);
  const topWins = useMemo(() => Object.values(stats).sort((a, b) => b.siege - a.siege), [stats]);
  const topQuote = useMemo(
    () => Object.values(stats).filter((p) => p.spiele >= 10).sort((a, b) => b.quote - a.quote),
    [stats]
  );
  const topStreak = useMemo(
    () => Object.values(stats).filter((p) => p.streak > 0).sort((a, b) => b.streak - a.streak),
    [stats]
  );

  // Spielgeschwindigkeit: unabhaengig von der globalen Disziplin-Auswahl,
  // weil die beiden Werte je schon fix auf eine Protokoll-Art festgelegt
  // sind (Zeit/Spiel nur bei 8/9/10-Ball-Zaehler-Protokollen, Zeit/Kugel nur
  // bei 14/1) - "Doppel" waere hier immer leer, genau wie beim Verlaufs-
  // Graphen gibt es daher bewusst keine Kopplung an globalDisc.
  //
  // KEIN Mindest-Match-Filter wie bei "Beste Siegquote" (dort >= 10 Spiele):
  // gueltige Zeitstempel gibt es nur bei Matches, die live ueber den
  // digitalen Zaehler gespielt wurden (nicht bei nachgetragenen/manuell
  // erfassten Matches) UND deren Tempo die Plausibilitaetsgrenze in
  // ballSpeedSums()/gameSpeedSums() besteht (lib/runLog.js) - das ist schon
  // ein deutlich kleinerer, aber dafuer verlaesslicher Pool. Ein zusaetzliches
  // ">= 3 Matches" liess die Listen praktisch immer leer bleiben (Nutzer-
  // Feedback: "egal was ich einstelle, keine Werte"), weil kaum ein Spieler
  // bisher so viele qualifizierende Matches hat - avgGameMs/avgBallMs sind
  // bereits null ohne jeden Treffer, das reicht als Filter.
  const speedStats = useMemo(
    () => players.map((p) => ({ name: p.nickname, ...computeSpeedStats(matches, p.id) })),
    [players, matches]
  );
  const topGameSpeed = useMemo(
    () => speedStats.filter((p) => p.avgGameMs != null).sort((a, b) => a.avgGameMs - b.avgGameMs),
    [speedStats]
  );
  const topBallSpeed = useMemo(
    () => speedStats.filter((p) => p.avgBallMs != null).sort((a, b) => a.avgBallMs - b.avgBallMs),
    [speedStats]
  );

  // Rekorde: dieselbe computeAchievementExtras()-Berechnung wie im eigenen
  // Profil (RecordsCard.jsx), hier aber fuer JEDEN Spieler durchgefuehrt, um
  // je Kennzahl den aktuellen Rekordhalter zu finden statt nur die eigene
  // Zahl zu zeigen. Ergaenzt um drei bisher nirgends gezeigte Kennzahlen
  // (Hoechster Sieg, Rating-Rekord, meiste Matches gesamt).
  const extrasAll = useMemo(
    () => players.map((p) => ({ name: p.nickname, ...computeAchievementExtras(p.nickname, matches, players, challenges) })),
    [players, matches, challenges]
  );
  const topExtra = (metric) => extrasAll.filter((p) => p[metric] > 0).sort((a, b) => b[metric] - a[metric])[0] || null;

  // Groesster Punkteabstand in einem Einzel-Match (wie computeStats/
  // computeAchievementExtras nur Einzel - bei Doppel gaebe es zwei Namen
  // statt eines eindeutigen Rekordhalters).
  const biggestWin = useMemo(() => {
    let best = null;
    matches.forEach((m) => {
      if (m.player1b_id) return;
      const diff = Math.abs(m.score1 - m.score2);
      if (diff === 0) return;
      if (!best || diff > best.diff) {
        const p1Won = m.score1 > m.score2;
        best = { name: p1Won ? m.p1.nickname : m.p2.nickname, diff,
          score: `${Math.max(m.score1, m.score2)}:${Math.min(m.score1, m.score2)}` };
      }
    });
    return best;
  }, [matches]);

  // Hoechstes je erreichtes Gesamt-Rating: sowohl aus dem taeglichen
  // Snapshot-Verlauf als auch dem aktuellen Stand (falls das heutige
  // Hoch noch nicht als Snapshot vorliegt).
  const peakRating = useMemo(() => {
    let best = null;
    snapshots.forEach((s) => {
      if (s.discipline !== "Gesamt") return;
      if (!best || s.rating > best.rating) {
        const p = players.find((pl) => pl.id === s.player_id);
        if (p) best = { name: p.nickname, rating: s.rating };
      }
    });
    rangliste.forEach((r) => {
      if (r.discipline !== "Gesamt") return;
      if (!best || r.rating > best.rating) best = { name: r.nickname, rating: r.rating };
    });
    return best ? { name: best.name, rating: Math.round(best.rating) } : null;
  }, [snapshots, players, rangliste]);

  const mostGames = useMemo(() => {
    const arr = Object.values(computeStats(matches)).filter((p) => p.spiele > 0).sort((a, b) => b.spiele - a.spiele);
    return arr[0] || null;
  }, [matches]);

  // Schnellstes/Laengstes Match: Gesamtdauer (erster bis letzter Zeitstempel
  // im Protokoll), nur Einzel-Matches (bei Doppel waeren es vier statt zwei
  // Namen - passt nicht in die Zwei-Spieler-Zeile). matchDurationMs() selbst
  // prueft keine Plausibilitaet (anders als ballSpeedSums/gameSpeedSums in
  // lib/runLog.js) - Grenzen hier daher separat: unter 1 Minute ist fuer ein
  // echtes Match praktisch unmoeglich (gleiche Idee wie MIN_MS_PER_BALL, nur
  // aufs ganze Match bezogen) und schliesst dieselben zu schnell durch-
  // geklickten Alt-/Testdaten aus, die schon bei der Spielgeschwindigkeit
  // aufgefallen sind. Ueber 4 Stunden ist eher ein liegen gelassenes,
  // verspaetet fertig erfasstes Match als echte durchgehende Spielzeit.
  const MIN_MATCH_MS = 60 * 1000;
  const MAX_MATCH_MS = 4 * 60 * 60 * 1000;
  const matchDurations = useMemo(() => {
    const list = [];
    matches.forEach((m) => {
      if (m.player1b_id) return;
      const ms = matchDurationMs(m.run_log);
      if (ms == null || ms < MIN_MATCH_MS || ms > MAX_MATCH_MS) return;
      list.push({ p1Name: m.p1.nickname, p2Name: m.p2.nickname, discipline: m.discipline, ms });
    });
    return list;
  }, [matches]);
  const fastestMatch = useMemo(
    () => matchDurations.reduce((best, m) => (!best || m.ms < best.ms ? m : best), null),
    [matchDurations]
  );
  const longestMatch = useMemo(
    () => matchDurations.reduce((best, m) => (!best || m.ms > best.ms ? m : best), null),
    [matchDurations]
  );

  const recordRows = [
    { key: "highRun", label: t("Höchstserie 14/1"), holder: topExtra("highRun"), fmt: (h) => h.highRun },
    { key: "longestStreak", label: t("Beste Serie"), holder: topExtra("longestStreak"), fmt: (h) => h.longestStreak },
    { key: "shutoutWins", label: t("Zu-Null-Siege"), holder: topExtra("shutoutWins"), fmt: (h) => h.shutoutWins },
    { key: "maxVsOpponent", label: t("Rekord geg. 1 Gegner"), holder: topExtra("maxVsOpponent"), fmt: (h) => h.maxVsOpponent },
    { key: "maxPerDay", label: t("Meiste an 1 Tag"), holder: topExtra("maxPerDay"), fmt: (h) => h.maxPerDay },
    { key: "recruitedCount", label: t("Geworben"), holder: topExtra("recruitedCount"), fmt: (h) => h.recruitedCount },
    { key: "biggestWin", label: t("Höchster Sieg"), holder: biggestWin, fmt: (h) => h.score },
    { key: "peakRating", label: t("Höchstes Rating erreicht"), holder: peakRating, fmt: (h) => h.rating },
    { key: "mostGames", label: t("Meiste Matches gesamt"), holder: mostGames, fmt: (h) => h.spiele },
    { key: "fastestMatch", label: t("Schnellstes Match"), holder: fastestMatch, fmt: (h) => fmtDuration(h.ms), type: "match" },
    { key: "longestMatch", label: t("Längstes Match"), holder: longestMatch, fmt: (h) => fmtDuration(h.ms), type: "match" },
  ];

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>{t("Statistik")}</h2>
        <span className="head-note">{t("Bestenlisten (bestaetigte Matches)")}</span>
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

      <div className="stat-split">
      {/* .stat-right-col buendelt die globale Auswahl + Rangliste + "Rest"
          (siehe unten) zu EINER Huelle: am Handy per CSS unsichtbar
          (display:contents), dort ordnen sich ihre Kinder ueber "order"
          direkt in .stat-split ein (globale Auswahl zuerst, dann Rangliste
          - Nutzer-Feedback: Gesamt-Rangliste soll am Handy gleich danach
          an erster Stelle stehen, ohne eigenen "order" faellt die globale
          Auswahl automatisch auf order:0 zurueck und bleibt damit vorn).
          Am Desktop wird daraus ein einziges Grid-Feld mit eigenem
          Flex-Stapel (siehe App.css) - das verhindert den Grid-Zeilen-
          Kopplungs-Bug (leere Luecke vor "Meiste Siege", weil die viel
          hoehere Chart-Spalte sonst dieselbe Grid-Zeile wie die kurze
          Rangliste aufblaeht) UND stellt die globale Auswahl (Nutzer-
          Feedback) ganz oben in die rechte Spalte statt als eigene volle
          Zeile ueber allen drei Spalten. */}
      <div className="stat-right-col">
      <StatGlobalFilter disc={globalDisc} disciplines={disciplines} onDisc={setGlobalDisc}
        count={globalCount} nearby={globalNearby} onCount={setGlobalCount} onNearby={setGlobalNearby}
        me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} />
      <div className="stat-ranking-col">
        <RankingBlock rangliste={rangliste} disc={globalDisc} count={globalCount} nearby={globalNearby} me={me}
          colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} />
      </div>

      <div className="stat-rest-col">
      <div className="stat-grid">
        <LiveStatusCard pings={pings} openChallengesToMe={openChallengesToMe} onGoToLive={onGoToLive} />
        <LeaderboardBlock icon={<Trophy size={17} />} title={t("Meiste Siege")} rows={topWins} me={me} count={globalCount} nearby={globalNearby}
          fmt={(p) => `${p.siege} ${t("Siege")}`} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} />
        <LeaderboardBlock icon={<BarChart3 size={17} />} title={t("Beste Siegquote (ab 10 Spielen)")} rows={topQuote} me={me} count={globalCount} nearby={globalNearby}
          fmt={(p) => `${p.quote} %`} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile}
          info={t("Anteil gewonnener Einzel-Matches (Siege ÷ Spiele) in der aktuell gewählten Disziplin. Um verlässlich zu sein, zählt die Quote erst ab 10 Spielen in dieser Auswahl.")} />
        <LeaderboardBlock icon={<Flame size={17} />} title={t("Aktuelle Serien")} rows={topStreak} me={me} count={globalCount} nearby={globalNearby}
          fmt={(p) => `${p.streak} ${t("in Folge")}`} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile}
          info={t("Wie viele Einzel-Matches in Folge gewonnen wurden, seit der letzten Niederlage in der aktuell gewählten Disziplin.")} />
        <LeaderboardBlock icon={<Zap size={17} />} title={t("Schnellstes Tempo (Ø pro Spiel)")} rows={topGameSpeed} me={me} count={globalCount} nearby={globalNearby}
          fmt={(p) => fmtDuration(p.avgGameMs)} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile}
          info={t("Durchschnittliche Zeit pro Einzelspiel bei 8-, 9- und 10-Ball-Matches mit gespeichertem Protokoll (nur Matches, die über den digitalen Zähler gemeldet wurden). Niedrigster Wert zuerst. Nur Spieler mit mindestens einem auswertbaren Match werden gelistet.")} />
        <LeaderboardBlock icon={<Timer size={17} />} title={t("Schnellstes 14/1-Tempo (Ø pro Kugel)")} rows={topBallSpeed} me={me} count={globalCount} nearby={globalNearby}
          fmt={(p) => fmtDuration(p.avgBallMs)} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile}
          info={t("Durchschnittliche Zeit pro versenkter Kugel bei 14/1-Endlos-Matches mit gespeichertem Protokoll. Fouls zählen nicht mit. Niedrigster Wert zuerst. Nur Spieler mit mindestens einem auswertbaren Match werden gelistet.")} />
        <RecordsBoard records={recordRows} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} />
      </div>
      </div>
      </div>

      <aside className="ov-side">
        {/* Wie auf Profil: dieselbe UserPanel-Konstante - am Handy
            ausgeblendet (Redundanz mit dem Profil-Tab), ab 900px sichtbar.
            hideRatings: die "Ratings nach Disziplin"-Karte duplizierte hier
            die eigene (angeheftete) Zeile in der Rangliste-Karte rechts,
            die dank der globalen Disziplin-Auswahl ohnehin jede Disziplin
            zeigen kann - auf Profil/Live bleibt sie unveraendert sichtbar. */}
        <div className="ov-side-extra">
          <UserPanel nickname={me.nickname} matches={matches} rangliste={rangliste} players={players}
            challenges={challenges} catalog={catalog} earnedBadges={earnedBadges} hideRatings
            colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} onInvite={onInvite} />
        </div>
      </aside>

      {/* Mittlere Spalte: der Verlaufs-Graph - der eigentliche Fokus dieser
          Seite (Letzte Matches sind in den Live-Menuepunkt gewandert). */}
      <div className="stat-chart-col">
      <EntwicklungBlock snapshots={snapshots} players={players} rangliste={rangliste} me={me} colorOf={colorOf} matches={matches} disc={globalDisc} />
      </div>
      </div>
      <ImprintFooter />
    </div>
  );
}
