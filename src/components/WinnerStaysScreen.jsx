import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Repeat, UserPlus, X, Check, Trash2, Flag, Trophy, Crown } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { initials } from "../lib/format";
import { appConfirm } from "../lib/confirmDialog";
import Ball from "./Ball";
import PlayerPicker from "./PlayerPicker";
import PlayerMultiPicker from "./PlayerMultiPicker";
import { ScoreStepper } from "./TurnierMatchActions";
import ImprintFooter from "./widgets/ImprintFooter";

const POLL_MS = 8000;

// "Winner Stays" (Nutzer-Feedback): ein Tisch, mehrere Leute in einer
// Warteschlange - die zwei vordersten (Position 0/1) spielen, der Sieger
// bleibt (Position bleibt unveraendert), der Verlierer geht ans Ende, alle
// dahinter ruecken auf (siehe winner_stays_report_game() in der DB - die
// ganze Rotation passiert dort serverseitig, dieser Screen zeigt nur den
// aktuellen Stand und bietet die Eingabemaske). Voellig anderes Datenmodell
// als TurnierRasterScreen.jsx (keine Bracket-Struktur), deshalb ein
// eigener, viel einfacherer Screen statt einer Erweiterung dort.
export default function WinnerStaysScreen({ sessionId, me, players, matches, toast, colorOf, badgeOf, photoOf, onReload, onBack }) {
  const [session, setSession] = useState(null);
  const [entries, setEntries] = useState(null);
  const [games, setGames] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: sess }, { data: ents }, { data: gms }] = await Promise.all([
      supabase.from("winner_stays_sessions")
        .select("*, organizer:players!winner_stays_sessions_organizer_id_fkey(nickname)")
        .eq("id", sessionId).maybeSingle(),
      supabase.from("winner_stays_entries")
        .select("*, player1:players!winner_stays_entries_player1_id_fkey(nickname), player2:players!winner_stays_entries_player2_id_fkey(nickname)")
        .eq("session_id", sessionId).order("queue_position"),
      supabase.from("winner_stays_games")
        .select("id, game_no, entry_a_id, entry_b_id, score_a, score_b, winner_entry_id, played_at")
        .eq("session_id", sessionId).order("game_no", { ascending: false }).limit(20),
    ]);
    setSession(sess || null);
    setEntries(ents || []);
    setGames(gms || []);
  }, [sessionId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Eingabe fuers naechste Ergebnis - zurueckgesetzt, sobald sich die
  // aktuelle Tisch-Paarung aendert (neue Runde nach Eintragen).
  const [sA, setSA] = useState(0);
  const [sB, setSB] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [addSelected, setAddSelected] = useState([]);
  const [teamP1, setTeamP1] = useState(null);
  const [teamP2, setTeamP2] = useState(null);

  if (!session || !entries) {
    return (
      <div className="screen">
        <header className="screen-head with-back">
          <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
          <h2>{t("Winner Stays")}</h2>
        </header>
        <p className="hint">{t("Lade ...")}</p>
      </div>
    );
  }

  const isOrganizer = me.id === session.organizer_id || me.role === "admin";
  const posA = entries.find((e) => e.queue_position === 0);
  const posB = entries.find((e) => e.queue_position === 1);
  const waiting = entries.filter((e) => e.queue_position >= 2).sort((a, b) => a.queue_position - b.queue_position);
  const ranked = [...entries].sort((a, b) => b.wins - a.wins || b.streak - a.streak || a.queue_position - b.queue_position);
  const canReport = isOrganizer && session.status === "running" && posA && posB;
  const canDelete = isOrganizer && games.length === 0;
  const existingPlayerIds = entries.flatMap((e) => [e.player1_id, e.player2_id]).filter(Boolean);

  const entryName = (e) => (e?.player2_id ? `${e.player1?.nickname} & ${e.player2?.nickname}` : e?.player1?.nickname);
  const entryById = (id) => entries.find((e) => e.id === id);

  const reportGame = async () => {
    if (sA === sB) { toast(t("Unentschieden gibt es beim Billard nicht.")); return; }
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_report_game", { p_session_id: sessionId, p_score_a: sA, p_score_b: sB });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    setSA(0); setSB(0);
    await load();
    onReload && onReload();
  };

  const addSingles = async () => {
    if (addSelected.length === 0) return;
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_add_entries", { p_session_id: sessionId, p_player_ids: addSelected });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Teilnehmer hinzugefügt."));
    setAddSelected([]); setShowAdd(false);
    await load();
  };

  const addTeam = async () => {
    if (!teamP1 || !teamP2) return;
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_add_team", { p_session_id: sessionId, p_player1_id: teamP1, p_player2_id: teamP2 });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Team hinzugefügt."));
    setTeamP1(null); setTeamP2(null); setShowAdd(false);
    await load();
  };

  const removeEntry = async (entryId) => {
    if (!(await appConfirm(t("Diese Person/dieses Team aus der Runde nehmen?")))) return;
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_remove_entry", { p_session_id: sessionId, p_entry_id: entryId });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    await load();
  };

  const finishSession = async () => {
    if (!(await appConfirm(t("Diese Runde jetzt beenden? Für jede Zweier-Paarung wird jetzt ein gewertetes Match mit Protokoll gespeichert.")))) return;
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_finish_session", { p_session_id: sessionId });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Runde beendet."));
    await load();
  };

  const deleteSession = async () => {
    if (!(await appConfirm(t("Diese Runde wirklich löschen?")))) return;
    setBusy(true);
    const { error } = await supabase.rpc("winner_stays_delete_session", { p_session_id: sessionId });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Runde gelöscht."));
    onBack();
  };

  const renderEntryAvatars = (e, size) => (
    <span className="ws-entry-avatars">
      <Ball color={colorOf(e.player1?.nickname)} label={initials(e.player1?.nickname)} badge={badgeOf(e.player1?.nickname)} photo={photoOf(e.player1?.nickname)} size={size} />
      {e.player2_id && <Ball color={colorOf(e.player2?.nickname)} label={initials(e.player2?.nickname)} badge={badgeOf(e.player2?.nickname)} photo={photoOf(e.player2?.nickname)} size={size} />}
    </span>
  );

  return (
    <div className="screen">
      <div className="turnier-layout">
      <header className="screen-head with-back">
        <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
        <h2>{session.name}</h2>
      </header>
      <p className="hint" style={{ marginTop: -6 }}>
        {t(session.is_doubles ? "Doppel" : "Einzel")} · {t(session.discipline)}
        {session.table_number != null && ` · ${t("Tisch")} ${session.table_number}`}
        {" · "}{session.status === "finished" ? t("beendet") : t("läuft")}
      </p>
      <div className="turnier-organizer-line">
        <span className="hint" style={{ margin: 0 }}>{t("Turnierleitung")}:</span>
        <Ball color={colorOf(session.organizer?.nickname)} label={initials(session.organizer?.nickname)} badge={badgeOf(session.organizer?.nickname)} photo={photoOf(session.organizer?.nickname)} size={22} />
        <b>{session.organizer?.nickname || "?"}</b>
      </div>

      {isOrganizer && (
        <div className="chips small" style={{ marginBottom: 10 }}>
          {session.status === "running" && (
            <button className="btn ghost" disabled={busy} onClick={finishSession}>
              <Flag size={15} /> {t("Runde beenden")}
            </button>
          )}
          {canDelete && (
            <button className="btn ghost" disabled={busy} onClick={deleteSession}>
              <Trash2 size={15} /> {t("Runde löschen")}
            </button>
          )}
        </div>
      )}

      {(!posA || !posB) ? (
        <section className="stat-block">
          <p className="hint" style={{ margin: 0 }}>{t("Noch nicht genug Teilnehmer - mindestens zwei nötig, um zu spielen.")}</p>
        </section>
      ) : (
        <section className="stat-block">
          <h3><Trophy size={17} /> {t("Am Tisch")}</h3>
          <div className="ws-table-row">
            <div className="ws-table-side">
              {renderEntryAvatars(posA, 34)}
              <span className="ws-table-name">{entryName(posA)}</span>
              <span className="hint" style={{ margin: 0 }}>{t("Verteidigt")}</span>
              {canReport && <ScoreStepper value={sA} onChange={setSA} />}
            </div>
            <span className="ws-table-vs">:</span>
            <div className="ws-table-side">
              {renderEntryAvatars(posB, 34)}
              <span className="ws-table-name">{entryName(posB)}</span>
              <span className="hint" style={{ margin: 0 }}>{t("Herausforderer")}</span>
              {canReport && <ScoreStepper value={sB} onChange={setSB} />}
            </div>
          </div>
          {canReport && (
            <button className="btn primary" style={{ marginTop: 10 }} disabled={busy || sA === sB} onClick={reportGame}>
              <Check size={16} /> {t("Eintragen")}
            </button>
          )}
        </section>
      )}

      {waiting.length > 0 && (
        <section className="stat-block">
          <h3><Repeat size={17} /> {t("Warteschlange")}</h3>
          <div className="pmp-grid">
            {waiting.map((e, i) => (
              <div key={e.id} className="pmp-chip">
                {renderEntryAvatars(e, 28)}
                <span className="pmp-name">{i + 1}. {entryName(e)}</span>
                {isOrganizer && session.status === "running" && (
                  <button type="button" className="pmp-remove" disabled={busy} onClick={() => removeEntry(e.id)} aria-label={t("Entfernen")} title={t("Entfernen")}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {isOrganizer && session.status === "running" && (
        <section className="stat-block">
          <div className="stat-block-head">
            <h3><UserPlus size={17} /> {t("Teilnehmer")}</h3>
            <button className="btn ghost" onClick={() => setShowAdd((s) => !s)}>
              {showAdd ? <><X size={15} /> {t("Abbrechen")}</> : <><UserPlus size={15} /> {t("Hinzufügen")}</>}
            </button>
          </div>
          {showAdd && (
            session.is_doubles ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <PlayerPicker players={players} matches={matches} me={me} getKey={(p) => p.id}
                  value={teamP1} exclude={[...existingPlayerIds, teamP2].filter(Boolean)}
                  onSelect={setTeamP1} placeholder={t("Erste Person")} />
                <PlayerPicker players={players} matches={matches} me={me} getKey={(p) => p.id}
                  value={teamP2} exclude={[...existingPlayerIds, teamP1].filter(Boolean)}
                  onSelect={setTeamP2} placeholder={t("Zweite Person")} />
                <button className="btn primary" disabled={busy || !teamP1 || !teamP2} onClick={addTeam}>
                  <Check size={15} /> {t("Team hinzufügen")}
                </button>
              </div>
            ) : (
              <div>
                <PlayerMultiPicker players={players} matches={matches} me={me} selected={addSelected}
                  onToggle={(id) => setAddSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
                  colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} exclude={existingPlayerIds} />
                <button className="btn primary" style={{ marginTop: 10 }} disabled={busy || addSelected.length === 0} onClick={addSingles}>
                  <Check size={15} /> {t("{n} Teilnehmer hinzufügen", { n: addSelected.length })}
                </button>
              </div>
            )
          )}
        </section>
      )}

      <section className="stat-block">
        <h3><Crown size={17} /> {t("Live-Rangliste")}</h3>
        {ranked.length === 0 && <p className="hint">{t("Noch keine Teilnehmer.")}</p>}
        {ranked.map((e, i) => (
          <div key={e.id} className="stat-row turnier-standings-row">
            <span className="medal">{i + 1}.</span>
            {renderEntryAvatars(e, 30)}
            <span className="stat-name">
              {entryName(e)}
              {e.queue_position <= 1 && <span className="ws-live-tag">🎱 {t("Am Tisch")}</span>}
            </span>
            <span className="stat-val">{e.wins}S / {e.losses}N</span>
            {e.streak > 1 && <span className="hint" style={{ margin: 0 }}>{t("{n} in Folge", { n: e.streak })}</span>}
          </div>
        ))}
      </section>

      {games.length > 0 && (
        <section className="stat-block">
          <h3><Repeat size={17} /> {t("Verlauf")}</h3>
          {games.map((g) => {
            const ea = entryById(g.entry_a_id), eb = entryById(g.entry_b_id);
            const wonA = g.winner_entry_id === g.entry_a_id;
            return (
              <div key={g.id} className="stat-row turnier-standings-row">
                <span className="medal">{g.game_no}.</span>
                <span className="stat-name">
                  <b style={wonA ? { color: "var(--win)" } : undefined}>{ea ? entryName(ea) : "?"}</b>
                  {" "}{g.score_a}:{g.score_b}{" "}
                  <b style={!wonA ? { color: "var(--win)" } : undefined}>{eb ? entryName(eb) : "?"}</b>
                </span>
              </div>
            );
          })}
        </section>
      )}
      </div>
      <ImprintFooter />
    </div>
  );
}
