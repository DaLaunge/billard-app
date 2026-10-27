import { useEffect, useRef } from "react";
import { Swords } from "lucide-react";
import { t } from "../lib/i18n";
import ChallengeCard from "./ChallengeCard";
import ImprintFooter from "./widgets/ImprintFooter";
import ShowAllCardsButton from "./widgets/ShowAllCardsButton";
import CardSlot from "./widgets/CardSlot";
import CardDeck from "./widgets/CardDeck";
import VenueList, { VenueProvider, PingBlock, VenueSearch, VenueQuick } from "./widgets/VenueList";
import LocationReview from "./widgets/LocationReview";
import { useCardLayout } from "../lib/useCardLayout";

// Live-Bildschirm (seit 424.31 ohne Reiter-Karte): ganz oben der Ping, direkt darunter die Suche (wer ueber den Ping nicht
// gefunden wird, wird hier gesucht), dann die zwei Schnellaktionen "Online gehen" / "Planung erstellen", danach die Duelle
// (nur wenn es welche gibt) und die Liste mit allem, was gerade live oder geplant ist, sowie die Lokale.
// Daten und Handler der Orte-Ansicht liegen einmal im VenueProvider (siehe VenueList.jsx).
export default function LiveScreen({ me, pings, plannings, challenges, players,
  colorOf, badgeOf, photoOf, onCreate, onClose, onReply, onUnreply,
  onCreatePlanning, onDeletePlanning, onUpdatePlanning, onReplyPlanning, onUnreplyPlanning,
  onDeclineChallenge, onCancelChallenge, onEditChallengeMessage, onReplyToChallenge, onOpenProfile, onSetCardLayout, onCreateChallenge, toast }) {
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

  // Sichtbarkeit der Duell-Karte (Einstellungen -> Karten, oder im Kartenmenue hier)
  const cards = useCardLayout("live", me.card_layout, onSetCardLayout, toast);

  const duelleBody = (
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
    </>
  );
  // Ohne Duelle gibt es die Karte samt Ueberschrift gar nicht
  const showDuelle = openChallenges.length > 0 && cards.visibleOrder.includes("duelle");

  return (
    <VenueProvider me={me} players={players} toast={toast} pings={pings} plannings={plannings} challengesFromMe={challengesFromMe} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
      onOpenProfile={onOpenProfile} onCreate={onCreate} onClose={onClose} onCreatePlanning={onCreatePlanning} onUpdatePlanning={onUpdatePlanning} onDeletePlanning={onDeletePlanning}
      onReply={onReply} onUnreply={onUnreply} onReplyPlanning={onReplyPlanning} onUnreplyPlanning={onUnreplyPlanning} onChallenge={onCreateChallenge}>
      <div className="screen">
        <header className="screen-head">
          <h2>{t("Live")}</h2>
          <span className="head-note">{t("Wer ist gerade am Tisch oder sucht ein Match?")}</span>
        </header>

        <PingBlock />
        <VenueSearch />
        <VenueQuick />

        {showDuelle && (
          <CardSlot order={10}>
            <CardDeck icon={<Swords size={17} />} title={t("Duelle")}
              tabs={[{ id: "duelle", tab: t("Duelle"), title: t("Duelle"), icon: <Swords size={15} />, count: openChallenges.length, render: () => duelleBody }]}
              activeId="duelle" onActive={() => {}} onHide={() => cards.hideCard("duelle")} />
          </CardSlot>
        )}

        <VenueList />
        <LocationReview me={me} players={players} toast={toast} />
        <ShowAllCardsButton hiddenCount={cards.hiddenCount} onShowAll={cards.showAll} />
        <ImprintFooter />
      </div>
    </VenueProvider>
  );
}
