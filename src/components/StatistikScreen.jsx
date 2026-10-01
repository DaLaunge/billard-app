import { useState, useMemo, useEffect, Fragment } from "react";
import { Trophy, BarChart3, Gauge, Percent, Flame, X, FileText, Check, Clock, Zap, Timer, Star, History, ChevronsDown, ChevronsUp, Undo2 } from "lucide-react";
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { t } from "../lib/i18n";
import { computeStats } from "../lib/stats";
import { computeAchievementExtras } from "../lib/achievements";
import { initials, fmtDate, fmtDateTime, fmtDuration, isDoubles, mSide, sideNames } from "../lib/format";
import { computeSpeedStats, matchDurationMs, matchPlayTimeMs } from "../lib/runLog";
import { DISC_LABEL, LIST_COUNT_OPTIONS, DEFAULT_LIST_COUNT, normalizeListCount } from "../lib/constants";
import { STAT_CARD_SCREEN, deckIds, foldedDeck, withoutFolded, deckColumn, splitCardColumns, phoneSlotOrder } from "../lib/cardLayout";
import { useCardLayout } from "../lib/useCardLayout";
import { useWideScreen } from "../lib/useWideScreen";
import { useRevealOnScroll } from "../lib/useRevealOnScroll";
import { useFunnel, FunnelButton, FunnelPanel } from "./widgets/FilterFunnel";
import DiscBall, { DiscAll, DiscPickRow } from "./widgets/DiscBall";
import ModePick from "./widgets/ModePick";
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
import CardDeck from "./widgets/CardDeck";
import EmptyColumnDropZone from "./widgets/EmptyColumnDropZone";

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];
const MATCH_DISCIPLINES = ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"];
// Feste ids der beiden EmptyColumnDropZone-Ablageflaechen (siehe dort) -
// koennen keine echte Karten-id ueberschneiden, da Karten-ids aus
// cardLayout.js kommen.
const EMPTY_MIDDLE_DROP_ID = "middle-empty";
const EMPTY_RIGHT_DROP_ID = "right-empty";
// Die sechs Bestenlisten teilen sich EINE Karte (siehe CardDeck.jsx) - als
// Konstante, weil handleDragEnd sie schon braucht, bevor der Katalog der
// Listen weiter unten gebaut ist.
const LEADERBOARD_ID_LIST = deckIds("stats", "bestenlisten");

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

// Reiter-Auswahl der Bestenlisten-Karte: eine reine Anzeige-Gewohnheit
// dieses Geraets, gehoert also wie collapsedCards in den localStorage und
// nicht aufs Profil (siehe uiPrefs.js / CLAUDE.md).
const LEADERBOARD_TAB_KEY = "statLeaderboardTab";
const readTabPref = () => { try { return localStorage.getItem(LEADERBOARD_TAB_KEY) || null; } catch { return null; } };
const writeTabPref = (v) => { try { localStorage.setItem(LEADERBOARD_TAB_KEY, v); } catch { /* Privatmodus */ } };

// Gemeinsamer Listenkoerper aller Bestenlisten - stand bis 2026-09-30
// zweimal fast wortgleich da (LeaderboardBlock und RankingBlock).
// nameOf/valOf/extra sind der ganze Unterschied zwischen einer einfachen
// Wertliste und der Rangliste (Medaillen + Verfalls-Abzeichen).
//
// count/nearby kommen von AUSSEN (globale Auswahl ganz oben auf der Seite,
// siehe StatGlobalFilter) statt aus eigenem State - Nutzer-Feedback: jede
// Bestenliste hatte vorher ihre eigenen Top-3/10/Alle-Knoepfe, das waren zu
// viele Buttons. Die eigene Position bleibt trotzdem IMMER sichtbar - auch
// bei Top-3/Top-10, nicht nur als Zahl, sondern als echte Zeile mit
// Name/Wert (Beispiel: "wenn ich Platz 40 bin, will ich das trotzdem in der
// Top-3-Ansicht sehen"). Der eigene Rang wird deshalb IMMER aus der vollen,
// ungekuerzten "rows"-Liste ermittelt (nicht aus "visible") - liegt er
// ausserhalb der gerade sichtbaren Top-N, wird die eigene Zeile per Trenner
// angehaengt statt nur als Text erwaehnt.
function LeaderboardRows({ rows, nameOf, valOf, extra, medals, emptyText, me, count, nearby, colorOf, badgeOf, photoOf, onOpenProfile }) {
  const myIndex = rows.findIndex((r) => nameOf(r) === me?.nickname);
  const showNearby = nearby && myIndex >= 0;
  const sliceStart = showNearby ? Math.max(0, myIndex - 2) : 0;
  const visible = showNearby ? rows.slice(sliceStart, myIndex + 3) : (count === "all" ? rows : rows.slice(0, count));
  const myRowShown = showNearby || count === "all" || (myIndex >= 0 && myIndex < count);
  const pinMyRow = myIndex >= 0 && !myRowShown;
  const row = (r, rank) => {
    const name = nameOf(r);
    return (
      <button key={name} className={"stat-row as-btn" + (name === me?.nickname ? " mine" : "")} onClick={() => onOpenProfile(name)}>
        <span className="medal">{medals && rank < 3 ? MEDAL_EMOJI[rank] : `${rank + 1}.`}</span>
        <Ball color={colorOf(name)} label={initials(name)} badge={badgeOf(name)} photo={photoOf(name)} size={34} />
        <span className="stat-name">{name}</span>
        <span className="stat-val">{valOf(r)}</span>
        {extra && <span className="stat-decay-slot">{extra(r)}</span>}
      </button>
    );
  };
  return (
    <>
      {myIndex < 0 && <p className="stat-my-rank hint">{t("Du bist in dieser Liste nicht vertreten.")}</p>}
      {visible.length === 0 && <p className="hint">{emptyText || t("Noch keine Daten.")}</p>}
      {visible.map((r, i) => row(r, sliceStart + i))}
      {pinMyRow && (
        <>
          <div className="stat-row-sep">···</div>
          {row(rows[myIndex], myIndex)}
        </>
      )}
    </>
  );
}

// Inhalt des Trichter-Felds der Bestenlisten-Karte: Disziplin und Top-N bzw.
// "Meine Umgebung" fuer ALLE Bestenlisten und den Verlaufs-Graphen.
//
// Bis 2026-09-30 war das eine eigene Karte ("Auswahl fuer alle
// Statistiken") mit drei Zeilen Chips, dauerhaft aufgeklappt - obwohl man
// sie selten aendert und alle Bestenlisten inzwischen in EINER Karte
// stecken. Jetzt klappt sie hinter dem Trichter-Symbol der Bestenlisten-
// Karte auf (siehe CardDeck.jsx, Prop "filter"). Die Auswahl selbst bleibt
// unveraendert am Bildschirm (statGlobalDisc/-Count/-Nearby im
// localStorage), das Feld schliesst sich nur.
//
// Nutzer-Feedback, das zu dieser Aufteilung gefuehrt hat (unveraendert
// gueltig): jede Bestenliste hatte vorher ihre eigenen Top-3/10/Alle-
// Knoepfe, das waren zu viele Buttons - daher EIN Satz fuer alle.
function StatFilterContent({ disc, disciplines, onDisc, mode, onMode, count, nearby, onCount, onNearby, me, colorOf, badgeOf, photoOf }) {
  return (
    <>
      {/* Disziplin als Kugeln (Nutzer-Feedback 2026-09-30: "verwende die Kugeln
          auch bei Statistik-Filtern"), "Alle" und "Doppel" als Chips. */}
      {/* "Doppel" ist KEINE Disziplin (das Rating dafuer wird nur intern als
          solche gefuehrt) und steht deshalb nicht in dieser Reihe, sondern als
          eigene Achse darunter: Einzel / Doppel / Beides. */}
      <div style={{ marginBottom: 8 }}>
        <DiscPickRow all="Gesamt" discs={disciplines.filter((d) => d !== "Doppel")} value={disc} onChange={onDisc} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <ModePick value={mode} onChange={onMode} />
      </div>
      <div className="chips small" style={{ marginBottom: 0 }}>
        {LIST_COUNT_OPTIONS.map((c) => (
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
  const recordsRef = useRevealOnScroll([shown.length, collapsed]);
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
        <table className="records-table" ref={recordsRef}>
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
                <tr key={key} className="reveal">
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
// aus demselben Grund wie LeaderboardDeck/RecordsBoard oben: sonst
// verliert ihr lokaler Filter-State bei jedem Render der Eltern-
// Komponente seine Identitaet.
function MatchHistoryBlock({ matches, players, me, onOpenProfile, onOpenProtokoll, collapsed, onToggleCollapse, column, onToggleColumn, onHide }) {
  const [filterPlayer, setFilterPlayer] = useState("");
  const [filterResult, setFilterResult] = useState("all"); // all | win | loss
  const [filterDisc, setFilterDisc] = useState("all"); // all | "8 Ball" | ...
  const [filterMode, setFilterMode] = useState("both"); // single | double | both (siehe widgets/ModePick.jsx)
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [matchCount, setMatchCount] = useState(DEFAULT_LIST_COUNT);
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
        // Disziplin und Einzel/Doppel sind zwei unabhaengige Filter - "8 Ball im
        // Doppel" ist eine gueltige Auswahl.
        if (filterMode === "single" && isDoubles(m)) return false;
        if (filterMode === "double" && !isDoubles(m)) return false;
        if (filterDisc !== "all" && m.discipline !== filterDisc) return false;
        const day = m.played_at.slice(0, 10);
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
        return true;
      })
      .sort((a, b) => new Date(b.played_at) - new Date(a.played_at));
  }, [matches, hideTournament, filterPlayer, filterResult, filterDisc, filterMode, dateFrom, dateTo]);

  const visibleMatches = matchCount === "all" ? filteredMatches : filteredMatches.slice(0, matchCount);
  const filtersActive = !!(filterPlayer || filterDisc !== "all" || filterMode !== "both" || dateFrom || dateTo || hideTournament);
  const resetFilters = () => {
    setFilterPlayer(""); setFilterResult("all"); setFilterDisc("all"); setFilterMode("both"); setDateFrom(""); setDateTo("");
    setMatchCount(DEFAULT_LIST_COUNT); setHideTournament(false);
  };

  const funnel = useFunnel();
  // Kurzfassung der Filter fuer den Kartenkopf, nur wenn etwas vom Standard
  // abweicht. Passt sie nicht in wenige Zeichen (ein langer Spielername), wird
  // sie zur Anzahl - sonst kuerzte sie am Handy den Titel.
  // Jeder Eintrag: text (zaehlt fuer die Laenge) und node (was gezeigt wird -
  // die Disziplin als Kugel statt als Kuerzel).
  const bit = (text, node = text) => (text ? { text, node } : null);
  const filterBits = [
    bit(filterPlayer || null),
    filterPlayer && filterResult !== "all" ? bit(filterResult === "win" ? t("Siege") : t("Niederlagen")) : null,
    filterDisc !== "all" ? bit(DISC_LABEL[filterDisc] || filterDisc, <DiscBall disc={filterDisc} size={15} />) : null,
    filterMode !== "both" ? bit(t(filterMode === "single" ? "Einzel" : "Doppel")) : null,
    hideTournament ? bit(t("ohne Turnier")) : null,
    dateFrom || dateTo ? bit(t("Zeitraum")) : null,
    matchCount !== DEFAULT_LIST_COUNT ? bit(matchCount === "all" ? t("Alle") : t("Top {n}", { n: matchCount })) : null,
  ].filter(Boolean);
  const filterPillLength = filterBits.map((b) => b.text).join(" · ").length;
  const filterPill = filterBits.length === 0 ? null
    : filterPillLength <= 14
      ? filterBits.map((b, i) => <Fragment key={i}>{i > 0 && " · "}{b.node}</Fragment>)
      : t("{n} Filter", { n: filterBits.length });

  // Zeilen blenden sich beim Hineinscrollen ein - die Liste geht bis
  // "Alle" und wird dann sehr lang (siehe lib/useRevealOnScroll.js).
  const listRef = useRevealOnScroll([visibleMatches.length, collapsed]);

  return (
    <section className="stat-block" ref={listRef}>
      <div className="stat-block-head">
        <h3><History size={17} /> <span className="stat-block-title-text">{t("Letzte Matches")}</span>
          {filterPill && <span className="deck-filter-pill">{filterPill}</span>}
        </h3>
        <div className="stat-block-head-actions">
          <CardMenuButton onHide={onHide} />
          {!collapsed && <FunnelButton funnel={funnel} label={t("Filter")} />}
          <CardColumnButton column={column} onToggle={onToggleColumn} />
          <CardCollapseButton collapsed={collapsed} onToggle={onToggleCollapse} />
        </div>
      </div>
      {!collapsed && (
      <>
      {/* Alle Filter hinter dem Trichter (Nutzer-Feedback 2026-09-30: "so wie bei
          den ueblichen Statistiken") - vorher standen fuenf Filterzeilen
          dauerhaft ueber der Liste, vor dem ersten Match. Die Anzahl-Chips
          (10/20/50/100/Alle) sind bewusst mit hineingewandert, so wie Top-N
          bei den Bestenlisten. Die Zeile "x von y Matches" bleibt sichtbar. */}
      <FunnelPanel funnel={funnel} onReset={filtersActive || matchCount !== DEFAULT_LIST_COUNT ? resetFilters : undefined}>
        <div className="match-filters" style={{ marginBottom: 0 }}>
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
          <DiscPickRow all="all" discs={MATCH_DISCIPLINES} value={filterDisc} onChange={setFilterDisc} />
          <ModePick value={filterMode} onChange={setFilterMode} />
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
          <div className="chips small" style={{ marginBottom: 0 }}>
            {LIST_COUNT_OPTIONS.map((c) => (
              <button key={c} className={"chip" + (matchCount === c ? " active" : "")} onClick={() => setMatchCount(c)}>
                {c === "all" ? t("Alle") : c}
              </button>
            ))}
          </div>
        </div>
      </FunnelPanel>
      <p className="filter-count">
        {t("{shown} von {total} Matches", { shown: visibleMatches.length, total: filteredMatches.length })}
      </p>

      {visibleMatches.map((m) => (
        <div key={m.id} className="match-row reveal">
          <span className="m-date m-datetime">{fmtDateTime(m.played_at)}</span>
          <span className="m-txt">
            {sideNames(m, 1).map((n, i) => (
              <span key={n}>{i > 0 && " & "}<button className="name-link" onClick={() => onOpenProfile(n)}>{n}</button></span>
            ))}
            {/* Der Sieger ist eingefaerbt, statt dass man zwei Zahlen
                vergleichen muss (Nutzer-Vorgabe: lieber visuell). --win ist
                dafuer die richtige Farbe: sie ist laut Farbsystem
                ausdruecklich KEINE Themenfarbe, sondern steht ueberall in
                der App fuer "gewonnen". */}
            {" "}<b className="m-score">
              <span className={m.score1 > m.score2 ? "m-win" : undefined}>{m.score1}</span>
              :
              <span className={m.score2 > m.score1 ? "m-win" : undefined}>{m.score2}</span>
            </b>{" "}
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
  catalog, earnedBadges, onInvite, disciplines, pending, onConfirm, myOpenReports, onSetCardLayout, toast }) {
  // Kartenreihenfolge, Spaltenwahl und Sichtbarkeit liegen zusammen in EINEM
  // Zustand (useCardLayout, siehe dort) und werden direkt am Spielerprofil
  // gespeichert - kein useEffect-Resync mit der Server-Antwort noetig, weil
  // dieser Screen bei jedem Tab-Wechsel komplett neu gemountet wird (siehe
  // tab-basiertes Rendering in App.jsx) und den frischen Wert dann einfach
  // neu initialisiert. Optimistisches Update samt Rollback und dem einen
  // Schritt "Rueckgaengig" steckt ebenfalls im Hook. Reihenfolge und Spalte
  // bleiben zwei unabhaengige Werte (siehe cardLayout.js Stufe 4) - der
  // Spalten-Knopf aendert nur die Spalte, Ziehen beides.
  const cards = useCardLayout(STAT_CARD_SCREEN, me.card_layout, onSetCardLayout, toast);
  const cardOrder = cards.order;
  const cardColumns = cards.columns;
  // Spalten gibt es nur am Desktop - am Handy stehen alle Karten in EINER
  // Liste in der Reihenfolge aus cardOrder (per CSS-"order", siehe unten).
  // @dnd-kit muss das wissen, sonst rechnet die Zieh-Animation mit einer
  // anderen Nachbarschaft, als am Bildschirm zu sehen ist.
  const wide = useWideScreen();
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
  // Mitte oder rechts steht trifft der User". cards.setLayout() uebernimmt
  // das optimistische Update + Rollback + Rueckgaengig-Merken fuer beide
  // Arten von Aenderung (Ziehen hier, Spaltenwechsel per Knopf).
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
    // Die Bestenlisten-Karte vertritt SECHS ids (siehe CardDeck.jsx): ein
    // Spaltenwechsel muss alle sechs mitnehmen, sonst zoege das Ziehen nur
    // den gerade ersten sichtbaren Teil um und die Karte spraenge beim
    // naechsten Aus-/Einblenden wieder zurueck.
    const movedIds = LEADERBOARD_ID_LIST.includes(active.id) ? LEADERBOARD_ID_LIST : [active.id];
    const colPatch = (col) => Object.fromEntries(movedIds.map((id) => [id, col]));
    if (over.id === EMPTY_MIDDLE_DROP_ID || over.id === EMPTY_RIGHT_DROP_ID) {
      const targetColumn = over.id === EMPTY_RIGHT_DROP_ID ? "right" : "middle";
      cards.setLayout(cardOrder, { ...cardColumns, ...colPatch(targetColumn) });
      return;
    }
    const oldIndex = cardOrder.indexOf(active.id);
    const newIndex = cardOrder.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const nextOrder = arrayMove(cardOrder, oldIndex, newIndex);
    const overColumn = cardColumns[over.id] === "right" ? "right" : "middle";
    const activeColumn = deckColumn(cardColumns, movedIds, STAT_CARD_SCREEN) === "right" ? "right" : "middle";
    const nextColumns = overColumn !== activeColumn ? { ...cardColumns, ...colPatch(overColumn) } : cardColumns;
    cards.setLayout(nextOrder, nextColumns);
  };

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
  // Disziplin und Einzel/Doppel sind zwei getrennte Achsen. Bis 2026-09-30 war
  // "Doppel" ein Eintrag in der Disziplin-Reihe (statGlobalDisc = "Doppel") -
  // ein solcher Altwert wird zu Disziplin "Gesamt" + Modus "double".
  const [globalDisc, setGlobalDisc] = useState(() => {
    try { const v = localStorage.getItem("statGlobalDisc"); return v && v !== "Doppel" ? v : "Gesamt"; } catch { return "Gesamt"; }
  });
  const [globalMode, setGlobalMode] = useState(() => {
    try {
      const m = localStorage.getItem("statGlobalMode");
      if (m === "single" || m === "double" || m === "both") return m;
      return localStorage.getItem("statGlobalDisc") === "Doppel" ? "double" : "both";
    } catch { return "both"; }
  });
  const [globalCount, setGlobalCount] = useState(() => {
    try { return normalizeListCount(localStorage.getItem("statGlobalCount")); } catch { return DEFAULT_LIST_COUNT; }
  });
  const [globalNearby, setGlobalNearby] = useState(() => {
    try { return localStorage.getItem("statGlobalNearby") === "1"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("statGlobalDisc", globalDisc); } catch { /* ignore */ } }, [globalDisc]);
  useEffect(() => { try { localStorage.setItem("statGlobalMode", globalMode); } catch { /* ignore */ } }, [globalMode]);
  // Welche Rating-"Disziplin" die Auswahl trifft: fuer Doppel gibt es serverseitig
  // NUR ein Gesamt-Doppel-Rating (keins je Disziplin), sonst gilt die gewaehlte
  // Disziplin bzw. Gesamt. Fuer Einzel + Alle gibt es ebenfalls nur "Gesamt"
  // (Einzel und Doppel zusammen) - siehe elo_anchor_rows() in supabase/.
  const ratingDisc = globalMode === "double" ? "Doppel" : globalDisc;
  useEffect(() => { try { localStorage.setItem("statGlobalCount", String(globalCount)); } catch { /* ignore */ } }, [globalCount]);
  useEffect(() => { try { localStorage.setItem("statGlobalNearby", globalNearby ? "1" : "0"); } catch { /* ignore */ } }, [globalNearby]);

  // Meiste Siege/Beste Siegquote/Aktuelle Serien nach Disziplin UND Einzel/
  // Doppel: die Disziplin filtert die Matches, der Modus sagt computeStats(),
  // welche Art zaehlt (Doppel zaehlt fuer alle vier Beteiligten).
  const discFilteredMatches = useMemo(
    () => (globalDisc === "Gesamt" ? matches : matches.filter((m) => m.discipline === globalDisc)),
    [matches, globalDisc]
  );
  const stats = useMemo(() => computeStats(discFilteredMatches, globalMode), [discFilteredMatches, globalMode]);
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
  const [leaderboardTab, setLeaderboardTab] = useState(readTabPref);
  const cardCollapse = (id) => ({ collapsed: collapsedCards.has(id), onToggleCollapse: () => toggleCardCollapse(id) });
  const cardColumn = (id) => ({ column: cardColumns[id], onToggleColumn: () => cards.cycleColumn(id) });
  const cardHide = (id) => ({ onHide: () => cards.hideCard(id) });
  // Katalog der sechs Bestenlisten. Die Reihenfolge hier ist nur ein
  // Rueckfall - welche Listen es als Reiter gibt und in welcher Reihenfolge,
  // entscheidet die gespeicherte Kartenreihenfolge (siehe leaderboardBoards
  // weiter unten).
  const leaderboardById = {
    rangliste: {
      id: "rangliste", tab: t("Rating"), title: t("Rangliste"), icon: <Gauge size={15} />, medals: true,
      rows: rangliste.filter((r) => r.discipline === ratingDisc && r.aktiv && !r.vorlaeufig),
      nameOf: (r) => r.nickname, valOf: (r) => r.rating,
      extra: (r) => <DecayBadge player={r} iconSize={15} />,
      emptyText: t("Noch keine Ratings in dieser Disziplin."),
      info: t("Rating nach einem Fargo-ähnlichen Elo-System: mehr Punkte = besser, 100 Punkte Unterschied entsprechen ungefähr einer Gewinnchance von 2:1. Ohne bestätigtes Match bewegt sich das Rating mit der Zeit wieder Richtung 500 (Startwert). Unter 10 Spielen gilt ein Rating als vorläufig, ohne Match seit 180 Tagen als inaktiv.") + " " + t("Ein Doppel-Rating gibt es nur insgesamt, nicht je Disziplin; ohne Disziplin-Auswahl zählt das Gesamt-Rating (Einzel und Doppel zusammen)."),
    },
    meisteSiege: {
      id: "meisteSiege", tab: t("Siege"), title: t("Meiste Siege"), icon: <Trophy size={15} />,
      rows: topWins, nameOf: (p) => p.name, valOf: (p) => `${p.siege} ${t("Siege")}`,
    },
    besteSiegquote: {
      id: "besteSiegquote", tab: t("Quote"), title: t("Beste Siegquote (ab 10 Spielen)"), icon: <Percent size={15} />,
      rows: topQuote, nameOf: (p) => p.name, valOf: (p) => `${p.quote} %`,
      info: t("Anteil gewonnener Matches (Siege ÷ Spiele) in der aktuell gewählten Auswahl aus Disziplin und Einzel/Doppel. Um verlässlich zu sein, zählt die Quote erst ab 10 Spielen in dieser Auswahl."),
    },
    aktuelleSerien: {
      id: "aktuelleSerien", tab: t("Serien"), title: t("Aktuelle Serien"), icon: <Flame size={15} />,
      rows: topStreak, nameOf: (p) => p.name, valOf: (p) => `${p.streak} ${t("in Folge")}`,
      info: t("Wie viele Matches in Folge gewonnen wurden, seit der letzten Niederlage, in der aktuell gewählten Auswahl aus Disziplin und Einzel/Doppel."),
    },
    schnellstesTempo: {
      id: "schnellstesTempo", tab: t("Tempo"), title: t("Schnellstes Tempo (Ø pro Spiel)"), icon: <Timer size={15} />,
      rows: topGameSpeed, nameOf: (p) => p.name, valOf: (p) => fmtDuration(p.avgGameMs),
      info: t("Durchschnittliche Zeit pro Einzelspiel bei 8-, 9- und 10-Ball-Matches mit gespeichertem Protokoll (nur Matches, die über den digitalen Zähler gemeldet wurden). Niedrigster Wert zuerst. Nur Spieler mit mindestens einem auswertbaren Match werden gelistet."),
    },
    schnellste141: {
      id: "schnellste141", tab: t("14/1-Tempo"), title: t("Schnellstes 14/1-Tempo (Ø pro Kugel)"), icon: <DiscBall disc="14/1 Endlos" size={16} />,
      rows: topBallSpeed, nameOf: (p) => p.name, valOf: (p) => fmtDuration(p.avgBallMs),
      info: t("Durchschnittliche Zeit pro versenkter Kugel bei 14/1-Endlos-Matches mit gespeichertem Protokoll. Fouls zählen nicht mit. Niedrigster Wert zuerst. Nur Spieler mit mindestens einem auswertbaren Match werden gelistet."),
    },
  };

  // Kurzfassung der gewaehlten Filter fuer den Kartenkopf: die Disziplin immer,
  // Einzel/Doppel und die Menge nur, wenn sie vom Standard (Beides, Top 10)
  // abweichen. Bei geschlossenem Trichter-Feld sieht man so, was die Listen zeigen.
  const pillBits = [
    // Die Disziplin steht IMMER in der Ueberschrift, auch bei "Alle" (dann als
    // Kugelhaufen) - Nutzer-Feedback 2026-09-30: sonst sieht man bei
    // "Alle" nicht, dass die Auswahl ueberhaupt eine Disziplin betrifft.
    globalDisc !== "Gesamt" ? <DiscBall key="d" disc={globalDisc} size={20} /> : <DiscAll key="d" size={26} />,
    globalMode !== "both" ? t(globalMode === "single" ? "Einzel" : "Doppel") : null,
    globalNearby ? t("Umgebung") : (globalCount !== DEFAULT_LIST_COUNT ? (globalCount === "all" ? t("Alle") : t("Top {n}", { n: globalCount })) : null),
  ].filter(Boolean);
  const filterPill = pillBits.length
    ? pillBits.map((b, i) => <Fragment key={i}>{i > 0 && " · "}{b}</Fragment>)
    : null;
  const LEADERBOARD_IDS = LEADERBOARD_ID_LIST;
  const { parts: deckParts, anchor: deckAnchor } = foldedDeck(cards.visibleOrder, LEADERBOARD_IDS);
  // Der Trichter haengt an der Bestenlisten-Karte. Fehlt sie (alle sechs
  // Listen ausgeblendet), uebernimmt ihn der Verlaufs-Graph - sonst liesse
  // sich dessen Disziplin nirgends mehr aendern.
  const statFilter = {
    label: t("Auswahl fuer alle Statistiken"),
    pill: filterPill,
    content: <StatFilterContent disc={globalDisc} disciplines={disciplines} onDisc={setGlobalDisc} mode={globalMode} onMode={setGlobalMode}
      count={globalCount} nearby={globalNearby} onCount={setGlobalCount} onNearby={setGlobalNearby}
      me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} />,
  };

  const cardsById = {
    entwicklung: (
      <EntwicklungBlock snapshots={snapshots} players={players} rangliste={rangliste} me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} matches={matches} disc={ratingDisc} filter={deckAnchor ? undefined : statFilter} {...cardCollapse("entwicklung")} {...cardColumn("entwicklung")} {...cardHide("entwicklung")} />
    ),
    rekordeClub: (
      <RecordsBoard records={recordRows} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} onOpenProtokoll={onOpenProtokoll} {...cardCollapse("rekordeClub")} {...cardColumn("rekordeClub")} {...cardHide("rekordeClub")} />
    ),
    letzteMatches: (
      <MatchHistoryBlock matches={matches} players={players} me={me} onOpenProfile={onOpenProfile} onOpenProtokoll={onOpenProtokoll} {...cardCollapse("letzteMatches")} {...cardColumn("letzteMatches")} {...cardHide("letzteMatches")} />
    ),
  };
  // Ausgeblendete Karten fliegen erst HIER raus, nicht schon aus cardOrder:
  // ihre Position in der Reihenfolge und ihre Spalte bleiben gespeichert, so
  // steht eine wieder eingeblendete Karte genau dort, wo sie vorher war.
  // Wichtig fuer @dnd-kit: die SortableContext-Liste unten muss exakt den
  // gerenderten Karten entsprechen - eine id ohne zugehoerigen Knoten wuerde
  // die Zieh-Animation verrechnen.
  // Die sechs Bestenlisten teilen sich EINE Karte (siehe CardDeck.jsx): sie
  // steht an der Stelle der ERSTEN noch sichtbaren Liste, die uebrigen fuenf
  // ids rendern nichts. Dadurch bleibt die ganze Sortier-Mechanik
  // unveraendert - die Karte laesst sich ziehen wie jede andere, und
  // @dnd-kit sieht weiterhin genau die ids, die auch wirklich als Knoten im
  // DOM stehen.
  // Die zusammengelegte Karte zaehlt am Desktop als EINE Karte und braucht
  // daher EINE Spalte - unabhaengig davon, welche Liste gerade der erste
  // sichtbare Teil ist (siehe deckColumn()).
  const deckCol = deckColumn(cardColumns, LEADERBOARD_IDS, STAT_CARD_SCREEN);
  const deckActive = deckParts.includes(leaderboardTab) ? leaderboardTab : deckAnchor;
  if (deckAnchor) {
    const rowProps = { me, count: globalCount, nearby: globalNearby, colorOf, badgeOf, photoOf, onOpenProfile };
    cardsById[deckAnchor] = (
      <CardDeck icon={<Trophy size={17} />} title={t("Bestenlisten")}
        tabs={deckParts.map((id) => {
          const b = leaderboardById[id];
          return { ...b, render: () => <LeaderboardRows {...rowProps} {...b} /> };
        })}
        activeId={deckActive} onActive={(id) => { setLeaderboardTab(id); writeTabPref(id); }}
        hideLabel={t("Diese Liste ausblenden")}
        filter={statFilter}
        {...cardCollapse(deckAnchor)}
        column={deckCol} onToggleColumn={() => cards.cycleColumn(LEADERBOARD_IDS)}
        onHide={() => cards.hideCard(deckActive)} />
    );
  }

  const visibleOrder = withoutFolded(cards.visibleOrder, LEADERBOARD_IDS, deckAnchor);
  const byCol = splitCardColumns(cards.visibleOrder,
    { ...cardColumns, ...Object.fromEntries(LEADERBOARD_IDS.map((id) => [id, deckCol])) }, STAT_CARD_SCREEN);
  const middleCardIds = withoutFolded(byCol.middle, LEADERBOARD_IDS, deckAnchor);
  const rightCardIds = withoutFolded(byCol.right, LEADERBOARD_IDS, deckAnchor);
  // Am Handy legt CSS-"order" die Reihenfolge fest (die Spalten-Huellen sind
  // dort display:contents, siehe App.css) - dadurch ist die sichtbare Liste
  // genau cardOrder, unabhaengig davon, in welcher Spalte eine Karte am
  // Desktop steht. Am Desktop wirkt derselbe Wert innerhalb der Spalte und
  // aendert dort nichts (die Spalte ist ohnehin schon nach cardOrder
  // sortiert). Ab 10, damit die feste Seitenspalte darunter bleiben kann.
  //
  // Am Handy stehen ERST die Mitte-Karten, DANN die rechten (auf jedem
  // Bildschirm so, siehe PHONE_COLUMN_ORDER in cardLayout.js). Massgeblich ist die Spalte, in der die
  // Karte am PC WIRKLICH steht (middleCardIds/rightCardIds, also mit der
  // gemeinsamen Spalte der Bestenlisten-Karte), nicht ihr rohes columns-Feld.
  const rightSet = new Set(rightCardIds);
  const slotOrder = (id) => phoneSlotOrder(rightSet.has(id) ? "right" : "middle", visibleOrder.indexOf(id));

  return (
    <div className="screen">
      {/* Die drei Werkzeuge der frueheren Filter-Karte (Alle auf-/zuklappen,
          Rueckgaengig) wirken auf ALLE Karten dieses Bildschirms und gehoeren
          daher in den Bildschirmkopf, nicht in eine einzelne Karte - sonst
          waeren sie weg, sobald die Bestenlisten ausgeblendet sind. Als
          Symbole statt Textchips (Nutzer-Vorgabe: visuell statt textuell);
          der Text steckt in title/aria-label. */}
      <header className="screen-head with-tools">
        <div>
          <h2>{t("Statistik")}</h2>
          <span className="head-note">{t("Bestenlisten (bestaetigte Matches)")}</span>
        </div>
        <div className="head-tools">
          <button className="chip chip-icon" onClick={expandAllCards} aria-label={t("Alle aufklappen")} title={t("Alle aufklappen")}>
            <ChevronsDown size={16} />
          </button>
          <button className="chip chip-icon" onClick={collapseAllCards} aria-label={t("Alle zuklappen")} title={t("Alle zuklappen")}>
            <ChevronsUp size={16} />
          </button>
          {/* Ein Schritt Rueckgaengig (kein ganzer Verlauf), deaktiviert
              solange es nichts rueckgaengig zu machen gibt - seit die
              Spaltenwahl nicht mehr automatisch passiert, ist ein
              Fehlklick leichter moeglich (Nutzer-Feedback, siehe
              cardLayout.js). */}
          <button className="chip chip-icon" onClick={cards.undo} disabled={!cards.canUndo} aria-label={t("Rückgängig")} title={t("Rückgängig")}>
            <Undo2 size={16} />
          </button>
        </div>
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
      {/* Auch am Handy die gruppierte Reihenfolge (erst Mitte, dann rechts):
          das ist dort die tatsaechliche Bildschirm-Reihenfolge, und die
          Zieh-Animation rechnet mit der Reihenfolge dieses Arrays. */}
      <SortableContext items={[...middleCardIds, ...rightCardIds]}
        strategy={wide ? statCardSortingStrategy(middleCardIds.length) : rectSortingStrategy}>
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
        {rightCardIds.map((id) => <SortableCard key={id} id={id} order={slotOrder(id)}>{cardsById[id]}</SortableCard>)}
        {rightCardIds.length === 0 && (
          <EmptyColumnDropZone id={EMPTY_RIGHT_DROP_ID} label="Karte hierher ziehen, um sie in diese Spalte zu verschieben" />
        )}
      </div>
      </div>

      <aside className="ov-side">
        {/* Dieselbe linke Spalte wie auf Live und im Profil (UserPanel:
            Identitaet + "Meine Zahlen" mit Reitern) - am Handy
            ausgeblendet (Redundanz mit dem Profil-Tab), ab 900px sichtbar.
            Bis 2026-09-30 liess Statistik hier die Ratings weg (die
            Bestenlisten-Karte zeigt sie ja auch) - Nutzer-Feedback: die
            Spalte soll ueberall gleich sein. Bewusst NICHT Teil der
            sortierbaren Karten: hier bleibt die Identitaets-Spalte fix. */}
        <div className="ov-side-extra">
          <UserPanel nickname={me.nickname} matches={matches} rangliste={rangliste} players={players}
            challenges={challenges} catalog={catalog} earnedBadges={earnedBadges} cardLayout={me.card_layout}
            colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} onInvite={onInvite} />
        </div>
      </aside>

      {/* Mittlere Spalte: welche Karten hier statt in .stat-right-col
          landen, entscheidet einzig der Nutzer per CardColumnButton
          (cardColumns) - die Reihenfolge INNERHALB dieser Spalte kommt
          weiterhin aus cardOrder (Drag & Drop). */}
      <div className="stat-chart-col">
        {middleCardIds.map((id) => <SortableCard key={id} id={id} order={slotOrder(id)}>{cardsById[id]}</SortableCard>)}
        {middleCardIds.length === 0 && (
          <EmptyColumnDropZone id={EMPTY_MIDDLE_DROP_ID} label="Karte hierher ziehen, um sie in diese Spalte zu verschieben" />
        )}
      </div>
      </SortableContext>
      </DndContext>
      </div>
      <ShowAllCardsButton hiddenCount={cards.hiddenCount} onShowAll={cards.showAll} />
      <ImprintFooter />
    </div>
  );
}
