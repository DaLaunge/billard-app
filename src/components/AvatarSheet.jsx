import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  // Die Kugel haengt am Scrollen der Liste: oben steht sie gross und mittig im freien Platz ueber der Liste (.avatar-sheet-hero) und
  // laeuft mit dem Inhalt nach oben, waehrend sie schrumpft und nach links in die Kopfzeile rutscht. Der Platz scrollt nativ weg, die Kugel
  // bekommt nur ein transform (translate + scale, kein Layout) aus scrollTop - dadurch ruckelt nichts mehr (frueher: Kopfhoehe/-breite pro
  // Bild veraendert -> Layout der ganzen Liste + doppelte Scrollgeschwindigkeit).
  const t0Ref = useRef(148); // Abstand der Werkzeugzeile vom Fensterrand bei scrollTop 0 (Kopfzeile 64 + .avatar-sheet-hero 78 + Zeilenabstand), beim Mounten gemessen
  const SMALL = 48;
  const sheetRef = useRef(null);
  const listRef = useRef(null);
  const toolsRef = useRef(null);
  const titleRef = useRef(null);
  const updateBall = () => {
    const sheet = sheetRef.current; const list = listRef.current; const ball = bigRef.current;
    if (!sheet || !list || !ball) return;
    // Die Kugel sitzt von Anfang an in Hoehe der Kopfzeile (y = 8, Platz oben bleibt nicht leer). Phase 1: ihr Durchmesser ist der freie Platz
    // bis zur Werkzeugzeile minus 20 (8 oben, 12 Luft unten), also schliesst sie unten immer mit gleichem Abstand ab - bis 48 px erreicht sind.
    // Dieselbe Strecke bewegt sie auch von der Mitte nach links (q = 0..1): gross+mittig -> klein+links ist EINE durchgehende Bewegung.
    const sc = Math.max(0, list.scrollTop);
    const t0 = t0Ref.current;
    const toolsTop = Math.max(64, t0 - sc);
    const d = Math.min(128, Math.max(SMALL, toolsTop - 20));
    const q = Math.min(1, Math.max(0, sc / (t0 - (SMALL + 20))));
    const x = (sheet.clientWidth / 2 - d / 2) * (1 - q) + 14 * q;
    ball.style.transform = `translate3d(${x.toFixed(2)}px, 8px, 0) scale(${(d / 128).toFixed(4)})`;
    if (titleRef.current) titleRef.current.style.opacity = String(Math.min(1, Math.max(0, (q - 0.6) * 2.5)));
  };
  useLayoutEffect(() => {
    if (toolsRef.current) t0Ref.current = toolsRef.current.offsetTop;
    updateBall();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
      updateBall();
      // Die angepinnte Werkzeugzeile kann umbrechen: die Kategorie-Koepfe kleben direkt darunter
      if (toolsRef.current && listRef.current) listRef.current.style.setProperty("--tools-h", `${toolsRef.current.offsetHeight}px`);
    }) : null;
    if (ro) { ro.observe(sheetRef.current); if (toolsRef.current) ro.observe(toolsRef.current); }
    return () => ro?.disconnect();
  }, []);
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
      <div className="avatar-sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label={t("Dein Profilbild")} onClick={(e) => e.stopPropagation()}>
        <div className="avatar-sheet-bar">
          <strong ref={titleRef}>{t("Dein Profilbild")}</strong>
          <button type="button" className="avatar-sheet-close icon-btn" onClick={onClose} aria-label={t("Schließen")}><X size={20} /></button>
        </div>
        <div className={"avatar-sheet-big" + (photo ? " clickable" : "")} ref={bigRef}
          onClick={photo ? () => setViewPhoto(true) : undefined} title={photo ? t("Foto ansehen") : undefined}>
          <Ball color={colorOf(nick)} label={initials(nick)} badge={ballBadge} photo={photo} size={128} />
        </div>
        <div className={"avatar-sheet-list " + view} ref={listRef} onScroll={updateBall}>
          <div className="avatar-sheet-hero" aria-hidden="true" />
        {/* Die Werkzeugzeile klebt oben, sobald der Platz fuer die Kugel weggescrollt ist. Alles Feste ist bewusst klein (kleine Vorschau-Kugel, Foto-Knoepfe, Suche, Ansicht): die frueher 128 px grosse Kugel
            samt Kopfzone fraß am Handy - vor allem bei Schriftzoom - fast den ganzen Platz, die Erfolge waren kaum zu sehen (Nutzer-Feedback 412.28). */}
        <div className="avatar-sheet-tools" ref={toolsRef}>
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
