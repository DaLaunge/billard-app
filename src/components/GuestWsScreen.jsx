import { useCallback, useEffect, useRef, useState } from "react";
import { Trophy, Check, X, UserPlus, LogOut, Users, Minus, Plus, Flag } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { setRef } from "../lib/session";
import DiscBall from "./widgets/DiscBall";

const POLL_MS = 8000;

/* Dashboard fuer einen Gast OHNE Konto in einer Winner-Stays-Runde (supabase/2026-10-30b_winner_stays_invite.sql): mein Platz in der
   Warteschlange, "Du bist dran" sobald ich am Tisch stehe, Abmelden solange ich warte. Ergebnisse tragen die Spieler am Tisch (Mitglieder)
   oder die Leitung ein. Der Stand wird alle paar Sekunden abgefragt, solange die Seite sichtbar ist. */
export default function GuestWsScreen({ session, onLogin, onForget, onSession }) {
  const { token, tournamentId: sessionId } = session;
  const [st, setSt] = useState(undefined);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState(false);
  const wasAtTable = useRef(false);
  // Spiel mitzaehlen und melden (nur am Tisch). Der Zaehler gilt je Spiel: Schluessel = Runde + bisherige Spiele dieses Gastes.
  const [score, setScore] = useState({ a: 0, b: 0 });
  const [ask, setAsk] = useState(false);
  const trackKey = st ? `guest_ws_track:${sessionId}:${(st.wins || 0) + (st.losses || 0)}` : null;
  useEffect(() => {
    if (!trackKey) return;
    try { setScore(JSON.parse(localStorage.getItem(trackKey) || "null") || { a: 0, b: 0 }); } catch { setScore({ a: 0, b: 0 }); }
    setAsk(false);
  }, [trackKey]);
  const bump = (who, d) => setScore((v) => {
    const n = { ...v, [who]: Math.max(0, v[who] + d) };
    try { if (trackKey) localStorage.setItem(trackKey, JSON.stringify(n)); } catch { /* */ }
    return n;
  });
  const report = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("guest_ws_report_game", { p_token: token, p_my_score: score.a, p_opp_score: score.b });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    try { if (trackKey) localStorage.removeItem(trackKey); } catch { /* */ }
    setAsk(false); setScore({ a: 0, b: 0 }); load();
  };
  const link = (() => { const u = new URL("/", window.location.origin); u.searchParams.set("ws", sessionId); return u.toString(); })();

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("guest_ws_state", { p_token: token });
    if (error) return;
    setSt(data || null);
    const at = !!data?.at_table && data?.in_queue;
    if (at && !wasAtTable.current) { setPopup(true); try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignorieren */ } }
    wasAtTable.current = at;
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  const withdraw = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("guest_ws_withdraw", { p_token: token });
    setBusy(false);
    if (error) setErr(error.message); else load();
  };
  const rejoin = async () => {
    setBusy(true); setErr("");
    const { data, error } = await supabase.rpc("winner_stays_join_guest", { p_session_id: sessionId, p_nickname: session.nickname });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onSession?.({ ...session, token: data.token });   // der Server vergibt beim Wieder-Anmelden ein neues Token
  };
  const register = async () => {
    const { data } = await supabase.rpc("winner_stays_invite_info", { p_session_id: sessionId });
    setRef(data?.ref);
    onLogin();
  };

  if (st === undefined) return <div className="screen login-screen"><p className="hint center">{t("Lade ...")}</p></div>;
  if (st === null) {
    return (
      <div className="screen login-screen"><div className="login-card">
        <p className="nick-status err"><X size={14} /> {t("Dieser Gast-Zugang ist nicht mehr gültig.")}</p>
        <button className="btn primary" onClick={onForget}>{t("Weiter zur App")}</button>
      </div></div>
    );
  }
  const s = st.session;
  const running = s.status === "running";
  const waiting = st.in_queue && !st.at_table;
  return (
    <div className="screen login-screen">
      <div className="login-hero">
        <div className="login-balls"><Trophy size={42} color="var(--accent)" /></div>
        <h1 className="app-title">{s.name}</h1>
        <p className="app-sub">{t("Winner Stays")} · <DiscBall disc={s.discipline} size={16} />
          {s.organizer && <><br />{t("Turnierleitung")}: <b>{s.organizer}</b></>}</p>
      </div>

      {popup && st.at_table && (
        <div className="celebrate-overlay">
          <div className="celebrate-card">
            <div className="celebrate-head">{t("Du bist dran!")}</div>
            <p className="hint">{s.table_number != null ? `${t("Tisch")} ${s.table_number} · ` : ""}{t("gegen {name}", { name: st.opponent || "?" })}</p>
            <button className="btn primary" onClick={() => setPopup(false)}>{t("Verstanden")}</button>
          </div>
        </div>
      )}

      <div className="login-card">
        <div className="sent-check"><Check size={28} /></div>
        <p className="sent-text">
          {st.in_queue ? t("Du bist dabei, {name}!", { name: st.me }) : t("Du bist abgemeldet, {name}.", { name: st.me })}
        </p>
        {!running && <p className="hint center">{t("Diese Runde ist beendet.")}</p>}
        {running && st.in_queue && st.at_table && (
          <>
            <p className="hint center"><b>{t("Du stehst am Tisch")}</b> – {t("gegen {name}", { name: st.opponent || "?" })}.</p>
            <div className="score-row">
              {[["a", st.me], ["b", st.opponent || "?"]].map(([who, name]) => (
                <div className="score-col" key={who}>
                  <b style={{ fontSize: 13 }}>{name}</b>
                  <div className="score-num">{score[who]}</div>
                  <div className="chips" style={{ justifyContent: "center" }}>
                    <button className="round-btn" onClick={() => bump(who, -1)} aria-label="-1"><Minus size={20} /></button>
                    <button className="round-btn" onClick={() => bump(who, 1)} aria-label="+1"><Plus size={20} /></button>
                  </div>
                </div>
              ))}
            </div>
            {!ask ? (
              <button className="btn primary" disabled={score.a === score.b} onClick={() => setAsk(true)}><Flag size={16} /> {t("Spiel beenden")}</button>
            ) : (
              <>
                <p className="hint center">{t("Ergebnis {a} : {b} jetzt melden?", { a: score.a, b: score.b })}</p>
                <button className="btn primary" disabled={busy} onClick={report}><Check size={16} /> {t("Ja, melden")}</button>
                <button className="btn ghost" onClick={() => setAsk(false)}>{t("Noch nicht")}</button>
              </>
            )}
          </>
        )}
        {running && waiting && (
          <p className="hint center">{t("Du bist an Platz {n} der Warteschlange.", { n: st.position - 1 })} {t("Lass diese Seite offen – du siehst hier, wann du dran bist.")}</p>
        )}
        {st.in_queue && <p className="hint center">{t("Siege")} {st.wins} · {t("Niederlagen")} {st.losses}{st.streak > 1 ? ` · ${t("Serie")} ${st.streak}` : ""}</p>}
        {err && <p className="nick-status err"><X size={14} /> {err}</p>}
        {running && waiting && (
          <button className="btn ghost" disabled={busy} onClick={withdraw}><LogOut size={16} /> {t("Aus der Schlange nehmen")}</button>
        )}
        {running && !st.in_queue && (
          <button className="btn primary" disabled={busy} onClick={rejoin}><UserPlus size={16} /> {t("Wieder einreihen")}</button>
        )}

        <div className="stat-block-head" style={{ marginTop: 10 }}><h3><Users size={16} /> {t("Warteschlange")} ({st.queue.length})</h3></div>
        <div className="chips small" style={{ justifyContent: "flex-start" }}>
          {st.queue.map((p) => (
            <span key={p.position} className={"chip" + (p.position <= 1 ? " active" : "")} data-no-avatar>
              {p.nickname}{p.is_guest && <span className="guest-tag">{t("Gast")}</span>}
            </span>
          ))}
        </div>

        {running && (
          <>
            <div className="qr-box"><QRCodeSVG value={link} size={170} level="M" bgColor="#F2EDE0" fgColor="#0A2B21" includeMargin /></div>
            <p className="hint center">{t("Dieser QR-Code führt zur Runde – andere können ihn gleich scannen.")}</p>
          </>
        )}
        <button className="btn ghost" onClick={register}><UserPlus size={16} /> {t("Doch lieber registrieren")}</button>
      </div>
    </div>
  );
}
