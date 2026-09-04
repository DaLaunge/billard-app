import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, Trophy, Check, X, ShieldAlert } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { initials } from "../lib/format";
import Ball from "./Ball";

const POLL_MS = 8000;

const formatLabel = (f) => (f === "ko" ? t("K.O.") : f === "double_ko" ? t("Doppel-K.O.") : t("Jeder gegen jeden"));
const bracketLabel = (b) => (b === "winners" ? t("Gewinnerbaum") : b === "losers" ? t("Verliererbaum") : b === "final" ? t("Finale") : t("Raster"));

// Turnierraster: zeigt ein einzelnes Turnier an, laedt seine Daten selbst
// und pollt periodisch (kein Supabase Realtime im Einsatz, siehe CLAUDE.md) -
// bewusste Ausnahme vom sonstigen "alles ueber App.jsx loadData()"-Muster,
// weil das nur aktiv ist waehrend diese Seite offen ist.
export default function TurnierRasterScreen({ tournamentId, me, players, toast, onBack, colorOf, onReload }) {
  const [tour, setTour] = useState(null);
  const [tms, setTms] = useState(null);
  const [roster, setRoster] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [scores, setScores] = useState({});

  const load = useCallback(async () => {
    const [{ data: tr }, { data: matches }, { data: ros }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle(),
      supabase.from("tournament_matches")
        .select("id, bracket, round, bracket_position, player1_id, player2_id, is_bye, table_number, match_id, winner_id, match:matches(id, score1, score2, confirmed, reported_by)")
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
      if (!tm.winner_id) return;
      const loser = tm.player1_id === tm.winner_id ? tm.player2_id : tm.player1_id;
      if (tally[tm.winner_id]) tally[tm.winner_id].wins += 1;
      if (loser && tally[loser]) tally[loser].losses += 1;
    });
    return Object.entries(tally)
      .map(([id, v]) => ({ id, name: nameOf(id), ...v }))
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  }, [tour, roster, tms, nameOf]);

  const report = async (tm) => {
    const s = scores[tm.id] || {};
    const s1 = parseInt(s.s1, 10), s2 = parseInt(s.s2, 10);
    if (!Number.isFinite(s1) || !Number.isFinite(s2) || s1 < 0 || s2 < 0 || s1 === s2) {
      toast(t("Ungültiges Ergebnis.")); return;
    }
    setBusyId(tm.id);
    const isP1 = tm.player1_id === me.id;
    const { error } = await supabase.rpc("tournament_report_match", {
      p_tournament_match_id: tm.id, p_my_score: isP1 ? s1 : s2, p_opp_score: isP1 ? s2 : s1,
    });
    setBusyId(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Ergebnis gemeldet – wartet auf Bestätigung."));
    await load();
    if (onReload) onReload();
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
  const groups = {};
  tms.forEach((tm) => { (groups[tm.bracket] ||= []).push(tm); });
  const bracketOrder = tour.format === "double_ko" ? ["winners", "losers", "final"] : ["main"];

  const renderMatch = (tm) => {
    const n1 = nameOf(tm.player1_id), n2 = nameOf(tm.player2_id);
    const confirmed = tm.match?.confirmed;
    const canReport = !tm.is_bye && tm.player1_id && tm.player2_id && !tm.match_id &&
      (me.id === tm.player1_id || me.id === tm.player2_id);
    const canConfirm = tm.match_id && !confirmed && tm.match?.reported_by !== me.id &&
      (me.id === tm.player1_id || me.id === tm.player2_id);
    const canForce = tm.match_id && !confirmed && isOrganizer && me.id !== tm.player1_id && me.id !== tm.player2_id;
    return (
      <div key={tm.id} className="pending-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="m-txt">
            {tm.is_bye ? (
              <><b>{n1 || "?"}</b> {" "}{t("(Freilos)")}</>
            ) : (
              <>
                <b>{n1 || t("TBD")}</b>{" "}
                {tm.match ? <b>{tm.match.score1}:{tm.match.score2}</b> : "–"}{" "}
                <b>{n2 || t("TBD")}</b>
              </>
            )}
          </span>
          {tm.table_number != null && <span className="m-disc">{t("Tisch")} {tm.table_number}</span>}
        </div>
        {tm.match_id && !confirmed && <span className="hint" style={{ margin: 0 }}>{t("Wartet auf Bestätigung ...")}</span>}
        {canReport && (
          <div className="am-scores" style={{ justifyContent: "flex-start" }}>
            <input type="number" inputMode="numeric" min="0" placeholder="0"
              value={scores[tm.id]?.s1 || ""} onChange={(e) => setScores({ ...scores, [tm.id]: { ...scores[tm.id], s1: e.target.value } })} />
            <span>:</span>
            <input type="number" inputMode="numeric" min="0" placeholder="0"
              value={scores[tm.id]?.s2 || ""} onChange={(e) => setScores({ ...scores, [tm.id]: { ...scores[tm.id], s2: e.target.value } })} />
            <button className="btn primary" disabled={busyId === tm.id} onClick={() => report(tm)}>{t("Melden")}</button>
          </div>
        )}
        {canConfirm && (
          <div className="confirm-actions">
            <button className="chip-btn ok" disabled={busyId === tm.id} onClick={() => confirm(tm, true)}><Check size={15} /> {t("Bestätigen")}</button>
            <button className="chip-btn no" disabled={busyId === tm.id} onClick={() => confirm(tm, false)}><X size={15} /> {t("Ablehnen")}</button>
          </div>
        )}
        {canForce && (
          <button className="btn ghost" disabled={busyId === tm.id} onClick={() => forceConfirm(tm)}>
            <ShieldAlert size={15} /> {t("Als Turnierleitung erzwingen")}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="screen">
      <header className="screen-head with-back">
        <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
        <h2>{tour.name}</h2>
      </header>
      <p className="hint" style={{ marginTop: -6 }}>
        {formatLabel(tour.format)} · {t(tour.discipline)} · {tour.status === "finished" ? t("beendet") : t("läuft")}
      </p>

      {standings && (
        <section className="stat-block">
          <h3><Trophy size={17} /> {t("Tabelle")}</h3>
          {standings.map((s, i) => (
            <div key={s.id} className="stat-row">
              <span className="medal">{i + 1}.</span>
              <Ball color={colorOf(s.name)} label={initials(s.name)} size={28} />
              <span className="stat-name">{s.name}</span>
              <span className="stat-val">{s.wins}S / {s.losses}N</span>
            </div>
          ))}
        </section>
      )}

      {bracketOrder.map((b) => {
        const list = groups[b] || [];
        if (list.length === 0) return null;
        const byRound = {};
        list.forEach((tm) => { (byRound[tm.round] ||= []).push(tm); });
        return (
          <section key={b} className="stat-block">
            <h3><Trophy size={17} /> {bracketOrder.length > 1 ? bracketLabel(b) : t("Raster")}</h3>
            <div style={{ display: "flex", gap: 16, overflowX: "auto" }}>
              {Object.keys(byRound).sort((a, c) => a - c).map((r) => (
                <div key={r} style={{ minWidth: 220, flex: "0 0 auto" }}>
                  <p className="hint" style={{ marginTop: 0 }}>{t("Runde")} {r}</p>
                  {byRound[r].sort((a, c) => a.bracket_position - c.bracket_position).map(renderMatch)}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
