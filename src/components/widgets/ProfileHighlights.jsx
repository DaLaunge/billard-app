import { useMemo } from "react";
import { Trophy, Swords, ChevronRight } from "lucide-react";
import { t } from "../../lib/i18n";
import { initials } from "../../lib/format";
import { recordBadgeEmoji } from "../../lib/achievements";
import Ball from "../Ball";
import Emoji from "../Emoji";

/* "Auf einen Blick": kleine, oeffentliche Uebersicht eines Profils - die persoenlichen Rekorde (bis zu vier, nur Werte > 0, in dieser
   Rangfolge) und der Angstgegner (der Gegner mit der schlechtesten Siegquote, siehe unten). Es ersetzt "Meine Zahlen"
   nicht, sondern ist deren Vorschau: ein Tipp auf Titel oder Rekorde oeffnet "Meine Zahlen" (onOpenNumbers, nur am eigenen Profil). Der
   Angstgegner bleibt ein eigener Knopf (oeffnet dessen Profil). Die staerkste Disziplin steht als Wert in der Zahlenreihe der Karte.
   Gaeste und Doppel zaehlen nicht, wie beim Head-to-Head. */
const NEMESIS_MIN_MATCHES = 5;
const RECORDS = [
  ["longestStreak", "Beste Serie"],
  ["shutoutWins", "Zu-Null-Siege"],
  ["highRun", "Höchstserie 14/1"],
  ["maxVsOpponent", "Rekord geg. 1 Gegner"],
  ["maxPerDay", "Meiste an 1 Tag"],
];

export default function ProfileHighlights({ nickname, matches, extras, catalog, earnedBadges, onOpenNumbers, onOpenProfile, colorOf, badgeOf, photoOf }) {
  const records = useMemo(() => (extras ? RECORDS.filter(([k]) => extras[k] > 0).slice(0, 4) : []), [extras]);
  // Angstgegner = der Gegner mit der schlechtesten SIEGQUOTE (relativ, nicht die meisten Niederlagen: wer oft gegeneinander spielt, hat
  // zwangslaeufig mehr verlorene Matches - Nutzer-Feedback 412.23). Damit die Quote etwas aussagt, zaehlen nur Gegner mit mindestens
  // NEMESIS_MIN_MATCHES gewerteten Einzelmatches, und die Quote muss unter 50 % liegen (sonst gibt es keinen Angstgegner). Gleichstand:
  // mehr Matches, dann Name. Unentschieden zaehlen nicht mit.
  const nemesis = useMemo(() => {
    const map = {};
    (matches || []).forEach((m) => {
      if (m.player1b_id || m.p1.is_guest || m.p2.is_guest) return;
      let opp = null, won = false, lost = false;
      if (m.p1.nickname === nickname) { opp = m.p2.nickname; won = m.score1 > m.score2; lost = m.score1 < m.score2; }
      else if (m.p2.nickname === nickname) { opp = m.p1.nickname; won = m.score2 > m.score1; lost = m.score2 < m.score1; }
      if (!opp || (!won && !lost)) return;
      const e = (map[opp] ||= { opp, w: 0, l: 0 });
      if (won) e.w++; else e.l++;
    });
    const list = Object.values(map)
      .map((e) => ({ ...e, n: e.w + e.l, rate: e.w / (e.w + e.l) }))
      .filter((e) => e.n >= NEMESIS_MIN_MATCHES && e.rate < 0.5)
      .sort((a, b) => a.rate - b.rate || b.n - a.n || a.opp.localeCompare(b.opp));
    return list[0] ? { ...list[0], pct: Math.round(list[0].rate * 100) } : null;
  }, [matches, nickname]);
  if (records.length === 0 && !nemesis) return null;
  const go = onOpenNumbers ? { role: "button", tabIndex: 0, onClick: onOpenNumbers,
    onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenNumbers(); } } } : {};
  return (
    <section className="stat-block pf-highlights">
      <div className={"stat-block-head" + (onOpenNumbers ? " pf-hl-go" : "")} {...go}>
        <h3><Trophy size={17} /> {t("Auf einen Blick")}</h3>
        {onOpenNumbers && <ChevronRight size={18} className="pf-hl-chev" aria-hidden="true" />}
      </div>
      {records.length > 0 && (
        <div className={"records-grid pf-hl-records" + (onOpenNumbers ? " pf-hl-go" : "")} {...go}>
          {records.map(([metric, label]) => {
            const emoji = recordBadgeEmoji(catalog, earnedBadges, metric);
            return (
              <div key={metric}>
                <b>{emoji && <span className="record-emoji"><Emoji e={emoji} /></span>}{extras[metric]}</b>
                <span>{t(label)}</span>
              </div>
            );
          })}
        </div>
      )}
      {nemesis && (
        <button type="button" className="pf-hl-row pf-hl-btn" onClick={() => onOpenProfile?.(nemesis.opp)}>
          <span className="pf-hl-label" title={t("Gegner, gegen den du die schlechteste Siegquote hast (mindestens 5 Matches)")}><Swords size={14} /> {t("Angstgegner")}</span>
          <span className="pf-hl-val">
            <Ball nick={nemesis.opp} color={colorOf(nemesis.opp)} label={initials(nemesis.opp)} badge={badgeOf(nemesis.opp)} photo={photoOf(nemesis.opp)} size={22} />
            <strong>{nemesis.opp}</strong> <small>{nemesis.w}:{nemesis.l} · {nemesis.pct} %</small>
          </span>
        </button>
      )}
    </section>
  );
}
