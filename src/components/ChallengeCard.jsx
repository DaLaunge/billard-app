import { useState } from "react";
import { X, Pencil, Swords } from "lucide-react";
import { t } from "../lib/i18n";
import { initials, timeLeft } from "../lib/format";
import Ball from "./Ball";

export default function ChallengeCard({ challenge: c, role, colorOf, badgeOf, photoOf, isNewMsg, isNewReply, onDecline, onCancel, onEditMessage, onReply }) {
  const other = role === "to" ? c.challenger : c.challenged;
  const [editingMsg, setEditingMsg] = useState(false);
  const [msgDraft, setMsgDraft] = useState(c.message || "");
  const [editingReply, setEditingReply] = useState(false);
  const [replyDraft, setReplyDraft] = useState(c.reply || "");

  return (
    <section className={"stat-block challenge-card" + (role === "to" ? " to-me" : "")}>
      <div className="ping-head">
        <Ball color={colorOf(other.nickname)} label={initials(other.nickname)} badge={badgeOf(other.nickname)} photo={photoOf(other.nickname)} size={40} />
        <div className="ping-who">
          <b>{other.nickname}</b>
          <span className="rank-meta">
            {role === "to" ? t("fordert dich heraus") : t("wartet auf ein Match")} · {timeLeft(c.expires_at)}
          </span>
        </div>
        <Swords size={18} className="challenge-ico" />
      </div>

      {role === "from" ? (
        editingMsg ? (
          <div className="challenge-msg-form">
            <div className="search-row" style={{ marginBottom: 6 }}>
              <input value={msgDraft} maxLength={200} placeholder={t("z. B. 'Hast du heute Abend Zeit?'")}
                onChange={(e) => setMsgDraft(e.target.value)} />
            </div>
            <div className="sp-controls">
              <button className="btn ghost small" onClick={() => { setEditingMsg(false); setMsgDraft(c.message || ""); }}>{t("Abbrechen")}</button>
              <button className="btn primary small" onClick={() => { onEditMessage(c.id, msgDraft); setEditingMsg(false); }}>
                {t("Nachricht senden")}
              </button>
            </div>
          </div>
        ) : c.message ? (
          <p className="challenge-msg">"{c.message}" <button className="msg-edit-btn" onClick={() => setEditingMsg(true)} aria-label={t("Nachricht bearbeiten")}><Pencil size={12} /></button></p>
        ) : (
          <button className="btn ghost small" onClick={() => setEditingMsg(true)}>{t("Nachricht senden")}</button>
        )
      ) : (
        c.message && (
          <p className={"challenge-msg" + (isNewMsg ? " new" : "")}>
            {isNewMsg && <span className="new-dot" title={t("Neu")} />}"{c.message}"
          </p>
        )
      )}

      {role === "to" ? (
        editingReply ? (
          <div className="challenge-msg-form">
            <div className="search-row" style={{ marginBottom: 6 }}>
              <input value={replyDraft} maxLength={200} placeholder={t("Nachricht (optional)")}
                onChange={(e) => setReplyDraft(e.target.value)} />
            </div>
            <div className="sp-controls">
              <button className="btn ghost small" onClick={() => { setEditingReply(false); setReplyDraft(c.reply || ""); }}>{t("Abbrechen")}</button>
              <button className="btn primary small" onClick={() => { onReply(c.id, replyDraft); setEditingReply(false); }}>
                {t("Antwort senden")}
              </button>
            </div>
          </div>
        ) : c.reply ? (
          <p className="challenge-msg reply">"{c.reply}" <button className="msg-edit-btn" onClick={() => setEditingReply(true)} aria-label={t("Antwort bearbeiten")}><Pencil size={12} /></button></p>
        ) : (
          <button className="btn ghost small" onClick={() => setEditingReply(true)}>{t("Antworten")}</button>
        )
      ) : (
        c.reply && (
          <p className={"challenge-msg reply" + (isNewReply ? " new" : "")}>
            {isNewReply && <span className="new-dot" title={t("Neu")} />}"{c.reply}"
          </p>
        )
      )}

      <button className="btn ghost small" onClick={() => (role === "to" ? onDecline(c.id) : onCancel(c.id))}>
        <X size={15} /> {role === "to" ? t("Ablehnen") : t("Zurückziehen")}
      </button>
    </section>
  );
}
