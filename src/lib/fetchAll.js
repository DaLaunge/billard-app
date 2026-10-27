/* Supabase/PostgREST liefert pro Abfrage hoechstens 1000 Zeilen (db-max-rows) - alles darueber wird STILL abgeschnitten.
   Fuer Tabellen, die wachsen (player_badges: 1500 Zeilen in der Testdatenbank), holt diese Funktion alle Seiten nacheinander.
   `build(from, to)` liefert die Abfrage fuer den Zeilenbereich; die Abfrage MUSS stabil sortiert sein (sonst wandern Zeilen zwischen
   den Seiten). Rueckgabe wie bei einer normalen Abfrage: { data, error }. */
export async function fetchAll(build, pageSize = 1000) {
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) return { data: null, error };
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return { data: all, error: null };
}
