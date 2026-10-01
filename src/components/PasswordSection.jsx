import { useState, useEffect } from "react";
import { Lock, X, Check, KeyRound } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import InfoButton from "./widgets/InfoButton";

/* Anmeldung & Sicherheit als Zeile in der Karte "Konto & Hilfe" (Profil
   bearbeiten), keine eigene Karte mehr: die E-Mail-Adresse und ein
   Schluessel-Symbol statt eines breiten Textknopfs; die Erklaerung steckt im
   Info-Knopf (Nutzer-Feedback 2026-09-30). */
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
    if (pw.length < 6) { setMsg(t("Mindestens 6 Zeichen.")); return; }
    if (pw !== pw2) { setMsg(t("Die Passwörter stimmen nicht überein.")); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg(t("Fehler: ") + error.message); return; }
    setPw(""); setPw2(""); setOpen(false);
    toast(t("Passwort gespeichert – du kannst dich künftig damit anmelden."));
  };

  return (
    <div className="acct-sub">
      <div className="acct-row">
        <Lock size={16} className="acct-ico" />
        <span className="acct-text">
          {email ? <><span className="acct-dim">{t("Angemeldet als")}</span> <b>{email}</b></> : t("Anmeldung & Sicherheit")}
        </span>
        {!open && (
          <button type="button" className="icon-btn" onClick={() => setOpen(true)}
            aria-label={t("Passwort festlegen / ändern")} title={t("Passwort festlegen / ändern")}>
            <KeyRound size={18} />
          </button>
        )}
        <InfoButton title={t("Anmeldung & Sicherheit")}>
          {t("Damit meldest du dich künftig mit E-Mail + Passwort an. Passwort vergessen? Der Magic-Link bringt dich immer rein.")}
        </InfoButton>
      </div>
      {open && (
        <div className="pw-box">
          <input type="password" placeholder={t("Neues Passwort (min. 6 Zeichen)")} value={pw}
            autoComplete="new-password" onChange={(e) => setPw(e.target.value)} />
          <input type="password" placeholder={t("Passwort wiederholen")} value={pw2}
            autoComplete="new-password" onChange={(e) => setPw2(e.target.value)} />
          {msg && <p className="nick-status err"><X size={14} /> {msg}</p>}
          <div className="acct-actions">
            <button type="button" className="icon-btn" aria-label={t("Abbrechen")} title={t("Abbrechen")}
              onClick={() => { setOpen(false); setPw(""); setPw2(""); setMsg(""); }}>
              <X size={18} />
            </button>
            <button type="button" className="icon-btn primary" disabled={busy || !pw || !pw2} onClick={save}
              aria-label={t("Speichern")} title={t("Speichern")}>
              <Check size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
