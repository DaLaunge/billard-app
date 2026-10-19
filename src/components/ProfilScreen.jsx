import { useState, useMemo } from "react";
import { Plus, ChevronLeft, Swords, Award } from "lucide-react";
import { t } from "../lib/i18n";
import { computeStats } from "../lib/stats";
import { computeSpeedStats } from "../lib/runLog";
import { bestDiscipline } from "../lib/bestDiscipline";
import { deckIds, foldedDeck } from "../lib/cardLayout";
import { useCardLayout } from "../lib/useCardLayout";
import { getListMode } from "../lib/uiPrefs";
import { useChapters, ChapterBar, Chap } from "../lib/useChapters";
import { useProfileExtras } from "../lib/useProfileExtras";
import IdentityCard from "./widgets/IdentityCard";
import ProfileHighlights from "./widgets/ProfileHighlights";
import AchievementsBrowser from "./widgets/AchievementsBrowser";
import NumbersDeck from "./widgets/NumbersDeck";
import CardDeck from "./widgets/CardDeck";
import ImprintFooter from "./widgets/ImprintFooter";
import { BarChart3 } from "lucide-react";

/* PROFIL EINES ANDEREN SPIELERS (Tab "fremdprofil") und "So sehen dich andere" (Tab "profilvorschau", asOthers): Kopfkarte, "Auf einen Blick",
   Erfolge und Zahlen als Kapitel (lib/useChapters.jsx). Die eigenen Bereiche - Identitaet, Erfolge, Zahlen, Einstellungen - sind eigene
   Bildschirme (IdentityScreen, AchievementsScreen, NumbersScreen, SettingsScreen); hier ist nichts davon mehr enthalten. */
export default function ProfilScreen({ nickname, matches, rangliste, onBack, asOthers = false, colorOf, badgeOf, photoOf, players, meRow, earnedBadges,
  catalog, challenges, achievementCounters, onChallenge, onStartMatch, onSetCardLayout, onOpenProfile, toast }) {
  const { liveExtras, extendedExtras, playerObj } = useProfileExtras(nickname, matches, players, challenges, achievementCounters);
  const stats = useMemo(() => computeStats(matches)[nickname], [matches, nickname]);
  const myRows = rangliste.filter((r) => r.nickname === nickname);
  const gesamt = myRows.find((r) => r.discipline === "Gesamt");
  const speedStats = useMemo(() => computeSpeedStats(matches, playerObj?.id), [matches, playerObj?.id]);
  const hasTempoData = speedStats.avgGameMs != null || speedStats.avgBallMs != null;
  // Reihenfolge der Zahlen-Kapitel = die Vorliebe dessen, der gerade schaut (sein Profil-Kartenlayout); ausgeblendet wird fremd nichts
  const cards = useCardLayout("profil", meRow?.card_layout, onSetCardLayout, toast);
  const numberIds = deckIds("profil", "zahlen").filter((id) => id !== "tempo" || hasTempoData);
  const { parts: numberParts } = foldedDeck(cards.order, numberIds);
  const [challengeForm, setChallengeForm] = useState(false);
  const [challengeMsg, setChallengeMsg] = useState("");
  const chap = useChapters("profile", [{ id: "erfolge", label: t("Erfolge") }, ...(numberParts.length ? [{ id: "zahlen", label: t("Zahlen") }] : [])]);
  const mode = getListMode();
  return (
    <div className="screen">
      <header className="screen-head with-back">
        {onBack && <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>}
        <div>
          <h2>{asOthers ? t("So sehen dich andere") : t("Spielerprofil")}</h2>
          <span className="head-note">{asOthers ? t("Vorschau deines Profils für andere Spieler") : t("Erfolge und Statistiken dieses Spielers")}</span>
        </div>
      </header>
      <div className="screen-stack">
        <IdentityCard nickname={nickname} playerId={playerObj?.id} ownProfile={false} best={bestDiscipline(myRows)} gesamt={gesamt}
          motto={playerObj?.motto} since={playerObj?.created_at} stats={stats} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
          sideActions={!asOthers && playerObj ? {
            left: (
              <button type="button" className="id-round-btn id-round-match" onClick={() => onStartMatch(playerObj)}
                aria-label={t("Match starten")} title={t("Match starten")}>
                <span className="fab-shine" /><Plus size={24} className="fab-plus" />
              </button>
            ),
            right: (
              <button type="button" className={"id-round-btn id-round-challenge" + (challengeForm ? " on" : "")}
                onClick={() => setChallengeForm((v) => !v)} aria-pressed={challengeForm}
                aria-label={t("Herausfordern")} title={t("Herausfordern")}>
                <Swords size={22} />
              </button>
            ),
          } : undefined}
          actions={!asOthers && playerObj && challengeForm ? (
            <div className="challenge-form">
              <div className="search-row" style={{ marginBottom: 8 }}>
                <input placeholder={t("z. B. 'Hast du heute Abend Zeit?'")} value={challengeMsg}
                  maxLength={200} onChange={(e) => setChallengeMsg(e.target.value)} />
              </div>
              <div className="sp-controls">
                <button className="btn ghost" onClick={() => { setChallengeForm(false); setChallengeMsg(""); }}>{t("Abbrechen")}</button>
                <button className="btn primary" onClick={() => { onChallenge(playerObj.id, challengeMsg); setChallengeForm(false); setChallengeMsg(""); }}>
                  <Swords size={15} /> {t("Herausfordern")}
                </button>
              </div>
            </div>
          ) : undefined} />
        <ProfileHighlights nickname={nickname} matches={matches} extras={liveExtras} catalog={catalog} earnedBadges={earnedBadges}
          onOpenProfile={onOpenProfile} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} />
        <ChapterBar c={chap} label={t("Bereich")} />
        <Chap id="erfolge" c={chap}>
          <CardDeck roomy icon={<Award size={17} />} soloTitle={false} title={`${t("Erfolge")} (${earnedBadges.size} / ${catalog.length})`}
            tabs={[{ id: "erfolge", tab: t("Alle"), title: t("Erfolge"), icon: <Award size={15} />,
              render: () => (
                <AchievementsBrowser isMe={false} nickname={nickname} catalog={catalog} earnedBadges={earnedBadges}
                  extendedExtras={extendedExtras} meRow={meRow} onSelectBadge={() => {}} badgeOf={badgeOf} />
              ) }]}
            activeId="erfolge" onActive={() => {}} />
        </Chap>
        {numberParts.length > 0 && (
          <Chap id="zahlen" c={chap}>
            <NumbersDeck stacked={mode === "stacked"} nickname={nickname} isMe={false} parts={numberParts} matches={matches} rangliste={rangliste}
              players={players} challenges={challenges} catalog={catalog} earnedBadges={earnedBadges}
              onOpenProfile={onOpenProfile} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} />
          </Chap>
        )}
      </div>
      <ImprintFooter />
    </div>
  );
}
