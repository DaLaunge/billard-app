import { useState, useEffect } from "react";
import { Lock, X } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";

export default function PasswordSection({ toast }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email || ""));
  }, []);

  const save = async () => {
    setMsg("");
    if (pw.length < 6) { setMsg("Mindestens 6 Zeichen."); return; }
    if (pw !== pw2) { setMsg("Die Passwörter stimmen nicht überein."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg("Fehler: " + error.message); return; }
    setPw(""); setPw2(""); setOpen(false);
    toast("Passwort gespeichert – du kannst dich künftig damit anmelden.");
  };

  return (
    <section className="stat-block">
      <h3><Lock size={17} /> {t("Anmeldung & Sicherheit")}</h3>
      {email && <p className="hint" style={{ marginTop: 0 }}>{t("Angemeldet als")} <b>{email}</b></p>}
      {!open ? (
        <button className="btn ghost" onClick={() => setOpen(true)}>{t("Passwort festlegen / ändern")}</button>
      ) : (
        <div className="pw-box">
          <input type="password" placeholder={t("Neues Passwort (min. 6 Zeichen)")} value={pw}
            autoComplete="new-password" onChange={(e) => setPw(e.target.value)} />
          <input type="password" placeholder={t("Passwort wiederholen")} value={pw2}
            autoComplete="new-password" onChange={(e) => setPw2(e.target.value)} />
          {msg && <p className="nick-status err"><X size={14} /> {msg}</p>}
          <div className="sp-controls">
            <button className="btn ghost" onClick={() => { setOpen(false); setPw(""); setPw2(""); setMsg(""); }}>{t("Abbrechen")}</button>
            <button className="btn primary" disabled={busy || !pw || !pw2} onClick={save}>
              {busy ? "..." : "Speichern"}
            </button>
          </div>
          <p className="hint">{t("Damit meldest du dich künftig mit E-Mail + Passwort an. Passwort vergessen? Der Magic-Link bringt dich immer rein.")}</p>
        </div>
      )}
    </section>
  );
}
