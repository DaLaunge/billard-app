import { poolBallStyle, DISC_BALL } from "../../lib/pool";
import { t } from "../../lib/i18n";

/* Die Disziplin als Billardkugel statt als Kuerzel ("8B", "9B", ...).
   Nutzer-Feedback 2026-09-30: "verwende bei den Turnieren statt langweiligen
   Zahlen die entsprechenden Billardkugeln als Hinweis fuer die Disziplin ...
   Verwende dieselben Graphiken" wie beim 14/1-Protokoll - deshalb kommt die
   Kugel aus derselben Quelle (poolBallStyle in lib/pool.js) und dieselben
   Klassen (.pool-ball/.pb-no), nur skalierbar und nicht klickbar.

   8 Ball -> Kugel 8 (schwarz), 9 Ball -> 9 (gelb gestreift), 10 Ball -> 10
   (blau gestreift), 14/1 Endlos -> 14 (gruen gestreift).

   Der Name der Disziplin bleibt als title/aria-label erhalten: eine Kugel
   allein sagt Vorlesehilfen nichts, und ein laengeres Antippen zeigt ihn.
   Eine Disziplin ohne Kugel (z.B. "Gesamt") faellt auf den Text zurueck,
   statt eine leere Stelle zu hinterlassen. */
export default function DiscBall({ disc, size = 18 }) {
  const n = DISC_BALL[disc];
  if (n == null) return <span>{t(disc)}</span>;
  return (
    <span className="pool-ball disc-ball" role="img" aria-label={t(disc)} title={t(disc)}
      style={{ ...poolBallStyle(n), width: size, height: size }}>
      {/* Nummer nur, wo sie noch lesbar ist - unter ~18px ist sie ein Fleck; die
          kleinen Kugeln in Pillen und Kopfzeilen bleiben dann reine Farbe bzw.
          Streifen (8 schwarz, 9 gelb, 10 blau, 14 gruen gestreift). */}
      {size >= 18 && <span className="pb-no" style={{ fontSize: Math.max(6, Math.round(size * 0.34)) }}>{n}</span>}
    </span>
  );
}

/* Eine Kugel zum Auswaehlen (Turnierformular, Statistik-Filter): dieselbe
   Kachel an allen Stellen, gewaehlt = Ring in der Akzentfarbe. "compact" fuer
   die Filterfelder, wo mehrere Kugeln neben "Alle"/"Doppel" in eine Zeile
   passen muessen. Disziplinen ohne Kugel (z.B. "Doppel") sind hier KEINE
   Kachel, sondern ein normaler Chip - die Aufrufer mischen beides in einer
   Zeile, siehe DiscPickRow. */
export function DiscPick({ disc, selected, onSelect, compact }) {
  return (
    <button type="button" className={"disc-pick" + (compact ? " compact" : "") + (selected ? " sel" : "")}
      aria-pressed={selected} aria-label={t(disc)} title={t(disc)} onClick={onSelect}>
      <DiscBall disc={disc} size={compact ? 26 : 34} />
    </button>
  );
}

/* Zeile aus Disziplin-Kugeln plus den Eintraegen OHNE Kugel als Chips.
   "all": Wert und Beschriftung fuer "Alle" (Gesamt bzw. "all"), sonst kein
   solcher Chip. Die Reihenfolge ist immer die der Turniere (8, 9, 10, 14/1,
   dann der Rest wie "Doppel") - die alphabetische aus App.jsx stellte
   "10 Ball" vor "8 Ball". */
const ORDER = Object.keys(DISC_BALL);
export const sortDisciplines = (list) =>
  [...list].sort((a, b) => {
    const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });

/* "Alle Disziplinen" als Bild: alle vier Kugeln ueberlappend in einem Haufen
   (Nutzer-Feedback 2026-09-30: "Alle sollte alle 4 Disziplinen in der Graphik
   vereinen, gerne auch ueberlappende Kugeln - dann ist sofort klar, dass es
   sich um alle Disziplinen und nicht alle Modi handelt"). Ohne Nummern: bei
   der Groesse waeren sie ein Fleck, und der Haufen soll als Ganzes gelesen
   werden. Reihenfolge = Ueberlappung: die 14 liegt zuoberst. */
export function DiscAll({ size = 26 }) {
  const b = Math.round(size * 0.66);
  const off = size - b;
  const spots = [[0, 0, 8], [off, 0, 9], [0, off, 10], [off, off, 14]];
  return (
    <span className="disc-all" role="img" aria-label={t("Alle Disziplinen")} title={t("Alle Disziplinen")}
      style={{ width: size, height: size }}>
      {spots.map(([x, y, n]) => (
        <span key={n} className="pool-ball disc-ball"
          style={{ ...poolBallStyle(n), width: b, height: b, position: "absolute", left: x, top: y, margin: 0 }} />
      ))}
    </span>
  );
}

export function DiscPickRow({ discs, value, onChange, all }) {
  return (
    <div className="disc-picks compact">
      {all && (
        <button type="button" className={"disc-pick compact" + (value === all ? " sel" : "")}
          aria-pressed={value === all} aria-label={t("Alle Disziplinen")} title={t("Alle Disziplinen")} onClick={() => onChange(all)}>
          <DiscAll />
        </button>
      )}
      {sortDisciplines(discs).map((d) => (DISC_BALL[d] != null ? (
        <DiscPick key={d} disc={d} compact selected={value === d} onSelect={() => onChange(d)} />
      ) : (
        <button key={d} type="button" className={"chip" + (value === d ? " active" : "")} onClick={() => onChange(d)}>{t(d)}</button>
      )))}
    </div>
  );
}
