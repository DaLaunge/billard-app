import { useMemo } from "react";
import { User, Award, Eye, Users, UserPlus, Palette, ChevronRight, Share, Download } from "lucide-react";
import { t } from "../lib/i18n";
import Emoji from "./Emoji";
import { computeStats } from "../lib/stats";
import { bestDiscipline } from "../lib/bestDiscipline";
import { useClubData } from "../lib/clubStore";
import { useInstallPrompt } from "../lib/installPrompt";
import { useProfileExtras } from "../lib/useProfileExtras";
import IdentityCard from "./widgets/IdentityCard";
import ProfileHighlights from "./widgets/ProfileHighlights";
import ImprintFooter from "./widgets/ImprintFooter";

/* MEINE IDENTITAET als eigener Bildschirm (Tab "profil", 417.5; vorher ein Modus von ProfilScreen): Kopfkarte, "Auf einen Blick" und
   die Kacheln zu den uebrigen Bereichen (Erfolge, Vorschau, Clubs, Einladen, Einstellungen). Die Einstellungen sind ein eigener Bildschirm. */
export default function IdentityScreen({ nickname, matches, rangliste, players, challenges, achievementCounters, catalog, earnedBadges, meRow,
  colorOf, badgeOf, photoOf, onOpenSettings, onPreview, onOpenAchievements, onOpenNumbers, onOpenClubs, onInvite, onOpenProfile }) {
  const clubData = useClubData();
  const installPrompt = useInstallPrompt();
  const { liveExtras, playerObj } = useProfileExtras(nickname, matches, players, challenges, achievementCounters);
  const stats = useMemo(() => computeStats(matches)[nickname], [matches, nickname]);
  const myRows = rangliste.filter((r) => r.nickname === nickname);
  const gesamt = myRows.find((r) => r.discipline === "Gesamt");
  const myClubCount = clubData.members.filter((m) => m.player_id === meRow?.id).length;
  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h2>{t("Meine Identität")}</h2>
          <span className="head-note">{t("So kennen dich die anderen")}</span>
        </div>
      </header>
      <div className="screen-stack">
        <IdentityCard nickname={nickname} playerId={playerObj?.id} ownProfile best={bestDiscipline(myRows)} gesamt={gesamt}
          motto={playerObj?.motto} since={playerObj?.created_at} stats={stats} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
          onHeadClick={onOpenSettings} />
        <ProfileHighlights nickname={nickname} matches={matches} extras={liveExtras} catalog={catalog} earnedBadges={earnedBadges}
          onOpenNumbers={onOpenNumbers} onOpenProfile={onOpenProfile} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} />
        <section className="stat-block pf-more">
          <div className="stat-block-head"><h3><User size={17} /> {t("Bereiche")}</h3></div>
          <div className="pf-identity-extra">
            <button type="button" className="pf-id-card" onClick={onOpenAchievements}>
              <Award size={20} /><span className="pf-id-card-text"><strong>{t("Meine Erfolge")}</strong><small>{t("{n} von {m} freigeschaltet", { n: earnedBadges.size, m: catalog.length })}</small></span><ChevronRight size={18} />
            </button>
            <button type="button" className="pf-id-card" onClick={onPreview}>
              <Eye size={20} /><span className="pf-id-card-text"><strong>{t("So sehen dich andere")}</strong><small>{t("Kugel, Name, Motto, Rating und Erfolge")}</small></span><ChevronRight size={18} />
            </button>
            {clubData.loaded && (
              <button type="button" className="pf-id-card" data-tour="clubs-entry" onClick={onOpenClubs}>
                <Users size={20} /><span className="pf-id-card-text"><strong>{t("Clubs")}</strong><small>{myClubCount > 0 ? t("{n} Club(s) – verwalten, einladen, beitreten", { n: myClubCount }) : t("Gründen, beitreten oder anfragen")}</small></span><ChevronRight size={18} />
              </button>
            )}
            <button type="button" className="pf-id-card" onClick={onInvite}>
              <UserPlus size={20} /><span className="pf-id-card-text"><strong>{t("Einladen")}</strong><small>{t("Freunde per Code ins Spiel holen")}</small></span><ChevronRight size={18} />
            </button>
            <button type="button" className="pf-id-card" onClick={onOpenSettings}>
              <Palette size={20} /><span className="pf-id-card-text"><strong>{t("Aussehen")}</strong><small>{t("Kugelfarbe, Foto und Design")}</small></span><ChevronRight size={18} />
            </button>
          </div>
        </section>
      </div>
      <ImprintFooter />
      {installPrompt.canShow && (
        <section className="stat-block install-block">
          {installPrompt.isIos ? (
            <p className="hint center">
              <Emoji e="📲" /> {t("Installiere Break & Rank auf deinem Home-Bildschirm")} — <Share size={13} style={{ verticalAlign: "-2px" }} /> {t("Tippe unten auf Teilen, dann \"Zum Home-Bildschirm\"")}
            </p>
          ) : installPrompt.hasPrompt ? (
            <button className="btn ghost" onClick={installPrompt.install}>
              <Download size={16} /> {t("App installieren")}
            </button>
          ) : (
            <p className="hint center">
              <Emoji e="💻" /> {t("Kein Installations-Dialog verfuegbar. Schon installiert, aber kein Symbol mehr sichtbar? Oeffne chrome://apps oder suche im Startmenue nach \"Break & Rank\". Noch nicht installiert? Browser-Menue (⋮) -> \"App installieren\".")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
