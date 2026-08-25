import { useState, useMemo } from "react";
import { Trophy, BarChart3, Flame, Swords, X } from "lucide-react";
import { t } from "../lib/i18n";
import { computeStats } from "../lib/stats";
import { initials, fmtDate, mSide } from "../lib/format";
import Ball from "./Ball";
import EntwicklungBlock from "./EntwicklungBlock";

const COUNT_OPTIONS = [3, 10, "all"];

// Eigene Komponente statt Definition innerhalb von StatistikScreen: sonst
// waere Block bei jedem Render der Eltern-Komponente eine neue Funktion,
// React wuerde sie als anderen Komponententyp behandeln und ihren
// useState (die gewaehlte Anzahl) jedes Mal verwerfen.
function LeaderboardBlock({ icon, title, rows, fmt, colorOf, badgeOf, onOpenProfile }) {
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
          <Ball color={colorOf(p.name)} label={initials(p.name)} badge={badgeOf(p.name)} size={34} />
          <span className="stat-name">{p.name}</span>
          <span className="stat-val">{fmt(p)}</span>
        </button>
      ))}
    </section>
  );
}

export default function StatistikScreen({ matches, onOpenProfile, colorOf, badgeOf, snapshots, players, rangliste, me }) {
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
        const day = m.played_at.slice(0, 10);
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
        return true;
      })
      .sort((a, b) => new Date(b.played_at) - new Date(a.played_at));
  }, [matches, filterPlayer, filterResult, dateFrom, dateTo]);

  const filtersActive = !!(filterPlayer || dateFrom || dateTo);
  const resetFilters = () => { setFilterPlayer(""); setFilterResult("all"); setDateFrom(""); setDateTo(""); };

  return (
    <div className="screen">
      <header className="screen-head"><h2>{t("Statistik")}</h2><span className="head-note">{t("Bestenlisten (bestaetigte Matches)")}</span></header>
      <EntwicklungBlock snapshots={snapshots} players={players} rangliste={rangliste} me={me} colorOf={colorOf} matches={matches} />
      <LeaderboardBlock icon={<Trophy size={17} />} title={t("Meiste Siege")} rows={topWins}
        fmt={(p) => `${p.siege} ${t("Siege")}`} colorOf={colorOf} badgeOf={badgeOf} onOpenProfile={onOpenProfile} />
      <LeaderboardBlock icon={<BarChart3 size={17} />} title={t("Beste Siegquote (ab 10 Spielen)")} rows={topQuote}
        fmt={(p) => `${p.quote} %`} colorOf={colorOf} badgeOf={badgeOf} onOpenProfile={onOpenProfile} />
      <LeaderboardBlock icon={<Flame size={17} />} title={t("Aktuelle Serien")} rows={topStreak}
        fmt={(p) => `${p.streak} ${t("in Folge")}`} colorOf={colorOf} badgeOf={badgeOf} onOpenProfile={onOpenProfile} />

      <section className="stat-block">
        <h3><Swords size={17} /> {t("Letzte Matches")}</h3>
        <div className="match-filters">
          <select className="settings-select" style={{ marginBottom: 0 }}
            value={filterPlayer} onChange={(e) => { setFilterPlayer(e.target.value); setFilterResult("all"); }}>
            <option value="">{t("Alle Spieler")}</option>
            {[...players].filter((p) => !p.is_ghost).sort((a, b) => a.nickname.localeCompare(b.nickname)).map((p) => (
              <option key={p.id} value={p.nickname}>{p.nickname}</option>
            ))}
          </select>
          {filterPlayer && (
            <div className="chips small" style={{ paddingBottom: 0 }}>
              {["all", "win", "loss"].map((r) => (
                <button key={r} className={"chip" + (filterResult === r ? " active" : "")} onClick={() => setFilterResult(r)}>
                  {r === "all" ? t("Alle") : r === "win" ? t("Siege") : t("Niederlagen")}
                </button>
              ))}
            </div>
          )}
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
        {filtersActive && (
          <p className="filter-count">{t("{n} Matches gefunden", { n: filteredMatches.length })}</p>
        )}
        {filteredMatches.map((m) => (
          <div key={m.id} className="match-row">
            <span className="m-date">{fmtDate(m.played_at).slice(0, 6)}</span>
            <span className="m-txt">{mSide(m, 1)} <b>{m.score1}:{m.score2}</b> {mSide(m, 2)}</span>
            <span className="m-disc">{t(m.discipline)}</span>
          </div>
        ))}
        {filteredMatches.length === 0 && (
          <p className="hint">{filtersActive ? t("Keine Matches fuer diese Filter.") : t("Noch keine bestaetigten Matches.")}</p>
        )}
      </section>
    </div>
  );
}
