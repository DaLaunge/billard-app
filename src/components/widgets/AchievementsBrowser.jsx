import { useState, useEffect, useMemo, useRef } from "react";
import { Search, X, Lock, LockOpen } from "lucide-react";
import { t } from "../../lib/i18n";
import { DISC_LABEL } from "../../lib/constants";
import { badgeProgress, stripScope } from "../../lib/achievements";
import { DISCIPLINES } from "../../lib/disciplineBadges";
import { getListMode } from "../../lib/uiPrefs";
import { flyIn } from "../../lib/flyBall";
import Emoji from "../Emoji";
import DiscBall from "./DiscBall";
import ProgressBar from "./ProgressBar";
import SegmentBar from "./SegmentBar";
import AchievementsProgressCard from "./AchievementsProgressCard";

/* Erfolge einer Kategorie nach Unterblock gruppieren (badge_catalog.subcategory, z. B. "8 Ball", "Alle Disziplinen",
   "Doppel"); Kategorien ohne Unterblock liefern genau eine Gruppe ohne Namen. Reihenfolge = Reihenfolge der Liste. */
const groupSubs = (list) => {
  const m = new Map();
  list.forEach((b) => { const k = b.subcategory || ""; if (!m.has(k)) m.set(k, []); m.get(k).push(b); });
  return [...m];
};

/* Die Erfolgsliste (Suche, Status-Filter, Kategorien als Leiste oder untereinander, Erfolg als Avatar waehlen) als eigenes Bauteil - benutzt von
   "Meine Erfolge" (AchievementsScreen) und von fremden Profilen (ProfilScreen). */
export default function AchievementsBrowser({ isMe, nickname, catalog, earnedBadges, extendedExtras, meRow, onSelectBadge, badgeOf }) {
  const catalogByCategory = useMemo(() => {
    const groups = {};
    [...catalog].sort((a, b) => a.sort - b.sort).forEach((b) => {
      (groups[b.category] ||= []).push(b);
    });
    return Object.entries(groups);
  }, [catalog]);
  const [catPick, setCatPick] = useState(() => { try { return localStorage.getItem("badgeCatPick") || ""; } catch { return ""; } });
  const pickCat = (c) => { setCatPick(c); try { localStorage.setItem("badgeCatPick", c); } catch { /* ignore */ } };
  // Suche/Status-Filter fuer die Erfolgsliste (144 Eintraege sind ohne
  // Suchmoeglichkeit schwer zu durchsuchen).
  const [badgeQuery, setBadgeQuery] = useState("");
  const [badgeStatus, setBadgeStatus] = useState("all"); // "all" | "earned" | "locked"
  const badgeFiltering = badgeQuery.trim() !== "" || badgeStatus !== "all";
  // Bis 2026-09-30 sprang "Alle Erfolge ansehen" von der Fortschritts-Karte
  // hierher (per .focus() auf diesen Chip statt scrollIntoView, weil das am
  // Handy zuverlaessiger ins Bild scrollt, ohne die Tastatur zu oeffnen).
  // Der Knopf ist weg, seit beide Teile EINE Karte mit Reitern sind - die
  // volle Liste ist jetzt der Nachbar-Reiter. Der Ref bleibt als Anker fuer
  // den "Alle"-Chip erhalten.
  const allFilterRef = useRef(null);
  // Welche Erfolge pro Kategorie beim aktuellen Filter sichtbar sind - fuer
  // die Liste unten UND fuers Auto-Aufklappen (siehe Effekt darunter).
  const visibleByCategory = useMemo(() => {
    const q = badgeQuery.trim().toLowerCase();
    return catalogByCategory.map(([cat, items]) => {
      // eigenes Profil: ALLE Erfolge zeigen (gesperrte gedimmt) -> Symbole + korrekte Gesamtzahl.
      // fremde Profile: nur erreichte zeigen. Suche/Status filtern zusaetzlich.
      const visible = items.filter((b) => {
        const earned = earnedBadges.has(b.badge_key);
        if (!isMe) { if (!earned) return false; }
        else if (badgeStatus === "earned" && !earned) return false;
        else if (badgeStatus === "locked" && earned) return false;
        if (q && !(t(b.name) + " " + t(b.description)).toLowerCase().includes(q)) return false;
        return true;
      });
      return [cat, items, visible];
    });
  }, [catalogByCategory, earnedBadges, isMe, badgeStatus, badgeQuery]);
  const avatarFlyRef = useRef(null);
  const avatarBadge = badgeOf(nickname);
  useEffect(() => {
    const f = avatarFlyRef.current;
    if (!f || avatarBadge !== f.key) return undefined;
    avatarFlyRef.current = null;
    // Erst fliegen, wenn der Avatar den Erfolg wirklich zeigt (die Spielerliste laedt nach dem Speichern kurz nach).
    const id = setTimeout(() => flyIn(document.querySelector(".pf-head-avatar .ball"), f.rect), 30);
    return () => clearTimeout(id);
  }, [avatarBadge]);
  const catLiveStat = (items, extras) => {
    // Disziplin-Erfolge (family) haben eigene Zaehler (siehe unten) und duerfen die Texterkennung der Gesamt-Familien nicht ausloesen
    const has = (re) => items.some((b) => !b.family && re.test(stripScope(b.description)));
    const parts = [];
    if (items.some((b) => b.family) && extras.dsc) {
      parts.push(DISCIPLINES.map((d) => `${t(DISC_LABEL[d] || d)} ${extras.dsc[d].w}`).join(" · ") + " " + t("Siege"));
    }
    if (has(/Siege in Folge$/)) {
      const curTxt = extras.streak > 0 ? `+${extras.streak}` : `${extras.streak}`;
      parts.push(`${t("Serie aktuell: {n}", { n: curTxt })} · ${t("Beste Serie: {n}", { n: extras.longestStreak })}`);
    }
    if (has(/^\d+ Siege insgesamt$/)) parts.push(t("{n} Siege insgesamt", { n: extras.siege }));
    if (has(/zu null gewonnen/)) parts.push(t("{n} Zu-Null-Siege", { n: extras.shutoutWins }));
    if (has(/Matches gegen denselben Gegner/)) parts.push(t("Rekord gegen 1 Gegner: {n} Matches", { n: extras.maxVsOpponent }));
    if (has(/Matches an einem Tag/)) parts.push(t("Rekord an 1 Tag: {n} Matches", { n: extras.maxPerDay }));
    if (has(/14\/1: Höchstserie/)) parts.push(t("Höchstserie: {n}", { n: extras.highRun }));
    if (has(/Spieler geworben/)) parts.push(t("{n} Spieler geworben", { n: extras.recruitedCount }));
    if (has(/Herausforderung(en)? angenommen/)) parts.push(t("{n} Herausforderungen angenommen", { n: extras.challengesAccepted }));
    if (has(/Siege in Folge gegen denselben Gegner$/)) parts.push(t("Laufende Serie gegen 1 Gegner: {n}", { n: extras.maxOpponentStreak }));
    // Ghost/Turniere/Mitgliedschaft: Rohdaten kommen aus my_achievement_counters()
    // bzw. players.created_at (extendedExtras, siehe oben), nicht aus
    // matches/players/challenges wie der Rest hier - deshalb eigene Zeilen statt
    // has()-Erkennung allein. Nur wenn die Zaehler auch tatsaechlich geladen sind
    // (RPC eingespielt) - sonst greift der Fallback weiter unten.
    if (extras.ghostGames != null && has(/Spiele? gegen den Ghost$/)) {
      parts.push(t("{n} Spiele gegen den Ghost", { n: extras.ghostGames }));
    }
    if (extras.rulesViewed != null && has(/Regeln? angesehen$/)) parts.push(t("{n} Regeln angesehen", { n: extras.rulesViewed }));
    if (extras.tournamentWins != null && (has(/Turniere? gewonnen$/) || has(/Turnier-Zweiter$/) || has(/Turnier-Dritter$/))) {
      const bits = [];
      if (has(/Turniere? gewonnen$/)) bits.push(t("{n}× Platz 1", { n: extras.tournamentWins }));
      if (has(/Turnier-Zweiter$/)) bits.push(t("{n}× Platz 2", { n: extras.tournament2nd }));
      if (has(/Turnier-Dritter$/)) bits.push(t("{n}× Platz 3", { n: extras.tournament3rd }));
      parts.push(bits.join(" · "));
    }
    if (extras.joinedAt && has(/dabei$/)) {
      const days = Math.floor((Date.now() - new Date(extras.joinedAt)) / 86400000);
      parts.push(t("Dabei seit {n} Tagen", { n: days }));
    }
    // Fallback fuer Kategorien ohne lokal berechenbare Live-Kennzahl UND ohne
    // geladene Zaehler oben (z.B. Migration noch nicht eingespielt): zeigt
    // zumindest, was in der Kategorie schon erreicht wurde, statt gar nichts -
    // sonst bleibt z.B. "1 Turnier gewonnen" fuer den Spieler unsichtbar,
    // obwohl das fuer die Motivation zum naechsten Erfolg wichtig ist.
    if (parts.length === 0) {
      if (has(/dabei$/)) {
        // Mitgliedschaft ist eine einzelne Leiter: jede erreichte Stufe
        // schliesst die vorherigen automatisch mit ein, nur die hoechste zeigen.
        const earned = items.filter((b) => earnedBadges.has(b.badge_key));
        if (earned.length) {
          const top = earned[earned.length - 1];
          parts.push(t("Aktuell: {name} ({desc})", { name: t(top.name), desc: t(top.description) }));
        }
      } else {
        // Sonst je Schwellenwert-Familie (Praefix vor der Endziffer, z.B.
        // "ghost10" -> "ghost", "tournament_win3" -> "tournament_win") nur die
        // jeweils hoechste erreichte Stufe zeigen - mehrere unabhaengige
        // Familien pro Kategorie moeglich (z.B. Turniersieg/2./3. Platz).
        const fams = {};
        items.forEach((b) => { (fams[b.badge_key.replace(/\d+$/, "")] ||= []).push(b); });
        Object.values(fams).forEach((fam) => {
          const earned = fam.filter((b) => earnedBadges.has(b.badge_key));
          if (earned.length) parts.push(t(earned[earned.length - 1].description));
        });
      }
    }
    return parts.length ? parts.join(" · ") : null;
  };

  const openBadge = (key) => {
    const b = catalog.find((x) => x.badge_key === key);
    if (!b) return;
    setBadgeQuery(""); setBadgeStatus("all");
    pickCat(b.category);
    let tries = 0;
    const go = () => {
      const el = document.querySelector(`[data-badge-key="${key}"]`);
      if (!el) { if (++tries < 20) setTimeout(go, 50); return; }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 2200);
    };
    setTimeout(go, 50);
  };
  return (
        <>
          {isMe && (
            <div className="ach-next">
              <AchievementsProgressCard embedded catalog={catalog} extras={extendedExtras}
                earnedBadges={earnedBadges} nickname={nickname} onOpenBadge={openBadge} />
            </div>
          )}
          <div className="search-row" style={{ marginBottom: 8 }}>
            <Search size={16} className="mail-ico" />
            <input placeholder={t("Erfolge durchsuchen …")} value={badgeQuery} onChange={(e) => setBadgeQuery(e.target.value)} />
            {badgeQuery && <button className="clear-btn" onClick={() => setBadgeQuery("")} aria-label={t("Suche loeschen")}><X size={15} /></button>}
          </div>
          {isMe && (
            // Alle 5 Werkzeuge (Status-Filter + Auf-/Zuklappen) auf einer
            // Ebene statt zweier getrennter Zeilen (Nutzer-Feedback) - eine
            // gemeinsame Flex-Zeile, die Auf-/Zuklappen-Buttons rechtsbuendig
            // per margin-left:auto auf dem ersten der beiden. Erreicht/Gesperrt
            // als Icon-Chips (Schloss offen/zu) statt Textlabels - kompakter
            // (behebt auch den Zeilenumbruch am Handy, Nutzer-Feedback) und
            // selbsterklaerend passend zum "Erfolge freischalten"-Thema.
            <div className="chips small" style={{ marginBottom: 8 }}>
              <button ref={allFilterRef} className={"chip" + (badgeStatus === "all" ? " active" : "")} onClick={() => setBadgeStatus("all")}>{t("Alle")}</button>
              <button className={"chip chip-icon" + (badgeStatus === "earned" ? " active" : "")} onClick={() => setBadgeStatus("earned")}
                aria-label={t("Erreicht")} title={t("Erreicht")}><LockOpen size={16} /></button>
              <button className={"chip chip-icon" + (badgeStatus === "locked" ? " active" : "")} onClick={() => setBadgeStatus("locked")}
                aria-label={t("Gesperrt")} title={t("Gesperrt")}><Lock size={16} /></button>
            </div>
          )}
          {(() => {
            let anyVisible = false;
            const catIds = visibleByCategory.filter(([, , v]) => v.length > 0).map(([c]) => c);
            const listMode = getListMode();
            const searching = !!badgeQuery.trim();
            const activeCat = catIds.includes(catPick) ? catPick : catIds[0];
            const catBar = listMode === "chapters" && !searching && catIds.length > 1;
            const rows = visibleByCategory.map(([cat, items, visible]) => {
              if (visible.length === 0) return null;
              if (catBar && cat !== activeCat) return null; // Tab-Freak: nur die gewaehlte Kategorie
              anyVisible = true;
              // Zähler immer gegen die ECHTE Gesamtzahl der Kategorie (items.length).
              const earnedCount = items.filter((b) => earnedBadges.has(b.badge_key)).length;
              const open = true; // Zu-/Aufklappen entfaellt: Tab-Freak zeigt eine Kategorie, Doomscroller alle
              const liveStat = isMe ? catLiveStat(items, extendedExtras) : null;
              return (
                <div key={cat} className="badge-cat">
                  <button className="badge-cat-head static" tabIndex={-1}>
                    <div className="badge-cat-head-row">
                      <span className="badge-cat-title">{t(cat)}</span>
                      <span className="badge-cat-count">{earnedCount} / {items.length}</span>
                    </div>
                    <ProgressBar current={earnedCount} target={items.length} />
                    {liveStat && <span className="badge-cat-live">{liveStat}</span>}
                  </button>
                  {open && (
                    <>
                    {groupSubs(visible).map(([sub, list]) => (
                    <div key={sub || "_"} className={sub ? "badge-sub" : undefined}>
                    {sub && (
                      <div className="badge-sub-head">
                        {DISCIPLINES.includes(sub) && <DiscBall disc={sub} size={18} />}
                        <span>{t(sub)}</span>
                        <span className="badge-sub-count">{items.filter((x) => x.subcategory === sub && earnedBadges.has(x.badge_key)).length} / {items.filter((x) => x.subcategory === sub).length}</span>
                      </div>
                    )}
                    <div className="badge-grid">
                      {list.map((b) => {
                        const key = b.badge_key;
                        const earned = earnedBadges.has(key);
                        const selected = meRow?.selected_badge === key && isMe;
                        const progress = isMe && !earned ? badgeProgress(b, extendedExtras) : null;
                        // "Derselbe Gegner": der Gegner, bei dem der Stand gerade am hoechsten ist.
                        const oppNick = progress
                          ? (b.family ? null : /Siege in Folge gegen denselben Gegner$/.test(b.description) ? extendedExtras.maxOpponentStreakNick
                            : /Matches gegen denselben Gegner/.test(b.description) ? extendedExtras.maxVsOpponentNick : null)
                          : null;
                        return (
                          <button key={key} data-badge-key={key}
                            className={"badge-chip" + (earned ? " earned" : " locked") + (selected ? " selected" : "")}
                            disabled={!isMe || !earned}
                            onClick={(e) => {
                              if (!isMe || !earned) return;
                              if (!selected) avatarFlyRef.current = { key, rect: e.currentTarget.querySelector(".badge-emoji")?.getBoundingClientRect() };
                              onSelectBadge(selected ? null : key);
                            }}
                            title={t(b.description)}>
                            <span className={"badge-emoji" + (earned ? "" : " locked-emoji")}><Emoji e={b.emoji} /></span>
                            <span className="badge-name">{t(b.name)}</span>
                            <span className="badge-desc">{t(b.description)}</span>
                            {progress && (
                              <>
                                <span className="badge-progress">
                                  {t("Fortschritt: {cur} / {target} {unit}", { cur: progress.current, target: progress.target, unit: progress.unit })}
                                </span>
                                <ProgressBar current={progress.current} target={progress.target} />
                                {oppNick && <span className="badge-progress">{t("Aktuell gegen: {name}", { name: oppNick })}</span>}
                              </>
                            )}
                            {selected && <span className="badge-active">{t("Als Avatar aktiv")}</span>}
                          </button>
                        );
                      })}
                    </div>
                    </div>
                    ))}
                    </>
                  )}
                </div>
              );
            });
            return (
              <>
                {catBar && <SegmentBar segments={catIds.map((c) => ({ id: c, label: t(c) }))} active={activeCat} onChange={pickCat} label={t("Kapitel")} storageKey="erfolgeCats" />}
                {rows}
                {!anyVisible && badgeFiltering && <p className="hint">{t("Keine passenden Erfolge gefunden.")}</p>}
              </>
            );
          })()}
          {!isMe && !badgeFiltering && earnedBadges.size === 0 && <p className="hint">{t("Noch keine Erfolge freigeschaltet.")}</p>}
        </>
  );
}
