import { useState } from "react";
import { Check, X, Mail, Lock, ArrowRight } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { getRef, getTurnierInvite, getWsInvite } from "../lib/session";
import { isIos, isStandalone } from "../lib/notifications";
import Ball from "./Ball";
import LegalModal from "./LegalModal";

const OTP_MIN = 6;
const OTP_MAX = 10;

// Schlichte Formpruefung: etwas@domain.endung - ein bloesses "@" reicht nicht,
// sonst erscheint der Knopf schon bei "a@" und Supabase lehnt die Adresse ab.
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

// Haeufige Tippfehler in der Domain; der Vorschlag ist ein Tipp, kein Zwang.
const DOMAIN_FIX = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmail.co": "gmail.com", "gamil.com": "gmail.com",
  "gmx.at.com": "gmx.at", "gmx.de.com": "gmx.de", "hotmal.com": "hotmail.com", "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com", "yahho.com": "yahoo.com", "yaho.com": "yahoo.com", "icloud.co": "icloud.com",
};
const suggestMail = (v) => {
  const m = v.trim().match(/^([^\s@]+)@([^\s@]+)$/);
  const fix = m && DOMAIN_FIX[m[2].toLowerCase()];
  return fix ? m[1] + "@" + fix : null;
};

export default function LoginScreen() {
  const [mode, setMode] = useState("magic"); // Standard: gewohnter Magic-Link; Passwort ist ein Tipp entfernt
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [legalOpen, setLegalOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [mailTouched, setMailTouched] = useState(false);

  const mailOk = validEmail(email);
  const mailFix = suggestMail(email);
  // Hinweis erst, wenn die Eingabe nach einer Adresse aussieht oder das Feld verlassen wurde -
  // wer gerade erst tippt, soll nicht schon beim ersten Buchstaben eine Fehlermeldung sehen.
  const mailWarn = !mailOk && email.trim() !== "" && (mailTouched || email.includes("@"));

  const sendLink = async () => {
    setBusy(true); setError("");
    // Einladungs-Code an die Rueckkehradresse haengen: oeffnet die Mail-App den
    // Link in einem anderen Browser/Webview als dem, in dem der QR-Code
    // gescannt wurde, ist der Code dort sonst unbekannt (localStorage ist pro
    // Browser) - die Werbung wuerde niemandem gutgeschrieben. Kennt Supabase
    // die Adresse mit Parameter nicht (Redirect-Allowlist), faellt es auf die
    // Site-URL zurueck; dann greift wie bisher der lokal gespeicherte Code.
    const ref = getRef();
    const turnier = getTurnierInvite();
    const ru = new URL("/", window.location.origin);
    if (ref) ru.searchParams.set("ref", ref);
    if (turnier) ru.searchParams.set("turnier", turnier);   // Turnier-Einladung ueberlebt den Browserwechsel
    const ws = getWsInvite();
    if (ws) ru.searchParams.set("ws", ws);
    const redirect = ru.search ? ru.toString() : window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirect },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  // Alternative zum Link-Klick: Supabase verschickt bei signInWithOtp immer
  // auch einen Zahlencode in derselben Mail (Mail-Vorlage muss
  // {{ .Token }} enthalten). Wichtig auf iOS: oeffnet die Mail-App den Link
  // in einem anderen Browser/In-App-Webview als dem, den man sonst nutzt
  // (eigener, separater localStorage!), landet die Sitzung dort und man
  // sieht sich in seinem eigentlichen Browser weiter als ausgeloggt - der
  // Code umgeht das, weil verifyOtp() direkt in DIESEM Tab laeuft und die
  // Sitzung darum garantiert im richtigen Speicher landet.
  const verifyCode = async () => {
    setCodeBusy(true); setCodeError("");
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setCodeBusy(false);
    if (error) setCodeError(error.message);
  };

  const signInPw = async () => {
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (!error) return;
    // Vorher wurde hier IMMER dieselbe generische Meldung gezeigt, egal was
    // Supabase tatsaechlich zurueckgab - das hat "Email not confirmed" (z.B.
    // bei admin-angelegten Accounts, wenn dort was nicht stimmt) genauso
    // aussehen lassen wie ein simples Tippfehler-Passwort. Bekannte Faelle
    // bekommen eine klare deutsche Meldung, alles andere zeigt den
    // Original-Fehlertext (wie beim Magic-Link oben), damit unerwartete
    // Fehler nicht mehr unsichtbar bleiben.
    if (error.message === "Email not confirmed") {
      setError(t("Diese E-Mail-Adresse ist noch nicht bestätigt."));
    } else if (error.message === "Invalid login credentials") {
      setError(t("Anmeldung fehlgeschlagen – Passwort falsch oder noch keins gesetzt. Nutze den Magic-Link."));
    } else {
      setError(error.message);
    }
  };

  return (
    <div className="screen login-screen">
      <div className="login-hero">
        <div className="login-balls">
          <Ball color="#E8B321" label="1" size={54} />
          <Ball color="#2B5DA8" label="2" size={54} />
          <Ball color="#C0392B" label="3" size={54} />
        </div>
        <h1 className="app-title">Break &amp; Rank</h1>
        <p className="app-sub">{t("Das Ranking eures Vereins.")}<br />{t("Fargo-Style, fair, immer aktuell.")}</p>
        {getRef() && (
          <p className="invite-note"><Check size={14} /> {t("Du wurdest eingeladen – melde dich an, um dabei zu sein!")}</p>
        )}
      </div>

      {sent ? (
        <div className="login-card">
          <div className="sent-check"><Check size={28} /></div>
          <p className="sent-text">{t("Link gesendet an")}<br /><b>{email}</b></p>
          {/* Home-Bildschirm-App auf dem iPhone: Der Link oeffnet dort IMMER
              Safari, und Safari hat einen von der App getrennten Speicher -
              die Anmeldung landete in Safari, die App blieb ausgeloggt (nur
              iPhones haben das gemeldet, Android teilt den Speicher). Dort
              darum gleich auf den Code lenken statt auf den Link. */}
          {isIos() && isStandalone() ? (
            <p className="hint center" style={{ marginTop: 10 }}>
              <b>{t("Auf dem iPhone öffnet der Link Safari statt dieser App. Gib hier den Code aus der Mail ein, dann bist du direkt in der App angemeldet.")}</b>
            </p>
          ) : (
            <>
              <p className="hint" style={{ textAlign: "center" }}>
                {t("Oeffne die Mail auf DIESEM Geraet und tippe auf den Link. Nichts bekommen? Schau in den Spam-Ordner.")}
              </p>
              <p className="hint center" style={{ marginTop: 10 }}>{t("Oder gib den Code aus derselben Mail ein:")}</p>
            </>
          )}
          <label className="field-label" htmlFor="otp">{t("Code")}</label>
          <div className="mail-row">
            <Lock size={18} className="mail-ico" />
            {/* 6 bis 10 Stellen: die Laenge stellt Supabase ein (Authentication
                -> Providers -> Email -> "Email OTP Length", 6-10, Prod steht
                auf 8). Bis 2026-09-26 war hier hart 6 - ein 8-stelliger Code
                liess sich dann gar nicht eingeben. */}
            <input id="otp" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={OTP_MAX} placeholder="12345678"
              value={code} autoComplete="one-time-code"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, OTP_MAX))}
              onKeyDown={(e) => e.key === "Enter" && code.length >= OTP_MIN && verifyCode()} />
          </div>
          {codeError && <p className="nick-status err"><X size={14} /> {codeError}</p>}
          <button className="btn primary" disabled={codeBusy || code.length < OTP_MIN} onClick={verifyCode}>
            {codeBusy ? "..." : <>{t("Code bestätigen")} <ArrowRight size={18} /></>}
          </button>
          <p className="hint" style={{ textAlign: "center" }}>
            {t("Praktisch, wenn der Link die Mail-App in einem anderen Browser oeffnet als dem, den du sonst nutzt.")}
          </p>

          <button className="btn ghost" onClick={() => { setSent(false); setCode(""); setCodeError(""); }}>{t("Andere Adresse verwenden")}</button>
        </div>
      ) : (
        <div className="login-card">
          <label className="field-label" htmlFor="mail">{t("E-Mail-Adresse")}</label>
          <div className="mail-row">
            <Mail size={18} className="mail-ico" />
            <input id="mail" type="email" placeholder="du@beispiel.at" value={email} autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setMailTouched(true)}
              onKeyDown={(e) => e.key === "Enter" && mode === "magic" && mailOk && !busy && sendLink()} />
          </div>
          {mailFix ? (
            <p className="nick-status warn">
              {t("Meintest du")}{" "}
              <button type="button" className="legal-link" onClick={() => setEmail(mailFix)}>{mailFix}</button>?
            </p>
          ) : mailWarn ? (
            <p className="nick-status warn">{t("Das ist noch keine vollständige E-Mail-Adresse, z. B. du@beispiel.at.")}</p>
          ) : !mailOk ? (
            <p className="nick-status warn"><Mail size={14} style={{ flex: "none", marginTop: 2 }} />
              {mode === "magic"
                ? t("Gib zuerst deine E-Mail-Adresse ein – dann erscheint der Knopf für den Login-Link.")
                : t("Gib zuerst deine E-Mail-Adresse und dein Passwort ein.")}
            </p>
          ) : null}

          {mode === "password" ? (
            <>
              <label className="field-label" htmlFor="pw">{t("Passwort")}</label>
              <div className="mail-row">
                <Lock size={18} className="mail-ico" />
                <input id="pw" type="password" placeholder={t("Dein Passwort")} value={password} autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && mailOk && password && signInPw()} />
              </div>
              {error && <p className="nick-status err"><X size={14} /> {error}</p>}
              <button className="btn primary" disabled={busy || !mailOk || !password} onClick={signInPw}>
                {busy ? "..." : <>{t("Anmelden")} <ArrowRight size={18} /></>}
              </button>
              <button className="btn ghost" onClick={() => { setMode("magic"); setError(""); }}>
                {t("Passwort vergessen? Per Login-Link anmelden")}
              </button>
              <p className="hint">{t("Neu hier? Einmal per Magic-Link anmelden und danach im Profil ein Passwort festlegen.")}</p>
            </>
          ) : (
            <>
              {error && <p className="nick-status err"><X size={14} /> {error}</p>}
              {/* Der Knopf erscheint erst, wenn die Adresse stimmt: vorher gibt es nichts
                  zu senden, und ein ausgegrauter Knopf am Anfang liest sich wie ein Fehler. */}
              <div className={"collapsible" + (mailOk ? " open" : "")} inert={mailOk ? undefined : ""}>
                <div className="collapsible-inner">
                  <button className="btn primary" disabled={busy || !mailOk} onClick={sendLink} style={{ width: "100%" }}>
                    {busy ? "Sende ..." : <>{t("Login-Link senden")} <ArrowRight size={18} /></>}
                  </button>
                </div>
              </div>
              <p className="hint">{t("Kein Passwort noetig – du bekommst einen Link per Mail und bist drin. Ideal beim ersten Mal oder wenn du dein Passwort vergessen hast.")}</p>
              <p className="hint center">
                <button type="button" className="legal-link" onClick={() => { setMode("password"); setError(""); }}>{t("Lieber mit Passwort anmelden")}</button>
              </p>
            </>
          )}
        </div>
      )}

      <p className="hint center" style={{ marginTop: 14 }}>
        {t("Mit dem Fortfahren akzeptierst du die")}{" "}
        <button className="legal-link" onClick={() => setLegalOpen(true)}>{t("Nutzungsbedingungen & Datenschutzerklärung")}</button>.
      </p>
      {legalOpen && <LegalModal onClose={() => setLegalOpen(false)} />}
    </div>
  );
}
