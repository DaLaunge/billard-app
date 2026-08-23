/* Holt ALLE Zeilen einer Abfrage seitenweise (Supabase liefert je
   Anfrage max. 1000 Zeilen). queryFn(from, to) muss einen Supabase-
   Range-Query zurückgeben. Ergebnis: { data, error }. */
export async function fetchAllRows(queryFn, pageSize = 1000) {
  let from = 0;
  const all = [];
  // Sicherheitslimit: max. 50 Seiten (50.000 Zeilen)
  for (let page = 0; page < 50; page++) {
    const { data, error } = await queryFn(from, from + pageSize - 1);
    if (error) return { data: all, error };
    if (data && data.length) all.push(...data);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return { data: all, error: null };
}
