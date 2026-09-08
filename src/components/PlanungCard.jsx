import { useState } from "react";
import { Calendar, Check, X } from "lucide-react";
import { t } from "../lib/i18n";
import { initials, fmtDate } from "../lib/format";
import Ball from "./Ball";

export default function PlanungCard({ planning, me, colorOf, badgeOf, photoOf, onReply, onUnreply, onDelete, onOpenProfile }) {
  const myReply = planning.replies?.find((r) => r.player_id === me.id);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const mine = planning.player_id === me.id;

  return (
    <section className={"stat-block ping-card" + (mine ? " mine" : "")}>
      <button className="ping-head as-btn" onClick={() => onOpenProfile(planning.player.nickname)}>
        <Ball color={colorOf(planning.player.nickname)} label={initials(planning.player.nickname)} badge={badgeOf(planning.player.nickname)} photo={photoOf(planning.player.nickname)} size={40} />
        <div className="ping-who">
          <b>{planning.player.nickname}</b>
        </div>
        <span className="plan-pill"><Calendar size={12} /> {fmtDate(planning.planned_date)}</span>
      </button>
      {planning.message && <p className="ping-msg">"{planning.message}"</p>}

      {planning.replies?.length > 0 && (
        <div className="otw-count">🗓️ {planning.replies.length} {planning.replies.length === 1 ? t("Person ist") : t("Leute sind")} {t("interessiert")}</div>
      )}

      {planning.replies?.length > 0 && (
        <div className="ping-replies">
          {planning.replies.map((r) => (
            <button key={r.id} className="ping-reply as-btn" onClick={() => onOpenProfile(r.player.nickname)}>
              <Ball color={colorOf(r.player.nickname)} label={initials(r.player.nickname)} badge={badgeOf(r.player.nickname)} photo={photoOf(r.player.nickname)} size={26} />
              <span><b>{r.player.nickname}</b>{r.message ? `: ${r.message}` : t(" ist interessiert!")}</span>
            </button>
          ))}
        </div>
      )}

      {mine && (
        <button className="btn ghost" onClick={() => onDelete(planning.id)}>
          <X size={15} /> {t("Planung löschen")}
        </button>
      )}

      {!mine && !myReply && !open && (
        <div className="sp-controls">
          <button className="btn primary small" onClick={() => onReply(planning.id, "")}>
            <Calendar size={16} /> {t("Bin interessiert")}
          </button>
          <button className="btn ghost small" onClick={() => setOpen(true)}>{t("mit Nachricht")}</button>
        </div>
      )}
      {!mine && !myReply && open && (
        <div className="reply-form">
          <div className="search-row" style={{ marginBottom: 8 }}>
            <input placeholder={t("Nachricht (optional), z. B. 'Passt mir gut'")} value={msg}
              maxLength={120} onChange={(e) => setMsg(e.target.value)} />
          </div>
          <div className="confirm-actions">
            <button className="chip-btn ok" onClick={() => { onReply(planning.id, msg); setOpen(false); setMsg(""); }}>
              <Check size={15} /> {t("Interessiert")}
            </button>
            <button className="chip-btn no" onClick={() => setOpen(false)}><X size={15} /> {t("Abbrechen")}</button>
          </div>
        </div>
      )}
      {!mine && myReply && (
        <button className="btn ghost" onClick={() => onUnreply(planning.id)}>
          <X size={15} /> {t("Zusage zurueckziehen")}
        </button>
      )}
    </section>
  );
}
