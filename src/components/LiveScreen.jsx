import { useEffect, useRef, useState } from "react";
import { Swords, ChevronDown } from "lucide-react";
import { t } from "../lib/i18n";
import { supabase } from "../supabase";
import { useLocations } from "../lib/locationStore";
import ChallengeCard from "./ChallengeCard";
import ImprintFooter from "./widgets/ImprintFooter";
import ShowAllCardsButton from "./widgets/ShowAllCardsButton";
import CardSlot from "./widgets/CardSlot";
import CardMenuButton from "./widgets/CardMenuButton";
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

  // Ortsvorschlaege der Duelle (eigene Abfrage, damit ein Fehlen der Migration 2026-10-28b nichts anderes stoert)
  const locs = useLocations();
  const [clocs, setClocs] = useState({});
  const loadClocs = () => supabase.from("challenges").select("id, location_id, location_by").not("location_id", "is", null)
    .then(({ data, error }) => { if (!error) setClocs(Object.fromEntries((data || []).map((r) => [r.id, r]))); });
  useEffect(() => { loadClocs(); }, [openChallenges.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const setPlace = async (id, locId) => {
    const { error } = await supabase.rpc("set_challenge_location", { p_challenge_id: id, p_location_id: locId || null });
    if (error) toast(t("Fehler: ") + error.message);
    else toast(locId ? t("Ortsvorschlag gespeichert.") : t("Ortsvorschlag entfernt."));
    loadClocs();
  };
  const placeProps = (c) => {
    const r = clocs[c.id];
    return {
      place: r ? locs.list.find((l) => l.id === r.location_id) || null : null,
      placeBy: r ? players?.find((p) => p.id === r.location_by)?.nickname : null,
      onSetPlace: locs.available ? setPlace : null, toast, me,
    };
  };
  const [duelOpen, setDuelOpen] = useState(false); // Duelle sind standardmaessig eingeklappt, der Zaehler im Kopf zeigt, wie viele es sind

  const duelleBody = (
    <>
      {challengesToMe.length > 0 && <p className="q">{t("Herausforderungen an dich")}</p>}
      {challengesToMe.map((c) => (
        <ChallengeCard key={c.id} challenge={c} role="to" colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile}
          isNewMsg={isNew(c, "msg")} onDecline={onDeclineChallenge} onReply={onReplyToChallenge} {...placeProps(c)} />
      ))}
      {challengesFromMe.length > 0 && <p className="q" style={{ marginTop: challengesToMe.length ? 18 : 0 }}>{t("Deine offenen Herausforderungen")}</p>}
      {challengesFromMe.map((c) => (
        <ChallengeCard key={c.id} challenge={c} role="from" colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile}
          isNewReply={isNew(c, "reply")} onCancel={onCancelChallenge} onEditMessage={onEditChallengeMessage} {...placeProps(c)} />
      ))}
    </>
  );
  // Ohne Duelle gibt es die Karte samt Ueberschrift gar nicht
  const showDuelle = openChallenges.length > 0 && cards.visibleOrder.includes("duelle");

  return (
    <VenueProvider me={me} players={players} toast={toast} pings={pings} plannings={plannings} challengesFromMe={challengesFromMe} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
      onOpenProfile={onOpenProfile} onCreate={onCreate} onClose={onClose} onCreatePlanning={onCreatePlanning} onUpdatePlanning={onUpdatePlanning} onDeletePlanning={onDeletePlanning}
      onReply={onReply} onUnreply={onUnreply} onReplyPlanning={onReplyPlanning} onUnreplyPlanning={onUnreplyPlanning} onChallenge={(pid, msg, locId) => { onCreateChallenge(pid, msg, locId); setDuelOpen(true); }}>
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
            <section className="stat-block duel-card">
              <div className="stat-block-head">
                <button type="button" className="duel-toggle as-btn" onClick={() => setDuelOpen((v) => !v)} aria-expanded={duelOpen}
                  title={duelOpen ? t("Zuklappen") : t("Aufklappen")}>
                  <h3><Swords size={17} /> <span className="stat-block-title-text">{t("Duelle")}</span>
                    <span className="deck-tab-count duel-count">{openChallenges.length}</span>
                  </h3>
                  <span className="rank-meta duel-sub">
                    {challengesToMe.length > 0 && t("{n} an dich", { n: challengesToMe.length })}
                    {challengesToMe.length > 0 && challengesFromMe.length > 0 && " · "}
                    {challengesFromMe.length > 0 && t("{n} von dir", { n: challengesFromMe.length })}
                  </span>
                  <ChevronDown size={16} className={"duel-chev" + (duelOpen ? " open" : "")} />
                </button>
                <div className="stat-block-head-actions"><CardMenuButton onHide={() => cards.hideCard("duelle")} /></div>
              </div>
              <div className={"collapsible" + (duelOpen ? " open" : "")} inert={duelOpen ? undefined : ""}>
                <div className="collapsible-inner">{duelleBody}</div>
              </div>
            </section>
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
