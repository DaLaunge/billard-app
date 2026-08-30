import { useState, useEffect } from "react";
import { ChevronDown, MessageSquare } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import FeedbackThread from "./FeedbackThread";

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

  const hasNew = (tk) => {
    const msgs = msgsByTicket[tk.id] || [];
    const lastFromOther = [...msgs].reverse().find((m) => m.sender_id !== playerId);
    if (!lastFromOther) return false;
    const seenAt = seen[tk.id];
    return !seenAt || new Date(lastFromOther.created_at) > new Date(seenAt);
  };

  if (!tickets || tickets.length === 0) return null;

  return (
    <section className="stat-block">
      <h3><MessageSquare size={17} /> {t("Meine Tickets")}</h3>
      {tickets.map((tk) => (
        <div key={tk.id} className="ticket-item">
          <button className="ticket-head" onClick={() => toggle(tk.id)}>
            <span className="ticket-cat">{tk.category === "bug" ? t("Bug") : tk.category === "idea" ? t("Idee") : t("Sonstiges")}</span>
            <span className="ticket-msg">{tk.message}</span>
            {hasNew(tk) && <span className="new-dot" />}
            <ChevronDown size={15} className={"cat-chev" + (openId === tk.id ? " open" : "")} />
          </button>
          {openId === tk.id && (
            <FeedbackThread messages={msgsByTicket[tk.id] || []} meId={playerId}
              onSend={(msg) => send(tk.id, msg)} />
          )}
        </div>
      ))}
    </section>
  );
}
