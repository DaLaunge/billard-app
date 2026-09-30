import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, Trash2 } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { compressImageFile } from "../lib/avatarPhoto";

export default function AvatarPhotoField({ hasPhoto, onReload, toast }) {
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
    setBusy(true);
    try {
      const path = await myPath();
      await supabase.storage.from("avatars").remove([path]);
      const { error } = await supabase.rpc("set_avatar_photo", { p_has_photo: false });
      if (error) throw error;
      toast(t("Foto entfernt."));
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
      <button type="button" className="round-btn" disabled={busy} onClick={() => cameraRef.current.click()}
        aria-label={t("Foto aufnehmen")} title={t("Foto aufnehmen")}>
        <Camera size={18} />
      </button>
      <button type="button" className="round-btn" disabled={busy} onClick={() => galleryRef.current.click()}
        aria-label={t("Aus Galerie wählen")} title={t("Aus Galerie wählen")}>
        <ImageIcon size={18} />
      </button>
      {hasPhoto && (
        <button type="button" className="round-btn warn" disabled={busy} onClick={removePhoto}
          aria-label={t("Foto entfernen")} title={t("Foto entfernen")}>
          <Trash2 size={18} />
        </button>
      )}
      {busy && <span className="avatar-busy">{t("Verarbeite Foto ...")}</span>}
    </div>
  );
}
