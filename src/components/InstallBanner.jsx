import { useState, useEffect } from "react";
import { X, Download, Share } from "lucide-react";
import { t } from "../lib/i18n";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

/* Installations-Hinweis: auf Android/Chrome ein echter Button (beforeinstallprompt),
   auf iOS Safari nur eine Anleitung, da Apple das programmatische Ausloesen der
   Installation nicht erlaubt. Einmal weggeklickt, bleibt es dauerhaft weg. */
export default function InstallBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem("installBannerDismissed") === "1"; } catch { return false; }
  });
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const onBip = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem("installBannerDismissed", "1"); } catch { /* ignore */ }
  };

  if (dismissed || isStandalone()) return null;
  if (!isIos() && !deferredPrompt) return null; // Android ohne Prompt oder anderer Browser: nichts zeigen

  const installAndroid = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  };

  return (
    <div className="install-banner">
      {isIos() ? (
        <span className="install-banner-text">
          📲 {t("Installiere Break & Rank auf deinem Home-Bildschirm")} — <Share size={13} style={{ verticalAlign: "-2px" }} /> {t("Tippe unten auf Teilen, dann \"Zum Home-Bildschirm\"")}
        </span>
      ) : (
        <button className="install-banner-btn" onClick={installAndroid}>
          <Download size={16} /> {t("App installieren")}
        </button>
      )}
      <button className="install-banner-close" onClick={dismiss} aria-label={t("Schliessen")}><X size={15} /></button>
    </div>
  );
}
