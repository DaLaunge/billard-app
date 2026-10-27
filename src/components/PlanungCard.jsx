import { useState } from "react";
import { Calendar, Check, X, Pencil, MapPin, Navigation } from "lucide-react";
import { useLocations, routeUrl } from "../lib/locationStore";
import LocationPicker from "./widgets/LocationPicker";
import { t } from "../lib/i18n";
import { initials, fmtDate } from "../lib/format";
import Ball from "./Ball";
import DayPicker from "./widgets/DayPicker";
import Emoji from "./Emoji";
import { EmojiText } from "./Emoji";

export default function PlanungCard({ planning, me, colorOf, badgeOf, photoOf, onReply, onUnreply, onDelete, onUpdate, onOpenProfile, toast }) {
  const myReply = planning.replies?.find((r) => r.player_id === me.id);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const mine = planning.player_id === me.id;
  const { list: locList, planLoc } = useLocations();
  const place = locList.find((l) => l.id === planLoc[planning.id]);
  const [eLoc, setELoc] = useState(null);
  const [editing, setEditing] = useState(false);
  const [eDate, setEDate] = useState(planning.planned_date);
  const [eMsg, setEMsg] = useState(planning.message || "");

  return (
    <section className={"stat-block ping-card" + (mine ? " mine" : "")}>
      <button className="ping-head as-btn" onClick={() => onOpenProfile(planning.player.nickname)}>
        <Ball nick={planning.player.nickname} color={colorOf(planning.player.nickname)} label={initials(planning.player.nickname)} badge={badgeOf(planning.player.nickname)} photo={photoOf(planning.player.nickname)} size={40} />
        <div className="ping-who">
          <b>{planning.player.nickname}</b>
        </div>
        <span className="plan-pill"><Calendar size={12} /> {fmtDate(planning.planned_date)}</span>
      </button>
      {place && <div className="ping-loc"><MapPin size={16} /> {place.name}<a className="route-link" href={routeUrl(place)} target="_blank" rel="noreferrer" title={place.address || ""}><Navigation size={14} /> {t("Route")}</a></div>}
      {planning.message && <p className="ping-msg">"<EmojiText>{planning.message}</EmojiText>"</p>}

      {planning.replies?.length > 0 && (
        <div className="otw-count"><Emoji e="🗓️" /> {planning.replies.length} {planning.replies.length === 1 ? t("Person ist") : t("Leute sind")} {t("interessiert")}</div>
      )}

      {planning.replies?.length > 0 && (
        <div className="ping-replies">
          {planning.replies.map((r) => (
            <button key={r.id} className="ping-reply as-btn" onClick={() => onOpenProfile(r.player.nickname)}>
              <Ball nick={r.player.nickname} color={colorOf(r.player.nickname)} label={initials(r.player.nickname)} badge={badgeOf(r.player.nickname)} photo={photoOf(r.player.nickname)} size={26} />
              <span><b>{r.player.nickname}</b>{r.message ? <>: <EmojiText>{r.message}</EmojiText></> : t(" ist interessiert!")}</span>
            </button>
          ))}
        </div>
      )}

      {mine && editing && (
        <div className="reply-form">
          <DayPicker value={eDate} onChange={setEDate} />
          {locList.length > 0 && <LocationPicker value={eLoc} onChange={setELoc} optional toast={toast} me={me} />}
          <div className="search-row" style={{ marginBottom: 8 }}>
            <Pencil size={16} className="mail-ico" />
            <input placeholder={t("Hinweis (optional), z. B. 'Bin flexibel, meldet euch'")} value={eMsg}
              maxLength={120} onChange={(e) => setEMsg(e.target.value)} />
          </div>
          <div className="confirm-actions">
            <button className="chip-btn ok" disabled={!eDate} onClick={() => { onUpdate(planning.id, eDate, eMsg, eLoc); setEditing(false); }}>
              <Check size={15} /> {t("Speichern")}
            </button>
            <button className="chip-btn no" onClick={() => setEditing(false)}><X size={15} /> {t("Abbrechen")}</button>
          </div>
        </div>
      )}
      {mine && !editing && (
        <div className="sp-controls">
          {onUpdate && (
            <button className="btn ghost" onClick={() => { setEDate(planning.planned_date); setEMsg(planning.message || ""); setELoc(planLoc[planning.id] || null); setEditing(true); }}>
              <Pencil size={15} /> {t("Planung ändern")}
            </button>
          )}
          <button className="btn ghost" onClick={() => onDelete(planning.id)}>
            <X size={15} /> {t("Planung löschen")}
          </button>
        </div>
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
