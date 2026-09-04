import { useState, useMemo } from "react";
import { Swords } from "lucide-react";
import { t } from "../../lib/i18n";
import { initials } from "../../lib/format";
import Ball from "../Ball";

const COUNT_OPTIONS = [3, 10, 20, "all"];

/* Eigenstaendiges Modul: Head-to-Head-Bilanz eines Spielers gegen alle
   bisherigen Gegner, mit 3/10/20/Alle-Filter sowie einem Aktiv-Filter
   (per Default nur aktive Gegner, analog zur Rangliste). Ueberall gleich
   verwendbar (Profil, Uebersicht, ...) - braucht nur matches + den Namen;
   rangliste ist optional und liefert dafuer die "aktiv"-Flags. */
export default function HeadToHeadCard({ nickname, matches, rangliste, onOpenProfile, colorOf, badgeOf, photoOf, title }) {
  const h2h = useMemo(() => {
    const map = {};
    matches.forEach((m) => {
      if (m.player1b_id) return;
      let opp = null, w = 0, l = 0;
      if (m.p1.nickname === nickname) { opp = m.p2.nickname; w = m.score1 > m.score2 ? 1 : 0; l = 1 - w; }
      if (m.p2.nickname === nickname) { opp = m.p1.nickname; w = m.score2 > m.score1 ? 1 : 0; l = 1 - w; }
      if (!opp) return;
      map[opp] ||= { opp, w: 0, l: 0 };
      map[opp].w += w; map[opp].l += l;
    });
    return Object.values(map).sort((a, b) => (b.w / (b.w + b.l)) - (a.w / (a.w + a.l)));
  }, [matches, nickname]);

  // Gesamt-Zeile der Rangliste bestimmt "aktiv" (kein Match seit 180 Tagen).
  // Ohne rangliste-Prop (bzw. ohne passende Zeile, z.B. Spieler ganz ohne
  // Gesamt-Rating) gilt jemand als aktiv, damit nichts faelschlich verschwindet.
  const activeSet = useMemo(() => {
    const s = new Set();
    (rangliste || []).forEach((r) => { if (r.discipline === "Gesamt" && r.aktiv) s.add(r.nickname); });
    return s;
  }, [rangliste]);
  const isActive = (opp) => !rangliste || !rangliste.some((r) => r.discipline === "Gesamt" && r.nickname === opp) || activeSet.has(opp);

  const [count, setCount] = useState(3);
  const [showInactive, setShowInactive] = useState(false);
  const filtered = showInactive ? h2h : h2h.filter(({ opp }) => isActive(opp));
  const hiddenCount = h2h.length - filtered.length;
  const visible = count === "all" ? filtered : filtered.slice(0, count);

  return (
    <section className="stat-block">
      <div className="stat-block-head">
        <h3><Swords size={17} /> {title || t("Head-to-Head (Match-Siege)")}</h3>
        {h2h.length > 0 && (
          <div className="chips small">
            {COUNT_OPTIONS.map((c) => (
              <button key={c} className={"chip" + (count === c ? " active" : "")} onClick={() => setCount(c)}>
                {c === "all" ? t("Alle") : c}
              </button>
            ))}
          </div>
        )}
      </div>
      {visible.map(({ opp, w, l }) => (
        <button key={opp} className="h2h-row as-btn" onClick={() => onOpenProfile(opp)}>
          <Ball color={colorOf(opp)} label={initials(opp)} badge={badgeOf(opp)} photo={photoOf(opp)} size={34} />
          <span className="stat-name">{opp}</span>
          <div className="h2h-bar"><div className="h2h-w" style={{ width: `${(100 * w) / Math.max(1, w + l)}%` }} /></div>
          <span className="h2h-score">{w}:{l}</span>
        </button>
      ))}
      {h2h.length === 0 && <p className="hint">{t("Noch keine Matches.")}</p>}
      {hiddenCount > 0 && !showInactive && (
        <button className="btn ghost small" onClick={() => setShowInactive(true)}>
          {hiddenCount} {t("inaktive Gegner einblenden")}
        </button>
      )}
      {showInactive && h2h.some(({ opp }) => !isActive(opp)) && (
        <button className="btn ghost small" onClick={() => setShowInactive(false)}>{t("Nur aktive Gegner zeigen")}</button>
      )}
    </section>
  );
}
