import { useState, useEffect } from "react";
import { MapPin, Search, Radio, Calendar, Plus, Check, Pencil, X, Swords } from "lucide-react";
import { supabase } from "../../supabase";
import { t } from "../../lib/i18n";
import { initials, fmtDate, timeLeft } from "../../lib/format";
import { useLocations, loadLocations } from "../../lib/locationStore";
import Ball from "../Ball";
import Emoji, { EmojiText } from "../Emoji";
import RouteButton from "./RouteButton";
import LocationForm from "./LocationForm";
import DayPicker from "./DayPicker";

/* "Wer spielt wo": alle Lokale mit Suche. Pro Lokal steht, wer gerade live dort ist und welche Planungen es dort gibt;
   ausserdem lassen sich Live und Planung DIREKT unter dem Lokal eintragen (Formular klappt unter der Zeile auf) - kein
   Wechsel in einen anderen Reiter, kein Hochscrollen. Lokale mit Betrieb stehen oben. Der andere Weg (erst Live/Planung,
   Lokal dort optional waehlen) bleibt in den Formularen der Reiter selbst. */
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const SHOWN = 30;
const NEEDED = 2;
const REACTIONS = ["👍", "🎱", "❤️"];

/* Ein Live-Eintrag oder eine Planung samt Zusagen: wer zugesagt hat, kleine Reaktionen darauf (👍 🎱 ❤️) und - fuer alle
   anderen - der Knopf zum Zusagen (mit oder ohne Nachricht) bzw. Zurueckziehen. */
function Entry({ kind, item, me, colorOf, badgeOf, photoOf, onOpenProfile, onReply, onUnreply, reacts, onReact }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const mine = item.player_id === me?.id;
  const myReply = item.replies?.find((r) => r.player_id === me?.id);
  const nick = item.player.nickname;
  const ping = kind === "ping";
  return (
    <div className="venue-entry">
      <button type="button" className="venue-person as-btn" onClick={() => onOpenProfile?.(nick)}>
        <Ball nick={nick} color={colorOf(nick)} label={initials(nick)} badge={badgeOf(nick)} photo={photoOf(nick)} size={24} />
        <span>
          <b>{nick}</b>{" "}
          {ping
            ? <><span className="live-pill small"><span className="live-dot" /> LIVE</span> <span className="rank-meta">{timeLeft(item.expires_at)}</span></>
            : <span className="plan-pill small"><Calendar size={11} /> {fmtDate(item.planned_date)}</span>}
        </span>
      </button>
      {item.message && <p className="venue-msg">"<EmojiText>{item.message}</EmojiText>"</p>}
      {item.replies?.map((r) => {
        const here = reacts.filter((x) => x.kind === kind && x.reply_id === r.id);
        return (
          <div key={r.id} className="venue-reply">
            <button type="button" className="venue-person as-btn" onClick={() => onOpenProfile?.(r.player.nickname)}>
              <Ball nick={r.player.nickname} color={colorOf(r.player.nickname)} label={initials(r.player.nickname)} badge={badgeOf(r.player.nickname)} photo={photoOf(r.player.nickname)} size={20} />
              <span><b>{r.player.nickname}</b>{r.message ? <>: <EmojiText>{r.message}</EmojiText></> : (ping ? t(" ist unterwegs!") : t(" ist interessiert!"))}</span>
            </button>
            {onReact && (
              <span className="venue-react">
                {REACTIONS.map((e) => {
                  const n = here.filter((x) => x.emoji === e).length;
                  const on = here.some((x) => x.emoji === e && x.player_id === me?.id);
                  return (
                    <button key={e} type="button" className={"react-btn" + (on ? " on" : "")} onClick={() => onReact(kind, r.id, e)} aria-pressed={on}>
                      <Emoji e={e} />{n > 0 && <i>{n}</i>}
                    </button>
                  );
                })}
              </span>
            )}
          </div>
        );
      })}
      {!mine && !myReply && !open && (
        <div className="venue-actions">
          <button type="button" className="chip-btn ok" onClick={() => onReply(item.id, "")}>
            {ping ? <Swords size={14} /> : <Calendar size={14} />} {ping ? t("Bin unterwegs") : t("Bin interessiert")}
          </button>
          <button type="button" className="chip-btn" onClick={() => setOpen(true)}>{t("mit Nachricht")}</button>
        </div>
      )}
      {!mine && !myReply && open && (
        <div className="venue-form">
          <div className="search-row">
            <input autoFocus placeholder={ping ? t("Nachricht (optional), z. B. 'Bin in 20 Min da'") : t("Nachricht (optional), z. B. 'Passt mir gut'")}
              value={msg} maxLength={120} onChange={(e) => setMsg(e.target.value)} />
          </div>
          <div className="venue-actions">
            <button type="button" className="chip-btn ok" onClick={() => { onReply(item.id, msg); setOpen(false); setMsg(""); }}><Check size={14} /> {ping ? t("Unterwegs") : t("Interessiert")}</button>
            <button type="button" className="chip-btn no" onClick={() => setOpen(false)}><X size={14} /> {t("Abbrechen")}</button>
          </div>
        </div>
      )}
      {!mine && myReply && (
        <div className="venue-actions">
          <button type="button" className="chip-btn no" onClick={() => onUnreply(item.id)}><X size={14} /> {t("Zusage zurueckziehen")}</button>
        </div>
      )}
    </div>
  );
}

/* Klappt beim Einhaengen animiert auf (die Hoehe ist unbekannt, daher .collapsible). */
function Unfold({ children }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  return (
    <div className={"collapsible" + (on ? " open" : "")}>
      <div className="collapsible-inner">{children}</div>
    </div>
  );
}

function LiveForm({ venue, onCreate, onDone }) {
  const [msg, setMsg] = useState("");
  const [hours, setHours] = useState(3);
  return (
    <div className="venue-form">
      <div className="search-row">
        <Pencil size={16} className="mail-ico" />
        <input placeholder={t("Nachricht (optional), z. B. 'Wer hat Lust auf 9 Ball?'")} value={msg} maxLength={120} onChange={(e) => setMsg(e.target.value)} />
      </div>
      <div className="chips small">
        {[1, 2, 3, 6].map((h) => (
          <button key={h} type="button" className={"chip" + (hours === h ? " active" : "")} onClick={() => setHours(h)}>{t("{n} Std", { n: h })}</button>
        ))}
      </div>
      <div className="sp-controls">
        <button type="button" className="btn ghost" onClick={onDone}>{t("Abbrechen")}</button>
        <button type="button" className="btn primary" onClick={() => { onCreate(venue.name, msg, hours); onDone(); }}>
          <Radio size={17} /> {t("Live gehen")}
        </button>
      </div>
    </div>
  );
}

function PlanForm({ venue, onCreatePlanning, onDone }) {
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="venue-form">
      <DayPicker value={date} onChange={setDate} />
      <div className="search-row">
        <Pencil size={16} className="mail-ico" />
        <input placeholder={t("Hinweis (optional), z. B. 'Bin flexibel, meldet euch'")} value={msg} maxLength={120} onChange={(e) => setMsg(e.target.value)} />
      </div>
      <div className="sp-controls">
        <button type="button" className="btn ghost" onClick={onDone}>{t("Abbrechen")}</button>
        <button type="button" className="btn primary" disabled={!date} onClick={() => { onCreatePlanning(date, msg, venue.id); onDone(); }}>
          <Calendar size={17} /> {t("Planung eintragen")}
        </button>
      </div>
    </div>
  );
}

export default function VenueList({ me, pings = [], plannings = [], colorOf, badgeOf, photoOf, onOpenProfile,
  onCreate, onClose, onCreatePlanning, onReply, onUnreply, onReplyPlanning, onUnreplyPlanning, canLive = true, canPlan = true, toast }) {
  // Reaktionen auf Zusagen (supabase/2026-10-27e_reply_reactions.sql); fehlt die Tabelle, gibt es einfach keine Knoepfe
  const [reacts, setReacts] = useState([]);
  const [reactOk, setReactOk] = useState(false);
  const loadReacts = () => supabase.from("reply_reactions").select("kind, reply_id, player_id, emoji")
    .then(({ data, error }) => { if (!error) { setReacts(data || []); setReactOk(true); } });
  useEffect(() => { loadReacts(); }, [pings.length, plannings.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const react = async (kind, replyId, emoji) => {
    const { error } = await supabase.rpc("toggle_reply_reaction", { p_kind: kind, p_reply_id: replyId, p_emoji: emoji });
    if (error) toast?.(t("Fehler: ") + error.message);
    loadReacts();
  };
  const { list, confirms, planLoc } = useLocations();
  const [busy, setBusy] = useState(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null); // { id, kind: "live" | "plan" }
  // Neues Lokal: Formular klappt unter der Suche auf (Name aus der Suche, wenn getippt; sonst eigenes Namensfeld)
  const [adding, setAdding] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (adding) { setMounted(true); return undefined; }
    const id = setTimeout(() => setMounted(false), 350);
    return () => clearTimeout(id);
  }, [adding]);

  const myPing = pings.find((p) => p.player_id === me?.id);
  const count = (id) => confirms.filter((c) => c.location_id === id).length;
  const done = (id) => confirms.some((c) => c.location_id === id && c.player_id === me?.id);
  const usable = (l) => l.status === "approved" || l.created_by === me?.id || me?.role === "admin";
  const confirm = async (l) => {
    setBusy(l.id);
    const { data, error } = await supabase.rpc("confirm_location", { p_id: l.id });
    setBusy(null);
    if (error) { toast?.(t("Fehler: ") + error.message); return; }
    toast?.(data >= NEEDED ? t("Danke! „{name}“ ist jetzt freigegeben.", { name: l.name }) : t("Danke fürs Bestätigen!"));
    loadLocations(true);
  };

  // Lokale + Live-Eintraege, deren Ort (Freitext aus der Zeit vor dem Katalog) zu keinem Lokal passt
  const today = new Date().toISOString().slice(0, 10);
  const liveAt = (l) => pings.filter((p) => norm(p.location) === norm(l.name));
  const planAtVenue = (l) => plannings.filter((p) => planLoc[p.id] === l.id && String(p.planned_date) >= today)
    .sort((a, b) => String(a.planned_date).localeCompare(String(b.planned_date)));
  const known = new Set(list.map((l) => norm(l.name)));
  const loose = [...new Set(pings.map((p) => p.location).filter((n) => n && !known.has(norm(n))))]
    .map((name) => ({ id: "loose:" + name, name, loose: true, status: "approved" }));

  const all = [...list, ...loose].map((l) => ({ l, live: liveAt(l), plan: l.loose ? [] : planAtVenue(l) }));
  const nq = norm(q);
  const found = all
    .filter(({ l }) => !nq || norm(`${l.name} ${l.address || ""}`).includes(nq))
    .sort((a, b) => (b.live.length - a.live.length) || (b.plan.length - a.plan.length) || a.l.name.localeCompare(b.l.name));
  const rows = found.slice(0, SHOWN);
  const nothing = all.length === 0;

  return (
    <>
      <div className="search-row">
        <Search size={16} className="mail-ico" />
        <input placeholder={t("Lokal suchen …")} value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} />
      </div>
      <button type="button" className="btn ghost small" onClick={() => { if (!adding) setFormKey((k) => k + 1); setAdding((v) => !v); }} aria-expanded={adding}>
        <Plus size={15} /> {t("Neues Lokal anlegen")}
      </button>
      <div className={"collapsible" + (adding ? " open" : "")} inert={adding ? undefined : ""}>
        <div className="collapsible-inner">
          <div className="loc-panel">
            {mounted && (
              <LocationForm key={formKey} fixedName={nq.length >= 2 ? q.trim() : undefined} toast={toast}
                onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); setQ(""); }} />
            )}
          </div>
        </div>
      </div>
      {nothing && <p className="hint center">{t("Noch kein Lokal eingetragen – leg das erste bei „Live“ oder „Planung“ an.")}</p>}
      {!nothing && found.length === 0 && <p className="hint center">{t("Kein Lokal gefunden.")}</p>}
      <div className="venue-list">
        {rows.map(({ l, live, plan }) => {
          const open = form?.id === l.id ? form.kind : null;
          const toggle = (kind) => setForm(open === kind ? null : { id: l.id, kind });
          const mineHere = live.some((p) => p.player_id === me?.id);
          return (
            <div key={l.id} className={"venue-row" + (live.length ? " is-live" : "")}>
              <div className="venue-top">
                <div className="loc-sel-txt">
                  <b><MapPin size={14} /> {l.name}{l.status === "pending" ? " ⏳" : ""}</b>
                  {l.address && <span className="rank-meta">{l.address}</span>}
                  {l.status === "pending" && <span className="rank-meta">{count(l.id)}/{NEEDED} {t("bestätigt")}</span>}
                </div>
                {!l.loose && <RouteButton place={l} size={15} />}
              </div>

              {(live.length > 0 || plan.length > 0) && (
                <div className="venue-people">
                  {live.map((p) => (
                    <Entry key={"l" + p.id} kind="ping" item={p} me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                      onOpenProfile={onOpenProfile} onReply={onReply} onUnreply={onUnreply} reacts={reacts} onReact={reactOk ? react : null} />
                  ))}
                  {plan.slice(0, 4).map((p) => (
                    <Entry key={"p" + p.id} kind="planning" item={p} me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                      onOpenProfile={onOpenProfile} onReply={onReplyPlanning} onUnreply={onUnreplyPlanning} reacts={reacts} onReact={reactOk ? react : null} />
                  ))}
                  {plan.length > 4 && <span className="rank-meta">{t("{n} weitere Planungen", { n: plan.length - 4 })}</span>}
                </div>
              )}

              {l.status === "pending" && l.created_by !== me?.id && (
                <div className="venue-actions">
                  {done(l.id)
                    ? <span className="loc-review-done"><Check size={14} /> {t("Bestätigt")}</span>
                    : <button type="button" className="chip-btn ok" disabled={busy === l.id} onClick={() => confirm(l)}><Check size={14} /> {t("Stimmt")}</button>}
                </div>
              )}

              {!l.loose && usable(l) && (
                <div className="venue-actions">
                  {mineHere ? (
                    <button type="button" className="chip-btn no" onClick={onClose}><X size={14} /> {t("Live beenden")}</button>
                  ) : canLive && !myPing && (
                    <button type="button" className={"chip-btn" + (open === "live" ? " sel" : "")} onClick={() => toggle("live")} aria-expanded={open === "live"}>
                      <Radio size={14} /> {t("Hier live gehen")}
                    </button>
                  )}
                  {canPlan && (
                    <button type="button" className={"chip-btn" + (open === "plan" ? " sel" : "")} onClick={() => toggle("plan")} aria-expanded={open === "plan"}>
                      <Calendar size={14} /> {t("Hier planen")}
                    </button>
                  )}
                </div>
              )}

              {open === "live" && <Unfold><LiveForm venue={l} onCreate={onCreate} onDone={() => setForm(null)} /></Unfold>}
              {open === "plan" && <Unfold><PlanForm venue={l} onCreatePlanning={onCreatePlanning} onDone={() => setForm(null)} /></Unfold>}
            </div>
          );
        })}
      </div>
      {found.length > SHOWN && <p className="hint center">{t("{n} weitere – Suche eingrenzen.", { n: found.length - SHOWN })}</p>}
    </>
  );
}
