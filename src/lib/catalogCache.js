import { supabase, DB_REF } from "../supabase";
import { APP_VERSION } from "./constants";

/* Erfolgs-Katalog (badge_catalog: Emoji, Name, Beschreibung) mit lokalem
   Cache. Der Katalog aendert sich nur durch Migrationen, wurde aber bei jedem
   loadData() neu geladen (~23 KB). Neu geladen wird jetzt nur, wenn
   - sich die App-Version geaendert hat (neue Erfolge kommen praktisch immer
     zusammen mit einem Release),
   - irgendein vergebener Erfolg (player_badges) im Cache fehlt - faengt eine
     Katalog-Migration ohne neues Release ab, sobald der Erfolg jemandem
     verliehen wurde,
   - oder der Cache aelter als MAX_AGE_DAYS ist (geaenderte Texte bestehender
     Erfolge ohne Release). */

const KEY = `badgeCatalog:${DB_REF}`;
const MAX_AGE_DAYS = 7;

export async function loadBadgeCatalog(earnedKeys) {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    if (c && c.appVersion === APP_VERSION && Array.isArray(c.rows)
        && Date.now() - (c.fetchedAt || 0) < MAX_AGE_DAYS * 86400000) {
      const known = new Set(c.rows.map((b) => b.badge_key));
      if (earnedKeys.every((k) => known.has(k))) return { data: c.rows, error: null };
    }
  } catch { /* ignore - dann eben neu laden */ }

  const res = await supabase.from("badge_catalog").select("*");
  if (!res.error) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ appVersion: APP_VERSION, fetchedAt: Date.now(), rows: res.data || [] }));
    } catch { /* ignore */ }
  }
  return res;
}
