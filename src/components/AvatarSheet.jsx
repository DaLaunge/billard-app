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
  // Kinetisches Verhalten wie bei Telegram: ganz oben in der Liste steht die Kugel gross und mittig, sobald man runterscrollt wird sie
  // sofort klein (links), und beim Zurueckkommen an den oberen Rand springt sie sofort wieder auf. Beides laeuft als Feder (leichtes
  // Ueberschwingen), nicht als Funktion der Scrollposition. Zieht man oben weiter nach unten (Touch-Wischen oder Mausrad), dehnt sich die
  // Liste samt Kugel gummiartig mit ("over") und federt beim Loslassen zurueck. Gemoved wird die Liste selbst per transform (Kopfplatz =
  // HEAD), also ohne Layout; unten ragt sie dafuer um HEAD ueber das Fenster (Gegengewicht in CSS: negativer Rand + Innenabstand).
  const SMALL = 48;
  const HEAD = 84;        // Platz fuer die grosse Kugel ueber der Liste
  const MAX_OVER = 64;
  const stRef = useRef({ p: 0, v: 0, pt: 0, o: 0, ov: 0, ot: 0, raf: 0, t: 0, timer: 0, y0: null, last: 0, lastT: 0, vel: 0, wheelT: 0, wsp: 0, kp: 240, cp: 24, pull: 0 });
  const sheetRef = useRef(null);
  const listRef = useRef(null);
  const toolsRef = useRef(null);
  const titleRef = useRef(null);
  const paint = () => {
    const sheet = sheetRef.current; const list = listRef.current; const ball = bigRef.current;
    if (!sheet || !list || !ball) return;
    const st = stRef.current;
    const pc = Math.min(1, Math.max(0, st.p));
    const d = 128 - (128 - SMALL) * pc; // nie ueber 128 px: beim Ueberschwingen/Dehnen gibt nur die Liste nach
    const x = (sheet.clientWidth / 2 - d / 2) * (1 - pc) + 14 * pc;
    ball.style.transform = `translate3d(${x.toFixed(2)}px, 8px, 0) scale(${(d / 128).toFixed(4)})`;
    list.style.transform = `translate3d(0, ${(HEAD * (1 - Math.min(1, st.p)) + st.o).toFixed(2)}px, 0)`;
    if (titleRef.current) titleRef.current.style.opacity = String(Math.min(1, Math.max(0, (pc - 0.6) * 2.5)));
  };
  // Zwei Federn (Kugelstufe p, Dehnung o) im Bildtakt; laeuft nur, solange noch etwas in Bewegung ist.
  const tick = (now) => {
    const st = stRef.current;
    const dt = Math.min(0.032, (now - st.t) / 1000); st.t = now;
    // feste kleine Teilschritte: harte Federn sind mit einem grossen Bildschritt numerisch instabil
    const n = Math.max(1, Math.ceil(dt / 0.004)); const h = dt / n;
    for (let i = 0; i < n; i += 1) {
      st.v += ((st.pt - st.p) * st.kp - st.v * st.cp) * h; st.p += st.v * h;
      st.ov += ((st.ot - st.o) * 1500 - st.ov * 62) * h; st.o += st.ov * h;
    }
    const still = Math.abs(st.pt - st.p) < 0.001 && Math.abs(st.v) < 0.01 && Math.abs(st.ot - st.o) < 0.1 && Math.abs(st.ov) < 0.5;
    if (still) { st.p = st.pt; st.v = 0; st.o = st.ot; st.ov = 0; st.raf = 0; paint(); return; }
    paint();
    st.raf = requestAnimationFrame(tick);
  };
  const run = () => {
    const st = stRef.current;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { st.p = st.pt; st.o = st.ot; st.v = 0; st.ov = 0; paint(); return; }
    if (!st.raf) { st.t = performance.now(); st.raf = requestAnimationFrame(tick); }
  };
  const updateBall = () => {
    const list = listRef.current;
    if (!list) return;
    const st = stRef.current;
    const sc = list.scrollTop;
    // Scrollgeschwindigkeit (px/s, geglaettet): bestimmt, wie schnell und wie wuchtig die Feder anspringt, wenn der obere Rand erreicht
    // bzw. verlassen wird - ein schneller Wisch schnappt hart auf und laesst die Liste nachfedern, ein langsames Scrollen oeffnet sanft.
    const now = performance.now();
    const dtS = Math.max(0.004, (now - st.lastT) / 1000);
    st.lastT = now;
    st.vel = st.vel * 0.5 + Math.max(-6000, Math.min(6000, (sc - st.last) / dtS)) * 0.5;
    st.last = sc;
    const next = sc > 1 ? 1 : 0;
    if (next !== st.pt) {
      const sp = Math.abs(st.vel);
      st.kp = 240 + Math.min(sp / 6, 900);
      st.cp = 1.6 * Math.sqrt(st.kp);
      st.v = (next > st.p ? 1 : -1) * Math.min(sp / 500, 10);
      if (next === 0) st.ov += Math.min(sp * 0.5, 1400);
      st.pt = next;
    }
    if (sc > 1) { st.ot = 0; st.pull = 0; }
    run();
  };
  // Ziehen ueber den oberen Rand hinaus: Mausrad hoch (am Rand) bzw. Wischen nach unten (am Rand)
  // Gummiband-Kennlinie: anfangs fest, zum Ende hin immer haerter (nie ueber MAX_OVER). "pull" ist der rohe Zugweg in px.
  const rubber = (pull) => MAX_OVER * (1 - Math.exp(-Math.max(0, pull) / 120));
  const setPull = (pull) => { const st = stRef.current; st.pull = Math.max(0, pull); st.ot = rubber(st.pull); run(); };
  // Festgehalten wird die Dehnung, solange der Finger/die Maus sie haelt; erst beim Loslassen federt sie zurueck.
  // Mausrad/Trackpad dehnen die Liste bewusst NICHT: der Browser meldet dort weder "gehalten" noch "losgelassen" (und das Trackpad schickt nach
  // dem Abheben noch Traegheits-Impulse), jeder Erkennungsversuch fuehlte sich falsch an. Am PC bleiben das Oeffnen der Kugel am oberen Rand und
  // der Huepfer bei schnellem Anlauf (laufen ueber normale Scroll-Ereignisse); das Dehnen gibt es per Touch, wo es ein echtes Loslassen gibt.
  const onTouchStart = (e) => { stRef.current.y0 = listRef.current?.scrollTop <= 0 ? e.touches[0].clientY : null; };
  const onTouchMove = (e) => {
    const st = stRef.current;
    if (st.y0 == null) { if (listRef.current?.scrollTop <= 0) st.y0 = e.touches[0].clientY; return; }
    const dy = e.touches[0].clientY - st.y0;
    if (listRef.current.scrollTop <= 0) setPull(dy);
    else if (st.ot > 0) setPull(0);
  };
  const onTouchEnd = () => { stRef.current.y0 = null; setPull(0); };
  useLayoutEffect(() => {
    const st = stRef.current;
    paint();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
      // Die angepinnte Werkzeugzeile kann umbrechen: die Kategorie-Koepfe kleben direkt darunter
      if (toolsRef.current && listRef.current) listRef.current.style.setProperty("--tools-h", `${toolsRef.current.getBoundingClientRect().height}px`);
      paint();
    }) : null;
    if (ro) { ro.observe(sheetRef.current); if (toolsRef.current) ro.observe(toolsRef.current); }
    return () => { ro?.disconnect(); cancelAnimationFrame(st.raf); clearTimeout(st.timer); };
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
        <div className={"avatar-sheet-list " + view} ref={listRef} onScroll={updateBall}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
        {/* Die Werkzeugzeile klebt oben, sobald der Platz fuer die Kugel weggescrollt ist. Alles Feste ist bewusst klein (kleine Vorschau-Kugel, Foto-Knoepfe, Suche, Ansicht): die frueher 128 px grosse Kugel
            samt Kopfzone fraß am Handy - vor allem bei Schriftzoom - fast den ganzen Platz, die Erfolge waren kaum zu sehen (Nutzer-Feedback 412.28). */}
        <div className="avatar-sheet-tools" ref={toolsRef}>
          <AvatarPhotoField hasPhoto={!!photo} hasBadge={!!selected} onClearBadge={() => { setShown(null); requestAnimationFrame(popBall); return onSelectBadge(null); }} onReload={onReload} toast={toast} onView={() => setViewPhoto(true)} />
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
