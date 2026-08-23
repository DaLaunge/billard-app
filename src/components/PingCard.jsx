import { useState } from "react";
import { MapPin, Swords, Check, X } from "lucide-react";
import { t } from "../lib/i18n";
import { initials, timeAgo, timeLeft } from "../lib/format";
import Ball from "./Ball";

export default function PingCard({ ping, me, colorOf, badgeOf, onReply, onUnreply }) {
  const myReply = ping.replies?.find((r) => r.player_id === me.id);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const mine = ping.player_id === me.id;

  return (
    <section className={"stat-block ping-card" + (mine ? " mine" : "")}>
      <div className="ping-head">
        <Ball color={colorOf(ping.player.nickname)} label={initials(ping.player.nickname)} badge={badgeOf(ping.player.nickname)} size={40} />
        <div className="ping-who">
          <b>{ping.player.nickname}</b>
          <span className="rank-meta">{timeAgo(ping.created_at)} - {timeLeft(ping.expires_at)}</span>
        </div>
        <span className="live-pill"><span className="live-dot" /> LIVE</span>
      </div>
      <div className="ping-loc"><MapPin size={16} /> {ping.location}</div>
      {ping.message && <p className="ping-msg">"{ping.message}"</p>}

      {ping.replies?.length > 0 && (
        <div className="otw-count">🚗 {ping.replies.length} {ping.replies.length === 1 ? t("Person ist") : t("Leute sind")} {t("unterwegs")}</div>
      )}

      {ping.replies?.length > 0 && (
        <div className="ping-replies">
          {ping.replies.map((r) => (
            <div key={r.id} className="ping-reply">
              <Ball color={colorOf(r.player.nickname)} label={initials(r.player.nickname)} badge={badgeOf(r.player.nickname)} size={26} />
              <span><b>{r.player.nickname}</b>{r.message ? `: ${r.message}` : t(" ist unterwegs!")}</span>
            </div>
          ))}
        </div>
      )}

      {!mine && !myReply && !open && (
        <div className="sp-controls">
          <button className="btn primary small" onClick={() => onReply(ping.id, "")}>
            <Swords size={16} /> {t("Bin unterwegs")}
          </button>
          <button className="btn ghost small" onClick={() => setOpen(true)}>{t("mit Nachricht")}</button>
        </div>
      )}
      {!mine && !myReply && open && (
        <div className="reply-form">
          <div className="search-row" style={{ marginBottom: 8 }}>
            <input placeholder={t("Nachricht (optional), z. B. 'Bin um 19 Uhr da'")} value={msg}
              maxLength={120} onChange={(e) => setMsg(e.target.value)} />
          </div>
          <div className="confirm-actions">
            <button className="chip-btn ok" onClick={() => { onReply(ping.id, msg); setOpen(false); setMsg(""); }}>
              <Check size={15} /> {t("Unterwegs")}
            </button>
            <button className="chip-btn no" onClick={() => setOpen(false)}><X size={15} /> {t("Abbrechen")}</button>
          </div>
        </div>
      )}
      {!mine && myReply && (
        <button className="btn ghost" onClick={() => onUnreply(ping.id)}>
          <X size={15} /> {t("Zusage zurueckziehen")}
        </button>
      )}
    </section>
  );
}
