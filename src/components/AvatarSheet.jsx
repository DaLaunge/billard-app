import { useEffect, useMemo, useRef, useState } from "react";
import { X, Search, LayoutGrid, List } from "lucide-react";
import Ball from "./Ball";
import Emoji from "./Emoji";
import AvatarPhotoField from "./AvatarPhotoField";
import { initials } from "../lib/format";
import { flyIn } from "../lib/flyBall";
import { t } from "../lib/i18n";

/* Fenster fuer das eigene Profilbild (oeffnet bei einem Tipp auf die eigene Kugel, egal wo - siehe App.jsx).
   Aufbau wie ein normales Menue: feste Kopfzeile mit X, darunter das Bild gross, Kamera/Galerie, Suche mit
   Normal/Detail-Umschaltung - nur die Liste der freigeschalteten Erfolge scrollt.
   Ein Tipp auf einen Erfolg setzt ihn als Avatar (die Kugel fliegt wie bei der Gegnerwahl hinein), ein Tipp auf
   den aktiven nimmt ihn wieder weg. Ersetzt die frueheren Einzelmenues fuer Foto und Avatar-Erfolg. */
export default function AvatarSheet({ player, colorOf, badgeOf, photoOf, catalog, earned, onSelectBadge, onReload, toast, onClose }) {
  const nick = player.nickname;
  const selected = player.selected_badge || null;
  const flyRef = useRef(null);
  const badge = badgeOf(nick);
  const [query, setQuery] = useState("");
  const [view, setView] = useState(() => {
    try { return localStorage.getItem("avatarSheetView") === "detail" ? "detail" : "normal"; } catch { return "normal"; }
  });
  const pickView = (v) => {
    setView(v);
    try { localStorage.setItem("avatarSheetView", v); } catch { /* ignore */ }
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Erst fliegen, wenn das grosse Bild den Erfolg wirklich zeigt (die Spielerliste laedt nach dem Speichern kurz nach).
  useEffect(() => {
    const f = flyRef.current;
    if (!f || badge !== f.key) return undefined;
    flyRef.current = null;
    const id = setTimeout(() => flyIn(document.querySelector(".avatar-sheet-big .ball"), f.rect), 30);
    return () => clearTimeout(id);
  }, [badge]);

  const unlocked = useMemo(() => (catalog || []).filter((b) => earned.has(b.badge_key)), [catalog, earned]);
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => (q ? unlocked.filter((b) => `${t(b.name)} ${t(b.description)}`.toLowerCase().includes(q)) : unlocked),
    [unlocked, q],
  );

  const pick = (e, b) => {
    const isSel = selected === b.badge_key;
    if (!isSel) flyRef.current = { key: b.badge_key, rect: e.currentTarget.querySelector(".avatar-sheet-emoji")?.getBoundingClientRect() };
    onSelectBadge(isSel ? null : b.badge_key);
  };

  return (
    <div className="modal-overlay avatar-sheet-overlay" onClick={onClose}>
      <div className="avatar-sheet" role="dialog" aria-modal="true" aria-label={t("Dein Profilbild")} onClick={(e) => e.stopPropagation()}>
        <div className="avatar-sheet-bar">
          <strong>{t("Dein Profilbild")}</strong>
          <button type="button" className="avatar-sheet-close icon-btn" onClick={onClose} aria-label={t("Schließen")}><X size={20} /></button>
        </div>
        <div className="avatar-sheet-head">
          <div className="avatar-sheet-big">
            <Ball color={colorOf(nick)} label={initials(nick)} badge={badge} photo={photoOf(nick)} size={128} />
          </div>
          <AvatarPhotoField hasPhoto={!!photoOf(nick)} onReload={onReload} toast={toast} />
        </div>
        <div className="avatar-sheet-tools">
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
          {t("Freigeschaltete Erfolge")} <span>{shown.length}{q ? ` / ${unlocked.length}` : ""}</span>
        </div>
        <div className={"avatar-sheet-list " + view}>
          {unlocked.length === 0 && <p className="hint">{t("Noch keine Erfolge freigeschaltet.")}</p>}
          {unlocked.length > 0 && shown.length === 0 && <p className="hint">{t("Kein Erfolg gefunden.")}</p>}
          {shown.map((b) => (
            <button key={b.badge_key} type="button" className={"avatar-sheet-item" + (selected === b.badge_key ? " selected" : "")}
              onClick={(e) => pick(e, b)} title={t(b.description)}>
              <span className="avatar-sheet-emoji"><Emoji e={b.emoji} /></span>
              <span className="avatar-sheet-name">{t(b.name)}</span>
              {view === "detail" && <span className="avatar-sheet-desc">{t(b.description)}</span>}
              {selected === b.badge_key && <span className="avatar-sheet-on">{view === "detail" ? t("Als Avatar aktiv") : "✓"}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
