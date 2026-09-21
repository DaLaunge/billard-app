import { useState, useMemo, useEffect } from "react";
import { Trophy, BarChart3, Flame, X, FileText, Check, Clock, SlidersHorizontal, Zap, Timer, Star, History, ChevronsDown, ChevronsUp, Undo2 } from "lucide-react";
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { t } from "../lib/i18n";
import { computeStats } from "../lib/stats";
import { computeAchievementExtras } from "../lib/achievements";
import { initials, fmtDate, fmtDateTime, fmtDuration, isDoubles, mSide, sideNames } from "../lib/format";
import { computeSpeedStats, matchDurationMs, matchPlayTimeMs } from "../lib/runLog";
import { DISC_LABEL } from "../lib/constants";
import { STAT_CARD_SCREEN, normalizeCardOrder, normalizeCardColumns, splitCardColumns, mergeCardLayout } from "../lib/cardLayout";
import { useHiddenCards } from "../lib/useHiddenCards";
import Ball from "./Ball";
import EntwicklungBlock from "./EntwicklungBlock";
import PlayerPicker from "./PlayerPicker";
import UserPanel from "./widgets/UserPanel";
import DecayBadge from "./widgets/DecayBadge";
import InfoButton from "./widgets/InfoButton";
import ImprintFooter from "./widgets/ImprintFooter";
import TournamentFlag from "./TournamentFlag";
import SortableCard from "./widgets/SortableCard";
import CardCollapseButton from "./widgets/CardCollapseButton";
import CardMenuButton from "./widgets/CardMenuButton";
import ShowAllCardsButton from "./widgets/ShowAllCardsButton";
import CardColumnButton from "./widgets/CardColumnButton";
import EmptyColumnDropZone from "./widgets/EmptyColumnDropZone";

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];
const COUNT_OPTIONS = [3, 10, "all"];
const MATCH_COUNT_OPTIONS = [10, 20, 50, 100, "all"];
const MATCH_DISCIPLINES = ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos", "Doppel"];
// Feste ids der beiden EmptyColumnDropZone-Ablageflaechen (siehe dort) -
// koennen keine echte Karten-id ueberschneiden, da Karten-ids aus
// cardLayout.js kommen.
const EMPTY_MIDDLE_DROP_ID = "middle-empty";
const EMPTY_RIGHT_DROP_ID = "right-empty";

// rectSortingStrategy() geht von EINER durchgehenden Liste aus: es simuliert
// ein arrayMove() ueber ALLE Karten hinweg und verschiebt darauf basierend
// jede dazwischenliegende Karte optisch. Beim Ziehen INNERHALB einer Spalte
// passt das genau (siehe items-Kommentar bei SortableContext weiter unten).
// Beim Ziehen UEBER die Spaltengrenze hinweg wuerde diese Simulation aber
// auch Karten der jeweils ANDEREN, unbeteiligten Spalte optisch verschieben
// (Nutzer-Feedback: "wenn ich von rechts nach links schiebe, zeigt die
// Animation, dass eine Karte nach rechts verschoben wird, obwohl sie nach
// dem Loslassen trotzdem in der Mitte bleibt" - die Daten waren immer schon
// richtig, nur die Voransicht waehrend des Ziehens log).
//
// Ein erster Versuch liess beim Spaltenwechsel dafuer JEDE andere Karte
// unbewegt (return null) - das vermied die falsche Voransicht, aber ohne
// jede Reaktion beim Ziehen wirkte das Ziehen selbst wie kaputt (Nutzer-
// Feedback: "jetzt funktioniert der Drag and Drop zwar perfekt in der
// Mitte, aber ich kann nichts mehr nach rechts drag and droppen"). Diese
// Version berechnet die Voransicht stattdessen GETRENNT je Spalte: die
// Herkunftsspalte verhaelt sich wie ein reines Entfernen (alle Karten nach
// der gezogenen ruecken um deren Groesse zurueck), die Zielspalte wie ein
// reines Einfuegen von aussen (alle Karten ab der Zielposition ruecken um
// dieselbe Groesse weiter) - beide unabhaengig voneinander, nie ueber die
// eigene Spalte hinaus. Keine Karte bekommt dadurch je einen Transform, der
// so aussieht, als wechsle SIE die Spalte (das darf laut Design, siehe
// cardLayout.js Stufe 4, ausschliesslich die gezogene Karte selbst).
const STAT_CARD_GAP = 16; // entspricht --card-gap in App.css
function statCardSortingStrategy(middleCount) {
  const groupOf = (i) => (i < middleCount ? "middle" : "right");
  return (args) => {
    const { rects, activeIndex, overIndex, index } = args;
    if (activeIndex === -1 || overIndex === -1) return null;
    const activeGroup = groupOf(activeIndex);
    const overGroup = groupOf(overIndex);
    if (activeGroup === overGroup) return rectSortingStrategy(args);
    if (index === activeIndex) return null;
    const myGroup = groupOf(index);
    if (myGroup !== activeGroup && myGroup !== overGroup) return null;
    const activeRect = rects[activeIndex];
    if (!activeRect) return null;
    const shift = activeRect.height + STAT_CARD_GAP;
    if (myGroup === activeGroup) return index > activeIndex ? { x: 0, y: -shift, scaleX: 1, scaleY: 1 } : null;
    return index >= overIndex ? { x: 0, y: shift, scaleX: 1, scaleY: 1 } : null;
  };
}

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
function LeaderboardBlock({ icon, title, rows, fmt, colorOf, badgeOf, photoOf, onOpenProfile, me, count, nearby, info, collapsed, onToggleCollapse, column, onToggleColumn, onHide }) {
  const myIndex = rows.findIndex((p) => p.name === me?.nickname);
  const showNearby = nearby && myIndex >= 0;
  const sliceStart = showNearby ? Math.max(0, myIndex - 2) : 0;
  const visible = showNearby ? rows.slice(sliceStart, myIndex + 3) : (count === "all" ? rows : rows.slice(0, count));
  const myRowShown = showNearby || count === "all" || (myIndex >= 0 && myIndex < count);
  const pinMyRow = myIndex >= 0 && !myRowShown;
  return (
    <section className="stat-block">
      <div className="stat-block-head">
        <h3>{icon} <span className="stat-block-title-text">{title}</span></h3>
        <div className="stat-block-head-actions">
          <CardMenuButton onHide={onHide} />
          {info && <InfoButton title={title}>{info}</InfoButton>}
          <CardColumnButton column={column} onToggle={onToggleColumn} />
          <CardCollapseButton collapsed={collapsed} onToggle={onToggleCollapse} />
        </div>
      </div>
      {!collapsed && (
        <>
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
        </>
      )}
    </section>
  );
}

// Die fruehere eigene "Uebersicht"/Rangliste-Seite: hier als weiterer
// Bestenlisten-Block eingegliedert (gleiches Muster wie "Meiste Siege" &
// Co.). disc/count/nearby kommen ebenfalls von der globalen Auswahl.
function RankingBlock({ rangliste, disc, count, nearby, colorOf, badgeOf, photoOf, onOpenProfile, me, collapsed, onToggleCollapse, column, onToggleColumn, onHide }) {
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
        <h3><Trophy size={17} /> <span className="stat-block-title-text">{t("Rangliste")}</span></h3>
        <div className="stat-block-head-actions">
          <CardMenuButton onHide={onHide} />
          <InfoButton title={t("Rangliste")}>
            {t("Rating nach einem Fargo-ähnlichen Elo-System: mehr Punkte = besser, 100 Punkte Unterschied entsprechen ungefähr einer Gewinnchance von 2:1. Ohne bestätigtes Match bewegt sich das Rating mit der Zeit wieder Richtung 500 (Startwert). Unter 10 Spielen gilt ein Rating als vorläufig, ohne Match seit 180 Tagen als inaktiv.")}
          </InfoButton>
          <CardColumnButton column={column} onToggle={onToggleColumn} />
          <CardCollapseButton collapsed={collapsed} onToggle={onToggleCollapse} />
        </div>
      </div>
      {!collapsed && (
        <>
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
function StatGlobalFilter({ disc, disciplines, onDisc, count, nearby, onCount, onNearby, me, colorOf, badgeOf, photoOf, collapsed, onToggleCollapse, onExpandAll, onCollapseAll, canUndo, onUndo, column, onToggleColumn, onHide }) {
  return (
    <section className="stat-block stat-global-filter">
      <div className="stat-block-head">
        <h3><SlidersHorizontal size={17} /> <span className="stat-block-title-text">{t("Auswahl fuer alle Statistiken")}</span></h3>
        <div className="stat-block-head-actions">
          <CardMenuButton onHide={onHide} />
          <CardColumnButton column={column} onToggle={onToggleColumn} />
          <CardCollapseButton collapsed={collapsed} onToggle={onToggleCollapse} />
        </div>
      </div>
      {/* Nutzer-Feedback: "es fehlt der Button für 'alles ausklappen' und
          'alles zuklappen'" - bewusst AUSSERHALB von "{!collapsed && ...}":
          klappt man diese Karte selbst zu (oder per "Alle zuklappen"), muss
          "Alle aufklappen" trotzdem erreichbar bleiben, sonst gibt es keinen
          Weg mehr zurueck ausser jede Karte einzeln aufzuklappen. */}
      <div className="chips small" style={{ marginBottom: collapsed ? 0 : 8 }}>
        <button className="chip" onClick={onExpandAll}>
          <ChevronsDown size={14} /> {t("Alle aufklappen")}
        </button>
        <button className="chip" onClick={onCollapseAll}>
          <ChevronsUp size={14} /> {t("Alle zuklappen")}
        </button>
        {/* Nutzer-Feedback: "vergiss nicht, einen Rückgängig Button zu
            implementieren" - seit die Spaltenwahl nicht mehr automatisch
            passiert (siehe cardLayout.js), sondern jede Karte einzeln per
            Knopf umgestellt wird, ist ein Fehlklick leichter moeglich als
            vorher. Ein Schritt Rueckgaengig (kein ganzer Verlauf) genuegt
            dafuer - deaktiviert, solange es nichts rueckgaengig zu machen
            gibt, aus demselben Grund immer sichtbar wie "Alle zuklappen". */}
        <button className="chip" onClick={onUndo} disabled={!canUndo}>
          <Undo2 size={14} /> {t("Rückgängig")}
        </button>
      </div>
      {!collapsed && (
        <>
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
        </>
      )}
    </section>
  );
}

// Club-weite Rekorde statt der eigenen Zahlen (siehe RecordsCard.jsx im
// Profil) - fuer jede Kennzahl wird gezeigt, WER sie gerade haelt, nicht
// nur "wie viel". Als Tabelle statt gestapelter Karten-Zeilen (Nutzer-
// Feedback: "Alle Informationen in einer Zeile. Die Tabelle soll in der
// Breite immer gleich sein.") - feste Spaltenbreiten per <colgroup> plus
// table-layout:fixed halten die Tabellenbreite konstant, ein zu langer
// Name/Wert bricht per Zeilenvorschub INNERHALB seiner Zelle um (siehe
// .records-table in App.css) statt die Spalten zu verschieben. Bei type
// "match" (Schnellstes/Laengstes Match) stehen beide beteiligten Spieler
// in der Halter-Zelle, da so ein Rekord nicht EINER Person allein gehoert.
// Eintraege ohne Halter (noch keine Daten) werden ausgeblendet statt eine
// leere/falsche Zeile zu zeigen.
// Ergebnisse wie "658:258" haben keine Leerzeichen, an denen ein Zeilen-
// umbruch natuerlich ansetzen koennte - ohne Hilfe bricht der Browser
// mitten in der Zahl (z.B. "658:25" / "8"). Ein unsichtbares Zero-Width-
// Space nach dem Doppelpunkt gibt dem Browser dort einen sauberen, sonst
// visuell unsichtbaren Umbruchpunkt.
const breakableValue = (val) => (typeof val === "string" ? val.replace(/:/g, ":​") : val);

function RecordsBoard({ records, colorOf, badgeOf, photoOf, onOpenProfile, onOpenProtokoll, collapsed, onToggleCollapse, column, onToggleColumn, onHide }) {
  const shown = records.filter((r) => r.holder);
  return (
    <section className="stat-block">
      <div className="stat-block-head">
        <h3><Star size={17} /> <span className="stat-block-title-text">{t("Rekorde")}</span></h3>
        <div className="stat-block-head-actions">
          <CardMenuButton onHide={onHide} />
          <InfoButton title={t("Rekorde")}>
            {t("Aktuelle Bestwerte der gesamten Gruppe - wer hält gerade welchen Rekord? Jede Zeile hat rechts ihr eigenes Info-Symbol mit genauerer Erklärung (und, wenn vorhanden, dem zugehörigen Match-Protokoll).")}
          </InfoButton>
          <CardColumnButton column={column} onToggle={onToggleColumn} />
          <CardCollapseButton collapsed={collapsed} onToggle={onToggleCollapse} />
        </div>
      </div>
      {!collapsed && shown.length === 0 && <p className="hint">{t("Noch keine Rekorde.")}</p>}
      {!collapsed && shown.length > 0 && (
        <table className="records-table">
          <colgroup>
            <col className="rt-col-label" />
            <col className="rt-col-holder" />
            <col className="rt-col-value" />
            <col className="rt-col-info" />
          </colgroup>
          <tbody>
            {shown.map(({ key, label, holder, fmt, type, info, matchRef }) => {
              const hasProtokoll = matchRef && (matchRef.run_log?.length > 0 || matchRef.tournament_id);
              return (
                <tr key={key}>
                  <td className="rt-label">{label}</td>
                  <td className="rt-holder">
                    {type === "match" ? (
                      <span className="rt-match">
                        <span className="rt-match-names">
                          <button className="name-link" onClick={() => onOpenProfile(holder.p1Name)}>{holder.p1Name}</button>
                          {" vs. "}
                          <button className="name-link" onClick={() => onOpenProfile(holder.p2Name)}>{holder.p2Name}</button>
                        </span>
                        <span className="rt-match-disc">{t(holder.discipline)}</span>
                      </span>
                    ) : (
                      <button className="rt-holder-btn" onClick={() => onOpenProfile(holder.name)}>
                        <Ball color={colorOf(holder.name)} label={initials(holder.name)} badge={badgeOf(holder.name)} photo={photoOf(holder.name)} size={26} />
                        <span className="rt-name">{holder.name}</span>
                      </button>
                    )}
                  </td>
                  <td className="rt-value">{breakableValue(fmt(holder))}</td>
                  <td className="rt-info">
                    {info && (
                      <InfoButton title={label}
                        actionLabel={hasProtokoll ? t("Protokoll ansehen") : undefined}
                        onAction={hasProtokoll ? () => onOpenProtokoll(matchRef) : undefined}>
                        {info}
                      </InfoButton>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

// Spielehistorie: war urspruenglich Teil dieser Seite, wanderte bei der
// Nav-Umstellung (Uebersicht+Statistik -> Statistik, Live bekam eigenen
// Fokus) komplett in den Live-Tab - Nutzer-Feedback holte sie explizit
// wieder zurueck ("wo ist die Spielehistorie verschwunden? Ich wollte sie
// in den Statistiken in der mittleren Spalte ganz unten haben"), diesmal
// dauerhaft hier statt zusaetzlich auf Live dupliziert. Eigene Komponente
// aus demselben Grund wie LeaderboardBlock/RecordsBoard oben: sonst
// verliert ihr lokaler Filter-State bei jedem Render der Eltern-
// Komponente seine Identitaet.
function MatchHistoryBlock({ matches, players, me, onOpenProfile, onOpenProtokoll, collapsed, onToggleCollapse, column, onToggleColumn, onHide }) {
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
        if (hideTournament && (m.tournament_id || m.winner_stays_session_id)) return false;
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
    <section className="stat-block">
      <div className="stat-block-head">
        <h3><History size={17} /> <span className="stat-block-title-text">{t("Letzte Matches")}</span></h3>
        <div className="stat-block-head-actions">
          <CardMenuButton onHide={onHide} />
          <CardColumnButton column={column} onToggle={onToggleColumn} />
          <CardCollapseButton collapsed={collapsed} onToggle={onToggleCollapse} />
        </div>
      </div>
      {!collapsed && (
      <>
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
              {t(DISC_LABEL[d] || d)}
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
          <span className="m-disc">{t(m.discipline)}</span>
          <TournamentFlag match={m} />
          {/* Nutzer-Feedback: der "?"-Notiz-Button (siehe MatchProtokollScreen.jsx)
              war unerreichbar, weil dieser Link zur Protokoll-Ansicht bisher nur
              bei VORHANDENEM run_log erschien - genau dort, wo eine
              Turnierleitungs-Schnelleingabe (also KEIN run_log) am ehesten eine
              Notiz braucht, kam man gar nicht erst hin. Bei Turniermatches
              deshalb auch ohne run_log anzeigen. */}
          {(m.run_log?.length > 0 || m.tournament_id) && (
            <button className="m-download" onClick={() => onOpenProtokoll(m)} aria-label={t("Protokoll ansehen")} title={t("Protokoll ansehen")}>
              <FileText size={15} />
            </button>
          )}
        </div>
      ))}
      {filteredMatches.length === 0 && (
        <p className="hint">{filtersActive ? t("Keine Matches fuer diese Filter.") : t("Noch keine bestaetigten Matches.")}</p>
      )}
      </>
      )}
    </section>
  );
}

export default function StatistikScreen({ matches, onOpenProfile, onOpenProtokoll, colorOf, badgeOf, photoOf, snapshots, players, rangliste, me, challenges,
  catalog, earnedBadges, onInvite, disciplines, pending, onConfirm, myOpenReports, onSetCardLayout }) {
  // Kartenreihenfolge + Spaltenwahl (Drag & Drop bzw. CardColumnButton):
  // beides wird zusammen direkt am Spielerprofil gespeichert (siehe
  // cardLayout.js/App.jsx setCardLayout) - kein useEffect-Resync mit der
  // Server-Antwort noetig, weil dieser Screen bei jedem Tab-Wechsel komplett
  // neu gemountet wird (siehe tab-basiertes Rendering in App.jsx) und den
  // frischen Wert dann einfach neu initialisiert. Optimistisches Update:
  // eine Aenderung wird sofort lokal gesetzt, bei einem RPC-Fehler aber
  // wieder zurueckgerollt (siehe persistLayout). cardOrder und cardColumns
  // sind bewusst getrennte Werte (siehe cardLayout.js Stufe 4) - Ziehen
  // aendert nur cardOrder, der Spalten-Knopf nur cardColumns.
  const [cardOrder, setCardOrder] = useState(() => normalizeCardOrder(me.card_layout?.[STAT_CARD_SCREEN]));
  const [cardColumns, setCardColumns] = useState(() => normalizeCardColumns(me.card_layout?.[STAT_CARD_SCREEN], cardOrder));
  // Ein Schritt Rueckgaengig (Nutzer-Feedback: "vergiss nicht, einen
  // Rückgängig Button zu implementieren") - haelt den Stand VOR der
  // letzten Aenderung (Ziehen oder Spalten-Knopf), nicht einen ganzen
  // Verlauf. Wird beim Rueckgaengig-Machen selbst geleert statt erneut
  // befuellt - ein zweites Rueckgaengig in Folge macht daher nichts
  // (bewusst einfach gehalten, siehe Nutzer-Feedback: "ein Rückgängig
  // Button", kein Mehrschritt-Verlauf war verlangt).
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  // delay+tolerance statt sofortiger Aktivierung (Nutzer-Feedback: "lange
  // druecken, dann verschieben, damit es nicht mit einem Wischen verwechselt
  // wird") - bewegt sich der Zeiger vor Ablauf der Verzoegerung weiter als
  // die Toleranz, bricht @dnd-kit die Aktivierung selbst ab und ueberlaesst
  // die Geste dem normalen Touch-Scrollen (siehe SortableCard.jsx).
  //
  // MouseSensor + TouchSensor statt des vereinheitlichten PointerSensor
  // (Nutzer-Feedback: "am Smartphone wird erkannt, dass ich drag and drop
  // machen möchte, aber die Karte verschiebt sich nicht, sondern das Handy
  // geht sofort zum Scroll-Modus über") - PointerSensor's preventDefault()
  // auf Pointer-Events verhindert auf manchen mobilen Browsern das bereits
  // parallel vom Compositor-Thread gestartete native Scrollen nicht
  // zuverlaessig, weil touch-action dort schon VOR der JS-Verzoegerung
  // entscheidet. TouchSensor haengt seinen Listener direkt und non-passive
  // an echte touchmove-Events (kein Pointer-Events-Umweg) - das ist der
  // von @dnd-kit selbst fuer genau dieses Delay+Scroll-Szenario empfohlene,
  // auf Touch-Geraeten zuverlaessigere Pfad.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
  );
  // Stufe 4 (nach drei frueheren Versuchen, siehe cardLayout.js fuer die
  // volle Vorgeschichte): EINE SortableContext fuer die ganze Seite wie
  // schon in Stufe 3 (kein Einfrieren an einer Spaltengrenze moeglich,
  // @dnd-kit berechnet die Verschiebung ueber die komplette Liste hinweg),
  // aber Ziehen wechselt nie mehr die Spalte einer Karte - das entscheidet
  // ausschliesslich der CardColumnButton (siehe cardsById weiter unten).
  // Nutzer-Feedback dazu: "es könnte durchaus sein, dass der User zb. alles
  // in der Mitte anzeigen will... die Entscheidung ob eine Karte in der
  // Mitte oder rechts steht trifft der User". persistLayout uebernimmt das
  // optimistische Update + Rollback + Rueckgaengig-Merken fuer beide Arten
  // von Aenderung (Ziehen hier, Spaltenwechsel in toggleCardColumn).
  const persistLayout = async (nextOrder, nextColumns) => {
    const prevOrder = cardOrder;
    const prevColumns = cardColumns;
    setUndoSnapshot({ order: prevOrder, columns: prevColumns });
    setCardOrder(nextOrder);
    setCardColumns(nextColumns);
    const ok = await onSetCardLayout(STAT_CARD_SCREEN, mergeCardLayout(me.card_layout?.[STAT_CARD_SCREEN], { order: nextOrder, columns: nextColumns }));
    if (!ok) {
      setCardOrder(prevOrder);
      setCardColumns(prevColumns);
      setUndoSnapshot(null);
    }
  };
  // Nutzer-Feedback: "ich versuche die oberste Karte aus der rechten Spalte
  // an die 1. Stelle in der breiten Spalte zu ziehen - das funktioniert
  // aber nicht" - Ziehen aenderte bisher NIE die Spalte (nur der
  // CardColumnButton durfte das, siehe cardLayout.js), das widerspricht
  // aber der ganz normalen Erwartung an Drag & Drop zwischen zwei sichtbar
  // nebeneinanderliegenden Spalten. Jetzt uebernimmt Ziehen die Spalte der
  // Karte, auf die fallengelassen wird, ABER NUR fuer die gezogene Karte
  // selbst - keine andere Karte aendert dabei ihre Spalte (anders als beim
  // fruehren automatischen Ausgleich). Der Knopf bleibt trotzdem noetig:
  // eine leere Spalte hat keine Karte, auf die man zielen koennte.
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Leere Spalte hat keine Karte, auf die man beim Ziehen zielen koennte
    // (Nutzer-Feedback: "ich habe alle Karten in der Mitte, kann aber keine
    // Karte nach rechts schieben") - EmptyColumnDropZone registriert die
    // leere Spalte selbst als Ziel mit einer der beiden festen ids. Die
    // Reihenfolge bleibt hier unangetastet, nur die Spalte wechselt, genau
    // wie beim CardColumnButton.
    if (over.id === EMPTY_MIDDLE_DROP_ID || over.id === EMPTY_RIGHT_DROP_ID) {
      const targetColumn = over.id === EMPTY_RIGHT_DROP_ID ? "right" : "middle";
      if ((cardColumns[active.id] === "right" ? "right" : "middle") === targetColumn) return;
      persistLayout(cardOrder, { ...cardColumns, [active.id]: targetColumn });
      return;
    }
    const oldIndex = cardOrder.indexOf(active.id);
    const newIndex = cardOrder.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const nextOrder = arrayMove(cardOrder, oldIndex, newIndex);
    const overColumn = cardColumns[over.id] === "right" ? "right" : "middle";
    const activeColumn = cardColumns[active.id] === "right" ? "right" : "middle";
    const nextColumns = overColumn !== activeColumn ? { ...cardColumns, [active.id]: overColumn } : cardColumns;
    persistLayout(nextOrder, nextColumns);
  };
  const toggleCardColumn = (id) => {
    persistLayout(cardOrder, { ...cardColumns, [id]: cardColumns[id] === "right" ? "middle" : "right" });
  };
  const undoLayout = async () => {
    if (!undoSnapshot) return;
    const prevOrder = cardOrder;
    const prevColumns = cardColumns;
    const { order, columns } = undoSnapshot;
    setCardOrder(order);
    setCardColumns(columns);
    setUndoSnapshot(null);
    const ok = await onSetCardLayout(STAT_CARD_SCREEN, mergeCardLayout(me.card_layout?.[STAT_CARD_SCREEN], { order, columns }));
    if (!ok) {
      setCardOrder(prevOrder);
      setCardColumns(prevColumns);
      setUndoSnapshot({ order: prevOrder, columns: prevColumns });
    }
  };

  // Ausgeblendete Karten (Nutzer-Feedback: "es werden mittlerweile so viele
  // Karten, dass es unuebersichtlich ist") - anders als das Einklappen
  // darunter am Profil gespeichert, im selben card_layout-Eintrag wie
  // Reihenfolge/Spalte (siehe useHiddenCards.js/cardLayout.js). Deshalb
  // nimmt persistLayout oben den gespeicherten Stand per mergeCardLayout()
  // mit, statt ihn zu ueberschreiben.
  const hiddenCards = useHiddenCards(STAT_CARD_SCREEN, me.card_layout, onSetCardLayout);

  // Ein-/Ausklappen pro Karte (Nutzer-Feedback: "du solltest alle Karten
  // herunterklappbar machen") - bewusst nur lokal im Browser gemerkt
  // (gleiches Muster wie die einklappbaren Live-Bereiche, siehe openSecs in
  // LiveScreen.jsx), nicht am Server: das ist eine reine Anzeige-Praeferenz
  // ohne Bezug zur Kartenreihenfolge, ein Reset dafuer waere unnoetig.
  const [collapsedCards, setCollapsedCards] = useState(() => {
    try { const s = localStorage.getItem("statCardsCollapsed"); if (s) return new Set(JSON.parse(s)); } catch { /* ignore */ }
    return new Set();
  });
  useEffect(() => {
    try { localStorage.setItem("statCardsCollapsed", JSON.stringify([...collapsedCards])); } catch { /* ignore */ }
  }, [collapsedCards]);
  const toggleCardCollapse = (id) => setCollapsedCards((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  // Nutzer-Feedback: "es fehlt der Button für 'alles ausklappen' und 'alles
  // zuklappen'" - aus columns statt einer festen Liste, damit auch neue,
  // per normalizeCardColumns() angehaengte Karten mit erfasst werden.
  const expandAllCards = () => setCollapsedCards(new Set());
  const collapseAllCards = () => setCollapsedCards(new Set(cardOrder));

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
  // statt eines eindeutigen Rekordhalters). 14/1 Endlos zaehlt in Punkten
  // statt Racks (typisch dreistellig, siehe "658:258" im Testdatensatz)
  // und wuerde in einer gemeinsamen Rangliste jede andere Disziplin immer
  // haushoch schlagen - daher zwei getrennte Rekorde statt einem: "Höchster
  // Sieg" fuer 8/9/10-Ball, "Höchster Sieg (14/1)" separat fuer 14/1.
  // Bei Gleichstand (z.B. mehrere 5:0-Ergebnisse in einer kurzen Disziplin)
  // gewinnt der/die Erste, der/die diesen Wert erreicht hat - nicht wer im
  // (neueste-zuerst sortierten) matches-Array zuerst auftaucht (Nutzer-
  // Feedback: "zählt der Rekord der Person, die dieses Ergebnis als erstes
  // erreicht hat"). match wird mitgefuehrt, damit die Info-Zeile bei
  // vorhandenem Protokoll einen "Protokoll ansehen"-Button anbieten kann.
  const biggestWinBy = (disciplineFilter) => {
    let best = null;
    matches.forEach((m) => {
      if (m.player1b_id) return;
      if (m.p1.is_guest || m.p2.is_guest) return;
      if (!disciplineFilter(m.discipline)) return;
      const diff = Math.abs(m.score1 - m.score2);
      if (diff === 0) return;
      const better = !best || diff > best.diff ||
        (diff === best.diff && new Date(m.played_at) < new Date(best.match.played_at));
      if (better) {
        const p1Won = m.score1 > m.score2;
        best = { name: p1Won ? m.p1.nickname : m.p2.nickname, diff,
          score: `${Math.max(m.score1, m.score2)}:${Math.min(m.score1, m.score2)}`, match: m };
      }
    });
    return best;
  };
  const biggestWin = useMemo(() => biggestWinBy((d) => d !== "14/1 Endlos"), [matches]);
  const biggestWin141 = useMemo(() => biggestWinBy((d) => d === "14/1 Endlos"), [matches]);

  // Hoechste 14/1-Serie mitsamt Quellmatch (topExtra("highRun") kannte nur
  // den Wert, nicht welches Match dazu gehoert - fuer den Protokoll-Link
  // hier direkt aus high_run1/high_run2 neu berechnet). Gleicher Gleichstand-
  // Grundsatz wie oben: wer zuerst so weit kam, haelt den Rekord.
  const highRunRecord = useMemo(() => {
    let best = null;
    matches.forEach((m) => {
      if (m.player1b_id) return;
      if (m.p1.is_guest || m.p2.is_guest) return;
      [[m.high_run1, m.p1?.nickname], [m.high_run2, m.p2?.nickname]].forEach(([run, name]) => {
        if (run == null || run <= 0 || !name) return;
        const better = !best || run > best.highRun ||
          (run === best.highRun && new Date(m.played_at) < new Date(best.match.played_at));
        if (better) best = { name, highRun: run, match: m };
      });
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
  // Namen - passt nicht in die Zwei-Spieler-Zeile). Bei Winner-Stays-Matches
  // zaehlt stattdessen die reine Spielzeit (matchPlayTimeMs): der Zeitraum
  // enthaelt dort die Racks anderer Paarungen am selben Tisch und waere mit
  // der Dauer eines normalen Matches nicht vergleichbar. matchDurationMs()
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
      if (m.p1.is_guest || m.p2.is_guest) return;
      const ms = matchPlayTimeMs(m.run_log) ?? matchDurationMs(m.run_log);
      if (ms == null || ms < MIN_MATCH_MS || ms > MAX_MATCH_MS) return;
      list.push({ p1Name: m.p1.nickname, p2Name: m.p2.nickname, discipline: m.discipline, ms, match: m });
    });
    return list;
  }, [matches]);
  // Gleichstand-Faelle (auf die Sekunde selten, aber moeglich): frueheres
  // Match gewinnt, gleicher Grundsatz wie bei biggestWinBy/highRunRecord.
  const pickExtreme = (list, isBetter) => list.reduce((best, cur) => {
    if (!best) return cur;
    if (isBetter(cur.ms, best.ms)) return cur;
    if (cur.ms === best.ms && new Date(cur.match.played_at) < new Date(best.match.played_at)) return cur;
    return best;
  }, null);
  const fastestMatch = useMemo(() => pickExtreme(matchDurations, (a, b) => a < b), [matchDurations]);
  const longestMatch = useMemo(() => pickExtreme(matchDurations, (a, b) => a > b), [matchDurations]);

  // info: Erklaerungstext im per-Zeile Info-Button (Nutzer-Feedback: "füge
  // bei jedem einzelnen Rekord einen Info-Badge ganz rechts hinzu"). matchRef
  // ist, wo vorhanden, das konkrete Match, aus dem der Rekord stammt - hat es
  // ein gespeichertes Zeit-Protokoll, bietet RecordsBoard dort automatisch
  // "Protokoll ansehen" an. Kennzahlen ohne einzelnes Quellmatch (Serien,
  // Zaehler ueber mehrere Matches hinweg) haben nur einen Erklaerungstext.
  const recordRows = [
    { key: "highRun", label: t("Höchstserie 14/1"), holder: highRunRecord, fmt: (h) => h.highRun, matchRef: highRunRecord?.match,
      info: t("Höchste ununterbrochene Serie in einer Partie 14/1 Endlos. Bei Gleichstand zählt, wer diese Serie zuerst erreicht hat.") },
    { key: "longestStreak", label: t("Beste Serie"), holder: topExtra("longestStreak"), fmt: (h) => h.longestStreak,
      info: t("Längste ununterbrochene Siegesserie (aufeinanderfolgende gewonnene Matches, unabhängig vom Gegner).") },
    { key: "shutoutWins", label: t("Zu-Null-Siege"), holder: topExtra("shutoutWins"), fmt: (h) => h.shutoutWins,
      info: t("Anzahl gewonnener Matches, bei denen der Gegner 0 Punkte bzw. Racks erzielt hat.") },
    { key: "maxVsOpponent", label: t("Rekord geg. 1 Gegner"), holder: topExtra("maxVsOpponent"), fmt: (h) => h.maxVsOpponent,
      info: t("Meiste Matches, die eine Person gegen ein und denselben Gegner gewonnen hat.") },
    { key: "maxPerDay", label: t("Meiste an 1 Tag"), holder: topExtra("maxPerDay"), fmt: (h) => h.maxPerDay,
      info: t("Meiste an einem einzigen Kalendertag gewonnene Matches.") },
    { key: "recruitedCount", label: t("Geworben"), holder: topExtra("recruitedCount"), fmt: (h) => h.recruitedCount,
      info: t("Anzahl neuer Mitglieder, die über den eigenen Einladungslink beigetreten sind.") },
    { key: "biggestWin", label: t("Höchster Sieg"), holder: biggestWin, fmt: (h) => h.score, matchRef: biggestWin?.match,
      info: t("Größter Punkte- bzw. Rack-Abstand in einem Einzel-Match (alle Disziplinen außer 14/1 Endlos). Bei Gleichstand zählt, wer dieses Ergebnis zuerst erreicht hat.") },
    { key: "biggestWin141", label: t("Höchster Sieg (14/1)"), holder: biggestWin141, fmt: (h) => h.score, matchRef: biggestWin141?.match,
      info: t("Größter Punkteabstand in einem Einzel-Match der Disziplin 14/1 Endlos (zählt in Punkten, daher meist deutlich höhere Werte als in anderen Disziplinen). Bei Gleichstand zählt, wer dieses Ergebnis zuerst erreicht hat.") },
    { key: "peakRating", label: t("Höchstes Rating erreicht"), holder: peakRating, fmt: (h) => h.rating,
      info: t("Höchstes je erreichtes Gesamt-Rating, aus dem täglichen Verlauf oder dem aktuellen Stand.") },
    { key: "mostGames", label: t("Meiste Matches gesamt"), holder: mostGames, fmt: (h) => h.spiele,
      info: t("Meiste bestätigte Matches insgesamt, über alle Disziplinen.") },
    { key: "fastestMatch", label: t("Schnellstes Match"), holder: fastestMatch, fmt: (h) => fmtDuration(h.ms), type: "match", matchRef: fastestMatch?.match,
      info: t("Kürzeste Gesamtdauer eines Matches (erster bis letzter Zeitstempel im gespeicherten Zeit-Protokoll; bei Winner Stays die reine Spielzeit dieser Paarung), unabhängig von der Disziplin. Nur Matches mit digitalem Zähler-Protokoll zählen.") },
    { key: "longestMatch", label: t("Längstes Match"), holder: longestMatch, fmt: (h) => fmtDuration(h.ms), type: "match", matchRef: longestMatch?.match,
      info: t("Längste Gesamtdauer eines Matches (erster bis letzter Zeitstempel im gespeicherten Zeit-Protokoll; bei Winner Stays die reine Spielzeit dieser Paarung), unabhängig von der Disziplin. Nur Matches mit digitalem Zähler-Protokoll zählen.") },
  ];

  // Registry aller per Drag & Drop sortierbaren Karten dieser Seite (Nutzer-
  // Feedback: "sollte auf alle Karten angewendet werden") - IDs muessen zu
  // DEFAULT_STAT_CARD_ORDER in cardLayout.js passen. Welche Karte in
  // welcher Spalte landet, entscheidet ausschliesslich der Nutzer per
  // CardColumnButton (cardColumns, siehe splitCardColumns() weiter unten) -
  // auf dem Handy werden beide Gruppen einfach hintereinander gestapelt
  // (erst Mitte, dann rechts - siehe .stat-chart-col/.stat-grid-Reihenfolge
  // in App.css), unabhaengig davon, welche Karte gerade welche Spalte hat.
  const cardCollapse = (id) => ({ collapsed: collapsedCards.has(id), onToggleCollapse: () => toggleCardCollapse(id) });
  const cardColumn = (id) => ({ column: cardColumns[id], onToggleColumn: () => toggleCardColumn(id) });
  const cardHide = (id) => ({ onHide: () => hiddenCards.hideCard(id) });
  const cardsById = {
    globalFilter: (
      <StatGlobalFilter disc={globalDisc} disciplines={disciplines} onDisc={setGlobalDisc}
        count={globalCount} nearby={globalNearby} onCount={setGlobalCount} onNearby={setGlobalNearby}
        me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} {...cardCollapse("globalFilter")} {...cardColumn("globalFilter")} {...cardHide("globalFilter")}
        onExpandAll={expandAllCards} onCollapseAll={collapseAllCards} canUndo={!!undoSnapshot} onUndo={undoLayout} />
    ),
    rangliste: (
      <RankingBlock rangliste={rangliste} disc={globalDisc} count={globalCount} nearby={globalNearby} me={me}
        colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} {...cardCollapse("rangliste")} {...cardColumn("rangliste")} {...cardHide("rangliste")} />
    ),
    entwicklung: (
      <EntwicklungBlock snapshots={snapshots} players={players} rangliste={rangliste} me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} matches={matches} disc={globalDisc} {...cardCollapse("entwicklung")} {...cardColumn("entwicklung")} {...cardHide("entwicklung")} />
    ),
    rekordeClub: (
      <RecordsBoard records={recordRows} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} onOpenProtokoll={onOpenProtokoll} {...cardCollapse("rekordeClub")} {...cardColumn("rekordeClub")} {...cardHide("rekordeClub")} />
    ),
    letzteMatches: (
      <MatchHistoryBlock matches={matches} players={players} me={me} onOpenProfile={onOpenProfile} onOpenProtokoll={onOpenProtokoll} {...cardCollapse("letzteMatches")} {...cardColumn("letzteMatches")} {...cardHide("letzteMatches")} />
    ),
    meisteSiege: (
      <LeaderboardBlock icon={<Trophy size={17} />} title={t("Meiste Siege")} rows={topWins} me={me} count={globalCount} nearby={globalNearby}
        fmt={(p) => `${p.siege} ${t("Siege")}`} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} {...cardCollapse("meisteSiege")} {...cardColumn("meisteSiege")} {...cardHide("meisteSiege")} />
    ),
    besteSiegquote: (
      <LeaderboardBlock icon={<BarChart3 size={17} />} title={t("Beste Siegquote (ab 10 Spielen)")} rows={topQuote} me={me} count={globalCount} nearby={globalNearby}
        fmt={(p) => `${p.quote} %`} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile}
        info={t("Anteil gewonnener Einzel-Matches (Siege ÷ Spiele) in der aktuell gewählten Disziplin. Um verlässlich zu sein, zählt die Quote erst ab 10 Spielen in dieser Auswahl.")} {...cardCollapse("besteSiegquote")} {...cardColumn("besteSiegquote")} {...cardHide("besteSiegquote")} />
    ),
    aktuelleSerien: (
      <LeaderboardBlock icon={<Flame size={17} />} title={t("Aktuelle Serien")} rows={topStreak} me={me} count={globalCount} nearby={globalNearby}
        fmt={(p) => `${p.streak} ${t("in Folge")}`} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile}
        info={t("Wie viele Einzel-Matches in Folge gewonnen wurden, seit der letzten Niederlage in der aktuell gewählten Disziplin.")} {...cardCollapse("aktuelleSerien")} {...cardColumn("aktuelleSerien")} {...cardHide("aktuelleSerien")} />
    ),
    schnellstesTempo: (
      <LeaderboardBlock icon={<Zap size={17} />} title={t("Schnellstes Tempo (Ø pro Spiel)")} rows={topGameSpeed} me={me} count={globalCount} nearby={globalNearby}
        fmt={(p) => fmtDuration(p.avgGameMs)} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile}
        info={t("Durchschnittliche Zeit pro Einzelspiel bei 8-, 9- und 10-Ball-Matches mit gespeichertem Protokoll (nur Matches, die über den digitalen Zähler gemeldet wurden). Niedrigster Wert zuerst. Nur Spieler mit mindestens einem auswertbaren Match werden gelistet.")} {...cardCollapse("schnellstesTempo")} {...cardColumn("schnellstesTempo")} {...cardHide("schnellstesTempo")} />
    ),
    schnellste141: (
      <LeaderboardBlock icon={<Timer size={17} />} title={t("Schnellstes 14/1-Tempo (Ø pro Kugel)")} rows={topBallSpeed} me={me} count={globalCount} nearby={globalNearby}
        fmt={(p) => fmtDuration(p.avgBallMs)} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile}
        info={t("Durchschnittliche Zeit pro versenkter Kugel bei 14/1-Endlos-Matches mit gespeichertem Protokoll. Fouls zählen nicht mit. Niedrigster Wert zuerst. Nur Spieler mit mindestens einem auswertbaren Match werden gelistet.")} {...cardCollapse("schnellste141")} {...cardColumn("schnellste141")} {...cardHide("schnellste141")} />
    ),
  };
  // Ausgeblendete Karten fliegen erst HIER raus, nicht schon aus cardOrder:
  // ihre Position in der Reihenfolge und ihre Spalte bleiben gespeichert, so
  // steht eine wieder eingeblendete Karte genau dort, wo sie vorher war.
  // Wichtig fuer @dnd-kit: die SortableContext-Liste unten muss exakt den
  // gerenderten Karten entsprechen - eine id ohne zugehoerigen Knoten wuerde
  // die Zieh-Animation verrechnen.
  const visibleOrder = cardOrder.filter((id) => !hiddenCards.isHidden(id));
  const { middle: middleCardIds, right: rightCardIds } = splitCardColumns(visibleOrder, cardColumns);

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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {/* items MUSS die tatsaechliche Render-Reihenfolge sein (erst
          middleCardIds, dann rightCardIds - genau wie weiter unten
          gerendert), NICHT das rohe cardOrder: rectSortingStrategy
          berechnet die Zieh-Animation anhand der Positionen benachbarter
          Eintraege IN DIESEM ARRAY, nicht anhand echter Bildschirm-
          Nachbarschaft. Seit Spalte und Reihenfolge unabhaengig sind
          (siehe cardLayout.js Stufe 4) kann cardOrder Karten aus Mitte und
          Rechts beliebig mischen, waehrend am Bildschirm immer erst alle
          Mitte-Karten, dann alle Rechts-Karten stehen - reicht man dort
          cardOrder direkt durch, "verschiebt" sich fuer eine voellig
          unbeteiligte Karte kurz die falsche Nachbar-Position (Nutzer-
          Feedback: "die Animation zeigt, dass 'Records' ganz nach oben
          kommt, aber die Sortierung ist danach trotzdem richtig" - das
          Endergebnis stimmte immer schon, nur die Animation dazwischen
          nicht). */}
      <SortableContext items={[...middleCardIds, ...rightCardIds]} strategy={statCardSortingStrategy(middleCardIds.length)}>
      {/* .stat-right-col buendelt alle rechten Karten (inkl. der globalen
          Auswahl, die seit dem Drag&Drop-Feature ebenfalls nur eine Karte
          unter vielen ist - Nutzer-Feedback: "auch die 'Selection for all
          Statistics' verschiebbar machen") zu EINER Huelle: am Handy per
          CSS unsichtbar (display:contents), ihre Kinder ordnen sich ueber
          "order" direkt in .stat-split ein (Nutzer-Feedback: "in der
          mobilen Ansicht ... ganz oben die Karten aus der mittleren
          Spalte, darunter die Karten der rechten Spalte"). Am Desktop wird
          daraus ein einziges Grid-Feld mit eigenem Flex-Stapel (siehe
          App.css) - das verhindert den Grid-Zeilen-Kopplungs-Bug (leere
          Luecke, weil die viel hoehere Chart-Spalte sonst dieselbe
          Grid-Zeile wie die kuerzere rechte Spalte aufblaeht). Welche
          Karte hier bzw. in .stat-chart-col landet, entscheidet einzig der
          Nutzer per CardColumnButton (cardColumns, siehe splitCardColumns()
          weiter oben) - am Handy ist diese Aufteilung ohnehin irrelevant,
          dort stehen beide Gruppen nur hintereinander. */}
      <div className="stat-right-col">
      <div className="stat-grid">
        {rightCardIds.map((id) => <SortableCard key={id} id={id}>{cardsById[id]}</SortableCard>)}
        {rightCardIds.length === 0 && (
          <EmptyColumnDropZone id={EMPTY_RIGHT_DROP_ID} label="Karte hierher ziehen, um sie in diese Spalte zu verschieben" />
        )}
      </div>
      </div>

      <aside className="ov-side">
        {/* Wie auf Profil: dieselbe UserPanel-Konstante - am Handy
            ausgeblendet (Redundanz mit dem Profil-Tab), ab 900px sichtbar.
            hideRatings: die "Ratings nach Disziplin"-Karte duplizierte hier
            die eigene (angeheftete) Zeile in der Rangliste-Karte rechts,
            die dank der globalen Disziplin-Auswahl ohnehin jede Disziplin
            zeigen kann - auf Profil/Live bleibt sie unveraendert sichtbar.
            Bewusst NICHT Teil der sortierbaren Karten (Nutzer-Feedback:
            "das Profilmenü ist das einzige, wo sich alle Karten komplett
            frei verschieben lassen" - hier auf Statistik bleibt die
            Identitaets-Spalte fix). */}
        <div className="ov-side-extra">
          <UserPanel nickname={me.nickname} matches={matches} rangliste={rangliste} players={players}
            challenges={challenges} catalog={catalog} earnedBadges={earnedBadges} hideRatings
            colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} onInvite={onInvite} />
        </div>
      </aside>

      {/* Mittlere Spalte: welche Karten hier statt in .stat-right-col
          landen, entscheidet einzig der Nutzer per CardColumnButton
          (cardColumns) - die Reihenfolge INNERHALB dieser Spalte kommt
          weiterhin aus cardOrder (Drag & Drop). */}
      <div className="stat-chart-col">
        {middleCardIds.map((id) => <SortableCard key={id} id={id}>{cardsById[id]}</SortableCard>)}
        {middleCardIds.length === 0 && (
          <EmptyColumnDropZone id={EMPTY_MIDDLE_DROP_ID} label="Karte hierher ziehen, um sie in diese Spalte zu verschieben" />
        )}
      </div>
      </SortableContext>
      </DndContext>
      </div>
      <ShowAllCardsButton hiddenCount={hiddenCards.hiddenCount} onShowAll={hiddenCards.showAll} />
      <ImprintFooter />
    </div>
  );
}
