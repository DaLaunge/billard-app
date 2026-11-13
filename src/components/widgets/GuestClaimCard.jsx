import { useState } from "react";
import { UserPlus, Share2, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../../supabase";
import { t } from "../../lib/i18n";
import { claimLink } from "../../lib/inviteLink";

/* Nach dem Speichern eines Matches mit Gast: der Gast kann sich registrieren und behaelt dieses (und alle anderen) Matches im neuen Konto.
   Ein Knopf je Gast zeigt einen QR-Code mit seinem Uebernahme-Link (/?claim=...), den er mit dem eigenen Handy scannt
   (supabase/2026-11-09c_guest_claim.sql, App.jsx loest ihn nach der Registrierung ein). Ohne Migration bleibt der Block einfach unsichtbar. */
function One({ guest, toast }) {
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const toggle = async () => {
    if (open) { setOpen(false); return; }
    if (!link) {
      setBusy(true);
      const { data, error } = await supabase.rpc("guest_claim_code_member", { p_guest: guest.id });
      setBusy(false);
      if (error || !data) { toast?.(error?.message || t("Das ging leider nicht.")); return; }
      setLink(claimLink(data));
    }
    setOpen(true);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast?.(t("Link kopiert!")); } catch { toast?.(t("Kopieren nicht möglich – Link markieren und kopieren.")); }
  };
  const share = async () => {
    if (!navigator.share) { copy(); return; }
    try { await navigator.share({ title: "Break & Rank", text: t("Konto anlegen und deine Matches behalten:"), url: link }); } catch { /* abgebrochen */ }
  };
  return (
    <div className="guest-claim">
      <button type="button" className="btn ghost" disabled={busy} onClick={toggle}>
        <UserPlus size={16} /> {t("{name}: Konto anlegen, Matches behalten", { name: guest.nickname })}
      </button>
      <div className={"collapsible" + (open ? " open" : "")} inert={open ? undefined : ""}>
        <div className="collapsible-inner">
          {link && (
            <div className="tqr-panel">
              <div className="qr-box"><QRCodeSVG value={link} size={190} level="M" bgColor="#F2EDE0" fgColor="#0A2B21" includeMargin /></div>
              <p className="hint center">{t("Mit dem Handy scannen, anmelden – fertig. Alle Matches zählen dann für Rangliste und Erfolge.")}</p>
              <div className="chips small" style={{ justifyContent: "center" }}>
                <button type="button" className="icon-btn" onClick={share} aria-label={t("Einladung teilen")} title={t("Einladung teilen")}><Share2 size={18} /></button>
                <button type="button" className="icon-btn" onClick={copy} aria-label={t("Link kopieren")} title={t("Link kopieren")}><Copy size={18} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GuestClaimCard({ guests, toast }) {
  const list = (guests || []).filter((g) => g?.is_guest && g.id);
  if (!list.length) return null;
  return <div className="guest-claim-list">{list.map((g) => <One key={g.id} guest={g} toast={toast} />)}</div>;
}
