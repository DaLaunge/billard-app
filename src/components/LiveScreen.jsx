import { useState, useEffect, useRef } from "react";
import { Radio, Swords, Users } from "lucide-react";
import { t } from "../lib/i18n";
import ChallengeCard from "./ChallengeCard";
import ImprintFooter from "./widgets/ImprintFooter";
import ShowAllCardsButton from "./widgets/ShowAllCardsButton";
import CardSlot from "./widgets/CardSlot";
import CardDeck from "./widgets/CardDeck";
import VenueList, { VenueProvider, PingBlock } from "./widgets/VenueList";
import LocationReview from "./widgets/LocationReview";
import { useCardLayout } from "../lib/useCardLayout";
import { deckIds, foldedDeck, withoutFolded } from "../lib/cardLayout";

// Die drei Bereiche dieses Bildschirms teilen sich seit 2026-09-30 EINE
// Karte mit Reitern (siehe CardDeck.jsx). Live hatte dabei das umgekehrte
// Problem von Statistik/Profil: nicht zu voll, sondern zu leer - drei
// Klapp-Balken, von denen zwei fast nur aus einem Eingabeformular bestanden
// ("Ich bin bereit!", "Planung erstellen"), zusammen 1341px Hoehe bei NULL
// Eintraegen. Jetzt steht die Liste vorne und das Formular hinter einem
// Knopf; die Zaehler an den Reitern zeigen weiterhin auf einen Blick, wo
// etwas liegt.
// Regelkunde (animierte Regelfaelle) als eigene Live-Karte: dort schaut man nach, wenn am Tisch etwas
// strittig ist. Eigener Chunk, geladen erst nach dem Aufklappen. Seit der Freigabe (2026-10-07) fuer alle;
// Admins sehen zusaetzlich noch nicht freigegebene Faelle (`released: false`).
const LIVE_DECK_IDS = deckIds("live", "mitspieler");
const DECK_TAB_KEY = "liveDeckTab";
const readLocal = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeLocal = (k, v) => { try { localStorage.setItem(k, v); } catch { /* Privatmodus */ } };

export default function LiveScreen({ me, pings, plannings, challenges, matches, rangliste, players, catalog, earnedBadges,
  colorOf, badgeOf, photoOf, onCreate, onClose, onReply, onUnreply,
  onCreatePlanning, onDeletePlanning, onUpdatePlanning, onReplyPlanning, onUnreplyPlanning,
  onDeclineChallenge, onCancelChallenge, onEditChallengeMessage, onReplyToChallenge, onOpenProfile, onInvite, onSetCardLayout, onCreateChallenge, toast }) {
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

  const counts = { duelle: openChallenges.length, orte: pings.length + plannings.length };


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
  };

  const TAB_META = {
    duelle: { tab: t("Duelle"), title: t("Duelle"), icon: <Swords size={15} /> },
    orte: { tab: t("Live & Planung"), title: t("Live & Planung"), icon: <Radio size={15} /> },
  };

  const { parts, anchor } = foldedDeck(cards.visibleOrder, LIVE_DECK_IDS);
  bodyById.orte = (
    <VenueList />
  );
  // Offener Reiter: die letzte Wahl dieses Geraets, sonst der erste Teil, in
  // dem ueberhaupt etwas steht - das erspart auf einem vollen Bildschirm den
  // ersten Klick. Ist NICHTS eingetragen, gewinnt "Live": das ist der
  // einzige Teil mit einer Handlung ("Ich bin am Tisch"), und genau die
  // gehoert auf einen leeren Bildschirm, statt ihn mit einer leeren
  // Duell-Liste zu eroeffnen.
  const [deckTab, setDeckTab] = useState(() => readLocal(DECK_TAB_KEY));
  const activeId = parts.includes(deckTab)
    ? deckTab
    : (parts.find((id) => counts[id] > 0) || (parts.includes("orte") ? "orte" : parts[0]));
  // Einklappen ersetzt das fruehere Zuklappen je Bereich - dieselbe Geste,
  // nur einmal statt dreimal, und wie dort nur auf diesem Geraet gemerkt.

  const cardsById = {};
  if (anchor) {
    cardsById[anchor] = (
      <CardDeck icon={<Users size={17} />} title={t("Mitspieler finden")}
        tabs={parts.map((id) => ({ id, ...TAB_META[id], count: counts[id], render: () => bodyById[id] }))}
        activeId={activeId} onActive={(id) => { setDeckTab(id); writeLocal(DECK_TAB_KEY, id); }}
        onHide={() => cards.hideCard(activeId)} />
    );
  }

  const visibleOrder = withoutFolded(cards.visibleOrder, LIVE_DECK_IDS, anchor);
  const renderCards = (ids) => ids.filter((id) => cardsById[id]).map((id) => (
    <CardSlot key={id} order={10 + visibleOrder.indexOf(id)}>{cardsById[id]}</CardSlot>
  ));

  return (
    <VenueProvider me={me} toast={toast} pings={pings} plannings={plannings} challengesFromMe={challengesFromMe} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
      onOpenProfile={onOpenProfile} onCreate={onCreate} onClose={onClose} onCreatePlanning={onCreatePlanning} onUpdatePlanning={onUpdatePlanning} onDeletePlanning={onDeletePlanning}
      onReply={onReply} onUnreply={onUnreply} onReplyPlanning={onReplyPlanning} onUnreplyPlanning={onUnreplyPlanning} onChallenge={onCreateChallenge} >
    <div className="screen">
      <header className="screen-head">
        <h2>{t("Live")}</h2>
        <span className="head-note">{t("Wer ist gerade am Tisch oder sucht ein Match?")}</span>
      </header>

      {/* Der Ping steht ganz oben, noch vor den Duellen - sehr praesent */}
      <PingBlock />

      <div className="live-split">
      {/* Keine linke Profil-Spalte mehr: am PC steht die Kugel ohnehin dauerhaft oben links in der Seitenleiste (AppDrawer). */}
      <div className="live-col middle">{renderCards(visibleOrder)}</div>
      </div>
      <LocationReview me={me} players={players} toast={toast} />
      <ShowAllCardsButton hiddenCount={cards.hiddenCount} onShowAll={cards.showAll} />
      <ImprintFooter />
    </div>
    </VenueProvider>
  );
}
