import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import Ball from "./Ball";
import Emoji from "./Emoji";
import AvatarPhotoField from "./AvatarPhotoField";
import { initials } from "../lib/format";
import { flyIn } from "../lib/flyBall";
import { t } from "../lib/i18n";

/* Fenster fuer das eigene Profilbild (oeffnet bei einem Tipp auf die eigene Kugel, egal wo - siehe App.jsx):
   oben gross das Bild, darunter Kamera/Galerie, darunter NUR die freigeschalteten Erfolge zur Auswahl.
   Ein Tipp auf einen Erfolg setzt ihn als Avatar - die Kugel fliegt wie bei der Gegnerwahl hinein; ein
   Tipp auf den aktiven Erfolg nimmt ihn wieder weg. Ersetzt die frueheren Einzelmenues fuer Foto und Avatar-Erfolg. */
export default function AvatarSheet({ player, colorOf, badgeOf, photoOf, catalog, earned, onSelectBadge, onReload, toast, onClose }) {
  const nick = player.nickname;
  const selected = player.selected_badge || null;
  const flyRef = useRef(null);
  const badge = badgeOf(nick);

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

  const unlocked = (catalog || []).filter((b) => earned.has(b.badge_key));
  const pick = (e, b) => {
    const isSel = selected === b.badge_key;
    if (!isSel) flyRef.current = { key: b.badge_key, rect: e.currentTarget.querySelector(".avatar-sheet-emoji")?.getBoundingClientRect() };
    onSelectBadge(isSel ? null : b.badge_key);
  };

  return (
    <div className="modal-overlay avatar-sheet-overlay" onClick={onClose}>
      <div className="avatar-sheet" role="dialog" aria-modal="true" aria-label={t("Dein Profilbild")} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="avatar-sheet-close icon-btn" onClick={onClose} aria-label={t("Schließen")}><X size={20} /></button>
        <div className="avatar-sheet-head">
          <div className="avatar-sheet-big">
            <Ball color={colorOf(nick)} label={initials(nick)} badge={badge} photo={photoOf(nick)} size={150} />
          </div>
          <AvatarPhotoField hasPhoto={!!photoOf(nick)} onReload={onReload} toast={toast} />
        </div>
        <div className="avatar-sheet-label">{t("Freigeschaltete Erfolge")} <span>{unlocked.length}</span></div>
        <div className="avatar-sheet-list">
          {unlocked.length === 0 && <p className="hint">{t("Noch keine Erfolge freigeschaltet.")}</p>}
          {unlocked.map((b) => (
            <button key={b.badge_key} type="button" className={"avatar-sheet-item" + (selected === b.badge_key ? " selected" : "")}
              onClick={(e) => pick(e, b)} title={t(b.description)}>
              <span className="avatar-sheet-emoji"><Emoji e={b.emoji} /></span>
              <span className="avatar-sheet-name">{t(b.name)}</span>
              {selected === b.badge_key && <span className="avatar-sheet-on">{t("Als Avatar aktiv")}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
