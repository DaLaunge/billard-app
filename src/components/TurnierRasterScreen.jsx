import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, Trophy, Flag, Trash2, List, GitBranch, Users, X, Timer, ScrollText, Download } from "lucide-react";
import { jsPDF } from "jspdf";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { initials, fmtDuration, fmtDateTime, fmtDate } from "../lib/format";
import Ball from "./Ball";
import TurnierGraph from "./TurnierGraph";
import TurnierMatchActions, { tmScores } from "./TurnierMatchActions";

const POLL_MS = 8000;

const formatLabel = (f) => (f === "ko" ? t("K.O.") : f === "double_ko" ? t("Doppel-K.O.") : t("Jeder gegen jeden"));
const bracketLabel = (b) => (b === "winners" ? t("Gewinnerbaum") : b === "losers" ? t("Verliererbaum") : b === "final" ? t("Finale") : t("Raster"));
const bracketRank = { main: 0, winners: 0, losers: 1, final: 2 };
// Die 'final'-Sektion kann jetzt mehrere Runden haben (Playoff-Stufe nach
// Jeder-gegen-jeden bzw. verkuerztes Doppel-K.O. mit bis zu 8 Finalisten,
// siehe Migration 2026-09-06) - Runden werden nach Abstand zum eigentlichen
// Finale benannt statt generisch "Runde n".
const finalRoundLabel = (round, totalRounds) => {
  const fromEnd = totalRounds - round;
  if (fromEnd <= 0) return t("Finale");
  if (fromEnd === 1) return t("Halbfinale");
  if (fromEnd === 2) return t("Viertelfinale");
  if (fromEnd === 3) return t("Achtelfinale");
  return `${t("Runde")} ${round}`;
};

// Turnierraster: zeigt ein einzelnes Turnier an, laedt seine Daten selbst
// und pollt periodisch (kein Supabase Realtime im Einsatz, siehe CLAUDE.md) -
// bewusste Ausnahme vom sonstigen "alles ueber App.jsx loadData()"-Muster,
// weil das nur aktiv ist waehrend diese Seite offen ist.
export default function TurnierRasterScreen({ tournamentId, me, players, toast, onBack, colorOf, badgeOf, photoOf, onReload, onReportTournamentMatch }) {
  const [tour, setTour] = useState(null);
  const [tms, setTms] = useState(null);
  const [roster, setRoster] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // list | graph | players - Jeder-gegen-jeden hat keinen Baum, "graph" entfaellt dort
  const [journeyPlayerId, setJourneyPlayerId] = useState(null);

  const load = useCallback(async () => {
    const [{ data: tr }, { data: matches }, { data: ros }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle(),
      supabase.from("tournament_matches")
        .select("id, bracket, round, bracket_position, player1_id, player2_id, is_bye, table_number, match_id, winner_id, next_match_id, loser_next_match_id, ready_at, match:matches(id, player1_id, player2_id, score1, score2, confirmed, reported_by, confirmed_by, played_at)")
        .eq("tournament_id", tournamentId)
        .order("bracket").order("round").order("bracket_position"),
      supabase.from("tournament_players").select("player_id").eq("tournament_id", tournamentId),
    ]);
    setTour(tr || null);
    setTms(matches || []);
    setRoster(ros || []);
  }, [tournamentId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const nameOf = useCallback((id) => players.find((p) => p.id === id)?.nickname || null, [players]);

  const standings = useMemo(() => {
    if (!tour || tour.format !== "round_robin" || !roster || !tms) return null;
    const tally = {};
    roster.forEach((r) => { tally[r.player_id] = { wins: 0, losses: 0 }; });
    tms.forEach((tm) => {
      // Nur die Gruppenphase zaehlt fuer die Tabelle - bei einem Turnier mit
      // Playoff-Stufe (bracket='final') sollen dessen Ergebnisse hier nicht
      // mit einfliessen, die Tabelle bildet nur die Gruppenphase ab.
      if (tm.bracket !== "main" || !tm.winner_id) return;
      const loser = tm.player1_id === tm.winner_id ? tm.player2_id : tm.player1_id;
      if (tally[tm.winner_id]) tally[tm.winner_id].wins += 1;
      if (loser && tally[loser]) tally[loser].losses += 1;
    });
    return Object.entries(tally)
      .map(([id, v]) => ({ id, name: nameOf(id), ...v }))
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  }, [tour, roster, tms, nameOf]);

  // Wartezeit einer Paarung = Zeit zwischen "beide Spieler stehen fest"
  // (tournament_matches.ready_at) und tatsaechlicher Ergebnismeldung
  // (matches.played_at) - zeigt, welche Paarungen am laengsten auf ihr
  // Match warten mussten (z.B. weil sie auf einen Tisch/Gegner-Ergebnis
  // warten mussten), absteigend sortiert.
  const waitRanked = useMemo(() => {
    if (!tms) return [];
    return tms
      .filter((tm) => tm.ready_at && tm.match?.played_at)
      .map((tm) => ({ tm, waitMs: new Date(tm.match.played_at) - new Date(tm.ready_at) }))
      .filter((x) => x.waitMs > 0)
      .sort((a, b) => b.waitMs - a.waitMs);
  }, [tms]);

  // Spielprotokoll: alle bestaetigten Partien in der Reihenfolge, in der sie
  // tatsaechlich gespielt/gemeldet wurden (matches.played_at) - unabhaengig
  // vom Baum-Layout, damit man den zeitlichen Ablauf des Turniertages
  // nachvollziehen kann. Erst am Ende des Turniers relevant, siehe Gating in
  // der JSX unten (tour.status === "finished").
  const timeline = useMemo(() => {
    if (!tms) return [];
    return tms
      .filter((tm) => tm.match?.confirmed && tm.match?.played_at)
      .sort((a, b) => new Date(a.match.played_at) - new Date(b.match.played_at));
  }, [tms]);

  const downloadProtocolPdf = () => {
    const doc = new jsPDF();
    const marginX = 14;
    const pageH = doc.internal.pageSize.getHeight();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;
    doc.setFontSize(16);
    doc.text(tour.name, marginX, y);
    y += 7;
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`${formatLabel(tour.format)} · ${t(tour.discipline)} · ${fmtDate(tour.created_at)}`, marginX, y);
    y += 10;
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text(t("Zeit"), marginX, y);
    doc.text(t("Partie"), marginX + 32, y);
    doc.text(t("Ergebnis"), pageW - marginX - 28, y);
    doc.setFont(undefined, "normal");
    y += 2;
    doc.setDrawColor(180);
    doc.line(marginX, y, pageW - marginX, y);
    y += 7;
    doc.setFontSize(10);
    timeline.forEach((tm) => {
      if (y > pageH - 20) { doc.addPage(); y = 20; }
      const n1 = nameOf(tm.player1_id) || "?", n2 = nameOf(tm.player2_id) || "?";
      const sc = tmScores(tm);
      doc.text(fmtDateTime(tm.match.played_at), marginX, y);
      doc.text(`${n1} – ${n2}`, marginX + 32, y, { maxWidth: pageW - marginX * 2 - 32 - 32 });
      doc.text(`${sc.s1}:${sc.s2}`, pageW - marginX - 28, y);
      y += 7;
    });
    if (timeline.length === 0) doc.text(t("Noch keine Partie in diesem Turnier."), marginX, y);
    doc.save(`${tour.name.replace(/[^\w\-]+/g, "_")}_protokoll.pdf`);
  };

  // Verlauf eines Spielers: alle Rasterplaetze, an denen er beteiligt ist,
  // in Lese-Reihenfolge durch den Baum (Gewinnerbaum vor Verliererbaum vor
  // Finale, je Abschnitt nach Runde) - erzaehlt seinen Weg durchs Turnier.
  const journeyFor = useCallback((playerId) => {
    if (!tms) return [];
    return tms
      .filter((tm) => tm.player1_id === playerId || tm.player2_id === playerId)
      .sort((a, b) => (bracketRank[a.bracket] - bracketRank[b.bracket]) || (a.round - b.round));
  }, [tms]);

  const openMatchScreen = (tm, asOrganizer) => {
    onReportTournamentMatch({
      tournamentMatchId: tm.id, discipline: tour.discipline,
      reportAs: asOrganizer ? "organizer" : "self",
      player1Id: tm.player1_id, player2Id: tm.player2_id, tableNumber: tm.table_number,
    });
  };

  const confirm = async (tm, ok) => {
    setBusyId(tm.id);
    const { error } = await supabase.rpc("confirm_match", { p_match_id: tm.match.id, p_ok: ok });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t(ok ? "Match bestaetigt - Ranking wird neu berechnet." : "Match zurueckgewiesen."));
    await load();
    if (onReload) onReload();
  };

  const forceConfirm = async (tm) => {
    if (!window.confirm(t("Dieses Ergebnis als Turnierleitung erzwungen bestätigen?"))) return;
    setBusyId(tm.id);
    const { error } = await supabase.rpc("tournament_force_confirm_match", { p_tournament_match_id: tm.id });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Erzwungen bestätigt."));
    await load();
    if (onReload) onReload();
  };

  const editMatch = async (tm, s1, s2, onDone) => {
    if (!window.confirm(t("Bestätigtes Ergebnis wirklich auf {s1} : {s2} korrigieren?", { s1, s2 }))) return;
    setBusyId(tm.id);
    const { error } = await supabase.rpc("tournament_organizer_edit_match", {
      p_tournament_match_id: tm.id, p_score1: s1, p_score2: s2,
    });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Ergebnis korrigiert."));
    onDone();
    await load();
    if (onReload) onReload();
  };

  const endEarly = async () => {
    if (!window.confirm(t("Turnier jetzt vorzeitig beenden? Bereits gespielte Partien bleiben als Turnierspiele in der Rangliste."))) return;
    setBusyId("end");
    const { error } = await supabase.rpc("tournament_end_early", { p_tournament_id: tournamentId });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Turnier beendet."));
    await load();
  };

  const deleteTournament = async () => {
    if (!window.confirm(t("Dieses Turnier wirklich unwiderruflich löschen?"))) return;
    setBusyId("delete");
    const { error } = await supabase.rpc("tournament_delete", { p_tournament_id: tournamentId });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Turnier gelöscht."));
    onBack();
  };

  if (!tour || !tms) {
    return (
      <div className="screen">
        <header className="screen-head with-back">
          <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
          <h2>{t("Turnier")}</h2>
        </header>
        <p className="hint">{t("Lade ...")}</p>
      </div>
    );
  }

  const isOrganizer = me.id === tour.organizer_id || me.role === "admin";
  const canDeleteTournament = isOrganizer && !tms.some((tm) => tm.match_id);
  const groups = {};
  tms.forEach((tm) => { (groups[tm.bracket] ||= []).push(tm); });
  // Aus den TATSAECHLICH vorhandenen bracket-Werten ableiten statt aus einer
  // festen Formats-Tabelle - ein Jeder-gegen-jeden-Turnier mit Playoff hat
  // sowohl 'main' (Tabelle) als auch 'final' (Playoff-Baum), ein Doppel-K.O.
  // mit fruehem Cutover weiterhin winners/losers/final wie gehabt.
  const bracketOrder = ["main", "winners", "losers", "final"].filter((b) => groups[b]?.length);
  const finalTotalRounds = groups.final ? Math.max(...groups.final.map((m) => m.round)) : 0;
  const hasTreeSections = bracketOrder.some((b) => b !== "main");

  const renderMatch = (tm) => {
    const n1 = nameOf(tm.player1_id), n2 = nameOf(tm.player2_id);
    const sc = tmScores(tm);
    return (
      <div key={tm.id} className="turnier-match-card">
        <div className="turnier-match-meta">
          <span className="turnier-match-players">
            {tm.is_bye ? (
              <>
                {n1 && <Ball color={colorOf(n1)} label={initials(n1)} badge={badgeOf(n1)} photo={photoOf(n1)} size={22} />}
                <b>{n1 || "?"}</b>&nbsp;{t("(Freilos)")}
              </>
            ) : (
              <>
                {n1 && <Ball color={colorOf(n1)} label={initials(n1)} badge={badgeOf(n1)} photo={photoOf(n1)} size={22} />}
                <b>{n1 || t("TBD")}</b>
                <span className="turnier-match-score">{sc ? `${sc.s1}:${sc.s2}` : "–"}</span>
                <b>{n2 || t("TBD")}</b>
                {n2 && <Ball color={colorOf(n2)} label={initials(n2)} badge={badgeOf(n2)} photo={photoOf(n2)} size={22} />}
              </>
            )}
          </span>
        </div>
        {tm.table_number != null && <span className="m-disc">{t("Tisch")} {tm.table_number}</span>}
        <TurnierMatchActions tm={tm} me={me} isOrganizer={isOrganizer} tourStatus={tour.status}
          busyId={busyId} onOpenMatchScreen={openMatchScreen} onConfirm={confirm} onForceConfirm={forceConfirm} onEditMatch={editMatch} />
      </div>
    );
  };

  return (
    <div className="screen">
      <div className="turnier-layout">
      <header className="screen-head with-back">
        <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
        <h2>{tour.name}</h2>
      </header>
      <p className="hint" style={{ marginTop: -6 }}>
        {formatLabel(tour.format)} · {t(tour.discipline)} · {tour.status === "finished" ? t("beendet") : t("läuft")}
      </p>

      {isOrganizer && (tour.status === "running" || canDeleteTournament) && (
        <div className="chips small" style={{ marginBottom: 10 }}>
          {tour.status === "running" && (
            <button className="btn ghost" disabled={busyId === "end"} onClick={endEarly}>
              <Flag size={15} /> {t("Turnier vorzeitig beenden")}
            </button>
          )}
          {canDeleteTournament && (
            <button className="btn ghost" disabled={busyId === "delete"} onClick={deleteTournament}>
              <Trash2 size={15} /> {t("Turnier löschen")}
            </button>
          )}
        </div>
      )}

      {standings && (
        <section className="stat-block">
          <h3><Trophy size={17} /> {t("Tabelle")}</h3>
          {standings.map((s, i) => (
            <div key={s.id} className="stat-row turnier-standings-row">
              <span className="medal">{i + 1}.</span>
              <Ball color={colorOf(s.name)} label={initials(s.name)} size={28} />
              <span className="stat-name">{s.name}</span>
              <span className="stat-val">{s.wins}S / {s.losses}N</span>
            </div>
          ))}
        </section>
      )}

      {waitRanked.length > 0 && (
        <section className="stat-block">
          <h3><Timer size={17} /> {t("Längste Wartezeiten")}</h3>
          <p className="hint" style={{ marginTop: 0 }}>{t("Zeit zwischen feststehender Paarung und gemeldetem Ergebnis.")}</p>
          {waitRanked.slice(0, 5).map(({ tm, waitMs }) => {
            const n1 = nameOf(tm.player1_id), n2 = nameOf(tm.player2_id);
            return (
              <div key={tm.id} className="stat-row turnier-standings-row">
                <Ball color={colorOf(n1)} label={initials(n1)} badge={badgeOf(n1)} photo={photoOf(n1)} size={26} />
                <Ball color={colorOf(n2)} label={initials(n2)} badge={badgeOf(n2)} photo={photoOf(n2)} size={26} />
                <span className="stat-name">{n1} – {n2}</span>
                <span className="stat-val">{fmtDuration(waitMs)}</span>
              </div>
            );
          })}
          {waitRanked.length > 5 && <p className="hint">{t("+{n} weitere", { n: waitRanked.length - 5 })}</p>}
        </section>
      )}

      {tour.status === "finished" && (
        <section className="stat-block">
          <div className="stat-block-head">
            <h3><ScrollText size={17} /> {t("Spielprotokoll")}</h3>
            <button className="btn ghost" onClick={downloadProtocolPdf}>
              <Download size={15} /> {t("Als PDF herunterladen")}
            </button>
          </div>
          <p className="hint" style={{ marginTop: 0 }}>{t("Zeitlicher Ablauf aller gespielten Partien.")}</p>
          {timeline.length === 0 && <p className="hint">{t("Noch keine Partie in diesem Turnier.")}</p>}
          {timeline.map((tm) => {
            const n1 = nameOf(tm.player1_id), n2 = nameOf(tm.player2_id);
            const won1 = tm.winner_id === tm.player1_id;
            const sc = tmScores(tm);
            return (
              <div key={tm.id} className="stat-row turnier-standings-row">
                <span className="m-date m-datetime">{fmtDateTime(tm.match.played_at)}</span>
                <Ball color={colorOf(n1)} label={initials(n1)} badge={badgeOf(n1)} photo={photoOf(n1)} size={24} />
                <span className="stat-name">
                  {n1} <b style={won1 ? { color: "var(--win)" } : undefined}>{sc.s1}</b>
                  {" : "}
                  <b style={!won1 ? { color: "var(--win)" } : undefined}>{sc.s2}</b> {n2}
                </span>
                <Ball color={colorOf(n2)} label={initials(n2)} badge={badgeOf(n2)} photo={photoOf(n2)} size={24} />
              </div>
            );
          })}
        </section>
      )}

      <div className="chips small turnier-view-toggle">
        <button className={"chip" + (viewMode === "list" ? " active" : "")} onClick={() => setViewMode("list")}>
          <List size={14} /> {t("Liste")}
        </button>
        {hasTreeSections && (
          <button className={"chip" + (viewMode === "graph" ? " active" : "")} onClick={() => setViewMode("graph")}>
            <GitBranch size={14} /> {t("Grafik")}
          </button>
        )}
        <button className={"chip" + (viewMode === "players" ? " active" : "")} onClick={() => setViewMode("players")}>
          <Users size={14} /> {t("Teilnehmer")}
        </button>
      </div>

      {viewMode === "players" ? (
        <section className="stat-block">
          <h3><Users size={17} /> {t("Teilnehmer")}</h3>
          {journeyPlayerId && (() => {
            const jName = nameOf(journeyPlayerId);
            const path = journeyFor(journeyPlayerId);
            return (
              <div className="turnier-graph-detail">
                <div className="turnier-match-meta">
                  <span className="turnier-match-players">
                    <Ball color={colorOf(jName)} label={initials(jName)} badge={badgeOf(jName)} photo={photoOf(jName)} size={28} />
                    <b>{jName}</b>
                  </span>
                  <button className="turnier-graph-detail-close" onClick={() => setJourneyPlayerId(null)} aria-label={t("Schliessen")}>
                    <X size={16} />
                  </button>
                </div>
                {path.length === 0 && <p className="hint">{t("Noch keine Partie in diesem Turnier.")}</p>}
                {path.map((tm) => {
                  const isP1 = tm.player1_id === journeyPlayerId;
                  const oppName = nameOf(isP1 ? tm.player2_id : tm.player1_id);
                  const sc = tmScores(tm);
                  const myScore = sc ? (isP1 ? sc.s1 : sc.s2) : null;
                  const oppScore = sc ? (isP1 ? sc.s2 : sc.s1) : null;
                  const won = tm.winner_id === journeyPlayerId;
                  let statusText;
                  if (tm.is_bye) statusText = t("Freilos");
                  else if (!tm.match_id) statusText = oppName ? t("Ausstehend") : t("Wartet auf Gegner …");
                  else if (!tm.match.confirmed) statusText = t("Wartet auf Bestätigung ...");
                  else statusText = won ? t("Sieg") : t("Niederlage");
                  const roundLabel = tm.bracket === "final" ? finalRoundLabel(tm.round, finalTotalRounds) : `${t("Runde")} ${tm.round}`;
                  return (
                    <div key={tm.id} className="stat-row turnier-standings-row">
                      <span className="stat-name">
                        {bracketOrder.length > 1 ? bracketLabel(tm.bracket) : t("Raster")} · {roundLabel}
                        {oppName ? ` · vs ${oppName}` : ""}
                      </span>
                      <span className="stat-val" style={won ? { color: "var(--win)" } : (tm.match?.confirmed && !won ? { color: "var(--loss)" } : undefined)}>
                        {myScore != null ? `${myScore}:${oppScore}` : statusText}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div className="pmp-grid">
            {(roster || []).map((r) => {
              const nick = nameOf(r.player_id);
              if (!nick) return null;
              return (
                <button key={r.player_id} type="button"
                  className={"pmp-chip" + (journeyPlayerId === r.player_id ? " sel" : "")}
                  onClick={() => setJourneyPlayerId(r.player_id === journeyPlayerId ? null : r.player_id)}>
                  <Ball color={colorOf(nick)} label={initials(nick)} badge={badgeOf(nick)} photo={photoOf(nick)} size={32} />
                  <span className="pmp-name">{nick}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : viewMode === "graph" && hasTreeSections ? (
        <section className="stat-block">
          <h3><Trophy size={17} /> {t("Turnierbaum")}</h3>
          {/* Bei Jeder-gegen-jeden mit Playoff hat die Gruppenphase ('main')
              keine next_match_id-Struktur - nur die Playoff-Stufe ('final')
              gehoert in den Baum, die Gruppentabelle steht schon oben. */}
          <TurnierGraph matches={tour.format === "round_robin" ? tms.filter((tm) => tm.bracket !== "main") : tms}
            nameOf={nameOf} me={me} isOrganizer={isOrganizer} tourStatus={tour.status}
            busyId={busyId} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
            onOpenMatchScreen={openMatchScreen} onConfirm={confirm} onForceConfirm={forceConfirm} onEditMatch={editMatch} />
        </section>
      ) : (
        <div className="turnier-brackets">
          {bracketOrder.map((b) => {
            const list = groups[b] || [];
            if (list.length === 0) return null;
            const byRound = {};
            list.forEach((tm) => { (byRound[tm.round] ||= []).push(tm); });
            return (
              <section key={b} className="stat-block">
                <h3><Trophy size={17} /> {bracketOrder.length > 1 ? bracketLabel(b) : t("Raster")}</h3>
                <div className="turnier-rounds">
                  {Object.keys(byRound).sort((a, c) => a - c).map((r) => (
                    <div key={r} className="turnier-round-col">
                      <p className="turnier-round-title">
                        {b === "final" ? finalRoundLabel(Number(r), finalTotalRounds) : `${t("Runde")} ${r}`}
                      </p>
                      {byRound[r].sort((a, c) => a.bracket_position - c.bracket_position).map(renderMatch)}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
