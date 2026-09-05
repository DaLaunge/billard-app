import { useState } from "react";
import { Lock, X, LogOut } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import Ball from "./Ball";

export default function ForcePasswordScreen({ onDone, onLogout }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (pw.length < 6) { setError(t("Mindestens 6 Zeichen.")); return; }
    if (pw !== pw2) { setError(t("Die Passwörter stimmen nicht überein.")); return; }
    setBusy(true);
    const { error: upErr } = await supabase.auth.updateUser({ password: pw });
    if (upErr) { setBusy(false); setError(t("Fehler: ") + upErr.message); return; }
    const { error: rpcErr } = await supabase.rpc("clear_must_change_password");
    setBusy(false);
    if (rpcErr) { setError(t("Fehler: ") + rpcErr.message); return; }
    onDone();
  };

  return (
    <div className="screen login-screen">
      <div className="login-hero">
        <div className="login-balls">
          <Ball color="#E8B321" label="1" size={54} />
          <Ball color="#2B5DA8" label="2" size={54} />
          <Ball color="#C0392B" label="3" size={54} />
        </div>
        <h1 className="app-title">{t("Neues Passwort")}</h1>
        <p className="app-sub">{t("Ein Admin hat dir ein neues Passwort vergeben. Lege jetzt dein eigenes fest, um fortzufahren.")}</p>
      </div>

      <div className="login-card">
        <label className="field-label" htmlFor="fpw1">{t("Neues Passwort")}</label>
        <div className="mail-row">
          <Lock size={18} className="mail-ico" />
          <input id="fpw1" type="password" placeholder={t("Neues Passwort (min. 6 Zeichen)")} value={pw}
            autoComplete="new-password" onChange={(e) => setPw(e.target.value)} />
        </div>
        <label className="field-label" htmlFor="fpw2">{t("Passwort wiederholen")}</label>
        <div className="mail-row">
          <Lock size={18} className="mail-ico" />
          <input id="fpw2" type="password" placeholder={t("Passwort wiederholen")} value={pw2}
            autoComplete="new-password" onChange={(e) => setPw2(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && pw && pw2 && save()} />
        </div>
        {error && <p className="nick-status err"><X size={14} /> {error}</p>}
        <button className="btn primary" disabled={busy || !pw || !pw2} onClick={save}>
          {busy ? "..." : t("Passwort speichern")}
        </button>
        <button className="btn ghost" onClick={onLogout}><LogOut size={16} /> {t("Abmelden")}</button>
      </div>
    </div>
  );
}
