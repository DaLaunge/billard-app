import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MapPin, Search, Radio, Calendar, Plus, Check, Pencil, X, Swords, Users, LocateFixed, Trash2, MessageSquare, ChevronDown } from "lucide-react";
import { supabase } from "../../supabase";
import { t, getLang } from "../../lib/i18n";
import { initials, fmtDate, timeLeft } from "../../lib/format";
import { useLocations, loadLocations, distanceM } from "../../lib/locationStore";
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
const fmtDist = (m) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(m / 1000)} km`);
const REACTIONS = ["👍", "🎱", "❤️"];

/* Ein Live-Eintrag oder eine Planung samt Zusagen: wer zugesagt hat, kleine Reaktionen darauf (👍 🎱 ❤️) und - fuer alle
   anderen - der Knopf zum Zusagen (mit oder ohne Nachricht) bzw. Zurueckziehen. */
function Entry({ kind, item, place, me, colorOf, badgeOf, photoOf, onOpenProfile, onReply, onUnreply, reacts, onReact,
  onChallenge, challenged, onUpdate, onDelete, onClose, dist }) {
  const [show, setShow] = useState(false); // Liste der gemeldeten Personen
  const [msgOpen, setMsgOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const mine = item.player_id === me?.id;
  const myReply = item.replies?.find((r) => r.player_id === me?.id);
  const nick = item.player.nickname;
  const ping = kind === "ping";
  const replies = item.replies || [];
  const people = new Set([item.player_id, ...replies.map((r) => r.player_id)]).size;
  const word = ping ? t("Bin unterwegs") : t("Bin interessiert");
  const person = (n, size) => (
    <button type="button" className="venue-person as-btn" onClick={() => onOpenProfile?.(n)}>
      <Ball nick={n} color={colorOf(n)} label={initials(n)} badge={badgeOf(n)} photo={photoOf(n)} size={size} />
      <b>{n}</b>
    </button>
  );
  return (
    <div className="venue-entry">
      <div className="venue-line">
        {person(nick, 24)}
        {ping
          ? <span className="live-pill small"><span className="live-dot" /> LIVE <span className="rank-meta">{timeLeft(item.expires_at)}</span></span>
          : <span className="plan-pill small"><Calendar size={11} /> {fmtDate(item.planned_date)}</span>}
        {place && <span className="venue-place"><MapPin size={13} /> {place.name}{dist != null && <> · {fmtDist(dist)}</>}</span>}
        <span className="venue-line-end">
          <button type="button" className={"venue-count as-btn" + (show ? " on" : "")} onClick={() => setShow((v) => !v)} aria-expanded={show}
            title={t("Gemeldete Spieler")} aria-label={t("Gemeldete Spieler")}>
            <Users size={12} /> {people}<ChevronDown size={12} className="venue-chev" />
          </button>
          {place && place.lat != null && <RouteButton place={place} size={15} />}
          {!mine && !myReply && (
            <>
              <button type="button" className="icon-btn small primary" onClick={() => onReply(item.id, "")} title={word} aria-label={word}>{ping ? <Swords size={15} /> : <Check size={15} />}</button>
              <button type="button" className="icon-btn small" onClick={() => { setShow(true); setMsgOpen((v) => !v); }} title={t("mit Nachricht")} aria-label={t("mit Nachricht")}><MessageSquare size={15} /></button>
            </>
          )}
          {!mine && myReply && (
            <button type="button" className="icon-btn small" onClick={() => onUnreply(item.id)} title={t("Zusage zurueckziehen")} aria-label={t("Zusage zurueckziehen")}><X size={15} /></button>
          )}
          {!mine && onChallenge && (challenged
            ? <span className="icon-btn small venue-done" title={t("Duell angefragt")} aria-label={t("Duell angefragt")}><Swords size={15} /></span>
            : <button type="button" className="icon-btn small" onClick={() => onChallenge(item)} title={t("Zum Duell herausfordern")} aria-label={t("Zum Duell herausfordern")}><Swords size={15} /></button>)}
          {mine && !ping && onUpdate && (
            <button type="button" className="icon-btn small" onClick={() => { setShow(true); setEditing((v) => !v); }} title={t("Ändern")} aria-label={t("Ändern")}><Pencil size={15} /></button>
          )}
          {mine && ping && onClose && (
            <button type="button" className="icon-btn small" onClick={onClose} title={t("Live beenden")} aria-label={t("Live beenden")}><X size={15} /></button>
          )}
          {mine && !ping && onDelete && (
            <button type="button" className="icon-btn small" onClick={() => onDelete(item.id)} title={t("Löschen")} aria-label={t("Löschen")}><Trash2 size={15} /></button>
          )}
        </span>
      </div>

      <div className={"collapsible" + (show ? " open" : "")} inert={show ? undefined : ""}>
        <div className="collapsible-inner">
          <div className="venue-details">
            {item.message && <p className="venue-msg">"<EmojiText>{item.message}</EmojiText>"</p>}
            {replies.length === 0 && !editing && !msgOpen && <span className="rank-meta">{t("Noch keine Zusagen.")}</span>}
            {replies.map((r) => {
              const here = reacts.filter((x) => x.kind === kind && x.reply_id === r.id);
              return (
                <div key={r.id} className="venue-reply">
                  <span className="venue-reply-who">
                    {person(r.player.nickname, 20)}
                    <span>{r.message ? <EmojiText>{r.message}</EmojiText> : (ping ? t("ist unterwegs!") : t("ist interessiert!"))}</span>
                  </span>
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
            {!mine && !myReply && msgOpen && (
              <div className="venue-form">
                <div className="search-row">
                  <input autoFocus placeholder={ping ? t("Nachricht (optional), z. B. 'Bin in 20 Min da'") : t("Nachricht (optional), z. B. 'Passt mir gut'")}
                    value={msg} maxLength={120} onChange={(e) => setMsg(e.target.value)} />
                </div>
                <div className="venue-actions">
                  <button type="button" className="chip-btn sel" onClick={() => { onReply(item.id, msg); setMsgOpen(false); setMsg(""); }}><Check size={14} /> {word}</button>
                  <button type="button" className="chip-btn no" onClick={() => setMsgOpen(false)}><X size={14} /> {t("Abbrechen")}</button>
                </div>
              </div>
            )}
            {mine && !ping && editing && (
              <PlanForm initial={{ date: item.planned_date, msg: item.message || "" }} label={t("Speichern")}
                onSubmit={(d, m) => onUpdate(item.id, d, m, null)} onDone={() => setEditing(false)} />
            )}
          </div>
        </div>
      </div>
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

function PlanForm({ initial, label, onSubmit, onDone }) {
  const [date, setDate] = useState(initial?.date || "");
  const [msg, setMsg] = useState(initial?.msg || "");
  return (
    <div className="venue-form">
      <DayPicker value={date} onChange={setDate} />
      <div className="search-row">
        <Pencil size={16} className="mail-ico" />
        <input placeholder={t("Hinweis (optional), z. B. 'Bin flexibel, meldet euch'")} value={msg} maxLength={120} onChange={(e) => setMsg(e.target.value)} />
      </div>
      <div className="sp-controls">
        <button type="button" className="btn ghost" onClick={onDone}>{t("Abbrechen")}</button>
        <button type="button" className="btn primary" disabled={!date} onClick={() => { onSubmit(date, msg); onDone(); }}>
          <Calendar size={17} /> {label || t("Planung eintragen")}
        </button>
      </div>
    </div>
  );
}

const NEAR_KEY = "venueNear";
const readLocal = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeLocal = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* Privatmodus */ } };

export default function VenueList({ me, pings = [], plannings = [], challengesFromMe = [], colorOf, badgeOf, photoOf, onOpenProfile,
  onCreate, onClose, onCreatePlanning, onUpdatePlanning, onDeletePlanning, onReply, onUnreply, onReplyPlanning, onUnreplyPlanning, onChallenge, toast }) {
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
  const [sel, setSel] = useState(null); // aufgeklapptes Lokal
  const [form, setForm] = useState(null); // "live" | "plan" fuer das aufgeklappte Lokal
  // Umgebung: Standort nur auf Wunsch (Knopf), danach wird die Wahl auf diesem Geraet gemerkt
  const [pos, setPos] = useState(null);
  const askPos = (quiet, then) => {
    if (!navigator.geolocation) { if (!quiet) toast?.(t("Dein Gerät kann den Standort nicht bestimmen.")); then?.(false); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); writeLocal(NEAR_KEY, "1"); then?.(true); },
      () => { if (!quiet) toast?.(t("Standort nicht verfügbar – bitte in den Browser-Einstellungen freigeben.")); then?.(false); },
      { timeout: 8000, maximumAge: 60000 },
    );
  };
  // Der grosse "In der Naehe"-Ping: Animation + die naechsten Spieler, die gerade LIVE sind
  const [pinging, setPinging] = useState(false);
  const [pinged, setPinged] = useState(false);
  // Die Ping-Welle laeuft ueber den ganzen Bildschirm (Overlay am Body, vom Radar aus), nicht nur im Knopf
  const orbRef = useRef(null);
  const [wave, setWave] = useState(null);
  const doPing = () => {
    const r = orbRef.current?.getBoundingClientRect();
    if (r && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setWave({ x: r.left + r.width / 2, y: r.top + r.height / 2, k: Date.now() });
      setTimeout(() => setWave(null), 2900);
    }
    setPinging(true);
    const stop = setTimeout(() => setPinging(false), 1900);
    askPos(false, (ok) => { if (ok) setPinged(true); else { clearTimeout(stop); setPinging(false); } });
  };
  useEffect(() => { if (readLocal(NEAR_KEY) === "1") askPos(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Neues Lokal: erst anbieten, wenn jemand nach einem Lokal sucht, das es (noch) nicht gibt; das Formular klappt darunter auf
  const [adding, setAdding] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [newName, setNewName] = useState("");
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

  const today = new Date().toISOString().slice(0, 10);
  const nq = norm(q);
  const venueOfPing = (p) => list.find((l) => norm(l.name) === norm(p.location)) || { id: "loose:" + p.location, name: p.location, loose: true };
  const venueOfPlan = (p) => list.find((l) => l.id === planLoc[p.id]) || null;
  const pass = (v, nick) => !nq || norm(`${v?.name || ""} ${v?.address || ""} ${nick}`).includes(nq);

  // Aktivitaeten: zuerst alles, was gerade LIVE ist (neueste oben), danach die Planungen nach Datum
  const liveItems = [...pings].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((item) => ({ kind: "ping", item, venue: venueOfPing(item) })).filter((x) => pass(x.venue, x.item.player.nickname));
  const planItems = plannings.filter((p) => String(p.planned_date) >= today)
    .sort((a, b) => String(a.planned_date).localeCompare(String(b.planned_date)) || String(a.created_at).localeCompare(String(b.created_at)))
    .map((item) => ({ kind: "planning", item, venue: venueOfPlan(item) })).filter((x) => pass(x.venue, x.item.player.nickname));
  const feed = [...liveItems, ...planItems];

  // Lokale: nach Entfernung (wenn der Standort bekannt ist), sonst alphabetisch; je Lokal die Zahl der gemeldeten Spieler
  const venues = list.map((l) => {
    const live = pings.filter((p) => norm(p.location) === norm(l.name));
    const plan = plannings.filter((p) => planLoc[p.id] === l.id && String(p.planned_date) >= today);
    const ids = new Set();
    [...live, ...plan].forEach((e) => { ids.add(e.player_id); (e.replies || []).forEach((r) => ids.add(r.player_id)); });
    const dist = pos && l.lat != null ? distanceM(pos, l) : null;
    return { l, live, plan, players: ids.size, dist };
  }).filter(({ l }) => !nq || norm(`${l.name} ${l.address || ""}`).includes(nq))
    .sort((a, b) => (pos ? ((a.dist ?? 1e12) - (b.dist ?? 1e12)) : (b.live.length - a.live.length) || (b.plan.length - a.plan.length)) || a.l.name.localeCompare(b.l.name));
  const rows = venues.slice(0, SHOWN);
  const exact = list.some((l) => norm(l.name) === nq);
  const canAdd = !adding && ((nq.length >= 2 && !exact) || list.length === 0);

  // Duell direkt aus der Liste: die Nachricht sagt gleich, wo man spielt bzw. wo der andere gerade ist
  const challenge = (item) => {
    const place = item.location || venueOfPlan(item)?.name;
    const msg = myPing ? `Ich bin live: ${myPing.location} – Duell?`
      : item.location ? `Du bist live bei ${item.location} – Duell?`
      : `Duell am ${fmtDate(item.planned_date)}${place ? ` (${place})` : ""}?`;
    onChallenge(item.player_id, msg.slice(0, 120));
  };

  const entry = (x, dist) => (
    <div key={x.kind + x.item.id} className={"venue-row" + (x.kind === "ping" ? " is-live" : "")}>
      <Entry kind={x.kind} item={x.item} place={x.venue} dist={dist} me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile}
        onReply={x.kind === "ping" ? onReply : onReplyPlanning} onUnreply={x.kind === "ping" ? onUnreply : onUnreplyPlanning}
        reacts={reacts} onReact={reactOk ? react : null}
        onChallenge={onChallenge ? challenge : null} challenged={challengesFromMe.some((c) => c.challenged_id === x.item.player_id)}
        onUpdate={onUpdatePlanning} onDelete={onDeletePlanning} onClose={onClose} />
    </div>
  );

  // Naechste Live-Spieler (nur Lokale mit Koordinaten), nach Entfernung
  const nearLive = pos ? [...pings].map((item) => ({ kind: "ping", item, venue: venueOfPing(item) }))
    .filter((x) => x.venue.lat != null).map((x) => ({ ...x, dist: distanceM(pos, x.venue) })).sort((a, b) => a.dist - b.dist).slice(0, 5) : [];

  // Planungen als Kapitel: ein Kapitel je Datum
  const loc = getLang() === "en" ? "en-US" : "de-AT";
  const chapters = [];
  planItems.forEach((x) => {
    const d = String(x.item.planned_date).slice(0, 10);
    let c = chapters[chapters.length - 1];
    if (!c || c.date !== d) { c = { date: d, items: [] }; chapters.push(c); }
    c.items.push(x);
  });
  const dayLabel = (d) => {
    const dt = new Date(d + "T12:00:00");
    const diff = Math.round((new Date(d + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000);
    const base = dt.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });
    return diff === 0 ? `${t("Heute")} · ${base}` : diff === 1 ? `${t("Morgen")} · ${base}` : base;
  };

  return (
    <>
      {wave && createPortal(
        <div className="ping-wave" key={wave.k} aria-hidden="true">
          <i style={{ left: wave.x, top: wave.y }} /><i className="w2" style={{ left: wave.x, top: wave.y }} /><i className="w3" style={{ left: wave.x, top: wave.y }} />
        </div>, document.body)}
      <div className="ping-box">
        <button type="button" className={"ping-btn" + (pinging ? " pinging" : "")} onClick={doPing} aria-label={t("Ping – wer spielt in meiner Nähe?")}>
          <span className="ping-orb" ref={orbRef}>
            <i className="ping-ring" /><i className="ping-ring r2" /><i className="ping-ring r3" />
            <i className="ping-sweep" />
            <svg viewBox="0 0 100 100" className="ping-scope" aria-hidden="true">
              <circle cx="50" cy="50" r="46" /><circle cx="50" cy="50" r="31" /><circle cx="50" cy="50" r="16" />
              <path d="M50 4V96M4 50H96" />
              <circle cx="67" cy="33" r="4" className="ping-blip" /><circle cx="36" cy="62" r="3" className="ping-blip" />
            </svg>
          </span>
          <span className="ping-txt">
            <b>{t("Ping")}</b>
            <span className="rank-meta">{pinged ? t("Tippen zum Aktualisieren") : t("Wer spielt in meiner Nähe?")}</span>
          </span>
        </button>
        <div className={"collapsible" + (pinged ? " open" : "")} inert={pinged ? undefined : ""}>
          <div className="collapsible-inner">
            <div className="ping-result">
              {nearLive.length > 0
                ? <><p className="q venue-sec">{t("Gerade live in deiner Nähe")}</p><div className="venue-list">{nearLive.map((x) => entry(x, x.dist))}</div></>
                : <p className="hint center">{t("Gerade ist in deiner Nähe niemand live – sei du der Erste!")}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="search-row">
        <Search size={16} className="mail-ico" />
        <input placeholder={t("Lokal oder Spieler suchen …")} value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} />
      </div>

      {liveItems.length > 0 && (
        <>
          <div className="deck-sub-head"><Radio size={14} /> {t("Jetzt live")}<span className="deck-tab-count">{liveItems.length}</span></div>
          <div className="venue-list">{liveItems.map((x) => entry(x))}</div>
        </>
      )}
      {chapters.map((c) => (
        <div key={c.date} className="venue-chap">
          <div className="deck-sub-head"><Calendar size={14} /> {dayLabel(c.date)}<span className="deck-tab-count">{c.items.length}</span></div>
          <div className="venue-list">{c.items.map((x) => entry(x))}</div>
        </div>
      ))}
      {feed.length === 0 && list.length > 0 && <p className="hint center">{t("Gerade ist nichts live oder geplant – sei der Erste: Such dir unten ein Lokal aus.")}</p>}

      <div className="deck-sub-head"><MapPin size={14} /> {pos ? t("Lokale in deiner Nähe") : t("Lokale")}</div>
      {canAdd && (
        <button type="button" className="chip-btn venue-add" onClick={() => { setNewName(q.trim()); setFormKey((k) => k + 1); setAdding(true); }}>
          <Plus size={14} /> {nq.length >= 2 ? t("„{name}“ als neues Lokal anlegen", { name: q.trim() }) : t("Erstes Lokal anlegen")}
        </button>
      )}
      <div className={"collapsible" + (adding ? " open" : "")} inert={adding ? undefined : ""}>
        <div className="collapsible-inner">
          <div className="loc-panel">
            {mounted && (
              <LocationForm key={formKey} fixedName={newName.length >= 2 ? newName : undefined} toast={toast}
                onCancel={() => setAdding(false)}
                onSaved={(id) => { setAdding(false); setQ(""); if (typeof id === "string") { setSel(id); setForm(null); } }} />
            )}
          </div>
        </div>
      </div>
      {list.length > 0 && venues.length === 0 && !canAdd && !adding && <p className="hint center">{t("Kein Lokal gefunden.")}</p>}
      <div className="venue-list">
        {rows.map(({ l, live, plan, players, dist }) => {
          const open = sel === l.id;
          const mineHere = live.some((p) => p.player_id === me?.id);
          const pending = l.status === "pending" && l.created_by !== me?.id;
          const can = usable(l);
          const pickForm = (k) => { setSel(l.id); setForm(form === k && open ? null : k); };
          return (
            <div key={l.id} className={"venue-row" + (open ? " is-open" : "")}>
              <div className="venue-top">
                <div className="venue-pick">
                  <b><MapPin size={14} /> {l.name}{l.status === "pending" ? " ⏳" : ""}</b>
                  {l.address && <span className="rank-meta">{l.address}</span>}
                  <span className="rank-meta">
                    {dist != null && <>{fmtDist(dist)} · </>}
                    {players > 0 ? t("{n} Spieler gemeldet", { n: players }) : t("noch niemand gemeldet")}
                    {live.length > 0 && <> · <span className="venue-livetag">{t("{n} live", { n: live.length })}</span></>}
                    {plan.length > 0 && <> · {t("{n} geplant", { n: plan.length })}</>}
                  </span>
                  {l.status === "pending" && <span className="rank-meta">{count(l.id)}/{NEEDED} {t("bestätigt")}</span>}
                </div>
                <div className="venue-icons">
                  {pending && (done(l.id)
                    ? <span className="icon-btn small venue-done" title={t("Bestätigt")} aria-label={t("Bestätigt")}><Check size={15} /></span>
                    : <button type="button" className="icon-btn small primary" disabled={busy === l.id} onClick={() => confirm(l)} title={t("Stimmt")} aria-label={t("Stimmt")}><Check size={15} /></button>)}
                  {can && (mineHere ? (
                    <button type="button" className="icon-btn small" onClick={onClose} title={t("Live beenden")} aria-label={t("Live beenden")}><X size={15} /></button>
                  ) : !myPing && (
                    <button type="button" className={"icon-btn small" + (open && form === "live" ? " primary" : "")} onClick={() => pickForm("live")}
                      title={t("Hier live gehen")} aria-label={t("Hier live gehen")} aria-expanded={open && form === "live"}><Radio size={15} /></button>
                  ))}
                  {can && (
                    <button type="button" className={"icon-btn small" + (open && form === "plan" ? " primary" : "")} onClick={() => pickForm("plan")}
                      title={t("Hier planen")} aria-label={t("Hier planen")} aria-expanded={open && form === "plan"}><Calendar size={15} /></button>
                  )}
                  <RouteButton place={l} size={15} />
                </div>
              </div>

              <div className={"collapsible" + (open && form ? " open" : "")} inert={open && form ? undefined : ""}>
                <div className="collapsible-inner">
                  <div className="venue-body">
                    {open && form === "live" && <Unfold><LiveForm venue={l} onCreate={onCreate} onDone={() => setForm(null)} /></Unfold>}
                    {open && form === "plan" && <Unfold><PlanForm onSubmit={(d, m) => onCreatePlanning(d, m, l.id)} onDone={() => setForm(null)} /></Unfold>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {venues.length > SHOWN && <p className="hint center">{t("{n} weitere – Suche eingrenzen.", { n: venues.length - SHOWN })}</p>}
    </>
  );
}
