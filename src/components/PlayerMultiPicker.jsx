import { useState, useMemo } from "react";
import { Search, X, Check } from "lucide-react";
import { t } from "../lib/i18n";
import { recentOpponentFreq } from "../lib/frequency";
import { initials } from "../lib/format";
import Ball from "./Ball";

// Mehrfachauswahl im selben Stil wie PlayerPicker.jsx (Suchfeld + nach
// Haeufigkeit sortierte Vorschlaege), aber mit Avataren und ohne
// zuklappendes Dropdown - man waehlt hier typischerweise viele Spieler
// nacheinander (Turnier-Teilnehmer), nicht nur einen. Bereits ausgewaehlte
// bleiben oben angeheftet sichtbar, damit man die aktuelle Auswahl auf
// einen Blick ueberprueft, statt sie in der Liste suchen zu muessen.
export default function PlayerMultiPicker({ players, matches, me, selected, onToggle, colorOf, badgeOf, photoOf, exclude = [] }) {
  const [query, setQuery] = useState("");

  const freqByKey = useMemo(() => recentOpponentFreq(matches, me), [matches, me]);

  const candidates = useMemo(() => {
    const pool = players.filter((p) => !p.is_ghost && !p.blocked && !exclude.includes(p.id));
    const q = query.trim().toLowerCase();
    const filtered = q ? pool.filter((p) => p.nickname.toLowerCase().includes(q)) : pool;
    return [...filtered].sort((a, b) => {
      const aSel = selected.includes(a.id), bSel = selected.includes(b.id);
      if (aSel !== bSel) return aSel ? -1 : 1;
      return (freqByKey[b.nickname] || 0) - (freqByKey[a.nickname] || 0) || a.nickname.localeCompare(b.nickname);
    });
  }, [players, query, freqByKey, exclude, selected]);

  return (
    <div className="player-multi-picker">
      <div className="search-row">
        <Search size={16} className="mail-ico" />
        <input placeholder={t("Spieler suchen …")} value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && <button className="clear-btn" onClick={() => setQuery("")}><X size={15} /></button>}
      </div>
      {!query && <p className="hint" style={{ marginTop: 0, marginBottom: 6 }}>{t("Häufigste Mitspieler zuerst:")}</p>}
      <div className="pmp-grid">
        {candidates.map((p) => {
          const isSel = selected.includes(p.id);
          return (
            <button key={p.id} type="button" className={"pmp-chip" + (isSel ? " sel" : "")} onClick={() => onToggle(p.id)}>
              <Ball color={colorOf(p.nickname)} label={initials(p.nickname)} badge={badgeOf(p.nickname)} photo={photoOf(p.nickname)} size={32} />
              <span className="pmp-name">{p.nickname}</span>
              {isSel && <Check size={15} className="pmp-check" />}
            </button>
          );
        })}
        {candidates.length === 0 && <p className="hint">{t("Kein Spieler gefunden.")}</p>}
      </div>
    </div>
  );
}
