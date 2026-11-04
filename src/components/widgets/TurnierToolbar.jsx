import { useState, useMemo } from "react";
import { Search, X, Check, UserPlus } from "lucide-react";
import { t } from "../../lib/i18n";
import { recentOpponentFreq } from "../../lib/frequency";
import { initials } from "../../lib/format";
import Ball from "../Ball";

/* Die Aktionsleiste ALLER Turniermodi (Winner Stays, Raster-Formate in Anmeldung, laufend, beendet): gleich grosse Symbolknoepfe unter dem
   Turniernamen - Einladungs-QR, Bildschirm an, Spieler hinzufuegen, Start/Ende, Loeschen usw. Welche Knoepfe es gibt, entscheidet der
   Aufrufer; Aussehen und Abstaende kommen aus .head-actions (App.css), damit kein Modus eine eigene Variante baut. Der Name steht nur im
   title/aria-label (Symbole statt Text). */
export function TurnierToolbar({ children }) {
  return <div className="head-actions">{children}</div>;
}

// active = der Knopf haelt etwas offen (z. B. das Spieler-Panel) und ist dann in der Akzentfarbe.
export function ToolBtn({ icon: Icon, label, onClick, disabled, active, size = 20, className = "" }) {
  return (
    <button type="button" className={"icon-btn" + (active ? " on" : "") + (className ? " " + className : "")} disabled={disabled}
      onClick={onClick} aria-label={label} title={label} aria-pressed={active == null ? undefined : !!active}>
      <Icon size={size} />
    </button>
  );
}

// Aufklappbares Panel unter der Kopfzeile (.collapsible animiert die unbekannte Hoehe; geschlossen ist es per inert aus dem Tab-Weg).
export function ToolPanel({ open, children }) {
  return (
    <div className={"collapsible tool-panel" + (open ? " open" : "")} inert={open ? undefined : ""}>
      <div className="collapsible-inner"><section className="stat-block tool-panel-card">{children}</section></div>
    </div>
  );
}

/* Spieler hinzufuegen: die Suche ist der Hauptweg, darunter stehen die haeufigsten Mitspieler als Vorschlaege (ein Tipp waehlt, ein zweiter
   nimmt zurueck). Gewaehlte bleiben sichtbar, auch wenn die Suche sie ausblendet. Findet die Suche kein Mitglied mit genau diesem Namen,
   steht der getippte Name als Gast zur Wahl (Personen ohne App). Enter waehlt den ersten Treffer. onAdd(ids) / onAddGuest(name) liefern
   true bei Erfolg; erst dann wird die Auswahl geleert. */
export function QuickAddPlayers({ players, matches, me, exclude = [], colorOf, badgeOf, photoOf, busy, onAdd, onAddGuest, suggestions = 8, team = false }) {
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState([]);
  const freq = useMemo(() => recentOpponentFreq(matches, me), [matches, me]);
  const q = query.trim().toLowerCase();
  // Im Doppel (team) legt "Gast hinzufuegen" noch nichts an, sondern liefert die Gast-Person zurueck: sie wird hier gemerkt und gleich
  // als Teampartner gewaehlt (die Spielerliste der App kennt Gaeste nicht).
  const [extra, setExtra] = useState([]);
  const pool = [...players.filter((p) => !p.is_ghost && !p.is_guest && !p.blocked && !exclude.includes(p.id)), ...extra.filter((g) => !exclude.includes(g.id))];
  const rank = (a, b) => (freq[b.nickname] || 0) - (freq[a.nickname] || 0) || a.nickname.localeCompare(b.nickname);
  const found = q
    ? pool.filter((p) => p.nickname.toLowerCase().includes(q))
      .sort((a, b) => (b.nickname.toLowerCase().startsWith(q) ? 1 : 0) - (a.nickname.toLowerCase().startsWith(q) ? 1 : 0) || rank(a, b))
    : [...pool].sort(rank);
  const shown = found.slice(0, q ? 12 : suggestions);
  const pinned = sel.map((id) => pool.find((p) => p.id === id)).filter(Boolean);
  const list = [...pinned, ...shown.filter((p) => !sel.includes(p.id))];
  const showGuest = !!onAddGuest && !!q && !pool.some((p) => p.nickname.toLowerCase() === q);
  // team: genau zwei Personen bilden ein Team - eine dritte Wahl ersetzt die aeltere, so bleibt die Auswahl immer ein Paar.
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : team ? [...s, id].slice(-2) : [...s, id]));
  const submit = async () => { if (sel.length && (await onAdd(sel))) { setSel([]); setQuery(""); } };
  const submitGuest = async () => {
    const r = await onAddGuest(query.trim());
    if (!r) return;
    if (team && r.id) {
      setExtra((e) => [...e.filter((x) => x.id !== r.id), r]);
      setSel((s) => (s.includes(r.id) ? s : [...s, r.id].slice(-2)));
    }
    setQuery("");
  };
  const onKey = (e) => {
    if (e.key !== "Enter" || !q) return;
    e.preventDefault();
    if (shown.length) { toggle(shown[0].id); setQuery(""); } else if (showGuest) submitGuest();
  };
  return (
    <div className="quick-add">
      <div className="search-row">
        <Search size={16} className="mail-ico" />
        <input placeholder={t("Spieler suchen oder Gast eingeben …")} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} />
        {query && <button type="button" className="clear-btn" onClick={() => setQuery("")} aria-label={t("Löschen")}><X size={15} /></button>}
      </div>
      {!q && list.length > 0 && <p className="hint quick-add-label">{t("Vorschläge")}</p>}
      {list.length > 0 && (
        <div className="pmp-grid quick-add-grid">
          {list.map((p) => {
            const on = sel.includes(p.id);
            return (
              <button key={p.id} type="button" className={"pmp-chip" + (on ? " sel" : "")} onClick={() => toggle(p.id)} aria-pressed={on}>
                <Ball nick={p.nickname} color={colorOf(p.nickname)} label={initials(p.nickname)} badge={badgeOf(p.nickname)} photo={photoOf(p.nickname)} size={32} />
                <span className="pmp-name">{p.nickname}</span>
                {on && <Check size={15} className="pmp-check" />}
              </button>
            );
          })}
        </div>
      )}
      {q && found.length === 0 && !showGuest && <p className="hint">{t("Kein Spieler gefunden.")}</p>}
      {showGuest && (
        <button type="button" className="btn ghost quick-add-guest" disabled={busy} onClick={submitGuest}>
          <UserPlus size={15} /> {t("Gast \"{name}\" hinzufügen", { name: query.trim() })}
        </button>
      )}
      {team && (
        <div className="quick-add-team" aria-live="polite">
          {[0, 1].map((i) => {
            const p = pinned[i];
            return p
              ? <span key={p.id} className="quick-add-team-slot"><Ball nick={p.nickname} color={colorOf(p.nickname)} label={initials(p.nickname)} badge={badgeOf(p.nickname)} photo={photoOf(p.nickname)} size={28} /><b>{p.nickname}</b></span>
              : <span key={i} className="quick-add-team-slot empty">{i === 0 ? t("Erste Person") : t("Zweite Person")}</span>;
          })}
        </div>
      )}
      <button type="button" className="btn primary quick-add-go" disabled={busy || (team ? sel.length !== 2 : sel.length === 0)} onClick={submit}>
        <Check size={15} /> {team ? t("Team hinzufügen") : t("{n} Spieler hinzufügen", { n: sel.length })}
      </button>
    </div>
  );
}
