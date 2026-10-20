import { useState, useEffect } from "react";
import { ChevronDown, MessageSquare, Check, RotateCcw } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import FeedbackThread from "./FeedbackThread";
import { EmojiText } from "./Emoji";

// Zeile in der Karte "Konto & Hilfe" (Profil bearbeiten), keine eigene Karte.
export default function MyFeedbackTickets({ playerId, toast, refreshKey }) {
  const [tickets, setTickets] = useState(null);
  const [msgsByTicket, setMsgsByTicket] = useState({});
  const [openId, setOpenId] = useState(null);
  const [seen, setSeen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`seenFeedbackMine:${playerId}`) || "{}"); } catch { return {}; }
  });

  const load = async () => {
    const { data: fb } = await supabase.from("feedback")
      .select("id, category, message, status, created_at")
      .order("created_at", { ascending: false });
    setTickets(fb || []);
    const { data: msgs } = await supabase.from("feedback_messages")
      .select("id, feedback_id, sender_id, message, created_at, sender:players!feedback_messages_sender_id_fkey(nickname)")
      .order("created_at");
    const grouped = {};
    (msgs || []).forEach((m) => { (grouped[m.feedback_id] ||= []).push(m); });
    setMsgsByTicket(grouped);
  };
  useEffect(() => { load(); }, [refreshKey]);

  const toggle = (id) => {
    setOpenId(openId === id ? null : id);
    const next = { ...seen, [id]: new Date().toISOString() };
    setSeen(next);
    try { localStorage.setItem(`seenFeedbackMine:${playerId}`, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const send = async (feedbackId, message) => {
    const { error } = await supabase.rpc("send_feedback_message", { p_feedback_id: feedbackId, p_message: message });
    if (error) { toast(t("Fehler: ") + error.message); return false; }
    await load();
    return true;
  };

  // Eigenes Ticket als erledigt markieren bzw. wieder oeffnen (RPC set_my_feedback_status, supabase/2026-10-21b_my_ticket_done.sql)
  const setStatus = async (tk, status) => {
    const { error } = await supabase.rpc("set_my_feedback_status", { p_id: tk.id, p_status: status });
    if (error) { toast(t("Fehler: ") + error.message); return; }
    await load();
  };

  const hasNew = (tk) => {
    const msgs = msgsByTicket[tk.id] || [];
    const lastFromOther = [...msgs].reverse().find((m) => m.sender_id !== playerId);
    if (!lastFromOther) return false;
    const seenAt = seen[tk.id];
    return !seenAt || new Date(lastFromOther.created_at) > new Date(seenAt);
  };

  if (!tickets || tickets.length === 0) return null;

  return (
    <div className="acct-sub">
      <div className="acct-row">
        <MessageSquare size={16} className="acct-ico" />
        <span className="acct-text">{t("Meine Tickets")} <span className="acct-dim">{tickets.filter((x) => x.status !== "done").length}</span></span>
      </div>
      {tickets.map((tk) => (
        <div key={tk.id} className={"ticket-item" + (tk.status === "done" ? " done" : "")}>
          <button className="ticket-head" onClick={() => toggle(tk.id)}>
            <span className="ticket-cat">{tk.category === "bug" ? t("Bug") : tk.category === "idea" ? t("Idee") : t("Sonstiges")}</span>
            <span className="ticket-msg"><EmojiText>{tk.message}</EmojiText></span>
            {tk.status === "done" && <Check size={14} className="ticket-done-ico" aria-label={t("erledigt")} />}
            {hasNew(tk) && <span className="new-dot" />}
            <ChevronDown size={15} className={"cat-chev" + (openId === tk.id ? " open" : "")} />
          </button>
          {openId === tk.id && (
            <>
              <FeedbackThread messages={msgsByTicket[tk.id] || []} meId={playerId}
                onSend={(msg) => send(tk.id, msg)} />
              <div className="ticket-actions">
                {tk.status === "done" ? (
                  <button type="button" className="chip-btn" onClick={() => setStatus(tk, "open")}><RotateCcw size={14} /> {t("wieder öffnen")}</button>
                ) : (
                  <button type="button" className="chip-btn ok" onClick={() => setStatus(tk, "done")}><Check size={14} /> {t("Als erledigt markieren")}</button>
                )}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
