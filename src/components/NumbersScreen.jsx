import { useMemo } from "react";
import { t } from "../lib/i18n";
import { getListMode } from "../lib/uiPrefs";
import { computeSpeedStats } from "../lib/runLog";
import { deckIds, foldedDeck } from "../lib/cardLayout";
import { useCardLayout } from "../lib/useCardLayout";
import NumbersDeck from "./widgets/NumbersDeck";
import ShowAllCardsButton from "./widgets/ShowAllCardsButton";
import ImprintFooter from "./widgets/ImprintFooter";

/* MEINE ZAHLEN als eigener Bildschirm (Tab "zahlen", 417.5; vorher ein Modus von ProfilScreen): Ratings, Rekorde, Gegner, Tempo, Fun als
   Kapitel (Tab-Freak: Leiste, Doomscroller: untereinander). Welche Kapitel es gibt und in welcher Reihenfolge, steht im Profil-Kartenlayout
   (cardLayout.js, "zahlen"-Deck); ausgeblendete Kapitel holt "Alle Karten einblenden" zurueck. */
export default function NumbersScreen({ nickname, matches, rangliste, players, challenges, catalog, earnedBadges, meRow, colorOf, badgeOf, photoOf,
  onOpenProfile, onSetCardLayout, toast }) {
  const cards = useCardLayout("profil", meRow?.card_layout, onSetCardLayout, toast);
  const playerObj = players.find((p) => p.nickname === nickname);
  const speedStats = useMemo(() => computeSpeedStats(matches, playerObj?.id), [matches, playerObj?.id]);
  const hasTempoData = speedStats.avgGameMs != null || speedStats.avgBallMs != null;
  // Ein Teil ohne Inhalt (Tempo ohne Protokolldaten) taucht gar nicht erst als Kapitel auf
  const ids = deckIds("profil", "zahlen").filter((id) => id !== "tempo" || hasTempoData);
  const { parts, anchor } = foldedDeck(cards.visibleOrder, ids);
  const mode = getListMode();
  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h2>{t("Meine Zahlen")}</h2>
          <span className="head-note">{t("Ratings, Rekorde und Tempo")}</span>
        </div>
      </header>
      <div className="screen-stack">
        {anchor && (
          <NumbersDeck stacked={mode === "stacked"} barMode={mode === "chapters"} nickname={nickname} isMe parts={parts} matches={matches}
            rangliste={rangliste} players={players} challenges={challenges} catalog={catalog} earnedBadges={earnedBadges}
            onOpenProfile={onOpenProfile} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
            onHidePart={onSetCardLayout ? (id) => cards.hideCard(id) : undefined} />
        )}
        {onSetCardLayout && <ShowAllCardsButton hiddenCount={cards.hiddenCount} onShowAll={cards.showAll} />}
      </div>
      <ImprintFooter />
    </div>
  );
}
