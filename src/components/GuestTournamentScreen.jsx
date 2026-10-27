import { useCallback, useEffect, useRef, useState } from "react";
import { Trophy, Check, X, Minus, Plus, UserPlus, LogOut, Users, Flag } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { formatLabel } from "../lib/turnierLayout";
import { setRef } from "../lib/session";
import DiscBall from "./widgets/DiscBall";
import Ball from "./Ball";

const POLL_MS = 8000;
const trackKey = (id) => "guest_track:" + id;
const readTrack = (id) => { try { return JSON.parse(localStorage.getItem(trackKey(id)) || "null") || { a: 0, b: 0 }; } catch { return { a: 0, b: 0 }; } };

/* Dashboard fuer einen Gast OHNE Konto (Turnier-Einladung). Alles laeuft ueber das Token (supabase/2026-10-29b_guest_tournament.sql):
   Anmeldung zuruecknehmen (nur vor dem Start), "Du bist dran"-Hinweis, die eigene Partie mitzaehlen, melden und bestaetigen (auch Gast gegen Gast).
   Nach dem Turnierstart laesst sich an der Anmeldung nichts mehr aendern. Der Stand wird alle paar Sekunden abgefragt, solange die Seite sichtbar ist. */
export default function GuestTournamentScreen({ session, onLogin, onForget }) {
  const { token, tournamentId, nickname } = session;
  const [st, setSt] = useState(undefined);        // undefined = laedt, null = Zugang ungueltig
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [score, setScore] = useState({ a: 0, b: 0 });
  const [finishAsk, setFinishAsk] = useState(false);
  const [popup, setPopup] = useState(null);       // Partie-id, fuer die "Du bist dran" gezeigt wird
  const seenReady = useRef(null);
  const link = (() => { const u = new URL("/", window.location.origin); u.searchParams.set("turnier", tournamentId); return u.toString(); })();

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("guest_tournament_state", { p_token: token });
    if (error) return;                           // offline: alter Stand bleibt
    setSt(data || null);
    const rid = data?.ready?.id;
    if (rid && seenReady.current !== rid) {
      seenReady.current = rid;
      setPopup(rid);
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignorieren */ }
    }
    if (!rid) seenReady.current = null;
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  const ready = st?.ready;
  useEffect(() => { if (ready?.id) setScore(readTrack(ready.id)); }, [ready?.id]);
  const bump = (who, d) => setScore((s) => {
    const n = { ...s, [who]: Math.max(0, s[who] + d) };
    if (ready?.id) { try { localStorage.setItem(trackKey(ready.id), JSON.stringify(n)); } catch { /* */ } }
    return n;
  });

  const call = async (fn, args, after) => {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc(fn, { p_token: token, ...args });
    setBusy(false);
    if (error) { setErr(error.message); return false; }
    await load();
    after?.();
    return true;
  };
  const withdraw = () => call("guest_withdraw", {});
  const rejoin = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("tournament_join_guest", { p_tournament_id: tournamentId, p_nickname: nickname });
    setBusy(false);
    if (error) setErr(error.message); else load();
  };
  const finish = () => call("guest_report_match", { p_tournament_match_id: ready.id, p_my_score: score.a, p_opp_score: score.b }, () => {
    try { localStorage.removeItem(trackKey(ready.id)); } catch { /* */ }
    setTracking(false); setFinishAsk(false);
  });
  // Wer sich doch registriert, soll die Turnierleitung als Werber gutschreiben
  const register = async () => {
    const { data } = await supabase.rpc("tournament_invite_info", { p_tournament_id: tournamentId });
    setRef(data?.ref);
    onLogin();
  };
  const confirm = () => call("guest_confirm_match", { p_tournament_match_id: st.confirm.id });

  if (st === undefined) return <div className="screen login-screen"><p className="hint center">{t("Lade ...")}</p></div>;
  if (st === null) {
    return (
      <div className="screen login-screen">
        <div className="login-card">
          <p className="nick-status err"><X size={14} /> {t("Dieser Gast-Zugang ist nicht mehr gültig.")}</p>
          <button className="btn primary" onClick={onForget}>{t("Weiter zur App")}</button>
        </div>
      </div>
    );
  }

  const tour = st.tournament;
  const setup = tour.status === "setup";
  const running = tour.status === "running";
  const conf = st.confirm;

  // Partie mitzaehlen
  if (tracking && ready) {
    return (
      <div className="screen login-screen">
        <div className="login-hero">
          <h2 className="app-title" style={{ fontSize: 22 }}>{tour.name}</h2>
          <p className="app-sub"><DiscBall disc={tour.discipline} size={16} /> · {t("Tisch")} {ready.table_number}</p>
        </div>
        <div className="login-card">
          <div className="score-row">
            {[["a", st.me.nickname], ["b", ready.opponent]].map(([who, name]) => (
              <div className="score-col" key={who}>
                <Ball nick={name} color={who === "a" ? "#2B5DA8" : "#C0392B"} label={(name[0] || "?").toUpperCase()} size={40} />
                <b style={{ fontSize: 13 }}>{name}</b>
                <div className="score-num">{score[who]}</div>
                <div className="chips" style={{ justifyContent: "center" }}>
                  <button className="round-btn" onClick={() => bump(who, -1)} aria-label="-1"><Minus size={20} /></button>
                  <button className="round-btn" onClick={() => bump(who, 1)} aria-label="+1"><Plus size={20} /></button>
                </div>
              </div>
            ))}
          </div>
          {err && <p className="nick-status err"><X size={14} /> {err}</p>}
          {!finishAsk ? (
            <>
              <button className="btn primary" disabled={score.a === score.b} onClick={() => setFinishAsk(true)}><Flag size={16} /> {t("Beenden")}</button>
              <button className="btn ghost" onClick={() => setTracking(false)}>{t("Zurück")}</button>
            </>
          ) : (
            <>
              <p className="hint center">{t("Ergebnis {a} : {b} jetzt melden?", { a: score.a, b: score.b })}</p>
              <button className="btn primary" disabled={busy} onClick={finish}><Check size={16} /> {t("Ja, melden")}</button>
              <button className="btn ghost" onClick={() => setFinishAsk(false)}>{t("Noch nicht")}</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen login-screen">
      <div className="login-hero">
        <div className="login-balls"><Trophy size={42} color="var(--accent)" /></div>
        <h1 className="app-title">{tour.name}</h1>
        <p className="app-sub">
          {formatLabel(tour.format)} · <DiscBall disc={tour.discipline} size={16} />
          {tour.organizer && <><br />{t("Turnierleitung")}: <b>{tour.organizer}</b></>}
        </p>
      </div>

      {/* "Du bist dran": erscheint, sobald fuer mich eine Partie bereitsteht (Tisch zugeteilt, Gegner steht fest) */}
      {popup && ready && popup === ready.id && !tracking && (
        <div className="celebrate-overlay">
          <div className="celebrate-card">
            <div className="celebrate-head">{t("Du bist dran!")}</div>
            <p className="hint">{t("Tisch {n} · gegen {name}", { n: ready.table_number, name: ready.opponent })}</p>
            <button className="btn primary" onClick={() => { setPopup(null); setTracking(true); }}>{t("Match mitzählen")}</button>
            <button className="btn ghost" onClick={() => setPopup(null)}>{t("Später")}</button>
          </div>
        </div>
      )}

      <div className="login-card">
        <div className="sent-check"><Check size={28} /></div>
        <p className="sent-text">
          {st.registered ? t("Du bist dabei, {name}!", { name: st.me.nickname }) : t("Du bist abgemeldet, {name}.", { name: st.me.nickname })}
        </p>

        {conf && (
          <div className="guest-empty-card" style={{ margin: "6px 0" }}>
            <div className="ghost-info">
              <span className="ghost-name">{t("Ergebnis gegen {name}", { name: conf.opponent })}: {conf.score_me} : {conf.score_opp}</span>
              <span className="ghost-sub">
                {conf.reported_by_me ? t("Der Gegner kann es bestätigen – oder du gibst das Gerät weiter und bestätigst direkt.") : t("Dein Gegner hat dieses Ergebnis gemeldet. Stimmt es?")}
              </span>
            </div>
            <button className="btn primary" disabled={busy} onClick={confirm}><Check size={16} /> {t("Ergebnis bestätigen")}</button>
          </div>
        )}

        {ready && !conf && (
          <button className="btn primary" onClick={() => setTracking(true)}>
            <Flag size={16} /> {t("Tisch {n} · gegen {name}", { n: ready.table_number, name: ready.opponent })} – {t("Match mitzählen")}
          </button>
        )}

        {running && !ready && !conf && st.registered && (
          <p className="hint center">{t("Das Turnier läuft. Du bekommst Bescheid, sobald du dran bist – lass diese Seite offen.")}</p>
        )}
        {tour.status === "finished" && <p className="hint center">{t("Das Turnier ist beendet.")}</p>}
        {setup && st.registered && <p className="hint center">{t("Die Turnierleitung startet das Turnier. Lass diese Seite offen – du siehst hier, wann du dran bist.")}</p>}
        {!setup && <p className="hint center">{t("Nach dem Start lässt sich an der Anmeldung nichts mehr ändern.")}</p>}

        {err && <p className="nick-status err"><X size={14} /> {err}</p>}
        {setup && st.registered && (
          <button className="btn ghost" disabled={busy} onClick={withdraw}><LogOut size={16} /> {t("Anmeldung zurücknehmen")}</button>
        )}
        {setup && !st.registered && (
          <button className="btn primary" disabled={busy} onClick={rejoin}><UserPlus size={16} /> {t("Wieder anmelden")}</button>
        )}

        <div className="stat-block-head" style={{ marginTop: 10 }}><h3><Users size={16} /> {t("Teilnehmer")} ({st.roster.length})</h3></div>
        <div className="chips small" style={{ justifyContent: "flex-start" }}>
          {st.roster.map((p) => (
            <span key={p.nickname} className="chip" data-no-avatar>{p.nickname}{p.is_guest && <span className="guest-tag">{t("Gast")}</span>}</span>
          ))}
        </div>

        {setup && (
          <>
            <div className="qr-box">
              <QRCodeSVG value={link} size={170} level="M" bgColor="#F2EDE0" fgColor="#0A2B21" includeMargin />
            </div>
            <p className="hint center">{t("Dieser QR-Code führt zum Turnier – andere können ihn gleich scannen.")}</p>
          </>
        )}

        <button className="btn ghost" onClick={register}><UserPlus size={16} /> {t("Doch lieber registrieren")}</button>
      </div>
    </div>
  );
}
