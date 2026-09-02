import { t } from "../../lib/i18n";
import { initials } from "../../lib/format";
import Ball from "../Ball";

/* Eigenstaendiges Modul: eigenes Foto/Kugel + Rating + Kernzahlen
   (Spiele/Siege/Quote). Klick fuehrt zum eigenen Profil. */
export default function MyStatusCard({ nickname, rating, stats, colorOf, badgeOf, photoOf, onOpenProfile, size = 64 }) {
  return (
    <section className="stat-block">
      <button className="dash-photo" onClick={() => onOpenProfile(nickname)}>
        <Ball color={colorOf(nickname)} label={initials(nickname)} badge={badgeOf(nickname)} photo={photoOf(nickname)} size={size} />
        <b>{nickname}</b>
        <span>{rating} · {t("Rating")}</span>
      </button>
      <div className="dash-stats">
        <div><b>{stats?.spiele ?? 0}</b><span>{t("Spiele")}</span></div>
        <div><b>{stats?.siege ?? 0}</b><span>{t("Siege")}</span></div>
        <div><b>{stats?.quote ?? 0} %</b><span>{t("Quote")}</span></div>
      </div>
    </section>
  );
}
