import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ChevronLeft, X, Share2, Copy } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";

export default function InviteScreen({ me, onBack, toast }) {
  const [code, setCode] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("my_invite_code");
      if (error) setError(error.message);
      else setCode(data);
    })();
  }, []);

  const link = code ? `${window.location.origin}/?ref=${code}` : "";

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Break & Rank",
          text: `${me.nickname} lädt dich zum Billard-Ranking ein! Tippe auf den Link, um mitzumachen:`,
          url: link,
        });
      } catch { /* abgebrochen */ }
    } else {
      copy();
    }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast(t("Link kopiert!")); }
    catch { toast(t("Kopieren nicht möglich – Link markieren und kopieren.")); }
  };

  return (
    <div className="screen">
      <header className="screen-head with-back">
        <button className="back-btn" onClick={onBack} aria-label={t("Zurück")}><ChevronLeft size={22} /></button>
        <h2>{t("Freund einladen")}</h2>
      </header>

      {error && <p className="nick-status err"><X size={14} /> {error}</p>}

      <section className="stat-block invite-card">
        <p className="invite-lead">{t("Neuer Spieler? Einfach diesen Code mit der Handykamera scannen – das öffnet die App und führt direkt zur Anmeldung.")}</p>
        <div className="qr-box">
          {code ? (
            <QRCodeSVG value={link} size={210} level="M"
              bgColor="#F2EDE0" fgColor="#0A2B21" includeMargin />
          ) : (
            <div className="qr-loading">{t("Code wird erstellt …")}</div>
          )}
        </div>
        {code && <div className="invite-code">{t("Code:")} <b>{code}</b></div>}
      </section>

      <button className="btn primary" onClick={share} disabled={!code}>
        <Share2 size={18} /> {t("Einladung teilen")}
      </button>
      <button className="btn ghost" onClick={copy} disabled={!code}>
        <Copy size={16} /> {t("Link kopieren")}
      </button>
      <p className="hint">{t("Wer über deinen Code beitritt, wird dir als geworbener Spieler gutgeschrieben – dafür gibt es später eigene Erfolge.")}</p>
    </div>
  );
}
