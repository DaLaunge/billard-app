import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, Trash2, Eye } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { compressImageFile } from "../lib/avatarPhoto";
import { appConfirm } from "../lib/confirmDialog";

export default function AvatarPhotoField({ hasPhoto, hasBadge, onClearBadge, onReload, toast, onView }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const myPath = async () => {
    const { data } = await supabase.auth.getUser();
    return `${data.user.id}/avatar.jpg`;
  };

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressImageFile(file);
      const path = await myPath();
      const { error } = await supabase.storage.from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
      if (error) throw error;
      const { error: rpcError } = await supabase.rpc("set_avatar_photo", { p_has_photo: true });
      if (rpcError) throw rpcError;
      toast(t("Foto gespeichert."));
      await onReload();
    } catch (e) {
      toast(t("Fehler: ") + e.message);
    }
    setBusy(false);
  };

  const removePhoto = async () => {
    // Der Muelleimer setzt das Profilbild zurueck: Foto UND als Avatar gewaehlter Erfolg. Ein Fehltipp kostet ein muehsam eingestelltes Foto,
    // deshalb erst nachfragen und genau sagen, was entfernt wird.
    const what = hasPhoto && hasBadge ? "Foto und Erfolg" : hasPhoto ? "Foto" : "Erfolg";
    const msg = {
      "Foto und Erfolg": t("Foto und Erfolg als Avatar entfernen? Dein Foto wird gelöscht und der gewählte Erfolg abgewählt. Deine Kugel zeigt danach wieder ihre normale Farbe."),
      "Foto": t("Foto wirklich entfernen? Dein Foto wird gelöscht und du musst es bei Bedarf neu hochladen."),
      "Erfolg": t("Erfolg als Avatar abwählen? Deine Kugel zeigt danach wieder ihre normale Farbe."),
    }[what];
    if (!(await appConfirm(msg))) return;
    setBusy(true);
    try {
      if (hasPhoto) {
        const path = await myPath();
        await supabase.storage.from("avatars").remove([path]);
        const { error } = await supabase.rpc("set_avatar_photo", { p_has_photo: false });
        if (error) throw error;
      }
      if (hasBadge) await onClearBadge?.();
      toast(t(what === "Foto" ? "Foto entfernt." : what === "Erfolg" ? "Erfolg abgewählt." : "Foto und Erfolg entfernt."));
      await onReload();
    } catch (e) {
      toast(t("Fehler: ") + e.message);
    }
    setBusy(false);
  };

  // Nur Symbole, keine Textknoepfe (Nutzer-Feedback 2026-09-30: "Foto
  // aufnehmen und Aus Galerie waehlen braucht keinen textuellen Button und
  // kann sich in die Ansicht besser integrieren"). Die Namen stecken in
  // title/aria-label; die Reihe sitzt zentriert direkt unter der Kugel.
  return (
    <div className="avatar-photo-actions">
      <input ref={cameraRef} type="file" accept="image/*" capture="user" style={{ display: "none" }}
        onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }} />
      <button type="button" className="icon-btn" disabled={busy} onClick={() => cameraRef.current.click()}
        aria-label={t("Foto aufnehmen")} title={t("Foto aufnehmen")}>
        <Camera size={18} />
      </button>
      <button type="button" className="icon-btn" disabled={busy} onClick={() => galleryRef.current.click()}
        aria-label={t("Aus Galerie wählen")} title={t("Aus Galerie wählen")}>
        <ImageIcon size={18} />
      </button>
      {hasPhoto && onView && (
        <button type="button" className="icon-btn" disabled={busy} onClick={onView}
          aria-label={t("Foto ansehen")} title={t("Foto ansehen")}>
          <Eye size={18} />
        </button>
      )}
      {(hasPhoto || hasBadge) && (
        <button type="button" className="icon-btn warn" disabled={busy} onClick={removePhoto}
          aria-label={t("Foto und Erfolg entfernen")} title={t("Foto und Erfolg entfernen")}>
          <Trash2 size={18} />
        </button>
      )}
      {busy && <span className="avatar-busy">{t("Verarbeite Foto ...")}</span>}
    </div>
  );
}
