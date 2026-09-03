import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { t } from "../../lib/i18n";
import { computeStats } from "../../lib/stats";
import { computeAchievementExtras } from "../../lib/achievements";
import MyStatusCard from "./MyStatusCard";
import RecordsCard from "./RecordsCard";
import HeadToHeadCard from "./HeadToHeadCard";

/* Die immer gleiche linke Spalte auf Uebersicht/Statistik/Profil: Foto +
   Kernzahlen, Ratings nach Disziplin, Rekorde, Head-to-Head - eine
   wiedererkennbare Konstante beim Wechsel zwischen den Tabs (bewusste
   Redundanz am PC fuer den Wiedererkennungswert; am Handy zeigt jede Seite
   weiterhin nur ihren eigenen Fokus, siehe die jeweiligen CSS-Regeln).
   nickname ist NICHT fix "der eingeloggte Spieler" - auf Uebersicht/
   Statistik ist das immer "me", auf einem fremden Profil aber die
   betrachtete Person, damit dort weiterhin deren eigene Werte stehen. */
export default function UserPanel({ nickname, matches, rangliste, players, challenges, catalog, earnedBadges,
  ratingOf, colorOf, badgeOf, photoOf, onOpenProfile }) {
  const stats = useMemo(() => computeStats(matches)[nickname], [matches, nickname]);
  const extras = useMemo(
    () => computeAchievementExtras(nickname, matches, players, challenges),
    [matches, players, challenges, nickname]
  );
  const myRows = rangliste.filter((r) => r.nickname === nickname);

  return (
    <>
      <MyStatusCard nickname={nickname} rating={ratingOf(nickname)} stats={stats}
        colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onOpenProfile={onOpenProfile} />

      <section className="stat-block">
        <h3><Trophy size={17} /> {t("Ratings nach Disziplin")}</h3>
        {myRows.map((r) => (
          <div key={r.discipline} className="stat-row">
            <span className="stat-name">{t(r.discipline)}</span>
            <span className="rank-meta" style={{ marginRight: 10 }}>{r.spiele} {t("Spiele")}</span>
            <span className="stat-val">{r.rating}</span>
          </div>
        ))}
        {myRows.length === 0 && <p className="hint">{t("Noch kein Rating - erst ein Match spielen!")}</p>}
      </section>

      <RecordsCard extras={extras} catalog={catalog} earnedBadges={earnedBadges} />

      <HeadToHeadCard nickname={nickname} matches={matches} onOpenProfile={onOpenProfile}
        colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} />
    </>
  );
}
