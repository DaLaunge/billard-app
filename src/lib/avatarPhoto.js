/* Komprimiert ein aufgenommenes/ausgewaehltes Foto clientseitig auf eine
   handy-taugliche Kantenlaenge, bevor es hochgeladen wird - haelt Speicher-
   und Bandbreitenverbrauch im Gratis-Kontingent des Backends gering.
   createImageBitmap mit imageOrientation:"from-image" beruecksichtigt die
   EXIF-Rotation von Handykamera-Fotos, sonst landen viele Bilder seitlich. */
export async function compressImageFile(file, { maxDim = 1000, quality = 0.82 } = {}) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Komprimierung fehlgeschlagen."))),
      "image/jpeg",
      quality
    );
  });
}
