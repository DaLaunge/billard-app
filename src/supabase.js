import { createClient } from "@supabase/supabase-js";

// Die beiden Werte kommen aus den Umgebungsvariablen,
// die du bei Vercel hinterlegst (siehe ANLEITUNG.md).
const DB_URL = import.meta.env.VITE_SUPABASE_URL || "";

// Projekt-Kennung aus der URL (https://<ref>.supabase.co) -> eindeutig je Supabase-Projekt.
export const DB_REF = (() => {
  try { return new URL(DB_URL).hostname.split(".")[0]; } catch { return "?"; }
})();

export const supabase = createClient(
  DB_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
