import { useState, useEffect, useRef } from "react";
import { Radio, MapPin, Pencil, X, Swords, ChevronDown, Calendar } from "lucide-react";
import { t } from "../lib/i18n";
import PingCard from "./PingCard";
import PlanungCard from "./PlanungCard";
import ChallengeCard from "./ChallengeCard";
import UserPanel from "./widgets/UserPanel";
import ImprintFooter from "./widgets/ImprintFooter";

export default function LiveScreen({ me, pings, plannings, challenges, matches, rangliste, players, catalog, earnedBadges,
  colorOf, badgeOf, photoOf, onCreate, onClose, onReply, onUnreply,
  onCreatePlanning, onDeletePlanning, onReplyPlanning, onUnreplyPlanning,
  onDeclineChallenge, onCancelChallenge, onEditChallengeMessage, onReplyToChallenge, onOpenProfile, onInvite }) {
  const myPing = pings.find((p) => p.player_id === me.id);
  const others = pings.filter((p) => p.player_id !== me.id);
  const [loc, setLoc] = useState("");
  const [msg, setMsg] = useState("");
  const [hours, setHours] = useState(3);

  const myPlannings = plannings.filter((p) => p.player_id === me.id);
  const otherPlannings = plannings.filter((p) => p.player_id !== me.id);
  const [planDate, setPlanDate] = useState("");
  const [planMsg, setPlanMsg] = useState("");
  const todayISO = new Date().toISOString().slice(0, 10);
  const maxPlanDate = new Date();
  maxPlanDate.setDate(maxPlanDate.getDate() + 120);
  const maxPlanISO = maxPlanDate.toISOString().slice(0, 10);

  const openChallenges = (challenges || []).filter((c) => c.status === "open" && new Date(c.expires_at) > new Date());
  const challengesToMe = openChallenges.filter((c) => c.challenged_id === me.id);
  const challengesFromMe = openChallenges.filter((c) => c.challenger_id === me.id);

  // Zwei einklappbare Bereiche (Duelle / Live), Zustand gemerkt wie bei den
  // Erfolgs-Kategorien im Profil. Standard: Duelle (erfordert Reaktion)
  // aufgeklappt, die Live-Liste (reine Info, aendert sich staendig) erstmal
  // zugeklappt - laesst sich aber jederzeit wieder aufklappen.
  const [openSecs, setOpenSecs] = useState(() => {
    try { const s = localStorage.getItem("liveSections"); if (s) return new Set(JSON.parse(s)); } catch { /* ignore */ }
    return new Set(["duelle"]);
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
  const planungOpen = openSecs.has("planung");

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>{t("Live")}</h2>
        <span className="head-note">{t("Wer ist gerade am Tisch oder sucht ein Match?")}</span>
      </header>

      <div className="live-split">
      <aside className="ov-side">
        <div className="ov-side-extra">
          <UserPanel nickname={me.nickname} matches={matches} rangliste={rangliste} players={players}
            challenges={challenges} catalog={catalog} earnedBadges={earnedBadges}
            colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} onInvite={onInvite} />
        </div>
      </aside>

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
              <ChallengeCard key={c.id} challenge={c} role="to" colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile}
                isNewMsg={isNew(c, "msg")} onDecline={onDeclineChallenge} onReply={onReplyToChallenge} />
            ))}
            {challengesFromMe.length > 0 && <p className="q" style={{ marginTop: challengesToMe.length ? 18 : 0 }}>{t("Deine offenen Herausforderungen")}</p>}
            {challengesFromMe.map((c) => (
              <ChallengeCard key={c.id} challenge={c} role="from" colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile}
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

      <div className="live-section pings">
        <button className="live-section-head" onClick={() => toggleSec("live")}>
          <Radio size={17} />
          <span className="live-section-title">{t("Live")}</span>
          <span className="live-section-count">{pings.length}</span>
          <ChevronDown size={16} className={"cat-chev" + (liveOpen ? " open" : "")} />
        </button>
        {liveOpen && (
          <>
            {myPing ? (
              <PingCard ping={myPing} me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} onReply={onReply} onUnreply={onUnreply} />
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
              <PingCard key={p.id} ping={p} me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} onReply={onReply} onUnreply={onUnreply} />
            ))}
            {others.length === 0 && !myPing && (
              <p className="hint center" style={{ marginTop: 24 }}>
                {t("Gerade ist niemand live. Sei du der Erste - dein Eintrag erscheint hier fuer alle sichtbar.")}
              </p>
            )}
          </>
        )}
      </div>

      <div className="live-section planung">
        <button className="live-section-head" onClick={() => toggleSec("planung")}>
          <Calendar size={17} />
          <span className="live-section-title">{t("Planung")}</span>
          <span className="live-section-count">{plannings.length}</span>
          <ChevronDown size={16} className={"cat-chev" + (planungOpen ? " open" : "")} />
        </button>
        {planungOpen && (
          <>
            <section className="stat-block">
              <h3><Calendar size={17} /> {t("Planung erstellen")}</h3>
              <p className="hint" style={{ marginTop: 0 }}>
                {t("Wann bist du voraussichtlich verfuegbar? Andere koennen dir dann direkt eine Nachricht schicken - spart laestiges Hin-und-Her bei der Terminfindung.")}
              </p>
              <div className="search-row">
                <Calendar size={16} className="mail-ico" />
                <input type="date" value={planDate} min={todayISO} max={maxPlanISO} aria-label={t("Datum")}
                  onChange={(e) => setPlanDate(e.target.value)} />
              </div>
              <div className="search-row">
                <Pencil size={16} className="mail-ico" />
                <input placeholder={t("Hinweis (optional), z. B. 'Bin flexibel, meldet euch'")} value={planMsg}
                  maxLength={120} onChange={(e) => setPlanMsg(e.target.value)} />
              </div>
              <button className="btn primary" disabled={!planDate}
                onClick={() => { onCreatePlanning(planDate, planMsg); setPlanDate(""); setPlanMsg(""); }}>
                <Calendar size={17} /> {t("Planung eintragen")}
              </button>
              <p className="hint">{t("Deine Planung verschwindet automatisch nach dem gewaehlten Tag.")}</p>
            </section>

            {myPlannings.length > 0 && <p className="q" style={{ marginTop: 18 }}>{t("Meine Planungen:")}</p>}
            {myPlannings.map((p) => (
              <PlanungCard key={p.id} planning={p} me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                onOpenProfile={onOpenProfile} onDelete={onDeletePlanning} />
            ))}

            {otherPlannings.length > 0 && <p className="q" style={{ marginTop: 18 }}>{t("Weitere Planungen:")}</p>}
            {otherPlannings.map((p) => (
              <PlanungCard key={p.id} planning={p} me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                onOpenProfile={onOpenProfile} onReply={onReplyPlanning} onUnreply={onUnreplyPlanning} />
            ))}
            {plannings.length === 0 && (
              <p className="hint center" style={{ marginTop: 24 }}>
                {t("Noch keine Planungen. Leg die erste an - dein Eintrag ist fuer alle sichtbar.")}
              </p>
            )}
          </>
        )}
      </div>
      </div>
      <ImprintFooter />
    </div>
  );
}
