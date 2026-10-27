import { useState } from "react";
import { createPortal } from "react-dom";
import { QrCode, X, Share2, Copy, UserCheck, UserPlus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { t } from "../../lib/i18n";

/* Einladungs-QR eines Turniers (/?turnier=<id>): ein Knopf, der einen grossen QR-Code in einem Fenster zeigt - zum Vorzeigen am Tisch.
   Mitglieder sind damit sofort angemeldet, Neue melden sich an oder spielen als Gast (TurnierInviteScreen). Der Knopf steht im geoeffneten
   Turnier gross oben und in der Turnieruebersicht an jeder Zeile (dort mit stopPropagation: die Zeile soll sich nicht oeffnen). */
export const turnierLink = (id) => { const u = new URL("/", window.location.origin); u.searchParams.set("turnier", id); return u.toString(); };

export default function TurnierQrButton({ tour, toast, size = 18, className = "icon-btn" }) {
  const [open, setOpen] = useState(false);
  const link = turnierLink(tour.id);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast(t("Link kopiert!")); }
    catch { toast(t("Kopieren nicht möglich – Link markieren und kopieren.")); }
  };
  const share = async () => {
    if (!navigator.share) { copy(); return; }
    try { await navigator.share({ title: tour.name, text: t("Du bist zum Turnier „{name}“ eingeladen:", { name: tour.name }), url: link }); } catch { /* abgebrochen */ }
  };
  return (
    <>
      <button type="button" className={className} title={t("Einladungslink / QR-Code")} aria-label={t("Einladungslink / QR-Code")}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }} onKeyDown={(e) => e.stopPropagation()}>
        <QrCode size={size} />
      </button>
      {open && createPortal(
        <div className="celebrate-overlay" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
          <div className="celebrate-card tqr-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="icon-btn small tqr-close" onClick={() => setOpen(false)} aria-label={t("Schließen")} title={t("Schließen")}><X size={16} /></button>
            <div className="celebrate-head">{tour.name}</div>
            <div className="qr-box">
              <QRCodeSVG value={link} size={240} level="M" bgColor="#F2EDE0" fgColor="#0A2B21" includeMargin />
            </div>
            <div className="qr-uses" style={{ marginTop: 8 }}>
              <span><UserCheck size={14} /> {t("Mitglied: sofort dabei")}</span>
              <span><UserPlus size={14} /> {t("Neu: anmelden oder Gast")}</span>
            </div>
            <div className="chips small" style={{ justifyContent: "center", marginTop: 10 }}>
              <button type="button" className="icon-btn" onClick={share} aria-label={t("Einladung teilen")} title={t("Einladung teilen")}><Share2 size={18} /></button>
              <button type="button" className="icon-btn" onClick={copy} aria-label={t("Link kopieren")} title={t("Link kopieren")}><Copy size={18} /></button>
            </div>
          </div>
        </div>, document.body)}
    </>
  );
}
