/* Staerkste Disziplin einer Person aus ihren Rating-Zeilen (rangliste): hoechstes Rating ohne "Gesamt" und das synthetische "Doppel".
   Gefestigte Ratings (nicht "vorlaeufig") haben Vorrang - sonst wuerde ein einziges Spiel in einer Disziplin (508) die echte
   Hauptdisziplin ausstechen. Gibt es nur vorlaeufige, zaehlen diese. Liefert null ohne passende Zeile. */
export function bestDiscipline(rows) {
  const list = (rows || []).filter((r) => r.discipline !== "Gesamt" && r.discipline !== "Doppel" && r.discipline !== "Einzel" && !r.discipline.includes(":") && r.rating != null);
  const settled = list.filter((r) => !r.vorlaeufig);
  const pool = settled.length ? settled : list;
  return pool.length ? pool.reduce((a, b) => (b.rating > a.rating ? b : a)) : null;
}
