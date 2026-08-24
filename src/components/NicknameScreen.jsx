import { useState } from "react";
import { Check, X, User, ArrowRight } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { getRef, clearRef } from "../lib/session";
import Ball from "./Ball";

export default function NicknameScreen({ onRegistered, existingPlayers }) {
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const clean = nick.trim();

  const legacyMatch = existingPlayers.find(
    (p) => p.nickname.toLowerCase() === clean.toLowerCase() && !p.auth_user_id
  );
  const taken = existingPlayers.find(
    (p) => p.nickname.toLowerCase() === clean.toLowerCase() && p.auth_user_id
  );
  const tooShort = clean.length > 0 && clean.length < 2;
  const valid = clean.length >= 2 && clean.length <= 30 && !taken;

  const register = async () => {
    setBusy(true); setError("");
    const { data, error } = await supabase.rpc("register_player", { p_nickname: clean, p_ref: getRef() });
    setBusy(false);
    if (error) setError(error.message);
    else { clearRef(); onRegistered(data); }
  };

  return (
    <div className="screen login-screen">
      <div className="login-hero">
        <div className="login-balls"><Ball color="#6C4AB0" label="?" size={54} /></div>
        <h1 className="app-title" style={{ fontSize: 28 }}>{t("Wie sollen wir dich nennen?")}</h1>
        <p className="app-sub">{t("Dein Nickname erscheint in Rangliste und Statistiken.")}<br />{t("Er muss im Verein eindeutig sein.")}</p>
      </div>
      <div className="login-card">
        <label className="field-label" htmlFor="nick">{t("Nickname")}</label>
        <div className="mail-row">
          <User size={18} className="mail-ico" />
          <input id="nick" value={nick} maxLength={30} placeholder={t("z. B. Kleiner Stefan")}
            autoComplete="off" onChange={(e) => setNick(e.target.value)} />
        </div>
        {clean.length === 0 && <p className="nick-status dim">{t("2 bis 30 Zeichen.")}</p>}
        {tooShort && <p className="nick-status warn">{t("Noch zu kurz - mindestens 2 Zeichen.")}</p>}
        {taken && <p className="nick-status err"><X size={14} /> {t("Dieser Name ist schon vergeben.")}</p>}
        {legacyMatch && (
          <p className="nick-status ok"><Check size={14} /> "{legacyMatch.nickname}" {t("gefunden! Deine bisherige Match-Historie wird uebernommen.")}</p>
        )}
        {valid && !legacyMatch && <p className="nick-status ok"><Check size={14} /> "{clean}" {t("ist verfügbar!")}</p>}
        {error && <p className="nick-status err"><X size={14} /> {error}</p>}
        <button className="btn primary" disabled={!valid || busy} onClick={register}>
          {busy ? t("Speichere ...") : <>{t("Los geht's")} <ArrowRight size={18} /></>}
        </button>
        <p className="hint">{t("Warst du schon im alten Telegram-Ranking dabei? Dann gib genau deinen damaligen Nicknamen ein, um deine Historie zu behalten.")}</p>
      </div>
    </div>
  );
}
