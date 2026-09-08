import { useState, useMemo } from "react";
import { Trophy, BarChart3, Flame, Swords, X, FileText, Check, Clock } from "lucide-react";
import { t } from "../lib/i18n";
import { computeStats } from "../lib/stats";
import { initials, fmtDate, fmtDateTime, sideNames, isDoubles, mSide } from "../lib/format";
import Ball from "./Ball";
import EntwicklungBlock from "./EntwicklungBlock";
import PlayerPicker from "./PlayerPicker";
import UserPanel from "./widgets/UserPanel";
import DecayBadge from "./widgets/DecayBadge";
import LiveStatusCard from "./widgets/LiveStatusCard";

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];
const COUNT_OPTIONS = [3, 10, "all"];
const MATCH_COUNT_OPTIONS = [10, 20, 50, 100, "all"];
const MATCH_DISCIPLINES = ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos", "Doppel"];

// Eigene Komponente statt Definition innerhalb von StatistikScreen: sonst
// waere Block bei jedem Render der Eltern-Komponente eine neue Funktion,
// React wuerde sie als anderen Komponententyp behandeln und ihren
// useState (die gewaehlte Anzahl) jedes Mal verwerfen.
//
// Nutzer-Feedback: in JEDER Ranglisten-/Bestenliste soll erkennbar sein, wo
// man selbst steht - auch wenn der eigene Platz ausserhalb der gerade
// sichtbaren Top-N liegt (eigener Rang wird deshalb IMMER aus der vollen,
// ungekuerzten "rows"-Liste ermittelt, nicht aus "visible"). Zusaetzlich ein
// "Meine Umgebung"-Umschalter (2 Plaetze davor/danach) als vierte, zu Top-3/
// 10/Alle exklusive Option - beim Wechsel zurueck auf eine Top-N-Zahl wird
// er automatisch wieder deaktiviert.
function LeaderboardBlock({ icon, title, rows, fmt, colorOf, badgeOf, photoOf, onOpenProfile, me }) {
  const [count, setCount] = useState(3);
  const [nearby, setNearby] = useState(false);
  const myIndex = rows.findIndex((p) => p.name === me?.nickname);
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const showNearby = nearby && myIndex >= 0;
  const sliceStart = showNearby ? Math.max(0, myIndex - 2) : 0;
  const visible = showNearby ? rows.slice(sliceStart, myIndex + 3) : (count === "all" ? rows : rows.slice(0, count));
  return (
    <section className="stat-block">
      <div className="stat-block-head">
        <h3>{icon} {title}</h3>
        <div className="chips small">
          {COUNT_OPTIONS.map((c) => (
            <button key={c} className={"chip" + (!nearby && count === c ? " active" : "")}
              onClick={() => { setCount(c); setNearby(false); }}>
              {c === "all" ? t("Alle") : `Top ${c}`}
            </button>
          ))}
          {myIndex >= 0 && (
            <button className={"chip" + (nearby ? " active" : "")} onClick={() => setNearby((n) => !n)}>
              {t("Meine Umgebung")}
            </button>
          )}
        </div>
      </div>
      <p className="stat-my-rank hint">
        {myRank != null ? <>{t("Dein Rang")}: <b>{myRank}.</b></> : t("Du bist in dieser Liste nicht vertreten.")}
      </p>
      {visible.length === 0 && <p className="hint">{t("Noch keine Daten.")}</p>}
      {visible.map((p, i) => (
        <button key={p.name} className={"stat-row as-btn" + (p.name === me?.nickname ? " mine" : "")} onClick={() => onOpenProfile(p.name)}>
          <span className="medal">{sliceStart + i + 1}.</span>
          <Ball color={colorOf(p.name)} label={initials(p.name)} badge={badgeOf(p.name)} photo={photoOf(p.name)} size={34} />
          <span className="stat-name">{p.name}</span>
          <span className="stat-val">{fmt(p)}</span>
        </button>
      ))}
    </section>
  );
}

// Die fruehere eigene "Uebersicht"/Rangliste-Seite: hier als weiterer
// Bestenlisten-Block eingegliedert (gleiches Top-3/Top-10/Alle-Muster wie
// "Meiste Siege" & Co.), da sie inhaltlich ohnehin eine Rangliste ist.
// Anders als die anderen Bloecke mit Disziplin-Auswahl, da die Rangliste
// (im Gegensatz zu den reinen Zaehl-Statistiken) je Disziplin getrennt
// gefuehrt wird.
function RankingBlock({ rangliste, disciplines, colorOf, badgeOf, photoOf, onOpenProfile, me }) {
  const [disc, setDisc] = useState("Gesamt");
  const [count, setCount] = useState(3);
  const [nearby, setNearby] = useState(false);
  const rows = rangliste.filter((r) => r.discipline === disc && r.aktiv && !r.vorlaeufig);
  const myIndex = rows.findIndex((r) => r.nickname === me?.nickname);
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const showNearby = nearby && myIndex >= 0;
  const sliceStart = showNearby ? Math.max(0, myIndex - 2) : 0;
  const visible = showNearby ? rows.slice(sliceStart, myIndex + 3) : (count === "all" ? rows : rows.slice(0, count));
  return (
    <section className="stat-block">
      <div className="stat-block-head">
        <h3><Trophy size={17} /> {t("Rangliste")}</h3>
        <div className="chips small">
          {COUNT_OPTIONS.map((c) => (
            <button key={c} className={"chip" + (!nearby && count === c ? " active" : "")}
              onClick={() => { setCount(c); setNearby(false); }}>
              {c === "all" ? t("Alle") : `Top ${c}`}
            </button>
          ))}
          {myIndex >= 0 && (
            <button className={"chip" + (nearby ? " active" : "")} onClick={() => setNearby((n) => !n)}>
              {t("Meine Umgebung")}
            </button>
          )}
        </div>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>{t("Fargo-Skala - 100 Punkte = 2:1")}</p>
      <div className="chips small" style={{ marginBottom: 10 }}>
        {["Gesamt", ...disciplines].map((d) => (
          <button key={d} className={"chip" + (disc === d ? " active" : "")} onClick={() => setDisc(d)}>{t(d)}</button>
        ))}
      </div>
      <p className="stat-my-rank hint">
        {myRank != null ? <>{t("Dein Rang")}: <b>{myRank}.</b></> : t("Du bist in dieser Liste nicht vertreten.")}
      </p>
      {visible.length === 0 && <p className="hint">{t("Noch keine Ratings in dieser Disziplin.")}</p>}
      {visible.map((r, i) => {
        const rank = sliceStart + i;
        return (
          <button key={r.nickname + r.discipline} className={"stat-row as-btn" + (r.nickname === me?.nickname ? " mine" : "")} onClick={() => onOpenProfile(r.nickname)}>
            <span className="medal">{rank < 3 ? MEDAL_EMOJI[rank] : `${rank + 1}.`}</span>
            <Ball color={colorOf(r.nickname)} label={initials(r.nickname)} badge={badgeOf(r.nickname)} photo={photoOf(r.nickname)} size={34} />
            <span className="stat-name">{r.nickname}</span>
            <span className="stat-val">{r.rating}</span>
            <DecayBadge player={r} iconSize={15} />
          </button>
        );
      })}
    </section>
  );
}

export default function StatistikScreen({ matches, onOpenProfile, onOpenProtokoll, colorOf, badgeOf, photoOf, snapshots, players, rangliste, me, challenges,
  catalog, earnedBadges, onInvite, disciplines, pending, onConfirm, myOpenReports, pings, openChallengesToMe, onGoToLive }) {
  const stats = useMemo(() => computeStats(matches), [matches]);
  const topWins = useMemo(() => Object.values(stats).sort((a, b) => b.siege - a.siege), [stats]);
  const topQuote = useMemo(
    () => Object.values(stats).filter((p) => p.spiele >= 10).sort((a, b) => b.quote - a.quote),
    [stats]
  );
  const topStreak = useMemo(
    () => Object.values(stats).filter((p) => p.streak > 0).sort((a, b) => b.streak - a.streak),
    [stats]
  );
  const [filterPlayer, setFilterPlayer] = useState("");
  const [filterResult, setFilterResult] = useState("all"); // all | win | loss
  const [filterDisc, setFilterDisc] = useState("all"); // all | "8 Ball" | ... | "Doppel"
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [matchCount, setMatchCount] = useState(10);
  const [hideTournament, setHideTournament] = useState(false);

  const filteredMatches = useMemo(() => {
    return [...matches]
      .filter((m) => {
        if (hideTournament && m.tournament_id) return false;
        if (filterPlayer) {
          const isP1 = m.p1?.nickname === filterPlayer || m.p1b?.nickname === filterPlayer;
          const isP2 = m.p2?.nickname === filterPlayer || m.p2b?.nickname === filterPlayer;
          if (!isP1 && !isP2) return false;
          if (filterResult !== "all") {
            const won = isP1 ? m.score1 > m.score2 : m.score2 > m.score1;
            if (filterResult === "win" && !won) return false;
            if (filterResult === "loss" && won) return false;
          }
        }
        if (filterDisc === "Doppel") { if (!isDoubles(m)) return false; }
        else if (filterDisc !== "all") { if (m.discipline !== filterDisc) return false; }
        const day = m.played_at.slice(0, 10);
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
        return true;
      })
      .sort((a, b) => new Date(b.played_at) - new Date(a.played_at));
  }, [matches, hideTournament, filterPlayer, filterResult, filterDisc, dateFrom, dateTo]);

  const visibleMatches = matchCount === "all" ? filteredMatches : filteredMatches.slice(0, matchCount);
  const filtersActive = !!(filterPlayer || filterDisc !== "all" || dateFrom || dateTo || hideTournament);
  const resetFilters = () => {
    setFilterPlayer(""); setFilterResult("all"); setFilterDisc("all"); setDateFrom(""); setDateTo("");
    setMatchCount(10); setHideTournament(false);
  };

  return (
    <div className="screen">
      <header className="screen-head"><h2>{t("Statistik")}</h2><span className="head-note">{t("Bestenlisten (bestaetigte Matches)")}</span></header>

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
      {/* Eigener, direkter Split-Kindknoten statt Teil von .stat-grid weiter
          unten (Nutzer-Feedback: Gesamt-Rangliste soll am Handy an erster
          Stelle stehen) - am Handy (Flex-Spalte, reine Quellreihenfolge)
          dadurch das ALLERERSTE sichtbare Element nach den Bestaetigungs-
          Bannern; am Desktop per explizitem grid-column/-row wieder an ihre
          gewohnte Position oben in der rechten Spalte zurueckgesetzt (siehe
          App.css) - dafuer muessen dort jetzt alle vier Split-Kinder
          explizit platziert werden statt sich auf die Grid-Auto-Platzierung
          zu verlassen (die haette sonst durch das neue, vorangestellte
          Element alle nachfolgenden Spalten verschoben). */}
      <div className="stat-ranking-col">
        <RankingBlock rangliste={rangliste} disciplines={disciplines} me={me}
          colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} />
      </div>

      <aside className="ov-side">
        {/* Wie auf Profil: dieselbe UserPanel-Konstante - am Handy
            ausgeblendet (Redundanz mit dem Profil-Tab), ab 900px sichtbar. */}
        <div className="ov-side-extra">
          <UserPanel nickname={me.nickname} matches={matches} rangliste={rangliste} players={players}
            challenges={challenges} catalog={catalog} earnedBadges={earnedBadges}
            colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} onInvite={onInvite} />
        </div>
      </aside>

      {/* Mittlere Spalte: der Graph und darunter die zuletzt gespielten
          Matches - der eigentliche Fokus dieser Seite. */}
      <div className="stat-chart-col">
      <EntwicklungBlock snapshots={snapshots} players={players} rangliste={rangliste} me={me} colorOf={colorOf} matches={matches} />

      <section className="stat-block">
        <h3><Swords size={17} /> {t("Letzte Matches")}</h3>
        <div className="match-filters">
          <PlayerPicker players={players} matches={matches} me={me} allowAll
            value={filterPlayer || null}
            onSelect={(nick) => { setFilterPlayer(nick || ""); setFilterResult("all"); }} />
          {filterPlayer && (
            <div className="chips small" style={{ marginBottom: 0 }}>
              {["all", "win", "loss"].map((r) => (
                <button key={r} className={"chip" + (filterResult === r ? " active" : "")} onClick={() => setFilterResult(r)}>
                  {r === "all" ? t("Alle") : r === "win" ? t("Siege") : t("Niederlagen")}
                </button>
              ))}
            </div>
          )}
          <div className="chips small" style={{ marginBottom: 0 }}>
            <button className={"chip" + (filterDisc === "all" ? " active" : "")} onClick={() => setFilterDisc("all")}>
              {t("Alle")}
            </button>
            {MATCH_DISCIPLINES.map((d) => (
              <button key={d} className={"chip" + (filterDisc === d ? " active" : "")} onClick={() => setFilterDisc(d)}>
                {t(d)}
              </button>
            ))}
          </div>
          <div className="chips small" style={{ marginBottom: 0 }}>
            <button className={"chip" + (hideTournament ? " active" : "")} onClick={() => setHideTournament((h) => !h)}>
              {t("Turniermatches ausblenden")}
            </button>
          </div>
          <div className="date-range">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label={t("Von")} />
            <span>{t("bis")}</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label={t("Bis")} />
          </div>
          {filtersActive && (
            <button className="btn ghost" style={{ marginTop: 0 }} onClick={resetFilters}>
              <X size={15} /> {t("Filter zurücksetzen")}
            </button>
          )}
        </div>

        <div className="stat-block-head">
          <p className="filter-count" style={{ marginBottom: 0 }}>
            {t("{shown} von {total} Matches", { shown: visibleMatches.length, total: filteredMatches.length })}
          </p>
          <div className="chips small">
            {MATCH_COUNT_OPTIONS.map((c) => (
              <button key={c} className={"chip" + (matchCount === c ? " active" : "")} onClick={() => setMatchCount(c)}>
                {c === "all" ? t("Alle") : c}
              </button>
            ))}
          </div>
        </div>

        {visibleMatches.map((m) => (
          <div key={m.id} className="match-row">
            <span className="m-date m-datetime">{fmtDateTime(m.played_at)}</span>
            <span className="m-txt">
              {sideNames(m, 1).map((n, i) => (
                <span key={n}>{i > 0 && " & "}<button className="name-link" onClick={() => onOpenProfile(n)}>{n}</button></span>
              ))}
              {" "}<b>{m.score1}:{m.score2}</b>{" "}
              {sideNames(m, 2).map((n, i) => (
                <span key={n}>{i > 0 && " & "}<button className="name-link" onClick={() => onOpenProfile(n)}>{n}</button></span>
              ))}
            </span>
            <span className="m-disc">{t(m.discipline)}{m.tournament_id ? " · 🏆" : ""}</span>
            {m.run_log?.length > 0 && (
              <button className="m-download" onClick={() => onOpenProtokoll(m)} aria-label={t("Protokoll ansehen")} title={t("Protokoll ansehen")}>
                <FileText size={15} />
              </button>
            )}
          </div>
        ))}
        {filteredMatches.length === 0 && (
          <p className="hint">{filtersActive ? t("Keine Matches fuer diese Filter.") : t("Noch keine bestaetigten Matches.")}</p>
        )}
      </section>
      </div>

      {/* Rechte Spalte: Live-Status, danach die drei reinen Bestenlisten
          ("alles andere") - die Rangliste selbst steht jetzt weiter oben als
          eigener .stat-ranking-col (siehe oben). */}
      <div className="stat-rest-col">
      <div className="stat-grid">
        <LiveStatusCard pings={pings} openChallengesToMe={openChallengesToMe} onGoToLive={onGoToLive} />
        <LeaderboardBlock icon={<Trophy size={17} />} title={t("Meiste Siege")} rows={topWins} me={me}
          fmt={(p) => `${p.siege} ${t("Siege")}`} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} />
        <LeaderboardBlock icon={<BarChart3 size={17} />} title={t("Beste Siegquote (ab 10 Spielen)")} rows={topQuote} me={me}
          fmt={(p) => `${p.quote} %`} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} />
        <LeaderboardBlock icon={<Flame size={17} />} title={t("Aktuelle Serien")} rows={topStreak} me={me}
          fmt={(p) => `${p.streak} ${t("in Folge")}`} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} />
      </div>
      </div>
      </div>
    </div>
  );
}
