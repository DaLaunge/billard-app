import { useState, useEffect, useRef } from "react";
import { Radio, MapPin, Pencil, X, Swords, Calendar, Users, Plus } from "lucide-react";
import { t } from "../lib/i18n";
import PingCard from "./PingCard";
import PlanungCard from "./PlanungCard";
import ChallengeCard from "./ChallengeCard";
import UserPanel from "./widgets/UserPanel";
import ImprintFooter from "./widgets/ImprintFooter";
import ShowAllCardsButton from "./widgets/ShowAllCardsButton";
import CardSlot from "./widgets/CardSlot";
import CardDeck from "./widgets/CardDeck";
import { useCardLayout } from "../lib/useCardLayout";
import { deckIds, foldedDeck, withoutFolded, deckColumn, splitCardColumns, phoneSlotOrder } from "../lib/cardLayout";

// Die drei Bereiche dieses Bildschirms teilen sich seit 2026-09-30 EINE
// Karte mit Reitern (siehe CardDeck.jsx). Live hatte dabei das umgekehrte
// Problem von Statistik/Profil: nicht zu voll, sondern zu leer - drei
// Klapp-Balken, von denen zwei fast nur aus einem Eingabeformular bestanden
// ("Ich bin bereit!", "Planung erstellen"), zusammen 1341px Hoehe bei NULL
// Eintraegen. Jetzt steht die Liste vorne und das Formular hinter einem
// Knopf; die Zaehler an den Reitern zeigen weiterhin auf einen Blick, wo
// etwas liegt.
const LIVE_DECK_IDS = deckIds("live", "mitspieler");
const DECK_TAB_KEY = "liveDeckTab";
const DECK_COLLAPSE_KEY = "liveDeckCollapsed";
const readLocal = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeLocal = (k, v) => { try { localStorage.setItem(k, v); } catch { /* Privatmodus */ } };

export default function LiveScreen({ me, pings, plannings, challenges, matches, rangliste, players, catalog, earnedBadges,
  colorOf, badgeOf, photoOf, onCreate, onClose, onReply, onUnreply,
  onCreatePlanning, onDeletePlanning, onReplyPlanning, onUnreplyPlanning,
  onDeclineChallenge, onCancelChallenge, onEditChallengeMessage, onReplyToChallenge, onOpenProfile, onInvite, onSetCardLayout, toast }) {
  const myPing = pings.find((p) => p.player_id === me.id);
  const others = pings.filter((p) => p.player_id !== me.id);
  const [loc, setLoc] = useState("");
  const [msg, setMsg] = useState("");
  const [hours, setHours] = useState(3);
  // Die beiden Formulare standen frueher dauerhaft offen und fuellten den
  // halben Bildschirm, obwohl man sie selten braucht - jetzt hinter einem
  // Knopf, damit oben steht, wofuer man herkommt: wer gerade da ist.
  const [pingForm, setPingForm] = useState(false);
  const [planForm, setPlanForm] = useState(false);

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

  // "Neu"-Markierung fuer Nachrichten/Antworten: beim ersten Laden ueberhaupt
  // gilt alles als gesehen (kein Ansturm an "Neu"-Punkten direkt nach dem
  // Feature-Start), danach zeigt sich "Neu" nur bei Aenderungen seit dem
  // letzten Aufruf dieses Bildschirms (gleiches Muster wie seenBadges).
  const seenKey = `seenChallengeMsgs:${me.id}`;
  const seenRef = useRef(undefined);
  if (seenRef.current === undefined) {
    try { seenRef.current = JSON.parse(localStorage.getItem(seenKey) || "null"); } catch { seenRef.current = null; }
  }
  const isNew = (c, field) => {
    const prev = seenRef.current;
    if (!prev) return false;
    const key = `${c.id}:${field}`;
    const stamp = field === "msg" ? c.message_at : c.reply_at;
    if (!stamp) return false;
    return !prev[key] || prev[key] !== stamp;
  };
  useEffect(() => {
    const next = {};
    openChallenges.forEach((c) => {
      if (c.message_at) next[`${c.id}:msg`] = c.message_at;
      if (c.reply_at) next[`${c.id}:reply`] = c.reply_at;
    });
    const save = () => { try { localStorage.setItem(seenKey, JSON.stringify(next)); } catch { /* ignore */ } };
    const id = setTimeout(save, 1500);
    return () => { clearTimeout(id); save(); };
  });

  // Anordnung + Sichtbarkeit der drei Bereiche Duelle/Live/Planung (die
  // "Karten" dieses Bildschirms; die ids stehen im Katalog in cardLayout.js).
  // Beides aendert der Nutzer in den Einstellungen (Profil bearbeiten ->
  // Karten), das Ausblenden zusaetzlich direkt im Kartenmenue hier.
  const cards = useCardLayout("live", me.card_layout, onSetCardLayout, toast);

  const counts = { duelle: openChallenges.length, pings: pings.length, planung: plannings.length };

  // Inhalte der drei Teile - Rahmen, Titel und Kartenmenue kommen von der
  // gemeinsamen Deck-Karte.
  const bodyById = {
    duelle: (
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
          <p className="hint center">
            {t("Noch keine Herausforderungen - fordere jemanden beim Match anlegen oder im Profil heraus.")}
          </p>
        )}
      </>
    ),
    pings: (
      <>
        {myPing ? (
          <>
            <PingCard ping={myPing} me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} onReply={onReply} onUnreply={onUnreply} />
            <button className="btn ghost small" onClick={onClose}><X size={15} /> {t("Live-Eintrag beenden")}</button>
          </>
        ) : pingForm ? (
          <>
            <div className="search-row">
              <MapPin size={16} className="mail-ico" />
              <input autoFocus placeholder={t("Wo bist du? z. B. Schwedenplatz")} value={loc}
                maxLength={60} onChange={(e) => setLoc(e.target.value)} />
            </div>
            <div className="search-row">
              <Pencil size={16} className="mail-ico" />
              <input placeholder={t("Nachricht (optional), z. B. 'Wer hat Lust auf 9 Ball?'")} value={msg}
                maxLength={120} onChange={(e) => setMsg(e.target.value)} />
            </div>
            <div className="chips small" style={{ marginBottom: 6 }}>
              {[1, 2, 3, 6].map((h) => (
                <button key={h} className={"chip" + (hours === h ? " active" : "")} onClick={() => setHours(h)}>
                  {t("{n} Std", { n: h })}
                </button>
              ))}
            </div>
            <div className="sp-controls">
              <button className="btn ghost" onClick={() => setPingForm(false)}>{t("Abbrechen")}</button>
              <button className="btn primary" disabled={loc.trim().length < 2}
                onClick={() => { onCreate(loc, msg, hours); setLoc(""); setMsg(""); setPingForm(false); }}>
                <Radio size={17} /> {t("Live gehen")}
              </button>
            </div>
            <p className="hint">{t("Dein Eintrag verschwindet nach der gewaehlten Zeit von selbst.")}</p>
          </>
        ) : (
          <button className="btn primary" onClick={() => setPingForm(true)}>
            <Radio size={17} /> {t("Ich bin am Tisch")}
          </button>
        )}

        {others.length > 0 && <p className="q" style={{ marginTop: 16 }}>{t("Gerade aktiv:")}</p>}
        {others.map((p) => (
          <PingCard key={p.id} ping={p} me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} onReply={onReply} onUnreply={onUnreply} />
        ))}
        {others.length === 0 && !myPing && (
          <p className="hint center">
            {t("Gerade ist niemand live. Sei du der Erste - dein Eintrag erscheint hier fuer alle sichtbar.")}
          </p>
        )}
      </>
    ),
    planung: (
      <>
        {planForm ? (
          <>
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
            <div className="sp-controls">
              <button className="btn ghost" onClick={() => setPlanForm(false)}>{t("Abbrechen")}</button>
              <button className="btn primary" disabled={!planDate}
                onClick={() => { onCreatePlanning(planDate, planMsg); setPlanDate(""); setPlanMsg(""); setPlanForm(false); }}>
                <Calendar size={17} /> {t("Planung eintragen")}
              </button>
            </div>
            <p className="hint">{t("Deine Planung verschwindet automatisch nach dem gewaehlten Tag.")}</p>
          </>
        ) : (
          <button className="btn primary" onClick={() => setPlanForm(true)}>
            <Plus size={17} /> {t("Termin eintragen")}
          </button>
        )}

        {myPlannings.length > 0 && <p className="q" style={{ marginTop: 16 }}>{t("Meine Planungen:")}</p>}
        {myPlannings.map((p) => (
          <PlanungCard key={p.id} planning={p} me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
            onOpenProfile={onOpenProfile} onDelete={onDeletePlanning} />
        ))}

        {otherPlannings.length > 0 && <p className="q" style={{ marginTop: 16 }}>{t("Weitere Planungen:")}</p>}
        {otherPlannings.map((p) => (
          <PlanungCard key={p.id} planning={p} me={me} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
            onOpenProfile={onOpenProfile} onReply={onReplyPlanning} onUnreply={onUnreplyPlanning} />
        ))}
        {plannings.length === 0 && (
          <p className="hint center">
            {t("Noch keine Planungen. Leg die erste an - dein Eintrag ist fuer alle sichtbar.")}
          </p>
        )}
      </>
    ),
  };

  const TAB_META = {
    duelle: { tab: t("Duelle"), title: t("Duelle"), icon: <Swords size={15} /> },
    pings: { tab: t("Live"), title: t("Live"), icon: <Radio size={15} /> },
    planung: { tab: t("Planung"), title: t("Planung"), icon: <Calendar size={15} /> },
  };

  const { parts, anchor } = foldedDeck(cards.visibleOrder, LIVE_DECK_IDS);
  // Offener Reiter: die letzte Wahl dieses Geraets, sonst der erste Teil, in
  // dem ueberhaupt etwas steht - das erspart auf einem vollen Bildschirm den
  // ersten Klick. Ist NICHTS eingetragen, gewinnt "Live": das ist der
  // einzige Teil mit einer Handlung ("Ich bin am Tisch"), und genau die
  // gehoert auf einen leeren Bildschirm, statt ihn mit einer leeren
  // Duell-Liste zu eroeffnen.
  const [deckTab, setDeckTab] = useState(() => readLocal(DECK_TAB_KEY));
  const activeId = parts.includes(deckTab)
    ? deckTab
    : (parts.find((id) => counts[id] > 0) || (parts.includes("pings") ? "pings" : parts[0]));
  // Einklappen ersetzt das fruehere Zuklappen je Bereich - dieselbe Geste,
  // nur einmal statt dreimal, und wie dort nur auf diesem Geraet gemerkt.
  const [collapsed, setCollapsed] = useState(() => readLocal(DECK_COLLAPSE_KEY) === "1");

  const cardsById = {};
  if (anchor) {
    cardsById[anchor] = (
      <CardDeck icon={<Users size={17} />} title={t("Mitspieler finden")}
        tabs={parts.map((id) => ({ id, ...TAB_META[id], count: counts[id], render: () => bodyById[id] }))}
        activeId={activeId} onActive={(id) => { setDeckTab(id); writeLocal(DECK_TAB_KEY, id); }}
        collapsed={collapsed} onToggleCollapse={() => { writeLocal(DECK_COLLAPSE_KEY, collapsed ? "0" : "1"); setCollapsed(!collapsed); }}
        onHide={() => cards.hideCard(activeId)} />
    );
  }

  // Die Deck-Karte zaehlt am Desktop als EINE Karte und braucht daher EINE
  // Spalte (siehe deckColumn()), unabhaengig davon, welcher Teil gerade der
  // erste sichtbare ist.
  const deckCol = deckColumn(cards.columns, LIVE_DECK_IDS, "live");
  const byCol = splitCardColumns(cards.visibleOrder,
    { ...cards.columns, ...Object.fromEntries(LIVE_DECK_IDS.map((id) => [id, deckCol])) }, "live");
  const middleCardIds = withoutFolded(byCol.middle, LIVE_DECK_IDS, anchor);
  const rightCardIds = withoutFolded(byCol.right, LIVE_DECK_IDS, anchor);
  const visibleOrder = withoutFolded(cards.visibleOrder, LIVE_DECK_IDS, anchor);
  // "order" = Platz in der Gesamtreihenfolge; am Handy ergibt das EINE
  // durchgehende Liste ueber beide Spalten hinweg (siehe CardSlot.jsx).
  const renderColumn = (ids, col) => ids.filter((id) => cardsById[id]).map((id) => (
    <CardSlot key={id} order={phoneSlotOrder(col, visibleOrder.indexOf(id))}>{cardsById[id]}</CardSlot>
  ));

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
            challenges={challenges} catalog={catalog} earnedBadges={earnedBadges} cardLayout={me.card_layout}
            colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} onInvite={onInvite} />
        </div>
      </aside>
      {/* Zwei frei befuellbare Spalten (am Handy per display:contents EINE
          durchgehende Liste, siehe App.css): breit in der Mitte, schmal
          rechts. Eine leere Spalte verschwindet per CSS ganz, statt eine
          Luecke zu hinterlassen (Nutzer-Feedback: "die Luecken zwischen den
          Karten sind unnoetig gross, wenn manche dazwischen ausgeblendet
          sind"). */}
      <div className="live-col middle">{renderColumn(middleCardIds, "middle")}</div>
      <div className="live-col right">{renderColumn(rightCardIds, "right")}</div>
      </div>
      <ShowAllCardsButton hiddenCount={cards.hiddenCount} onShowAll={cards.showAll} />
      <ImprintFooter />
    </div>
  );
}
