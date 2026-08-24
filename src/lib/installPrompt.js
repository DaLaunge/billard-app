import { useState, useEffect } from "react";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

/* Installations-Status: auf Android/Chrome liefert deferredPrompt einen echten
   Installations-Dialog (beforeinstallprompt), auf iOS Safari gibt es das nicht -
   dort bleibt nur eine Anleitung. canShow ist false, sobald die App schon als
   eigenstaendige App laeuft (kein Sinn, dann noch etwas anzuzeigen). */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  useEffect(() => {
    const onBip = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const ios = isIos();
  const canShow = !isStandalone() && (ios || !!deferredPrompt);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return { canShow, isIos: ios, hasPrompt: !!deferredPrompt, install };
}
