import { Star } from "lucide-react";
import { t } from "../../lib/i18n";
import { recordBadgeEmoji } from "../../lib/achievements";

const METRICS = [
  ["highRun", "Höchstserie 14/1"],
  ["longestStreak", "Beste Serie"],
  ["shutoutWins", "Zu-Null-Siege"],
  ["maxVsOpponent", "Rekord geg. 1 Gegner"],
  ["maxPerDay", "Meiste an 1 Tag"],
  ["recruitedCount", "Geworben"],
];

/* Eigenstaendiges Modul: kompakte Rekorde-Uebersicht aus den bereits fuer
   die Erfolge berechneten Zusatzkennzahlen (computeAchievementExtras).
   Zeigt vor der Zahl das Emoji des dazu bereits erreichten Erfolgs, falls
   vorhanden (catalog/earnedBadges optional - ohne die zwei einfach ohne
   Emoji, z.B. bei fremden Profilen ohne geladenen Erfolgs-Kontext). */
export default function RecordsCard({ extras, catalog, earnedBadges }) {
  if (!extras) return null;
  return (
    <section className="stat-block">
      <h3><Star size={17} /> {t("Rekorde")}</h3>
      <div className="records-grid">
        {METRICS.map(([metric, label]) => {
          const emoji = recordBadgeEmoji(catalog, earnedBadges, metric);
          return (
            <div key={metric}>
              <b>{emoji && <span className="record-emoji">{emoji}</span>}{extras[metric]}</b>
              <span>{t(label)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
