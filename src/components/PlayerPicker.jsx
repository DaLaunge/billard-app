import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { t } from "../lib/i18n";

/* Zeitfenster fuer "haeufigste Mitspieler in letzter Zeit", von eng nach weit:
   erstes Fenster mit genug Matches gewinnt. Trifft keines die Schwelle, zaehlt
   die gesamte Historie (Infinity) – gibt es ueberhaupt keine gemeinsamen
   Matches, bleibt freqByKey leer und die Sortierung faellt automatisch auf
   alphabetisch zurueck. */
const RECENT_WINDOWS_DAYS = [90, 180, 365, Infinity];
const MIN_SIGNIFICANT_MATCHES = 3;

/* Wiederverwendbarer Spieler-Auswahl: Trigger-Button klappt ein Suchfeld +
   Vorschlags-Chips auf (haeufigste Mitspieler mit `me` zuerst), statt einer
   langen <select>-Dropdown. Ersetzt alle Spieler-Dropdowns der App. */
export default function PlayerPicker({
  players, matches, me, value, onSelect, getKey = (p) => p.nickname,
  placeholder, allowAll = false, exclude = [], maxSuggestions = 8,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDocClick); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  const freqByKey = useMemo(() => {
    if (!me) return {};
    const now = Date.now();
    for (const days of RECENT_WINDOWS_DAYS) {
      const cutoff = days === Infinity ? 0 : now - days * 86400000;
      const f = {};
      let total = 0;
      (matches || []).forEach((m) => {
        if (m.player1b_id) return;
        if (new Date(m.played_at).getTime() < cutoff) return;
        let opp = null;
        if (m.p1?.nickname === me.nickname) opp = m.p2?.nickname;
        else if (m.p2?.nickname === me.nickname) opp = m.p1?.nickname;
        if (opp) { f[opp] = (f[opp] || 0) + 1; total++; }
      });
      if (total >= MIN_SIGNIFICANT_MATCHES || days === Infinity) return f;
    }
    return {};
  }, [matches, me]);

  const candidates = useMemo(() => {
    const pool = players.filter((p) => !p.is_ghost && !exclude.includes(getKey(p)));
    const q = query.trim().toLowerCase();
    const filtered = q ? pool.filter((p) => p.nickname.toLowerCase().includes(q)) : pool;
    const sorted = [...filtered].sort(
      (a, b) => (freqByKey[b.nickname] || 0) - (freqByKey[a.nickname] || 0) || a.nickname.localeCompare(b.nickname)
    );
    return q ? sorted : sorted.slice(0, maxSuggestions);
  }, [players, query, freqByKey, exclude, getKey, maxSuggestions]);

  const selected = players.find((p) => value && getKey(p) === value);
  const label = selected ? selected.nickname : (allowAll ? t("Alle Spieler") : (placeholder || t("Spieler wählen")));

  const pick = (key) => { onSelect(key); setQuery(""); setOpen(false); };

  return (
    <div className="player-picker" ref={boxRef}>
      <button type="button" className={"pp-trigger" + (selected ? " has-value" : "")} onClick={() => setOpen((o) => !o)}>
        <span>{label}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="pp-panel">
          <div className="search-row">
            <Search size={16} className="mail-ico" />
            <input placeholder={t("Spieler suchen …")} value={query} autoFocus
              onChange={(e) => setQuery(e.target.value)} />
            {query && <button className="clear-btn" onClick={() => setQuery("")}><X size={15} /></button>}
          </div>
          {!query && <p className="hint" style={{ marginTop: 0, marginBottom: 6 }}>{t("Häufigste Mitspieler zuerst:")}</p>}
          <div className="cand-row">
            {allowAll && !query && (
              <button className={"cand-chip" + (!value ? " sel" : "")} onClick={() => pick(null)}>
                {t("Alle Spieler")}
              </button>
            )}
            {candidates.map((p) => (
              <button key={p.id} className={"cand-chip" + (value === getKey(p) ? " sel" : "")} onClick={() => pick(getKey(p))}>
                {p.nickname}{freqByKey[p.nickname] ? ` (${freqByKey[p.nickname]})` : ""}
              </button>
            ))}
            {candidates.length === 0 && <p className="hint">{t("Kein Spieler gefunden.")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
