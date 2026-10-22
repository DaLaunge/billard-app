import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { X, Search, LayoutGrid, List, ChevronRight } from "lucide-react";
import Ball from "./Ball";
import Emoji from "./Emoji";
import AvatarPhotoField from "./AvatarPhotoField";
import ProgressBar from "./widgets/ProgressBar";
import { initials } from "../lib/format";
import { flyGlyph } from "../lib/flyBall";
import { t } from "../lib/i18n";

/* Fenster fuer das eigene Profilbild (oeffnet bei einem Tipp auf die eigene Kugel, egal wo - siehe App.jsx).
   Aufbau wie ein normales Menue: feste Kopfzeile mit X, darunter das Bild gross, Kamera/Galerie, Suche mit
   Normal/Detail-Umschaltung - nur die Liste der freigeschalteten Erfolge scrollt.
   Ein Tipp auf einen Erfolg setzt ihn als Avatar (die Kugel fliegt wie bei der Gegnerwahl hinein), ein Tipp auf
   den aktiven nimmt ihn wieder weg. Ersetzt die frueheren Einzelmenues fuer Foto und Avatar-Erfolg. */
export default function AvatarSheet({ player, colorOf, badgeOf, photoOf, catalog, earned, onSelectBadge, onReload, toast, onClose, onOpenAchievements }) {
  const nick = player.nickname;
  const selected = player.selected_badge || null;
  const badge = badgeOf(nick);
  const photo = photoOf(nick);
  // Die Kugel zeigt "ballBadge": bei der Auswahl bleibt der alte Stand bis das Symbol gelandet ist (flyGlyph), erst dann wechselt sie.
  const [ballBadge, setShown] = useState(badge);
  const flying = useRef(0);
  const badgeRef = useRef(badge);
  badgeRef.current = badge;
  useEffect(() => { if (!flying.current) setShown(badge); }, [badge]);
  const bigRef = useRef(null);
  // Das Scrollen der Liste zieht die Kugel gross (oben, mittig) oder staucht sie zusammen (unten, links): --p direkt am Kopf, ohne React-Render.
  const barRef = useRef(null);
  // Das Mausrad scrollt in Stufen: wuerde --p direkt folgen, ruckelt die Kugel. Deshalb laeuft der gezeigte Wert dem Ziel
  // per rAF weich hinterher (zeitunabhaengig geglaettet) und geht zusaetzlich durch eine S-Kurve.
  const pRef = useRef({ target: 0, cur: 0, raf: 0, last: 0 });
  const setP = (target) => {
    const st = pRef.current;
    st.target = target;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const apply = () => { const x = st.cur; barRef.current?.style.setProperty("--p", String(x * x * (3 - 2 * x))); };
    if (reduce) { st.cur = target; apply(); return; }
    if (st.raf) return;
    st.last = performance.now();
    const step = (now) => {
      const dt = Math.min(64, now - st.last); st.last = now;
      st.cur += (st.target - st.cur) * (1 - Math.exp(-dt / 90));
      if (Math.abs(st.target - st.cur) < 0.001) { st.cur = st.target; st.raf = 0; apply(); return; }
      apply();
      st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(pRef.current.raf), []);
  const [viewPhoto, setViewPhoto] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState(() => {
    try { return localStorage.getItem("avatarSheetView") === "detail" ? "detail" : "normal"; } catch { return "normal"; }
  });
  const pickView = (v) => {
    setView(v);
    try { localStorage.setItem("avatarSheetView", v); } catch { /* ignore */ }
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { if (viewPhoto) setViewPhoto(false); else onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, viewPhoto]);

  const unlocked = useMemo(() => (catalog || []).filter((b) => earned.has(b.badge_key)), [catalog, earned]);
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => (q ? unlocked.filter((b) => `${t(b.name)} ${t(b.description)}`.toLowerCase().includes(q)) : unlocked),
    [unlocked, q],
  );

  // Gruppen je Kategorie in Katalog-Reihenfolge; die Kopfzeile (Name, x / y, Balken) bleibt beim Scrollen oben, bis die naechste Kategorie kommt.
  const groups = useMemo(() => {
    const total = {};
    (catalog || []).forEach((b) => { total[b.category] = (total[b.category] || 0) + 1; });
    const earnedIn = {};
    unlocked.forEach((b) => { earnedIn[b.category] = (earnedIn[b.category] || 0) + 1; });
    const m = new Map();
    shown.forEach((b) => { if (!m.has(b.category)) m.set(b.category, []); m.get(b.category).push(b); });
    return [...m].map(([cat, items]) => ({ cat, items, earned: earnedIn[cat] || 0, total: total[cat] || items.length }));
  }, [catalog, unlocked, shown]);

  const popBall = () => {
    const el = bigRef.current?.querySelector(".ball");
    if (el?.animate) el.animate([{ transform: "scale(1)" }, { transform: "scale(1.14)", offset: 0.4 }, { transform: "scale(1)" }], { duration: 380, easing: "ease-out" });
  };
  const pick = async (e, b) => {
    const next = selected === b.badge_key ? null : b.badge_key;
    const src = e.currentTarget.querySelector(".avatar-sheet-emoji");
    const land = () => { setShown(next); requestAnimationFrame(popBall); };
    if (next) {
      flying.current += 1;
      const landed = () => { flying.current = Math.max(0, flying.current - 1); land(); };
      if (!flyGlyph(src, bigRef.current?.querySelector(".ball"), !!photo, landed)) landed();
    } else land();
    const ok = await onSelectBadge(next);
    // Speichern fehlgeschlagen: die Kugel zeigt wieder den echten Stand
    if (ok === false) setTimeout(() => setShown(badgeRef.current), 700);
  };

  return (
    <>
    <div className="modal-overlay avatar-sheet-overlay" onClick={onClose}>
      <div className="avatar-sheet" role="dialog" aria-modal="true" aria-label={t("Dein Profilbild")} onClick={(e) => e.stopPropagation()}>
        <div className="avatar-sheet-bar" ref={barRef}>
          <div className={"avatar-sheet-big" + (photo ? " clickable" : "")} ref={bigRef}
            onClick={photo ? () => setViewPhoto(true) : undefined} title={photo ? t("Foto ansehen") : undefined}>
            <div className="avatar-sheet-big-in">
              <Ball color={colorOf(nick)} label={initials(nick)} badge={ballBadge} photo={photo} size={128} />
            </div>
          </div>
          <strong>{t("Dein Profilbild")}</strong>
          <button type="button" className="avatar-sheet-close icon-btn" onClick={onClose} aria-label={t("Schließen")}><X size={20} /></button>
        </div>
        {/* Alles Feste ist bewusst NUR diese beiden Zeilen (kleine Vorschau-Kugel, Foto-Knoepfe, Suche, Ansicht): die frueher 128 px grosse Kugel
            samt Kopfzone fraß am Handy - vor allem bei Schriftzoom - fast den ganzen Platz, die Erfolge waren kaum zu sehen (Nutzer-Feedback 412.28). */}
        <div className="avatar-sheet-tools">
          <AvatarPhotoField hasPhoto={!!photo} onReload={onReload} toast={toast} onView={() => setViewPhoto(true)} />
          <label className="avatar-sheet-search">
            <Search size={16} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Erfolg suchen …")} aria-label={t("Erfolg suchen")} />
          </label>
          <div className="avatar-sheet-views" role="group" aria-label={t("Ansicht")}>
            <button type="button" className={view === "normal" ? "on" : ""} onClick={() => pickView("normal")}
              aria-pressed={view === "normal"} title={t("Normal")}><LayoutGrid size={16} /></button>
            <button type="button" className={view === "detail" ? "on" : ""} onClick={() => pickView("detail")}
              aria-pressed={view === "detail"} title={t("Detail")}><List size={16} /></button>
          </div>
        </div>
        <div className={"avatar-sheet-list " + view} onScroll={(e) => setP(Math.min(1, e.currentTarget.scrollTop / 90))}>
          <div className="avatar-sheet-label">
            <span className="avatar-sheet-label-text">{t("Freigeschaltete Erfolge")} <span>{shown.length}{q ? ` / ${unlocked.length}` : ""}</span></span>
            {onOpenAchievements && (
              <button type="button" className="avatar-sheet-all" onClick={onOpenAchievements}>
                {t("Alle Erfolge")} <ChevronRight size={14} />
              </button>
            )}
          </div>
          {unlocked.length === 0 && <p className="hint">{t("Noch keine Erfolge freigeschaltet.")}</p>}
          {unlocked.length > 0 && shown.length === 0 && <p className="hint">{t("Kein Erfolg gefunden.")}</p>}
          {groups.map((g) => (
            <Fragment key={g.cat}>
              <div className="avatar-sheet-cat-head">
                <div className="avatar-sheet-cat-row"><span className="avatar-sheet-cat-title">{t(g.cat)}</span><span className="avatar-sheet-cat-count">{g.earned} / {g.total}</span></div>
                <ProgressBar current={g.earned} target={g.total} />
              </div>
              {g.items.map((b) => (
                <button key={b.badge_key} type="button" className={"avatar-sheet-item" + (selected === b.badge_key ? " selected" : "")}
                  onClick={(e) => pick(e, b)} title={t(b.description)}>
                  <span className="avatar-sheet-emoji"><Emoji e={b.emoji} /></span>
                  <span className="avatar-sheet-name">{t(b.name)}</span>
                  {view === "detail" && <span className="avatar-sheet-desc">{t(b.description)}</span>}
                  {selected === b.badge_key && <span className="avatar-sheet-on">{view === "detail" ? t("Als Avatar aktiv") : "✓"}</span>}
                </button>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
    {viewPhoto && photo && (
      <div className="modal-overlay photo-lightbox" onClick={() => setViewPhoto(false)}>
        <img src={photo} alt={nick} onClick={(e) => e.stopPropagation()} />
        <button type="button" className="avatar-sheet-close icon-btn photo-lightbox-close" onClick={() => setViewPhoto(false)} aria-label={t("Schließen")}><X size={20} /></button>
      </div>
    )}
    </>
  );
}
