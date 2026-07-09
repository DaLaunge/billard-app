import { createClient } from "@supabase/supabase-js";

// Die beiden Werte kommen aus den Umgebungsvariablen,
// die du bei Vercel hinterlegst (siehe ANLEITUNG.md).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
