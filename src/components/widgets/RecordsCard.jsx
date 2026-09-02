import { Star } from "lucide-react";
import { t } from "../../lib/i18n";

/* Eigenstaendiges Modul: kompakte Rekorde-Uebersicht aus den bereits fuer
   die Erfolge berechneten Zusatzkennzahlen (computeAchievementExtras). */
export default function RecordsCard({ extras }) {
  if (!extras) return null;
  return (
    <section className="stat-block">
      <h3><Star size={17} /> {t("Rekorde")}</h3>
      <div className="records-grid">
        <div><b>{extras.highRun}</b><span>{t("Höchstserie 14/1")}</span></div>
        <div><b>{extras.longestStreak}</b><span>{t("Beste Serie")}</span></div>
        <div><b>{extras.shutoutWins}</b><span>{t("Zu-Null-Siege")}</span></div>
        <div><b>{extras.maxVsOpponent}</b><span>{t("Rekord geg. 1 Gegner")}</span></div>
        <div><b>{extras.maxPerDay}</b><span>{t("Meiste an 1 Tag")}</span></div>
        <div><b>{extras.recruitedCount}</b><span>{t("Geworben")}</span></div>
      </div>
    </section>
  );
}
