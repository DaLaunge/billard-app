import { supabase } from "../supabase";

/* Club-Logos sind absichtlich winzig (supabase/2026-10-19e_club_logo.sql: Bucket "club-logos", serverseitig max. 20 KB).
   compressClubLogo(): mittiger quadratischer Ausschnitt, 128 px, WebP (JPEG-Ersatz auf Geraeten ohne WebP-Export), danach
   schrittweise kleiner/schwaecher, bis die Datei unter MAX_BYTES liegt. */
export const LOGO_MAX_BYTES = 12 * 1024;
const STEPS = [[128, 0.8], [128, 0.65], [112, 0.6], [96, 0.55], [80, 0.5], [64, 0.45]];

const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type, q));

export async function compressClubLogo(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bmp.width, bmp.height);
  const sx = (bmp.width - side) / 2, sy = (bmp.height - side) / 2;
  let best = null;
  for (const [dim, q] of STEPS) {
    const canvas = document.createElement("canvas");
    canvas.width = dim; canvas.height = dim;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bmp, sx, sy, side, side, 0, 0, dim, dim);
    let blob = await toBlob(canvas, "image/webp", q);
    if (!blob || blob.type !== "image/webp") {
      // kein WebP-Export (aeltere Safari): JPEG, Transparenz wird weiss
      const c2 = document.createElement("canvas");
      c2.width = dim; c2.height = dim;
      const x2 = c2.getContext("2d");
      x2.fillStyle = "#fff"; x2.fillRect(0, 0, dim, dim);
      x2.drawImage(bmp, sx, sy, side, side, 0, 0, dim, dim);
      blob = await toBlob(c2, "image/jpeg", q);
    }
    best = blob;
    if (blob && blob.size <= LOGO_MAX_BYTES) break;
  }
  bmp.close?.();
  if (!best) throw new Error("Komprimierung fehlgeschlagen.");
  return best;
}

export const clubLogoPath = (clubId) => `${clubId}/logo`;

/* Oeffentliche URL des Logos (null ohne Logo); ?v=logo_at umgeht den Cache nach einem Wechsel. */
export function clubLogoUrl(club) {
  if (!club?.logo_at) return null;
  const { data } = supabase.storage.from("club-logos").getPublicUrl(clubLogoPath(club.id));
  return `${data.publicUrl}?v=${encodeURIComponent(club.logo_at)}`;
}
