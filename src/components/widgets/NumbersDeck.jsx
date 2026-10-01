import { useMemo, useState } from "react";
import { BarChart3, Trophy, Star, Swords, Clock, PartyPopper } from "lucide-react";
import { t } from "../../lib/i18n";
import { fmtDuration } from "../../lib/format";
import { computeAchievementExtras } from "../../lib/achievements";
import { computeSpeedStats } from "../../lib/runLog";
import { computeFunForPlayer } from "../../lib/funStats";
import { useMatchCounters } from "../../lib/useMatchCounters";
import { COUNTER_KEYS } from "../../lib/matchCounters";
import { META as COUNTER_META } from "./ExtraCounters";
import CardDeck from "./CardDeck";
import RecordsCard from "./RecordsCard";
import HeadToHeadCard from "./HeadToHeadCard";

/* "Meine Zahlen": Ratings, Rekorde, Head-to-Head und Spielgeschwindigkeit als
   EINE Karte mit Reitern - die linke Spalte am PC, auf jedem Bildschirm
   dieselbe (Nutzer-Feedback 2026-09-30: "In der PC-Version ist auf der
   linken Spalte immer dieselbe Ansicht. Diese variiert nun.").

   Warum es diese Komponente gibt: Statistik und Live zeigten links ihre
   eigene Zusammenstellung (Statistik ohne Ratings, Live mit vier gestapelten
   Karten), das Profil dagegen die Reiter-Karte - dieselbe Spalte in drei
   Varianten. Jetzt bauen alle drei sie aus genau diesem Baustein.

   Was hier bewusst NICHT liegt: welche Reiter es gibt und in welcher
   Reihenfolge. Das entscheidet das Profil (Profil bearbeiten -> Karten),
   deshalb kommt "parts" von aussen (siehe numbersParts() in cardLayout.js).
   So sieht man am PC ueberall dasselbe, auch wenn man dort einen Reiter
   ausgeblendet hat.

   Der offene Reiter gilt ebenfalls fuer alle Bildschirme (ein gemeinsamer
   localStorage-Schluessel): wer auf Statistik "Rekorde" aufgeschlagen hat,
   findet auf Live und im Profil dieselbe Ansicht wieder.

   onHidePart nur dort setzen, wo das Ausblenden hingehoert (Profil) - auf den
   anderen Bildschirmen bleibt das Kartenmenue weg, statt dort still das
   Profil-Layout zu veraendern. */
const TAB_KEY = "numbersDeckTab";
const readTab = () => { try { return localStorage.getItem(TAB_KEY); } catch { return null; } };
const writeTab = (v) => { try { localStorage.setItem(TAB_KEY, v); } catch { /* Privatmodus */ } };

export default function NumbersDeck({ nickname, isMe = true, parts, matches, rangliste, players, challenges,
  catalog, earnedBadges, onOpenProfile, colorOf, badgeOf, photoOf, onHidePart, roomy, column, onToggleColumn }) {
  const playerObj = players.find((p) => p.nickname === nickname);
  const myRows = rangliste.filter((r) => r.nickname === nickname);
  const extras = useMemo(
    () => computeAchievementExtras(nickname, matches, players, challenges),
    [matches, players, challenges, nickname]
  );
  const speed = useMemo(() => computeSpeedStats(matches, playerObj?.id), [matches, playerObj?.id]);
  const hasTempo = speed.avgGameMs != null || speed.avgBallMs != null;
  // Fun-Zahlen aus den optionalen Zusatzzaehlern (siehe lib/funStats.js). Wie
  // Tempo erscheint der Reiter erst, wenn es etwas zu zeigen gibt.
  const counterRows = useMatchCounters(matches.length);
  const fun = useMemo(() => computeFunForPlayer(matches, counterRows, nickname), [matches, counterRows, nickname]);
  const [tab, setTab] = useState(readTab);

  // Ein Reiter ohne Inhalt (Tempo ohne Protokolldaten) taucht gar nicht erst
  // auf - sonst fuehrte er ins Leere.
  const shown = parts.filter((id) => (id !== "tempo" || hasTempo) && (id !== "fun" || fun));
  if (shown.length === 0) return null;
  const activeId = shown.includes(tab) ? tab : shown[0];

  const bodies = {
    ratings: (
      <>
        {myRows.map((r) => (
          <div key={r.discipline} className="stat-row">
            <span className="stat-name">{t(r.discipline)}</span>
            <span className="rank-meta" style={{ marginRight: 10 }}>{r.spiele} {t("Spiele")}</span>
            <span className="stat-val">{r.rating}</span>
          </div>
        ))}
        {myRows.length === 0 && <p className="hint">{t("Noch kein Rating - erst ein Match spielen!")}</p>}
      </>
    ),
    rekorde: <RecordsCard embedded extras={extras} catalog={catalog} earnedBadges={earnedBadges} />,
    headToHead: (
      <HeadToHeadCard embedded nickname={nickname} matches={matches} rangliste={rangliste} onOpenProfile={onOpenProfile}
        colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} />
    ),
    tempo: (
      <>
        {speed.avgGameMs != null && (
          <div className="stat-row"><span className="stat-name">{t("Ø Zeit pro Spiel")}</span>
            <span className="stat-val">{fmtDuration(speed.avgGameMs)}</span></div>
        )}
        {speed.avgBallMs != null && (
          <>
            <div className="stat-row"><span className="stat-name">{t("Ø Zeit pro Kugel (14/1)")}</span>
              <span className="stat-val">{fmtDuration(speed.avgBallMs)}</span></div>
            <div className="stat-row"><span className="stat-name">{t("Hochgerechnet pro Rack")}</span>
              <span className="stat-val">{fmtDuration(speed.avgRackMs)}</span></div>
          </>
        )}
      </>
    ),
    fun: fun && (
      <>
        <p className="hint fun-note"><span className="fun-tag" style={{ marginLeft: 0 }}>FUN</span> {t("{n} Matches mit Zusatzzählern", { n: fun.n })}</p>
        {COUNTER_KEYS.map((k) => {
          const Icon = COUNTER_META[k].icon;
          const st = fun.stats[k];
          const avg = (Math.round(st.avg * 10) / 10).toString().replace(".", ",");
          return (
            <div key={k} className="stat-row">
              <span className="stat-name"><Icon size={14} style={{ marginRight: 6, verticalAlign: -2, color: "var(--accent)" }} />{t(COUNTER_META[k].label)}</span>
              <span className="rank-meta" style={{ marginRight: 10 }}>
                Ø {avg} · max {st.best}{st.rank != null && st.of > 1 ? ` · ${t("Platz")} ${st.rank}` : ""}
              </span>
              <span className="stat-val">{st.total}</span>
            </div>
          );
        })}
      </>
    ),
  };
  const meta = {
    ratings: { tab: t("Ratings"), title: t("Ratings nach Disziplin"), icon: <Trophy size={15} /> },
    rekorde: { tab: t("Rekorde"), title: t("Rekorde"), icon: <Star size={15} /> },
    headToHead: { tab: t("Gegner"), title: t("Head-to-Head (Match-Siege)"), icon: <Swords size={15} /> },
    tempo: { tab: t("Tempo"), title: t("Spielgeschwindigkeit"), icon: <Clock size={15} /> },
    fun: { tab: t("Fun"), title: t("Fun-Zahlen"), icon: <PartyPopper size={15} />,
      info: t("Aus den optionalen Zusatzzählern (Fluke, Runout, Scratch, Foul): Summe, Schnitt pro Match, Bestwert in einem Match und dein Platz unter allen, die den Zähler benutzt haben. Zählt nur Einzel-Matches, in denen die Zähler benutzt wurden – reiner Spaß, ohne Einfluss auf Rating und Erfolge.") },
  };

  return (
    <CardDeck roomy={roomy} icon={<BarChart3 size={17} />} title={isMe ? t("Meine Zahlen") : t("Zahlen")}
      tabs={shown.map((id) => ({ id, ...meta[id], render: () => bodies[id] }))}
      activeId={activeId} onActive={(id) => { setTab(id); writeTab(id); }}
      column={column} onToggleColumn={onToggleColumn}
      onHide={onHidePart ? () => onHidePart(activeId) : undefined} />
  );
}
