import { useMemo } from "react";
import { Trophy, BarChart3, Flame, Swords } from "lucide-react";
import { t } from "../lib/i18n";
import { computeStats } from "../lib/stats";
import { initials, fmtDate, mSide } from "../lib/format";
import Ball from "./Ball";
import EntwicklungBlock from "./EntwicklungBlock";

export default function StatistikScreen({ matches, onOpenProfile, colorOf, badgeOf, snapshots, players, rangliste, me }) {
  const stats = useMemo(() => computeStats(matches), [matches]);
  const list = Object.values(stats);
  const medals = ["1.", "2.", "3."];
  const topWins = [...list].sort((a, b) => b.siege - a.siege).slice(0, 3);
  const topQuote = [...list].filter((p) => p.spiele >= 10).sort((a, b) => b.quote - a.quote).slice(0, 3);
  const topStreak = [...list].filter((p) => p.streak > 0).sort((a, b) => b.streak - a.streak).slice(0, 3);
  const lastMatches = [...matches].sort((a, b) => new Date(b.played_at) - new Date(a.played_at)).slice(0, 10);

  const Block = ({ icon, title, rows, fmt }) => (
    <section className="stat-block">
      <h3>{icon} {title}</h3>
      {rows.length === 0 && <p className="hint">{t("Noch keine Daten.")}</p>}
      {rows.map((p, i) => (
        <button key={p.name} className="stat-row as-btn" onClick={() => onOpenProfile(p.name)}>
          <span className="medal">{medals[i]}</span>
          <Ball color={colorOf(p.name)} label={initials(p.name)} badge={badgeOf(p.name)} size={34} />
          <span className="stat-name">{p.name}</span>
          <span className="stat-val">{fmt(p)}</span>
        </button>
      ))}
    </section>
  );

  return (
    <div className="screen">
      <header className="screen-head"><h2>{t("Statistik")}</h2><span className="head-note">{t("Bestenlisten (bestaetigte Matches)")}</span></header>
      <EntwicklungBlock snapshots={snapshots} players={players} rangliste={rangliste} me={me} colorOf={colorOf} matches={matches} />
      <Block icon={<Trophy size={17} />} title={t("Meiste Siege")} rows={topWins} fmt={(p) => `${p.siege} ${t("Siege")}`} />
      <Block icon={<BarChart3 size={17} />} title={t("Beste Siegquote (ab 10 Spielen)")} rows={topQuote} fmt={(p) => `${p.quote} %`} />
      <Block icon={<Flame size={17} />} title={t("Aktuelle Serien")} rows={topStreak} fmt={(p) => `${p.streak} ${t("in Folge")}`} />
      <section className="stat-block">
        <h3><Swords size={17} /> {t("Letzte Matches")}</h3>
        {lastMatches.map((m) => (
          <div key={m.id} className="match-row">
            <span className="m-date">{fmtDate(m.played_at).slice(0, 6)}</span>
            <span className="m-txt">{mSide(m, 1)} <b>{m.score1}:{m.score2}</b> {mSide(m, 2)}</span>
            <span className="m-disc">{t(m.discipline)}</span>
          </div>
        ))}
        {lastMatches.length === 0 && <p className="hint">{t("Noch keine bestaetigten Matches.")}</p>}
      </section>
    </div>
  );
}
