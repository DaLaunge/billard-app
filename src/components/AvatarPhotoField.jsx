import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, Trash2 } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { compressImageFile } from "../lib/avatarPhoto";

export default function AvatarPhotoField({ playerId, hasPhoto, onReload, toast }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressImageFile(file);
      const { error } = await supabase.storage.from("avatars")
        .upload(`${playerId}.jpg`, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
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
      await supabase.storage.from("avatars").remove([`${playerId}.jpg`]);
      const { error } = await supabase.rpc("set_avatar_photo", { p_has_photo: false });
      if (error) throw error;
      toast(t("Foto entfernt."));
      await onReload();
    } catch (e) {
      toast(t("Fehler: ") + e.message);
    }
    setBusy(false);
  };

  return (
    <div className="avatar-photo-actions">
      <input ref={cameraRef} type="file" accept="image/*" capture="user" style={{ display: "none" }}
        onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }} />
      <button type="button" className="btn ghost" disabled={busy} onClick={() => cameraRef.current.click()}>
        <Camera size={15} /> {t("Foto aufnehmen")}
      </button>
      <button type="button" className="btn ghost" disabled={busy} onClick={() => galleryRef.current.click()}>
        <ImageIcon size={15} /> {t("Aus Galerie wählen")}
      </button>
      {hasPhoto && (
        <button type="button" className="btn ghost warn" disabled={busy} onClick={removePhoto}>
          <Trash2 size={15} /> {t("Foto entfernen")}
        </button>
      )}
      {busy && <p className="hint" style={{ marginTop: 6, marginBottom: 0, flexBasis: "100%" }}>{t("Verarbeite Foto ...")}</p>}
    </div>
  );
}
