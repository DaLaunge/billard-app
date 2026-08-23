import { useState, useEffect, useMemo } from "react";
import { TrendingUp, Plus, Search, X } from "lucide-react";
import { t } from "../lib/i18n";
import { dateMinusDays, todayStr } from "../lib/stats";
import DevChart from "./DevChart";

const RANGES = [
  { key: "1M", label: "1M", days: 31 },
  { key: "3M", label: "3M", days: 92 },
  { key: "6M", label: "6M", days: 183 },
  { key: "1J", label: "1J", days: 366 },
  { key: "ALL", label: "Alles", days: null },
];

export default function EntwicklungBlock({ snapshots, players, rangliste, me, colorOf, matches }) {
  const nickById = useMemo(() => {
    const m = {}; players.forEach((p) => { m[p.id] = p.nickname; }); return m;
  }, [players]);

  const gesamt = useMemo(() => rangliste.filter((r) => r.discipline === "Gesamt"), [rangliste]);

  const seriesByNick = useMemo(() => {
    const s = {};
    snapshots.forEach((r) => {
      const nick = nickById[r.player_id];
      if (!nick || !r.snap_date) return;
      (s[nick] ||= {})[r.snap_date] = r.rating;
    });
    // Kein Live-Overlay mehr: der Verlauf enthält den heutigen Tagespunkt bereits
    // aus dem Backfill. So läuft die Linie glatt (inkl. Inaktivitäts-Verfall) ohne Knick.
    return s;
  }, [snapshots, nickById]);

  const allDates = useMemo(() => {
    return [...new Set(snapshots.map((r) => r.snap_date).filter(Boolean))].sort();
  }, [snapshots]);
  const defaultSel = useMemo(() => {
    const names = gesamt.map((r) => r.nickname);
    const idx = names.indexOf(me.nickname);
    if (idx === -1) return names.slice(0, 5);
    const from = Math.max(0, idx - 2);
    return names.slice(from, from + 5);
  }, [gesamt, me]);

  // Wie oft habe ich gegen wen gespielt? (für Vorschläge)
  const freqByNick = useMemo(() => {
    const f = {};
    matches.forEach((m) => {
      if (m.player1b_id) return;
      let opp = null;
      if (m.p1.nickname === me.nickname) opp = m.p2.nickname;
      else if (m.p2.nickname === me.nickname) opp = m.p1.nickname;
      if (opp) f[opp] = (f[opp] || 0) + 1;
    });
    return f;
  }, [matches, me]);

  const [sel, setSel] = useState(defaultSel);
  const [rangeKey, setRangeKey] = useState("1J");
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => { setSel(defaultSel); }, [defaultSel]);

  const toggle = (nick) => {
    setSel((cur) => cur.includes(nick)
      ? cur.filter((x) => x !== nick)
      : (cur.length < 6 ? [...cur, nick] : cur));
  };

  const range = RANGES.find((r) => r.key === rangeKey) || RANGES.at(-1);
  const cutoff = range.days ? dateMinusDays(todayStr(), range.days) : null;
  const visibleDates = cutoff ? allDates.filter((d) => d >= cutoff) : allDates;

  const lines = sel
    .filter((nick) => seriesByNick[nick])
    .map((nick) => ({
      nickname: nick,
      color: colorOf(nick),
      points: visibleDates
        .map((dt, i) => (seriesByNick[nick][dt] != null ? { i, rating: seriesByNick[nick][dt] } : null))
        .filter(Boolean),
    }));

  // Vorschläge: erst häufigste Gegner, dann Rest – jeweils mit Verlaufsdaten & nicht gewählt
  const suggestions = useMemo(() => {
    const withData = players.map((p) => p.nickname).filter((n) => seriesByNick[n] && !sel.includes(n));
    const q = query.trim().toLowerCase();
    const filtered = q ? withData.filter((n) => n.toLowerCase().includes(q)) : withData;
    return filtered.sort((a, b) => (freqByNick[b] || 0) - (freqByNick[a] || 0) || a.localeCompare(b));
  }, [players, seriesByNick, sel, query, freqByNick]);

  const latest = (nick) => {
    const pts = seriesByNick[nick];
    if (!pts) return null;
    const dt = allDates.filter((w) => pts[w] != null).at(-1);
    return dt ? Math.round(pts[dt]) : null;
  };

  return (
    <section className="stat-block">
      <h3><TrendingUp size={17} /> {t("Entwicklung über die Zeit")}</h3>
      {allDates.length === 0 ? (
        <p className="hint">{t("Sobald Verlaufsdaten vorliegen, erscheinen hier die Kurven.")}</p>
      ) : (
        <>
          <div className="range-row">
            {RANGES.map((r) => (
              <button key={r.key} className={"range-btn" + (rangeKey === r.key ? " active" : "")}
                onClick={() => setRangeKey(r.key)}>{r.label}</button>
            ))}
          </div>
          <DevChart dates={visibleDates} lines={lines} />
          <div className="legend">
            {sel.map((nick) => (
              <button key={nick} className="legend-item" onClick={() => toggle(nick)} title="Entfernen">
                <span className="legend-dot" style={{ background: colorOf(nick) }} />
                {nick}{latest(nick) != null ? ` · ${latest(nick)}` : ""}
                <X size={12} />
              </button>
            ))}
          </div>

          {!addOpen ? (
            <button className="btn ghost" onClick={() => setAddOpen(true)}>
              <Plus size={16} /> {t("Spieler hinzufügen")}
            </button>
          ) : (
            <div className="add-panel">
              <div className="search-row">
                <Search size={16} className="mail-ico" />
                <input placeholder={t("Spieler suchen …")} value={query} autoFocus
                  onChange={(e) => setQuery(e.target.value)} />
                {query && <button className="clear-btn" onClick={() => setQuery("")}><X size={15} /></button>}
              </div>
              {!query && suggestions.length > 0 && (
                <p className="hint" style={{ marginTop: 0, marginBottom: 6 }}>
                  {t("Deine häufigsten Mitspieler zuerst:")}
                </p>
              )}
              <div className="cand-row">
                {suggestions.slice(0, 12).map((n) => (
                  <button key={n} className="cand-chip" onClick={() => toggle(n)}>
                    <Plus size={13} /> {n}{freqByNick[n] ? ` (${freqByNick[n]})` : ""}
                  </button>
                ))}
                {suggestions.length === 0 && <p className="hint">{t("Keine weiteren Spieler.")}</p>}
              </div>
              <button className="btn ghost" onClick={() => { setAddOpen(false); setQuery(""); }}>{t("Fertig")}</button>
            </div>
          )}
          <p className="hint">{t("Standardmäßig siehst du dich und deine direkten Nachbarn. Bis zu 6 Spieler, Zeitraum oben umschaltbar, zum Ablesen über den Graphen ziehen.")}</p>
        </>
      )}
    </section>
  );
}

