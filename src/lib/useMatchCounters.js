import { useEffect, useState } from "react";
import { loadMatchCounters } from "./counterCache";

/* Zusatzzaehler aller Matches fuer Auswertungen ausserhalb der Statistik
   (z.B. "Meine Zahlen" -> Fun). dep: aendert sich, wenn neu gelesen werden
   soll (Matchzahl). Kurz zwischengespeichert, damit das Umschalten zwischen
   Bildschirmen nicht jedes Mal eine Anfrage ausloest (counterCache.js). */
export function useMatchCounters(dep) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true;
    loadMatchCounters({ maxAgeMs: 60000 }).then((r) => { if (alive) setRows(r); });
    return () => { alive = false; };
  }, [dep]);
  return rows;
}
