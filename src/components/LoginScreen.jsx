import { useState, useEffect, useRef } from "react";
import { Check, X, Mail, Lock, ArrowRight } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { getRef } from "../lib/session";
import Ball from "./Ball";
import LegalModal from "./LegalModal";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";

export default function LoginScreen() {
  const [mode, setMode] = useState("magic"); // Standard: gewohnter Magic-Link; Passwort ist ein Tipp entfernt
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [legalOpen, setLegalOpen] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestError, setGuestError] = useState("");
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const turnstileBoxRef = useRef(null);
  const turnstileWidgetId = useRef(null);

  // Cloudflare Turnstile fuer "Als Gast spielen" (Nutzer-Feedback: Anonymous
  // Sign-In ist der einzige Login-Weg ohne jede Reibung - Magic-Link ist
  // durch den Mailversand, Passwort-Logins durch Admin-Anlegen natuerlich
  // gebremst. Ohne Captcha koennte ein Skript in einer Schleife beliebig
  // viele Gast-Accounts erzeugen, siehe supabase/2026-09-15d_*.sql fuer die
  // serverseitigen Rate-Limits als zusaetzliche Verteidigungsebene). Das
  // Skript wird nur hier (Login-Screen) nachgeladen, nicht global in
  // index.html, damit eingeloggte Nutzer es nie sehen.
  //
  // Faellt das Skript aus (Werbeblocker, Firmennetz, Cloudflare-Ausfall),
  // darf der Button NICHT fuer immer gesperrt bleiben - nach 8 Sekunden ohne
  // Token wird er trotzdem freigegeben; ein fehlendes Captcha fuehrt dann
  // hoechstens zu einer Fehlermeldung von Supabase selbst, statt einer
  // stillen Sackgasse.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return; // kein Key konfiguriert -> Gast-Button bleibt ohne Captcha nutzbar (siehe unten)
    let cancelled = false;
    const renderWidget = () => {
      if (cancelled || !turnstileBoxRef.current || !window.turnstile || turnstileWidgetId.current) return;
      turnstileWidgetId.current = window.turnstile.render(turnstileBoxRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        size: "compact",
        callback: (token) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(null),
        "error-callback": () => setCaptchaUnavailable(true),
      });
    };
    const fallbackTimer = setTimeout(() => { if (!cancelled) setCaptchaUnavailable(true); }, 8000);
    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
      if (existing) {
        existing.addEventListener("load", renderWidget);
        existing.addEventListener("error", () => setCaptchaUnavailable(true));
      } else {
        const script = document.createElement("script");
        script.id = TURNSTILE_SCRIPT_ID;
        script.src = "https://challenge.cloudflare.com/turnstile/v0/api.js";
        script.async = true;
        script.defer = true;
        script.onload = renderWidget;
        script.onerror = () => setCaptchaUnavailable(true);
        document.body.appendChild(script);
      }
    }
    return () => { cancelled = true; clearTimeout(fallbackTimer); };
  }, []);

  const playAsGuest = async () => {
    setGuestBusy(true); setGuestError("");
    const { error } = await supabase.auth.signInAnonymously(
      captchaToken ? { options: { captchaToken } } : undefined
    );
    setGuestBusy(false);
    if (error) {
      setGuestError(error.message);
      // Turnstile-Token ist Einweg - nach einem Fehlversuch zuruecksetzen,
      // sonst kann nie wieder ein zweiter Versuch gestartet werden.
      if (window.turnstile && turnstileWidgetId.current) window.turnstile.reset(turnstileWidgetId.current);
      setCaptchaToken(null);
    }
  };

  const sendLink = async () => {
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
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
          <p className="hint" style={{ textAlign: "center" }}>
            {t("Oeffne die Mail auf DIESEM Geraet und tippe auf den Link. Nichts bekommen? Schau in den Spam-Ordner.")}
          </p>
          <button className="btn ghost" onClick={() => setSent(false)}>{t("Andere Adresse verwenden")}</button>
        </div>
      ) : (
        <div className="login-card">
          <div className="auth-tabs">
            <button className={"auth-tab" + (mode === "magic" ? " on" : "")}
              onClick={() => { setMode("magic"); setError(""); }}>{t("Magic-Link")}</button>
            <button className={"auth-tab" + (mode === "password" ? " on" : "")}
              onClick={() => { setMode("password"); setError(""); }}>{t("Passwort")}</button>
          </div>

          <label className="field-label" htmlFor="mail">{t("E-Mail-Adresse")}</label>
          <div className="mail-row">
            <Mail size={18} className="mail-ico" />
            <input id="mail" type="email" placeholder="du@beispiel.at" value={email} autoComplete="email"
              onChange={(e) => setEmail(e.target.value)} />
          </div>

          {mode === "password" ? (
            <>
              <label className="field-label" htmlFor="pw">{t("Passwort")}</label>
              <div className="mail-row">
                <Lock size={18} className="mail-ico" />
                <input id="pw" type="password" placeholder={t("Dein Passwort")} value={password} autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && email.includes("@") && password && signInPw()} />
              </div>
              {error && <p className="nick-status err"><X size={14} /> {error}</p>}
              <button className="btn primary" disabled={busy || !email.includes("@") || !password} onClick={signInPw}>
                {busy ? "..." : <>{t("Anmelden")} <ArrowRight size={18} /></>}
              </button>
              <button className="btn ghost" onClick={() => { setMode("magic"); setError(""); }}>
                {t("Passwort vergessen? Per Magic-Link anmelden")}
              </button>
              <p className="hint">{t("Neu hier? Einmal per Magic-Link anmelden und danach im Profil ein Passwort festlegen.")}</p>
            </>
          ) : (
            <>
              {error && <p className="nick-status err"><X size={14} /> {error}</p>}
              <button className="btn primary" disabled={busy || !email.includes("@")} onClick={sendLink}>
                {busy ? "Sende ..." : <>{t("Login-Link senden")} <ArrowRight size={18} /></>}
              </button>
              <p className="hint">{t("Kein Passwort noetig – du bekommst einen Link per Mail und bist drin. Ideal beim ersten Mal oder wenn du dein Passwort vergessen hast.")}</p>
            </>
          )}
        </div>
      )}

      {!sent && (
        <div className="login-card">
          {TURNSTILE_SITE_KEY && <div ref={turnstileBoxRef} className="turnstile-box" />}
          {guestError && <p className="nick-status err"><X size={14} /> {guestError}</p>}
          <button className="btn ghost" disabled={guestBusy || (!!TURNSTILE_SITE_KEY && !captchaToken && !captchaUnavailable)} onClick={playAsGuest}>
            {guestBusy ? "..." : t("Als Gast spielen")}
          </button>
          <p className="hint center">{t("Nur zu Besuch? Ohne Account als Gast einsteigen – zählt fürs Protokoll, aber nicht fürs Ranking.")}</p>
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
