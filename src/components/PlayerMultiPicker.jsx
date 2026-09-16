import { useState, useMemo } from "react";
import { Search, X, Check, UserPlus } from "lucide-react";
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
export default function PlayerMultiPicker({ players, matches, me, selected, onToggle, colorOf, badgeOf, photoOf, exclude = [], onQueryChange, placeholder, onCreateGuest }) {
  const [query, setQuery] = useState("");
  const updateQuery = (q) => { setQuery(q); onQueryChange && onQueryChange(q); };

  const freqByKey = useMemo(() => recentOpponentFreq(matches, me), [matches, me]);

  const candidates = useMemo(() => {
    const pool = players.filter((p) => !p.is_ghost && !p.is_guest && !p.blocked && !exclude.includes(p.id));
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
        <input placeholder={placeholder || t("Spieler suchen …")} value={query} onChange={(e) => updateQuery(e.target.value)} />
        {query && <button className="clear-btn" onClick={() => updateQuery("")}><X size={15} /></button>}
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
      {/* Nutzer-Feedback: "hier sollte bereits ein Gast-User vorgeschlagen
          werden, weil es den user nicht im System gibt" - findet die Suche
          niemanden, direkt anbieten, den getippten Namen als Gast (ohne App/
          Login) anzulegen, statt separat zu einem eigenen Gast-Formular
          wechseln zu muessen. Nur sichtbar, wenn der Aufrufer das ueberhaupt
          unterstuetzt (onCreateGuest gesetzt, siehe WinnerStaysScreen.jsx). */}
      {candidates.length === 0 && query.trim() && onCreateGuest && (
        <button type="button" className="btn ghost" style={{ marginTop: 10 }} onClick={() => onCreateGuest(query.trim())}>
          <UserPlus size={15} /> {t("Gast \"{name}\" hinzufügen", { name: query.trim() })}
        </button>
      )}
    </div>
  );
}
