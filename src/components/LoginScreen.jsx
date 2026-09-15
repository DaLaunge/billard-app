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
  const turnstileBoxRef = useRef(null);
  const turnstileWidgetId = useRef(null);

  // Cloudflare Turnstile - EIN Widget fuers ganze Login-Screen, nicht nur
  // fuer "Als Gast spielen": Supabase wendet eine aktivierte Captcha-Pflicht
  // serverseitig auf ALLE Auth-Endpunkte an (Passwort-Login, Magic-Link,
  // Anonymous Sign-In) - eine Beschraenkung nur auf einen einzelnen Login-Weg
  // ist im Supabase-Dashboard nicht moeglich. Das Skript wird nur hier
  // (Login-Screen) nachgeladen, nicht global in index.html, damit eingeloggte
  // Nutzer es nie sehen. Das Widget bleibt bewusst IMMER im DOM (auch auf dem
  // "Link gesendet"-Zwischenschritt) statt nur innerhalb von {!sent && ...}
  // zu haengen - sonst wuerde React es beim Umschalten zerstoeren und beim
  // Zurueckwechseln (z.B. "Andere Adresse verwenden") nie neu rendern, weil
  // der Aufbau-Effekt unten nur einmal beim Mount laeuft.
  //
  // Kein Login-Weg wartet auf ein Token, bevor er ueberhaupt klickbar wird -
  // faellt das Skript aus (Werbeblocker, Firmennetz, Cloudflare-Ausfall),
  // wird einfach ohne Token versucht; ein fehlendes Captcha fuehrt dann
  // hoechstens zu einer Fehlermeldung von Supabase selbst, statt einer
  // stillen Sackgasse.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return; // kein Key konfiguriert -> alle Login-Wege bleiben ohne Captcha nutzbar
    let cancelled = false;
    const renderWidget = () => {
      if (cancelled || !turnstileBoxRef.current || !window.turnstile || turnstileWidgetId.current) return;
      turnstileWidgetId.current = window.turnstile.render(turnstileBoxRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        size: "compact",
        callback: (token) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(null),
      });
    };
    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
      if (existing) {
        existing.addEventListener("load", renderWidget);
      } else {
        const script = document.createElement("script");
        script.id = TURNSTILE_SCRIPT_ID;
        script.src = "https://challenge.cloudflare.com/turnstile/v0/api.js";
        script.async = true;
        script.defer = true;
        script.onload = renderWidget;
        document.body.appendChild(script);
      }
    }
    return () => { cancelled = true; };
  }, []);

  // Turnstile-Token ist Einweg - nach JEDEM Versuch (egal ob erfolgreich
  // oder nicht) zuruecksetzen, damit der naechste Login-Versuch (auch ein
  // Wechsel zwischen Magic-Link/Passwort/Gast) wieder ein frisches Token hat.
  const resetCaptcha = () => {
    if (window.turnstile && turnstileWidgetId.current) window.turnstile.reset(turnstileWidgetId.current);
    setCaptchaToken(null);
  };
  // Supabase liefert bei fehlendem/abgelaufenem Captcha nur einen englischen
  // Rohtext - gleiche Idee wie bei den bekannten Faellen in signInPw()
  // unten: uebersetzen statt roh durchreichen.
  const friendlyError = (msg) => msg.includes("captcha")
    ? t("Sicherheitsprüfung fehlgeschlagen - bitte Seite neu laden und nochmal versuchen.")
    : msg;

  const playAsGuest = async () => {
    setGuestBusy(true); setGuestError("");
    const { error } = await supabase.auth.signInAnonymously(
      captchaToken ? { options: { captchaToken } } : undefined
    );
    setGuestBusy(false);
    resetCaptcha();
    if (error) setGuestError(friendlyError(error.message));
  };

  const sendLink = async () => {
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin, captchaToken: captchaToken || undefined },
    });
    setBusy(false);
    resetCaptcha();
    if (error) setError(friendlyError(error.message));
    else setSent(true);
  };

  const signInPw = async () => {
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(), password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    setBusy(false);
    resetCaptcha();
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
      setError(friendlyError(error.message));
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

      {TURNSTILE_SITE_KEY && <div ref={turnstileBoxRef} className="turnstile-box" />}

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
          {guestError && <p className="nick-status err"><X size={14} /> {guestError}</p>}
          <button className="btn ghost" disabled={guestBusy} onClick={playAsGuest}>
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
