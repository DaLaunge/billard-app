import { useState, useEffect, createContext, useContext } from "react";
import { MapPin, Search, Radio, Calendar, Plus, Check, Pencil, X, Swords, Users, LocateFixed, Trash2, MessageSquare, ChevronDown } from "lucide-react";
import { supabase } from "../../supabase";
import { t, getLang } from "../../lib/i18n";
import { initials, fmtDate, timeLeft } from "../../lib/format";
import { useLocations, loadLocations, distanceM } from "../../lib/locationStore";
import Ball from "../Ball";
import Emoji, { EmojiText } from "../Emoji";
import RouteButton from "./RouteButton";
import LocationForm from "./LocationForm";
import LocationPicker from "./LocationPicker";
import PingButton from "./PingButton";
import { getPingRadiusKm, santaDistanceKm, fmtRadius, snapKm } from "../../lib/pingRadius";
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
        {ping && <span className="live-pill small"><span className="live-dot" /> LIVE <span className="rank-meta">{timeLeft(item.expires_at)}</span></span>}
        {!place && !ping && <span className="venue-place open"><MapPin size={13} /> {t("Ort noch auszumachen")}</span>}
        {place && (
          <span className="venue-place"><MapPin size={13} /> <b>{place.name}</b>{dist != null && <> · {fmtDist(dist)}</>}
            {place.lat != null && <RouteButton place={place} size={14} />}
          </span>
        )}
        <span className="venue-line-end">
          <button type="button" className={"venue-count as-btn" + (show ? " on" : "")} onClick={() => setShow((v) => !v)} aria-expanded={show}
            title={t("Gemeldete Spieler")} aria-label={t("Gemeldete Spieler")}>
            <Users size={12} /> {people}<ChevronDown size={12} className="venue-chev" />
          </button>
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
              <VenueMask kind="plan" initial={{ date: item.planned_date, msg: item.message || "", locId: place?.id || null }} label={t("Speichern")}
                onSubmit={({ date, msg: m, locId }) => onUpdate(item.id, date, m, locId)} onDone={() => setEditing(false)} />
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

/* EINE Maske fuer "Online gehen" und "Planung": Ort waehlen oder eingeben (LocationPicker), Nachricht, dazu bei Live die Dauer,
   bei der Planung der Kalender. Bei Live ist der Ort Pflicht (mit bekanntem Standort ist das naechste Lokal vorgewaehlt),
   bei der Planung optional - dann steht der Hinweis, dass man sich den Ort noch ausmachen muss. */
function VenueMask({ kind, initial, venueId, label, onSubmit, onDone }) {
  const { me, toast, list } = useContext(VenueCtx);
  const live = kind === "live";
  const [date, setDate] = useState(initial?.date || "");
  const [msg, setMsg] = useState(initial?.msg || "");
  const [hours, setHours] = useState(3);
  const [locId, setLocId] = useState(venueId || initial?.locId || null);
  // "Mein Standort": Standort abfragen und bekannte Billardlokale in der Naehe (bis 300 m) zum Auswaehlen anbieten
  const [near, setNear] = useState(null); // null = noch nicht abgefragt, sonst [{ l, d }]
  const [here, setHere] = useState(null); // eigene Position { lat, lng }
  const [own, setOwn] = useState(false); // live mit dem eigenen Standort, ohne Lokal (z. B. privater Tisch)
  const [locating, setLocating] = useState(false);
  const findMe = () => {
    if (!navigator.geolocation) { toast?.(t("Dein Gerät kann den Standort nicht bestimmen.")); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const me2 = { lat: p.coords.latitude, lng: p.coords.longitude };
        setHere(me2);
        const found = list.filter((l) => l.lat != null && (l.status === "approved" || l.created_by === me?.id || me?.role === "admin"))
          .map((l) => ({ l, d: distanceM(me2, l) })).filter((x) => x.d <= 300).sort((a, b) => a.d - b.d);
        setNear(found);
        if (found.length === 1) { setLocId(found[0].l.id); setOwn(false); } // genau ein Treffer: gleich vorwaehlen
        else if (found.length === 0) { setLocId(null); setOwn(true); }    // kein Lokal: mit dem eigenen Standort live gehen
        setLocating(false);
      },
      () => { setLocating(false); toast?.(t("Standort nicht verfügbar – bitte in den Browser-Einstellungen freigeben.")); },
      { timeout: 8000, maximumAge: 30000 },
    );
  };
  const venue = list.find((l) => l.id === locId) || null;
  return (
    <div className="venue-form">
      {!live && <DayPicker value={date} onChange={setDate} />}
      {live && (
        <>
          <button type="button" className="chip-btn venue-here" onClick={findMe} disabled={locating}>
            <LocateFixed size={14} /> {locating ? t("Standort wird gesucht …") : t("Mein Standort")}
          </button>
          {near && (
            <div className="quick-chips">
              {near.map(({ l, d }) => (
                <button key={l.id} type="button" className={"chip-btn" + (locId === l.id && !own ? " sel" : "")} onClick={() => { setLocId(l.id); setOwn(false); }}>
                  <MapPin size={14} /> {l.name}<span className="rank-meta"> · {fmtDist(d)}</span>
                </button>
              ))}
              <button type="button" className={"chip-btn" + (own ? " sel" : "")} onClick={() => { setOwn(true); setLocId(null); }}>
                <LocateFixed size={14} /> {t("Nur mein Standort")}
              </button>
            </div>
          )}
          {near && near.length === 0 && <p className="hint">{t("Kein bekanntes Lokal in deiner Nähe – du gehst mit deinem Standort live (z. B. privater Tisch). Ein Lokal ist optional, du kannst unten eines wählen.")}</p>}
        </>
      )}
      <LocationPicker value={locId} onChange={(id) => { setLocId(id); if (id) setOwn(false); }} toast={toast} me={me} />
      {!live && !locId && <p className="hint venue-warn"><MapPin size={13} /> {t("Kein Ort angegeben – ihr müsst euch den Ort noch ausmachen.")}</p>}
      {live && (
        <div className="chips small">
          {[1, 2, 3, 6].map((h) => (
            <button key={h} type="button" className={"chip" + (hours === h ? " active" : "")} onClick={() => setHours(h)}>{t("{n} Std", { n: h })}</button>
          ))}
        </div>
      )}
      <div className="search-row">
        <Pencil size={16} className="mail-ico" />
        <input placeholder={live ? t("Nachricht (optional), z. B. 'Wer hat Lust auf 9 Ball?'") : t("Hinweis (optional), z. B. 'Bin flexibel, meldet euch'")}
          value={msg} maxLength={120} onChange={(e) => setMsg(e.target.value)} />
      </div>
      <div className="sp-controls">
        <button type="button" className="btn ghost" onClick={onDone}>{t("Abbrechen")}</button>
        <button type="button" className="btn primary" disabled={live ? !(venue || (own && here)) : !date}
          onClick={() => { onSubmit({ date, msg, hours, locId, venue, here: own && !venue ? here : null }); onDone(); }}>
          {live ? <Radio size={17} /> : <Calendar size={17} />} {label || (live ? t("Live gehen") : t("Planung eintragen"))}
        </button>
      </div>
    </div>
  );
}

const NEAR_KEY = "venueNear";
const readLocal = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeLocal = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* Privatmodus */ } };

/* Alle Daten und Handler der Orte-Ansicht liegen EINMAL im Provider (VenueProvider, vom Live-Bildschirm um alles gelegt);
   der Ping-Knopf (PingBlock, ganz oben auf dem Bildschirm) und die Liste (VenueList, im Reiter) lesen sie aus dem Kontext. */
const VenueCtx = createContext(null);

export function VenueProvider({ children, santaKnown, onFoundSanta, players = [], me, pings = [], plannings = [], challengesFromMe = [], colorOf, badgeOf, photoOf, onOpenProfile,
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
  // Positionen von Live-Eintraegen (eigener Standort ohne Lokal, supabase/2026-10-28d_ping_position.sql) - eigene Abfrage, tolerant
  const [pingPos, setPingPos] = useState({});
  const pingKey = pings.map((p) => p.id).join(",");
  useEffect(() => {
    supabase.from("pings").select("id, lat, lng").not("lat", "is", null)
      .then(({ data, error }) => { if (!error) setPingPos(Object.fromEntries((data || []).map((r) => [r.id, r]))); });
  }, [pingKey]);
  const [busy, setBusy] = useState(null);
  const [q, setQ] = useState("");
  const [vq, setVq] = useState(""); // Suche nur in der Orte-Karte
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
  const doPing = () => {
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
  const nvq = norm(vq);
  const venueOfPing = (p) => list.find((l) => norm(l.name) === norm(p.location))
    || (pingPos[p.id] ? { id: "pos:" + p.id, name: p.location, lat: pingPos[p.id].lat, lng: pingPos[p.id].lng, loose: true }
      : { id: "loose:" + p.location, name: p.location, loose: true });
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
  }).filter(({ l }) => (!nq || norm(`${l.name} ${l.address || ""}`).includes(nq)) && (!nvq || norm(`${l.name} ${l.address || ""}`).includes(nvq)))
    .sort((a, b) => (pos ? ((a.dist ?? 1e12) - (b.dist ?? 1e12)) : (b.live.length - a.live.length) || (b.plan.length - a.plan.length)) || a.l.name.localeCompare(b.l.name));
  const rows = venues.slice(0, SHOWN);
  const addName = (vq || q).trim();
  const exact = list.some((l) => norm(l.name) === norm(addName));
  const canAdd = !adding && ((norm(addName).length >= 2 && !exact) || list.length === 0);

  // Duell direkt aus der Liste: die Nachricht sagt gleich, wo man spielt bzw. wo der andere gerade ist
  const challenge = (item) => {
    const place = item.location || venueOfPlan(item)?.name;
    const msg = myPing ? `Ich bin live: ${myPing.location} – Duell?`
      : item.location ? `Du bist live bei ${item.location} – Duell?`
      : `Duell am ${fmtDate(item.planned_date)}${place ? ` (${place})` : ""}?`;
    // Ortsvorschlag: der eigene Live-Ort, sonst der Ort des Eintrags (nur Lokale aus dem Katalog)
    const v = myPing ? venueOfPing(myPing) : item.location ? venueOfPing(item) : venueOfPlan(item);
    onChallenge(item.player_id, msg.slice(0, 120), v && !v.loose ? v.id : undefined);
  };

  // Spielersuche: Treffer lassen sich mit einem Tipp zum Duell herausfordern
  const hits = nq.length >= 2
    ? players.filter((p) => p.id !== me?.id && !p.is_guest && !p.is_ghost && !p.blocked && norm(p.nickname).includes(nq)).slice(0, 6) : [];
  const challengedIds = new Set(challengesFromMe.map((c) => c.challenged_id));
  const challengeTo = (p) => { const v = myPing ? venueOfPing(myPing) : null; onChallenge?.(p.id, myPing ? `Ich bin live: ${myPing.location} – Duell?` : "Duell?", v && !v.loose ? v.id : undefined); };

  const entry = (x, dist) => (
    <div key={x.kind + x.item.id} className={"venue-row" + (x.kind === "ping" ? " is-live" : "")}>
      <Entry kind={x.kind} item={x.item} place={x.venue} dist={dist} me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile}
        onReply={x.kind === "ping" ? onReply : onReplyPlanning} onUnreply={x.kind === "ping" ? onUnreply : onUnreplyPlanning}
        reacts={reacts} onReact={reactOk ? react : null}
        onChallenge={onChallenge ? challenge : null} challenged={challengesFromMe.some((c) => c.challenged_id === x.item.player_id)}
        onUpdate={onUpdatePlanning} onDelete={onDeletePlanning} onClose={onClose} />
    </div>
  );

  // Live-Spieler im Ping-Radius (Einstellung, Standard 5 km; nur Lokale mit Koordinaten), nach Entfernung
  const radiusKm = getPingRadiusKm();
  const santaKm = santaDistanceKm(pos, radiusKm); // Easteregg: der Weihnachtsmann am Nordpol
  const withDist = pos ? [...pings].map((item) => ({ kind: "ping", item, venue: venueOfPing(item) }))
    .filter((x) => x.venue.lat != null).map((x) => ({ ...x, dist: distanceM(pos, x.venue) })).sort((a, b) => a.dist - b.dist) : [];
  // Niemand im Radius? Dann wird der Suchradius schrittweise vergroessert (x2, x4, ...), aber HOECHSTENS bis 50 km und nur, solange noch
  // niemand gefunden wurde. Jeder Ping startet wieder beim eingestellten Radius, das Erweitern summiert sich nie auf; der Weihnachtsmann
  // (Easteregg) rechnet ausschliesslich mit dem eingestellten Radius (santaKm) und kann dadurch nie durch wiederholtes Klicken gefunden werden.
  const AUTO_MAX_KM = 50;
  let usedKm = radiusKm;
  if (pos && radiusKm < AUTO_MAX_KM && !withDist.some((x) => x.dist <= radiusKm * 1000)) {
    for (let r = radiusKm * 2; ; r *= 2) {
      const step = snapKm(Math.min(r, AUTO_MAX_KM));
      if (withDist.some((x) => x.dist <= step * 1000)) { usedKm = step; break; }
      if (step >= AUTO_MAX_KM) break;
    }
  }
  const nearLive = withDist.filter((x) => x.dist <= usedKm * 1000).slice(0, 10);
  const widened = usedKm > radiusKm && nearLive.length > 0;
  const searchedMax = !!pos && radiusKm < AUTO_MAX_KM && nearLive.length === 0; // auch bis 50 km war niemand live

  // Easteregg: Weihnachtsmann gefunden -> verstecktes Achievement (einmalig)
  useEffect(() => { if (pinged && santaKm != null && !santaKnown) onFoundSanta?.(); }, [pinged, santaKm, santaKnown]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (diff === 0) return t("Heute");
    if (diff === 1) return t("Morgen");
    return dt.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  const value = {
    me, toast, onClose, onCreate, onCreatePlanning, pinging, pinged, doPing, nearLive, radiusKm, usedKm, widened, searchedMax, santaKm, entry, q, setQ, liveItems, chapters, dayLabel, feed, list, pos,
    canAdd, nq, setNewName, setFormKey, setAdding, adding, mounted, newName, formKey, setSel, setForm, venues, rows, sel, form, busy, count, done,
    usable, confirm, myPing, askPos, vq, setVq, nvq, addName, planItems, hits, challengedIds, challengeTo, colorOf, badgeOf, photoOf,
  };
  return <VenueCtx.Provider value={value}>{children}</VenueCtx.Provider>;
}

/* Der grosse Ping-Knopf samt Ergebnis: steht ganz oben auf dem Live-Bildschirm, ueber den Duellen */
export function PingBlock() {
  const { pinging, pinged, doPing, nearLive, entry, radiusKm, usedKm, widened, searchedMax, santaKm } = useContext(VenueCtx);
  return (
    <>
      <div className="ping-box">
        <PingButton pinging={pinging} onClick={doPing} hint={!pinged ? t("Wer spielt in meiner Nähe?") : null} />
        <div className={"collapsible" + (pinged ? " open" : "")} inert={pinged ? undefined : ""}>
          <div className="collapsible-inner">
            <div className="ping-result">
              {(nearLive.length > 0 || santaKm != null)
                ? <>
                  {widened && <p className="hint center">{t("Im Umkreis von {r} war niemand live – ich habe die Suche auf {r2} erweitert.", { r: fmtRadius(radiusKm), r2: fmtRadius(usedKm) })}</p>}
                  <p className="q venue-sec">{t("Live im Umkreis von {r}", { r: fmtRadius(usedKm) })}</p><div className="venue-list">
                  {santaKm != null && (
                    <div className="venue-row is-live santa-row">
                      <Emoji e="🎅" /> <b>{t("Weihnachtsmann")}</b>
                      <span className="live-pill small"><span className="live-dot" /> LIVE</span>
                      <span className="venue-place"><MapPin size={13} /> {t("Nordpol-Workshop")} · {santaKm.toLocaleString()} km</span>
                    </div>
                  )}
                  {nearLive.map((x) => entry(x, x.dist))}
                </div></>
                : <p className="hint center">{searchedMax
                  ? t("Im Umkreis von {r} war niemand live – auch nach Erweiterung bis {r2} nicht. Sei du der Erste!", { r: fmtRadius(radiusKm), r2: fmtRadius(50) })
                  : t("Im Umkreis von {r} ist gerade niemand live – sei du der Erste!", { r: fmtRadius(radiusKm) })}</p>}
            </div>
          </div>
        </div>
      </div>

    </>
  );
}

/* Aufklappbare Karte (Live, Planungen, Orte): Kopf mit Symbol, Titel, Zaehler; der Zustand wird je Geraet gemerkt */
function Fold({ id, icon, title, count, defaultOpen, forceOpen, children }) {
  const key = "liveFold:" + id;
  const [open, setOpen] = useState(() => { try { const v = localStorage.getItem(key); return v == null ? defaultOpen : v === "1"; } catch { return defaultOpen; } });
  const toggle = () => { setOpen(!open); try { localStorage.setItem(key, open ? "0" : "1"); } catch { /* Privatmodus */ } };
  const shown = open || forceOpen;
  return (
    <section className="stat-block">
      <div className="stat-block-head">
        <button type="button" className="duel-toggle as-btn" onClick={toggle} aria-expanded={shown} title={shown ? t("Zuklappen") : t("Aufklappen")}>
          <h3>{icon} <span className="stat-block-title-text">{title}</span>
            {count != null && <span className="deck-tab-count">{count}</span>}
          </h3>
          <ChevronDown size={16} className={"duel-chev" + (shown ? " open" : "")} />
        </button>
      </div>
      <div className={"collapsible" + (shown ? " open" : "")} inert={shown ? undefined : ""}>
        <div className="collapsible-inner">{children}</div>
      </div>
    </section>
  );
}

/* Die Liste unter Suche und Schnellaktionen: Live, Planungen (je Tag ein Kapitel) und Orte - alle drei einklappbar */
export default function VenueList() {
  const { me, toast, onClose, onCreate, onCreatePlanning, q, setQ, vq, setVq, nvq, addName, liveItems, chapters, planItems, dayLabel, entry, feed, list, pos, canAdd, nq, setNewName,
    setFormKey, setAdding, adding, mounted, newName, formKey, setSel, setForm, venues, rows, sel, form, busy, count, done, usable, confirm, myPing } = useContext(VenueCtx);
  const openForm = () => { setNewName(norm(addName).length >= 2 ? addName : ""); setFormKey((k) => k + 1); setAdding(true); };
  return (
    <>
      {liveItems.length > 0 && (
        <Fold id="live" icon={<Radio size={17} />} title={t("Jetzt live")} count={liveItems.length} defaultOpen>
          <div className="venue-list">{liveItems.map((x) => entry(x))}</div>
        </Fold>
      )}
      {planItems.length > 0 && (
        <Fold id="plan" icon={<Calendar size={17} />} title={t("Planungen")} count={planItems.length} defaultOpen>
          {chapters.map((c) => (
            <div key={c.date} className="venue-chap">
              <div className="deck-sub-head">{dayLabel(c.date)}<span className="deck-tab-count">{c.items.length}</span></div>
              <div className="venue-list">{c.items.map((x) => entry(x))}</div>
            </div>
          ))}
        </Fold>
      )}
      {feed.length === 0 && list.length > 0 && <p className="hint center">{t("Gerade ist nichts live oder geplant – sei der Erste: Such dir unten ein Lokal aus.")}</p>}

      <Fold id="orte" icon={<MapPin size={17} />} title={pos ? t("Orte in deiner Nähe") : t("Orte")} count={list.length} defaultOpen={false} forceOpen={nq.length >= 2}>
        <div className="venue-toolbar">
          <div className="search-row">
            <Search size={16} className="mail-ico" />
            <input placeholder={t("Ort suchen …")} value={vq} maxLength={60} onChange={(e) => setVq(e.target.value)} />
          </div>
          <button type="button" className={"venue-new" + (adding ? " on" : "")} aria-expanded={adding} onClick={() => (adding ? setAdding(false) : openForm())}>
            <Plus size={16} /> {t("Neuer Ort")}
          </button>
        </div>
        {canAdd && norm(addName).length >= 2 && (
          <button type="button" className="chip-btn venue-add" onClick={openForm}>
            <Plus size={14} /> {t("„{name}“ als neues Lokal anlegen", { name: addName })}
          </button>
        )}
        <div className={"collapsible" + (adding ? " open" : "")} inert={adding ? undefined : ""}>
          <div className="collapsible-inner">
            <div className="loc-panel">
              {mounted && (
                <LocationForm key={formKey} fixedName={newName.length >= 2 ? newName : undefined} toast={toast}
                  onCancel={() => setAdding(false)}
                  onSaved={(id) => { setAdding(false); setQ(""); setVq(""); if (typeof id === "string") { setSel(id); setForm(null); } }} />
              )}
            </div>
          </div>
        </div>
        {list.length > 0 && venues.length === 0 && !adding && <p className="hint center">{t("Kein Lokal gefunden.")}</p>}
        {list.length === 0 && !adding && <p className="hint center">{t("Noch kein Lokal eingetragen – leg das erste mit „Neuer Ort“ an.")}</p>}
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
                      {open && form === "live" && <Unfold><VenueMask kind="live" venueId={l.id} onSubmit={({ venue, msg, hours, here }) => onCreate(venue ? venue.name : t("Mein Standort"), msg, hours, venue ? null : here)} onDone={() => setForm(null)} /></Unfold>}
                      {open && form === "plan" && <Unfold><VenueMask kind="plan" venueId={l.id} onSubmit={({ date, msg, locId }) => onCreatePlanning(date, msg, locId)} onDone={() => setForm(null)} /></Unfold>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {venues.length > SHOWN && <p className="hint center">{t("{n} weitere – Suche eingrenzen.", { n: venues.length - SHOWN })}</p>}
      </Fold>
    </>
  );
}

/* Suche direkt unter dem Ping: findet Spieler (ein Tipp bietet sofort ein Duell an) und filtert Lokale und Eintraege */
export function VenueSearch() {
  const { q, setQ, hits, challengedIds, challengeTo, colorOf, badgeOf, photoOf } = useContext(VenueCtx);
  return (
    <>
      <div className="search-row">
        <Search size={16} className="mail-ico" />
        <input placeholder={t("Spieler oder Lokal suchen …")} value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} />
      </div>
      {hits.length > 0 && (
        <div className="venue-list">
          {hits.map((p) => (
            challengedIds.has(p.id)
              ? (
                <div key={p.id} className="venue-row venue-hit done">
                  <Ball nick={p.nickname} color={colorOf(p.nickname)} label={initials(p.nickname)} badge={badgeOf(p.nickname)} photo={photoOf(p.nickname)} size={26} />
                  <b>{p.nickname}</b>
                  <span className="rank-meta venue-hit-end"><Swords size={13} /> {t("Duell angefragt")}</span>
                </div>
              ) : (
                <button key={p.id} type="button" className="venue-row venue-hit as-btn" onClick={() => challengeTo(p)}>
                  <Ball nick={p.nickname} color={colorOf(p.nickname)} label={initials(p.nickname)} badge={badgeOf(p.nickname)} photo={photoOf(p.nickname)} size={26} />
                  <b>{p.nickname}</b>
                  <span className="venue-hit-end"><Swords size={15} /> {t("Duell anbieten")}</span>
                </button>
              )
          ))}
        </div>
      )}
    </>
  );
}

/* Zwei Schnellaktionen: "Online gehen" und "Planung erstellen" - beide oeffnen dieselbe Maske (VenueMask) */
export function VenueQuick() {
  const { myPing, onClose, onCreate, onCreatePlanning } = useContext(VenueCtx);
  const [open, setOpen] = useState(null); // null | "live" | "plan"
  const toggle = (k) => setOpen(open === k ? null : k);
  return (
    <div className="quick">
      <div className="quick-row">
        {myPing
          ? <button type="button" className="quick-btn on" onClick={onClose}><X size={16} /> {t("Offline gehen")}</button>
          : <button type="button" className={"quick-btn live" + (open === "live" ? " on" : "")} onClick={() => toggle("live")} aria-expanded={open === "live"}><Radio size={16} /> {t("Online gehen")}</button>}
        <button type="button" className={"quick-btn" + (open === "plan" ? " on" : "")} onClick={() => toggle("plan")} aria-expanded={open === "plan"}><Calendar size={16} /> {t("Planung erstellen")}</button>
      </div>
      <div className={"collapsible" + (open ? " open" : "")} inert={open ? undefined : ""}>
        <div className="collapsible-inner">
          {open === "live" && !myPing && <VenueMask kind="live" onSubmit={({ venue, msg, hours, here }) => onCreate(venue ? venue.name : t("Mein Standort"), msg, hours, venue ? null : here)} onDone={() => setOpen(null)} />}
          {open === "plan" && <VenueMask kind="plan" onSubmit={({ date, msg, locId }) => onCreatePlanning(date, msg, locId)} onDone={() => setOpen(null)} />}
        </div>
      </div>
    </div>
  );
}
