import { Award } from "lucide-react";
import { t } from "../../lib/i18n";
import { upcomingAchievements } from "../../lib/achievements";

/* Eigenstaendiges Modul: die naechsten N noch nicht erreichten Erfolge
   eines Spielers (Rohdaten aus upcomingAchievements()), plus Link zur
   vollen Erfolgsliste im Profil. */
export default function AchievementsProgressCard({ catalog, extras, earnedBadges, onOpenProfile, nickname, count = 3 }) {
  const upcoming = extras ? upcomingAchievements(catalog, extras, earnedBadges, count) : [];
  return (
    <section className="stat-block">
      <h3><Award size={17} /> {t("Erfolge")} ({earnedBadges?.size ?? 0} / {catalog?.length ?? 0})</h3>
      {upcoming.length === 0 && <p className="hint" style={{ marginTop: 0 }}>{t("Alle erreichbaren Erfolge freigeschaltet!")}</p>}
      {upcoming.map((c) => (
        <div key={c.badgeKey} className="side-row">
          <span className="side-row-emoji">{c.emoji}</span>
          <span className="side-row-name">{c.name}</span>
          <span className="side-row-gap">{t("noch {n}", { n: c.gap })}</span>
        </div>
      ))}
      <button className="btn ghost small" onClick={() => onOpenProfile(nickname)}>{t("Alle Erfolge ansehen")}</button>
    </section>
  );
}
