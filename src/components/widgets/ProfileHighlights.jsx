import { useMemo } from "react";
import { Trophy, Swords } from "lucide-react";
import { t } from "../../lib/i18n";
import { initials } from "../../lib/format";
import Ball from "../Ball";

/* "Auf einen Blick": oeffentliche Profil-Kennzahlen, die auch andere Spieler sehen - beste Disziplin (hoechstes
   Rating, ohne "Gesamt") und Angstgegner (der Gegner, gegen den man am oefter verloren hat, mindestens 2 Niederlagen).
   Gaeste und Doppel zaehlen nicht, wie beim Head-to-Head. Eine Club-/Clan-Zeile kommt mit dem Club-Feature. */
export default function ProfileHighlights({ nickname, matches, rows, onOpenProfile, colorOf, badgeOf, photoOf }) {
  const best = useMemo(() => {
    const list = (rows || []).filter((r) => r.discipline !== "Gesamt" && r.rating != null);
    return list.length ? list.reduce((a, b) => (b.rating > a.rating ? b : a)) : null;
  }, [rows]);
  const nemesis = useMemo(() => {
    const map = {};
    (matches || []).forEach((m) => {
      if (m.player1b_id || m.p1.is_guest || m.p2.is_guest) return;
      let opp = null, lost = false;
      if (m.p1.nickname === nickname) { opp = m.p2.nickname; lost = m.score1 < m.score2; }
      else if (m.p2.nickname === nickname) { opp = m.p1.nickname; lost = m.score2 < m.score1; }
      if (!opp || !lost) return;
      map[opp] = (map[opp] || 0) + 1;
    });
    const top = Object.entries(map).sort((a, b) => b[1] - a[1])[0];
    return top && top[1] >= 2 ? { opp: top[0], n: top[1] } : null;
  }, [matches, nickname]);
  if (!best && !nemesis) return null;
  return (
    <section className="stat-block pf-highlights">
      <div className="stat-block-head"><h3><Trophy size={17} /> {t("Auf einen Blick")}</h3></div>
      {best && (
        <div className="pf-hl-row">
          <span className="pf-hl-label">{t("Beste Disziplin")}</span>
          <span className="pf-hl-val"><strong>{t(best.discipline)}</strong> <small>{best.rating}</small></span>
        </div>
      )}
      {nemesis && (
        <button type="button" className="pf-hl-row pf-hl-btn" onClick={() => onOpenProfile?.(nemesis.opp)}>
          <span className="pf-hl-label"><Swords size={14} /> {t("Angstgegner")}</span>
          <span className="pf-hl-val">
            <Ball nick={nemesis.opp} color={colorOf(nemesis.opp)} label={initials(nemesis.opp)} badge={badgeOf(nemesis.opp)} photo={photoOf(nemesis.opp)} size={22} />
            <strong>{nemesis.opp}</strong> <small>{t("{n} Niederlagen", { n: nemesis.n })}</small>
          </span>
        </button>
      )}
    </section>
  );
}
