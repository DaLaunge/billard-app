import { useMemo, useState } from "react";
import { ChevronLeft, Printer, Trophy, ScrollText, GitBranch } from "lucide-react";
import { t } from "../lib/i18n";
import { initials, fmtDate, fmtDateTime, fmtDuration } from "../lib/format";
import { matchDurationMs } from "../lib/runLog";
import { computeTurnierLayout, bracketLabel, formatLabel, finalRoundLabel, BOX_W, BOX_H, FINAL_BOX_W, FINAL_BOX_H } from "../lib/turnierLayout";
import { tmScores } from "./TurnierMatchActions";
import Ball from "./Ball";
import MatchProtokollTable from "./MatchProtokollTable";

// "Zeit am Tisch" fuer EIN Turniermatch: bevorzugt aus dem Zeitprotokoll
// (run_log traegt bei JEDER Disziplin Zeitstempel, siehe matchDurationMs()) -
// nur bei Turnierleitungs-/Admin-Eintragung (tournament_organizer_report_
// match) gibt es kein run_log, dort zaehlt ersatzweise die Tischblockierzeit
// von Paarung-steht-fest bis Ergebnis-gemeldet (dieselbe Formel wie die
// bestehende "Laengste Wartezeiten"-Sektion in TurnierRasterScreen.jsx) -
// vom Nutzer so bestaetigt (Rueckfrage waehrend der Planung dieser Funktion).
function tableTimeMs(tm) {
  const fromLog = matchDurationMs(tm.match?.run_log);
  if (fromLog != null) return fromLog;
  if (tm.ready_at && tm.match?.played_at) {
    const ms = new Date(tm.match.played_at) - new Date(tm.ready_at);
    return ms >= 0 ? ms : null;
  }
  return null;
}

// Statischer, nicht-interaktiver Turnierbaum als EIN SVG (statt der
// absolut-positionierten div-Bausteine der interaktiven Ansicht) - so
// skaliert die komplette Grafik beim Drucken/Als-PDF-Speichern sauber auf
// die Seitenbreite (width:100% + viewBox), ohne dass ein erzwungenes
// Querformat noetig waere (das @page-Regeln global aendern wuerde und damit
// auch MatchProtokollScreen unbeabsichtigt mit beeinflusst haette). Nutzt
// dieselbe Geometrie wie TurnierGraph.jsx (computeTurnierLayout), damit
// beide Ansichten optisch uebereinstimmen.
function StaticBracket({ matches, nameOf }) {
  const layout = useMemo(() => computeTurnierLayout(matches), [matches]);
  const labelH = layout.showSectionLabels ? 18 : 0;
  return (
    <svg className="tb-bracket-svg" viewBox={`0 -${labelH} ${layout.totalWidth} ${layout.totalHeight + labelH}`}>
      {layout.bands.map((b) => (
        <rect key={b.bracket} className={"tb-band tb-band--" + b.bracket}
          x={0} y={b.top} width={b.width} height={b.height} />
      ))}
      {layout.edges.map((e, i) => {
        const x1 = e.from.x + BOX_W, y1 = e.from.y + BOX_H / 2;
        const x2 = e.to.x, y2 = e.to.y + e.toH / 2;
        const midX = (x1 + x2) / 2;
        // Anders als im interaktiven Baum ist hier (Turnier bereits beendet)
        // JEDE Kante "entschieden" - die dort sinnvolle decided/undecided-
        // Unterscheidung waere hier bedeutungslos und wuerde jede Abstiegs-
        // Kante rot+kraeftig einfaerben (kreuz und quer durchs ganze Bild,
        // Nutzer-Feedback "optisch nicht ansprechend"). Deshalb bewusst
        // NUR Sieger-Pfade (kind="advance") gold hervorheben, Abstiegs-Pfade
        // bleiben immer dezent grau gestrichelt.
        return (
          <path key={i} className={"tb-edge" + (e.kind === "drop" ? " drop" : "")}
            d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`} />
        );
      })}
      {layout.showSectionLabels && layout.sections.map((s) => (
        <text key={s.bracket} className={"tb-section-label section--" + s.bracket} x={s.left + 4} y={s.top - 6}>
          {bracketLabel(s.bracket)}
        </text>
      ))}
      {matches.map((m) => {
        const p = layout.pos[m.id];
        if (!p) return null;
        const isFinal = m.bracket === "final" && layout.bigFinalBox;
        const w = isFinal ? FINAL_BOX_W : BOX_W;
        const h = isFinal ? FINAL_BOX_H : BOX_H;
        const n1 = nameOf(m.player1_id) || t("TBD");
        const sc = tmScores(m);
        // Freilos: nur EINE Zeile (der durchmarschierende Spieler), zentriert
        // statt der vollen Zwei-Zeilen-Aufteilung mit leerem/redundantem
        // zweiten Namen - eine komplette Box nur fuer "Name + (Freilos)"
        // wirkte unnoetig ausladend (Nutzer-Feedback "optisch nicht
        // ansprechend"), siehe auch keine Trennlinie hier (nur ein Spieler).
        if (m.is_bye) {
          return (
            <g key={m.id}>
              <rect className={"tb-box tb-box--" + m.bracket} x={p.x} y={p.y} width={w} height={h} rx={8} />
              <text className="tb-name" x={p.x + 10} y={p.y + h * 0.42} dominantBaseline="middle">{n1}</text>
              <text className="tb-name tb-bye" x={p.x + 10} y={p.y + h * 0.72} dominantBaseline="middle">{t("(Freilos)")}</text>
            </g>
          );
        }
        const n2 = nameOf(m.player2_id) || t("TBD");
        const row1Y = p.y + h * 0.4, row2Y = p.y + h * 0.78;
        return (
          <g key={m.id}>
            <rect className={"tb-box tb-box--" + m.bracket} x={p.x} y={p.y} width={w} height={h} rx={8} />
            <line className="tb-box-divider" x1={p.x} y1={p.y + h / 2} x2={p.x + w} y2={p.y + h / 2} />
            <text className={"tb-name" + (m.winner_id && m.winner_id === m.player1_id ? " tb-won" : "")} x={p.x + 10} y={row1Y}>{n1}</text>
            {sc && <text className={"tb-score" + (m.winner_id && m.winner_id === m.player1_id ? " tb-won" : "")} x={p.x + w - 10} y={row1Y} textAnchor="end">{sc.s1}</text>}
            <text className={"tb-name" + (m.winner_id && m.winner_id === m.player2_id ? " tb-won" : "")} x={p.x + 10} y={row2Y}>{n2}</text>
            {sc && <text className={"tb-score" + (m.winner_id && m.winner_id === m.player2_id ? " tb-won" : "")} x={p.x + w - 10} y={row2Y} textAnchor="end">{sc.s2}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// Kompletter Turnierbericht (Nutzer-Feedback) - eine druckfertige HTML-
// Ansicht statt eines zweiten jsPDF-Renderers (die bestehende einfache
// "Spielprotokoll als PDF"-Funktion in TurnierRasterScreen.jsx positioniert
// Text manuell x/y, fuer ein mehrteiliges Dokument mit Tabellen + Baumgrafik
// nicht praktikabel). "Als PDF speichern" nutzt wie MatchProtokollScreen.jsx
// den nativen Druckdialog des Browsers (window.print(), siehe @media print
// in App.css) - deckt "PDF" UND "Druck" mit demselben Mechanismus ab.
export default function TurnierBerichtScreen({ tour, tms, finalStandings, nameOf, colorOf, badgeOf, photoOf, onBack }) {
  // "Vollstaendig" zeigt pro Match das komplette Rack-/Punkte-Protokoll
  // (Nutzer-Wunsch: beide Detailgrade zur Wahl stellen, mit Erklaerung).
  const [logDetail, setLogDetail] = useState("kompakt"); // "kompakt" | "voll"

  // Browser schlagen im Druckdialog (Ziel "Als PDF speichern") den
  // Dateinamen aus document.title vor - der ist sonst ueberall einfach
  // "Break & Rank" (siehe index.html), Nutzer-Feedback wollte stattdessen
  // Datum + Turniername. Wird NUR fuers Drucken kurz umgesetzt und danach
  // wieder zurueckgesetzt (afterprint statt festem Timeout, damit es auch
  // bei einem langsamen/abgebrochenen Druckdialog zuverlaessig zurueckspringt).
  const printReport = () => {
    const prevTitle = document.title;
    const d = new Date(tour.finished_at || tour.created_at);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    document.title = `${iso}_${tour.name.replace(/[^\w\-]+/g, "_")}`;
    const restore = () => { document.title = prevTitle; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  // Pro Spieler ueber alle bestaetigten Turniermatches aggregiert - Games
  // gewonnen/verloren aus tmScores() (bereits in tm.player1/2-Reihenfolge),
  // Zeit am Tisch aus tableTimeMs() oben.
  const aggByPlayer = useMemo(() => {
    const agg = {};
    const ensure = (pid) => (agg[pid] ||= { wins: 0, losses: 0, gamesFor: 0, gamesAgainst: 0, tableMs: 0 });
    tms.forEach((tm) => {
      if (tm.is_bye || !tm.match?.confirmed) return;
      const sc = tmScores(tm);
      if (!sc) return;
      const durationMs = tableTimeMs(tm);
      [[tm.player1_id, sc.s1, sc.s2], [tm.player2_id, sc.s2, sc.s1]].forEach(([pid, own, opp]) => {
        if (!pid) return;
        const a = ensure(pid);
        a.gamesFor += own; a.gamesAgainst += opp;
        if (tm.winner_id === pid) a.wins += 1;
        else if (tm.winner_id) a.losses += 1;
        if (durationMs != null) a.tableMs += durationMs;
      });
    });
    return agg;
  }, [tms]);

  const standingsGrouped = useMemo(() => {
    if (!finalStandings?.length) return null;
    const byPlacement = {};
    finalStandings.forEach((row) => { (byPlacement[row.placement] ||= []).push(row); });
    return Object.keys(byPlacement).map(Number).sort((a, b) => a - b)
      .map((placement) => ({ placement, rows: byPlacement[placement] }));
  }, [finalStandings]);

  const timeline = useMemo(() => tms
    .filter((tm) => tm.match?.confirmed && tm.match?.played_at)
    .sort((a, b) => new Date(a.match.played_at) - new Date(b.match.played_at)), [tms]);

  // Wie in TurnierRasterScreen.jsx: bei Jeder-gegen-jeden ist "main" (die
  // Tabelle) kein Baum - nur eine eventuelle Playoff-Stufe wird gezeichnet.
  const bracketMatches = tour.format === "round_robin" ? tms.filter((tm) => tm.bracket !== "main") : tms;
  const hasTree = bracketMatches.some((tm) => tm.bracket !== "main");

  return (
    <div className="screen protokoll-screen">
      <header className="screen-head with-back no-print">
        <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
        <h2>{t("Turnierbericht")}</h2>
      </header>

      <div className="protokoll-doc turnier-bericht-doc">
        <div className="protokoll-head">
          <h1>{tour.name}</h1>
          <p className="protokoll-meta">{formatLabel(tour.format)} · {t(tour.discipline)} · {fmtDate(tour.finished_at || tour.created_at)}</p>
        </div>

        {standingsGrouped && (
          <section className="tb-section">
            <h3><Trophy size={17} /> {t("Bestenliste")}</h3>
            <div className="protokoll-table-wrap">
              <table className="protokoll-table tb-standings-table">
                <thead>
                  <tr>
                    <th>{t("Platz")}</th><th>{t("Spieler")}</th><th>{t("Siege")}</th><th>{t("Niederlagen")}</th>
                    <th>{t("Games +/-")}</th><th>{t("Zeit am Tisch")}</th>
                  </tr>
                </thead>
                <tbody>
                  {standingsGrouped.map(({ placement, rows }) => rows.map((row, i) => {
                    const n = nameOf(row.player_id);
                    const a = aggByPlayer[row.player_id] || { wins: 0, losses: 0, gamesFor: 0, gamesAgainst: 0, tableMs: 0 };
                    return (
                      <tr key={row.player_id} className={placement <= 3 ? "tb-podium-row" : undefined}>
                        <td>
                          {i === 0 && (
                            <span className={"tb-rank" + (placement <= 3 ? ` tb-rank--${placement}` : "")}>
                              {placement}.{row.tied_count > 1 ? ` ${t("geteilt")}` : ""}
                            </span>
                          )}
                        </td>
                        <td className="tb-player-cell">
                          {n && <Ball color={colorOf(n)} label={initials(n)} badge={badgeOf(n)} photo={photoOf(n)} size={22} />}
                          {n || "?"}
                        </td>
                        <td>{a.wins}</td>
                        <td>{a.losses}</td>
                        <td>{a.gamesFor}:{a.gamesAgainst}</td>
                        <td>{a.tableMs > 0 ? fmtDuration(a.tableMs) : "–"}</td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="tb-section">
          <h3><ScrollText size={17} /> {t("Chronologischer Match-Log")}</h3>
          <div className="tb-log-toggle no-print">
            <button className={"chip-btn" + (logDetail === "kompakt" ? " sel" : "")} onClick={() => setLogDetail("kompakt")}>{t("Kompakt")}</button>
            <button className={"chip-btn" + (logDetail === "voll" ? " sel" : "")} onClick={() => setLogDetail("voll")}>{t("Vollständig")}</button>
          </div>
          <p className="hint no-print" style={{ marginTop: 4 }}>
            {logDetail === "kompakt"
              ? t("Kompakt: Endstand, Höchstserie, Schnitt und Zeit am Tisch je Match.")
              : t("Vollständig: komplettes Aufnahme-/Punkte-Protokoll je Match, wie in der einzelnen Match-Ansicht.")}
          </p>

          {timeline.length === 0 && <p className="hint">{t("Noch keine Partie in diesem Turnier.")}</p>}

          {logDetail === "kompakt" ? (
            <div className="protokoll-table-wrap">
              <table className="protokoll-table tb-log-table">
                <thead>
                  <tr>
                    <th>{t("Zeit")}</th><th>{t("Partie")}</th><th>{t("Ergebnis")}</th>
                    <th>{t("Höchstserie")}</th><th>{t("Schnitt")}</th><th>{t("Zeit am Tisch")}</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((tm) => {
                    const n1 = nameOf(tm.player1_id) || "?", n2 = nameOf(tm.player2_id) || "?";
                    const sc = tmScores(tm);
                    const hr = [tm.match.high_run1, tm.match.high_run2].filter((v) => v != null);
                    const avg = [tm.match.avg1, tm.match.avg2].filter((v) => v != null);
                    const ms = tableTimeMs(tm);
                    return (
                      <tr key={tm.id}>
                        <td>{fmtDateTime(tm.match.played_at)}</td>
                        <td>{n1} – {n2}</td>
                        <td>{sc.s1}:{sc.s2}</td>
                        <td>{hr.length ? hr.join(" / ") : "–"}</td>
                        <td>{avg.length ? avg.map((v) => v.toFixed(1)).join(" / ") : "–"}</td>
                        <td>{ms != null ? fmtDuration(ms) : "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            timeline.map((tm) => {
              const n1 = nameOf(tm.player1_id) || "?", n2 = nameOf(tm.player2_id) || "?";
              return (
                <div key={tm.id} className="tb-log-match">
                  <p className="tb-log-match-head">
                    <b>{n1} {tm.match.score1}:{tm.match.score2} {n2}</b> · {fmtDateTime(tm.match.played_at)}
                  </p>
                  <MatchProtokollTable match={tm.match} names={[n1, n2]} />
                </div>
              );
            })
          )}
        </section>

        {hasTree && (
          <section className="tb-section tb-bracket-section">
            <h3><GitBranch size={17} /> {t("Turnierverlauf")}</h3>
            <StaticBracket matches={bracketMatches} nameOf={nameOf} />
          </section>
        )}

        <button className="btn primary no-print" onClick={printReport}>
          <Printer size={16} /> {t("Als PDF speichern")}
        </button>
      </div>
    </div>
  );
}
