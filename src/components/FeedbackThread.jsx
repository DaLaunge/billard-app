import { useState } from "react";
import { Send } from "lucide-react";
import { t } from "../lib/i18n";
import { fmtDateTime } from "../lib/format";

export default function FeedbackThread({ messages, meId, onSend }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const msg = text.trim();
    if (!msg || busy) return;
    setBusy(true);
    const ok = await onSend(msg);
    setBusy(false);
    if (ok) setText("");
  };

  return (
    <div className="feedback-thread">
      <div className="feedback-msgs">
        {messages.length === 0 && <p className="hint" style={{ margin: 0 }}>{t("Noch keine Nachrichten.")}</p>}
        {messages.map((m) => (
          <div key={m.id} className={"chat-bubble" + (m.sender_id === meId ? " mine" : "")}>
            <span className="chat-bubble-name">{m.sender?.nickname || t("Unbekannt")}</span>
            <span className="chat-bubble-text">{m.message}</span>
            <span className="chat-bubble-time">{fmtDateTime(m.created_at)}</span>
          </div>
        ))}
      </div>
      <div className="search-row" style={{ marginBottom: 0 }}>
        <input placeholder={t("Nachricht schreiben …")} value={text} maxLength={500}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="clear-btn" disabled={!text.trim() || busy} onClick={send} aria-label={t("Senden")}>
          <Send size={17} />
        </button>
      </div>
    </div>
  );
}
