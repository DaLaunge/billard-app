import { useState, useEffect, useRef } from "react";
import { Radio, MapPin, Pencil, X, Swords, ChevronDown } from "lucide-react";
import { t } from "../lib/i18n";
import PingCard from "./PingCard";
import ChallengeCard from "./ChallengeCard";

export default function LiveScreen({ me, pings, challenges, colorOf, badgeOf, photoOf, onCreate, onClose, onReply, onUnreply,
  onDeclineChallenge, onCancelChallenge, onEditChallengeMessage, onReplyToChallenge }) {
  const myPing = pings.find((p) => p.player_id === me.id);
  const others = pings.filter((p) => p.player_id !== me.id);
  const [loc, setLoc] = useState("");
  const [msg, setMsg] = useState("");
  const [hours, setHours] = useState(3);

  const openChallenges = (challenges || []).filter((c) => c.status === "open" && new Date(c.expires_at) > new Date());
  const challengesToMe = openChallenges.filter((c) => c.challenged_id === me.id);
  const challengesFromMe = openChallenges.filter((c) => c.challenger_id === me.id);

  // Zwei einklappbare Bereiche (Duelle / Live), Zustand gemerkt wie bei den
  // Erfolgs-Kategorien im Profil. Standard: beide aufgeklappt.
  const [openSecs, setOpenSecs] = useState(() => {
    try { const s = localStorage.getItem("liveSections"); if (s) return new Set(JSON.parse(s)); } catch { /* ignore */ }
    return new Set(["duelle", "live"]);
  });
  useEffect(() => {
    try { localStorage.setItem("liveSections", JSON.stringify([...openSecs])); } catch { /* ignore */ }
  }, [openSecs]);
  const toggleSec = (key) => setOpenSecs((prev) => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });

  // "Neu"-Markierung fuer Nachrichten/Antworten: beim ersten Laden ueberhaupt
  // gilt alles als gesehen (kein Ansturm an "Neu"-Punkten direkt nach dem
  // Feature-Start), danach zeigt sich "Neu" nur bei Aenderungen seit dem
  // letzten Aufruf dieses Bildschirms (gleiches Muster wie seenBadges).
  const seenKey = `seenChallengeMsgs:${me.id}`;
  const seenRef = useRef(undefined);
  if (seenRef.current === undefined) {
    try { seenRef.current = JSON.parse(localStorage.getItem(seenKey) || "null"); } catch { seenRef.current = null; }
  }
  const firstLoad = seenRef.current === null;
  const seen = seenRef.current || {};
  const isNew = (c, field) => {
    if (firstLoad) return false;
    const ts = field === "msg" ? c.message_updated_at : c.reply_updated_at;
    if (!ts) return false;
    const seenTs = seen[c.id]?.[field];
    return !seenTs || new Date(ts) > new Date(seenTs);
  };
  useEffect(() => {
    const next = {};
    (challenges || []).forEach((c) => {
      if (c.challenger_id === me.id || c.challenged_id === me.id) {
        next[c.id] = { msg: c.message_updated_at, reply: c.reply_updated_at };
      }
    });
    try { localStorage.setItem(seenKey, JSON.stringify(next)); } catch { /* ignore */ }
  }, [challenges, me.id, seenKey]);

  const duelleOpen = openSecs.has("duelle");
  const liveOpen = openSecs.has("live");

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>{t("Live")}</h2>
        <span className="head-note">{t("Wer ist gerade am Tisch oder sucht ein Match?")}</span>
      </header>

      <div className="live-section duelle">
        <button className="live-section-head" onClick={() => toggleSec("duelle")}>
          <Swords size={17} />
          <span className="live-section-title">{t("Duelle")}</span>
          <span className="live-section-count">{openChallenges.length}</span>
          <ChevronDown size={16} className={"cat-chev" + (duelleOpen ? " open" : "")} />
        </button>
        {duelleOpen && (
          <>
            {challengesToMe.length > 0 && <p className="q">{t("Herausforderungen an dich")}</p>}
            {challengesToMe.map((c) => (
              <ChallengeCard key={c.id} challenge={c} role="to" colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                isNewMsg={isNew(c, "msg")} onDecline={onDeclineChallenge} onReply={onReplyToChallenge} />
            ))}
            {challengesFromMe.length > 0 && <p className="q" style={{ marginTop: challengesToMe.length ? 18 : 0 }}>{t("Deine offenen Herausforderungen")}</p>}
            {challengesFromMe.map((c) => (
              <ChallengeCard key={c.id} challenge={c} role="from" colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                isNewReply={isNew(c, "reply")} onCancel={onCancelChallenge} onEditMessage={onEditChallengeMessage} />
            ))}
            {openChallenges.length === 0 && (
              <p className="hint center" style={{ marginTop: 8 }}>
                {t("Noch keine Herausforderungen - fordere jemanden beim Match anlegen oder im Profil heraus.")}
              </p>
            )}
          </>
        )}
      </div>

      <div className="live-section">
        <button className="live-section-head" onClick={() => toggleSec("live")}>
          <Radio size={17} />
          <span className="live-section-title">{t("Live")}</span>
          <span className="live-section-count">{pings.length}</span>
          <ChevronDown size={16} className={"cat-chev" + (liveOpen ? " open" : "")} />
        </button>
        {liveOpen && (
          <>
            {myPing ? (
              <PingCard ping={myPing} me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onReply={onReply} onUnreply={onUnreply} />
            ) : (
              <section className="stat-block">
                <h3><Radio size={17} /> {t("Ich bin bereit!")}</h3>
                <div className="search-row">
                  <MapPin size={16} className="mail-ico" />
                  <input placeholder={t("Wo bist du? z. B. Schwedenplatz")} value={loc}
                    maxLength={60} onChange={(e) => setLoc(e.target.value)} />
                </div>
                <div className="search-row">
                  <Pencil size={16} className="mail-ico" />
                  <input placeholder={t("Nachricht (optional), z. B. 'Wer hat Lust auf 9 Ball?'")} value={msg}
                    maxLength={120} onChange={(e) => setMsg(e.target.value)} />
                </div>
                <div className="chips" style={{ marginBottom: 4 }}>
                  {[1, 2, 3, 6].map((h) => (
                    <button key={h} className={"chip" + (hours === h ? " active" : "")} onClick={() => setHours(h)}>
                      {t("{n} Std", { n: h })}
                    </button>
                  ))}
                </div>
                <button className="btn primary" disabled={loc.trim().length < 2}
                  onClick={() => { onCreate(loc, msg, hours); setLoc(""); setMsg(""); }}>
                  <Radio size={17} /> {t("Live gehen")}
                </button>
                <p className="hint">{t("Dein Eintrag verschwindet nach der gewaehlten Zeit von selbst.")}</p>
              </section>
            )}

            {myPing && (
              <button className="btn ghost" onClick={onClose}><X size={15} /> {t("Meinen Live-Eintrag beenden")}</button>
            )}

            {others.length > 0 && <p className="q" style={{ marginTop: 18 }}>{t("Gerade aktiv:")}</p>}
            {others.map((p) => (
              <PingCard key={p.id} ping={p} me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onReply={onReply} onUnreply={onUnreply} />
            ))}
            {others.length === 0 && !myPing && (
              <p className="hint center" style={{ marginTop: 24 }}>
                {t("Gerade ist niemand live. Sei du der Erste - dein Eintrag erscheint hier fuer alle sichtbar.")}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
