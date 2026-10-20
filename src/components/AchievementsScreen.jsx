import { Award } from "lucide-react";
import { t } from "../lib/i18n";
import { initials } from "../lib/format";
import { useProfileExtras } from "../lib/useProfileExtras";
import Ball from "./Ball";
import CardDeck from "./widgets/CardDeck";
import AchievementsBrowser from "./widgets/AchievementsBrowser";
import ImprintFooter from "./widgets/ImprintFooter";

/* MEINE ERFOLGE als eigener Bildschirm (Tab "erfolge", 417.5; vorher ein Modus von ProfilScreen): die naechsten Erfolge, Suche/Filter und die
   Kategorien (lib/uiPrefs Tab-Freak/Doomscroller). Oben rechts haengt die Profilkugel - ein angetippter Erfolg fliegt dorthin (flyBall). */
export default function AchievementsScreen({ nickname, matches, players, challenges, achievementCounters, catalog, earnedBadges, meRow,
  onSelectBadge, colorOf, badgeOf, photoOf }) {
  const { extendedExtras } = useProfileExtras(nickname, matches, players, challenges, achievementCounters);
  return (
    <div className="screen">
      <div className="pf-head-avatar-sticky">
        <span className="pf-head-avatar">
          <Ball nick={nickname} color={colorOf(nickname)} label={initials(nickname)} badge={badgeOf(nickname)} photo={photoOf(nickname)} size={44} />
        </span>
      </div>
      <header className="screen-head">
        <div>
          <h2>{t("Meine Erfolge")}</h2>
          <span className="head-note">{t("Fortschritt und Sammlung")}</span>
        </div>
      </header>
      <div className="screen-stack">
        <CardDeck roomy id="pf-achievements-full" icon={<Award size={17} />} soloTitle={false}
          title={`${t("Erfolge")} (${earnedBadges.size} / ${catalog.length})`}
          tabs={[{ id: "erfolge", tab: t("Alle"), title: t("Erfolge"), icon: <Award size={15} />,
            info: t("Tippe einen freigeschalteten Erfolg an, um ihn als Avatar zu zeigen."),
            render: () => (
              <AchievementsBrowser isMe nickname={nickname} catalog={catalog} earnedBadges={earnedBadges}
                extendedExtras={extendedExtras} meRow={meRow} onSelectBadge={onSelectBadge} badgeOf={badgeOf} />
            ) }]}
          activeId="erfolge" onActive={() => {}} />
      </div>
      <ImprintFooter />
    </div>
  );
}
