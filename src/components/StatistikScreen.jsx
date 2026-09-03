import { useState, useMemo } from "react";
import { Trophy, BarChart3, Flame, Swords, X, FileText } from "lucide-react";
import { t } from "../lib/i18n";
import { computeStats } from "../lib/stats";
import { initials, fmtDateTime, sideNames, isDoubles } from "../lib/format";
import Ball from "./Ball";
import EntwicklungBlock from "./EntwicklungBlock";
import PlayerPicker from "./PlayerPicker";
import UserPanel from "./widgets/UserPanel";

const COUNT_OPTIONS = [3, 10, "all"];
const MATCH_COUNT_OPTIONS = [10, 20, 50, 100, "all"];
const MATCH_DISCIPLINES = ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos", "Doppel"];

// Eigene Komponente statt Definition innerhalb von StatistikScreen: sonst
// waere Block bei jedem Render der Eltern-Komponente eine neue Funktion,
// React wuerde sie als anderen Komponententyp behandeln und ihren
// useState (die gewaehlte Anzahl) jedes Mal verwerfen.
function LeaderboardBlock({ icon, title, rows, fmt, colorOf, badgeOf, photoOf, onOpenProfile }) {
  const [count, setCount] = useState(3);
  const visible = count === "all" ? rows : rows.slice(0, count);
  return (
    <section className="stat-block">
      <div className="stat-block-head">
        <h3>{icon} {title}</h3>
        <div className="chips small">
          {COUNT_OPTIONS.map((c) => (
            <button key={c} className={"chip" + (count === c ? " active" : "")} onClick={() => setCount(c)}>
              {c === "all" ? t("Alle") : `Top ${c}`}
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 && <p className="hint">{t("Noch keine Daten.")}</p>}
      {visible.map((p, i) => (
        <button key={p.name} className="stat-row as-btn" onClick={() => onOpenProfile(p.name)}>
          <span className="medal">{i + 1}.</span>
          <Ball color={colorOf(p.name)} label={initials(p.name)} badge={badgeOf(p.name)} photo={photoOf(p.name)} size={34} />
          <span className="stat-name">{p.name}</span>
          <span className="stat-val">{fmt(p)}</span>
        </button>
      ))}
    </section>
  );
}

export default function StatistikScreen({ matches, onOpenProfile, onOpenProtokoll, colorOf, badgeOf, photoOf, snapshots, players, rangliste, me, challenges, catalog, earnedBadges }) {
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

  const filteredMatches = useMemo(() => {
    return [...matches]
      .filter((m) => {
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
  }, [matches, filterPlayer, filterResult, filterDisc, dateFrom, dateTo]);

  const visibleMatches = matchCount === "all" ? filteredMatches : filteredMatches.slice(0, matchCount);
  const filtersActive = !!(filterPlayer || filterDisc !== "all" || dateFrom || dateTo);
  const resetFilters = () => {
    setFilterPlayer(""); setFilterResult("all"); setFilterDisc("all"); setDateFrom(""); setDateTo("");
    setMatchCount(10);
  };

  return (
    <div className="screen">
      <header className="screen-head"><h2>{t("Statistik")}</h2><span className="head-note">{t("Bestenlisten (bestaetigte Matches)")}</span></header>
      <div className="stat-split">
      <aside className="ov-side">
        {/* Wie auf Uebersicht/Profil: dieselbe UserPanel-Konstante - am
            Handy ausgeblendet (Redundanz mit dem Profil-Tab), ab 900px
            sichtbar. */}
        <div className="ov-side-extra">
          <UserPanel nickname={me.nickname} matches={matches} rangliste={rangliste} players={players}
            challenges={challenges} catalog={catalog} earnedBadges={earnedBadges}
            colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} />
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
            <span className="m-disc">{t(m.discipline)}</span>
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

      {/* Rechte Spalte: die drei Bestenlisten ("alles andere"). */}
      <div className="stat-rest-col">
      <div className="stat-grid">
        <LeaderboardBlock icon={<Trophy size={17} />} title={t("Meiste Siege")} rows={topWins}
          fmt={(p) => `${p.siege} ${t("Siege")}`} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} />
        <LeaderboardBlock icon={<BarChart3 size={17} />} title={t("Beste Siegquote (ab 10 Spielen)")} rows={topQuote}
          fmt={(p) => `${p.quote} %`} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} />
        <LeaderboardBlock icon={<Flame size={17} />} title={t("Aktuelle Serien")} rows={topStreak}
          fmt={(p) => `${p.streak} ${t("in Folge")}`} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} />
      </div>
      </div>
      </div>
    </div>
  );
}
