import { useEffect, useState } from "react";
import { Trophy, UserCheck, UserPlus, ArrowRight, Check, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { setRef } from "../lib/session";
import { formatLabel } from "../lib/turnierLayout";
import DiscBall from "./widgets/DiscBall";
import Ball from "./Ball";

/* Einladung zu einem Turnier (Link/QR /?turnier=ID) fuer Personen OHNE Anmeldung.
   Zwei Wege: "Anmelden" (normaler Anmeldevorgang, die Turnierleitung wird als Werber gutgeschrieben, die Turnier-Anmeldung folgt in App.jsx
   automatisch nach der Registrierung) oder "Als Gast mitspielen" (nur ein Name, kein Login). Beides laeuft ueber Funktionen, die ohne
   Login aufrufbar sind (supabase/2026-10-29_tournament_invite.sql). */
export default function TurnierInviteScreen({ tournamentId, onLogin, onDone }) {
  const [info, setInfo] = useState(undefined);   // undefined = laedt, null = nicht gefunden/Fehler
  const [guest, setGuest] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(null);

  useEffect(() => {
    let alive = true;
    supabase.rpc("tournament_invite_info", { p_tournament_id: tournamentId }).then(({ data, error: e }) => {
      if (alive) setInfo(e ? null : (data || null));
    });
    return () => { alive = false; };
  }, [tournamentId]);

  const login = () => { setRef(info?.ref); onLogin(); };

  const joinAsGuest = async () => {
    setBusy(true); setError("");
    const { data, error: e } = await supabase.rpc("tournament_join_guest", { p_tournament_id: tournamentId, p_nickname: name.trim() });
    setBusy(false);
    if (e) setError(e.message); else setJoined(data);
  };

  const open = info?.status === "setup";
  const inviteLink = (() => { const u = new URL("/", window.location.origin); u.searchParams.set("turnier", tournamentId); return u.toString(); })();

  return (
    <div className="screen login-screen">
      <div className="login-hero">
        <div className="login-balls"><Trophy size={46} color="var(--accent)" /></div>
        <h1 className="app-title">{info?.name || "Break & Rank"}</h1>
        {info && (
          <p className="app-sub">
            {formatLabel(info.format)} · <DiscBall disc={info.discipline} size={16} /> · {t("{n} angemeldet", { n: info.players })}
            {info.organizer && <><br />{t("Turnierleitung")}: <b>{info.organizer}</b></>}
          </p>
        )}
      </div>

      <div className="login-card">
        {info === undefined && <p className="hint center">{t("Lade ...")}</p>}

        {info === null && (
          <>
            <p className="nick-status err"><X size={14} /> {t("Dieses Turnier wurde nicht gefunden.")}</p>
            <button className="btn primary" onClick={onDone}>{t("Weiter zur App")} <ArrowRight size={18} /></button>
          </>
        )}

        {info && !open && !joined && (
          <>
            <p className="hint center">{t("Die Anmeldung für dieses Turnier ist nicht mehr offen.")}</p>
            <button className="btn primary" onClick={onDone}>{t("Weiter zur App")} <ArrowRight size={18} /></button>
          </>
        )}

        {info && open && joined && (
          <>
            <div className="sent-check"><Check size={28} /></div>
            <p className="sent-text">{t("Du bist dabei, {name}!", { name: joined.nickname })}</p>
            <p className="hint center">{t("Die Turnierleitung sieht dich in der Liste. Ergebnisse gegen Gäste zählen fürs Turnier, aber nicht fürs Rating.")}</p>
            {/* QR-Code zum Turnier: weitere Personen am Tisch koennen ihn gleich scannen */}
            <div className="qr-box">
              <QRCodeSVG value={inviteLink} size={170} level="M" bgColor="#F2EDE0" fgColor="#0A2B21" includeMargin />
            </div>
            <p className="hint center">{t("Dieser QR-Code führt zum Turnier – andere können ihn gleich scannen.")}</p>
            <button className="btn ghost" onClick={login}><UserPlus size={16} /> {t("Doch lieber registrieren")}</button>
          </>
        )}

        {info && open && !joined && !guest && (
          <>
            <p className="hint center">{t("Du bist zu diesem Turnier eingeladen.")}</p>
            <button className="btn primary" onClick={login}><UserCheck size={18} /> {t("Anmelden")} <ArrowRight size={18} /></button>
            <button className="btn ghost" onClick={() => setGuest(true)}>{t("Als Gast mitspielen")}</button>
          </>
        )}

        {info && open && !joined && guest && (
          <>
            <label className="field-label" htmlFor="guestname">{t("Dein Name")}</label>
            <div className="mail-row">
              <Ball nick={name || "?"} color="#2B5DA8" label={(name.trim()[0] || "?").toUpperCase()} size={28} />
              <input id="guestname" type="text" maxLength={30} placeholder={t("Name eingeben")} value={name} autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && name.trim().length >= 2 && joinAsGuest()} />
            </div>
            {error && <p className="nick-status err"><X size={14} /> {error}</p>}
            <button className="btn primary" disabled={busy || name.trim().length < 2} onClick={joinAsGuest}>
              {busy ? "..." : <>{t("Mitspielen")} <ArrowRight size={18} /></>}
            </button>
            <button className="btn ghost" onClick={() => { setGuest(false); setError(""); }}>{t("Zurück")}</button>
          </>
        )}
      </div>
    </div>
  );
}
