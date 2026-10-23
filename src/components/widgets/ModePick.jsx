import { t } from "../../lib/i18n";

/* Einzel / Doppel / Beides - der zweite Filter neben der Disziplin.

   Nutzer-Feedback 2026-09-30: "Doppel blendet die anderen Filter fuer
   Disziplinen aus. Das sollte nicht sein. Es sollte Filter pro Disziplin plus
   Auswahl Doppel, Einzel oder Beides geben." "Doppel" war vorher ein
   Eintrag in der Disziplin-Reihe (weil das Rating dafuer als eigene
   "Disziplin" gefuehrt wird) - man konnte also nie "8 Ball im Doppel"
   waehlen. Jetzt sind es zwei unabhaengige Achsen.

   Danach: "gib diesen Buttons verstaendliche Graphiken" - statt der Woerter
   Personen-Symbole. Einzel = eine Figur, Doppel = zwei, Beides = die Einzel-
   Figur VOR dem (abgedunkelten) Paar, also "die eine Art im Bild der
   anderen". Der Name steckt in title/aria-label.

   Werte: "single" | "double" | "both". */
export const MODES = [["single", "Einzel"], ["double", "Doppel"], ["both", "Beides"]];

// Eine Figur (Kopf + Schultern) um (x, y), s = Massstab. Nur currentColor,
// damit die Kachel die Farbe vorgibt (gewaehlt = Akzent, sonst gedaempft).
const Person = ({ x, y, s = 1, op = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={op} fill="currentColor">
    <circle cx="0" cy="-4.6" r="3.6" />
    <path d="M-6.4 7.6c0-5 2.9-7 6.4-7s6.4 2 6.4 7z" />
  </g>
);

export function ModeGlyph({ mode, size = 26, className }) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      {mode === "single" && <Person x={14} y={15} s={1.35} />}
      {mode === "double" && (<><Person x={8} y={15} s={1.1} /><Person x={20} y={15} s={1.1} /></>)}
      {mode === "both" && (
        <>
          <Person x={7} y={12.5} s={0.95} op={0.5} /><Person x={21} y={12.5} s={0.95} op={0.5} />
          <Person x={14} y={16} s={1.3} />
        </>
      )}
    </svg>
  );
}

/* Einzel / Doppel als Kacheln mit Zeichnung UND Name - dieselben Kacheln wie
   die Formatwahl in "Neues Turnier" (.fmt-card), damit "Neues Match" und
   "Neues Turnier" gleich aussehen (Nutzer-Feedback 2026-09-30). Fuer die
   Formulare, in denen Platz fuer den Namen ist; die schmalen Filterzeilen
   nehmen weiter ModePick (nur Symbol). */
export function ModeTiles({ value, onChange }) {
  return (
    <div className="fmt-grid two">
      {MODES.filter(([key]) => key !== "both").map(([key, label]) => (
        <button key={key} type="button" className={"fmt-card" + (value === key ? " sel" : "")}
          aria-pressed={value === key} onClick={() => onChange(key)}>
          <ModeGlyph mode={key} size={30} className="fmt-glyph" />
          <span>{t(label)}</span>
        </button>
      ))}
    </div>
  );
}

// Mehrfachauswahl (421.7): zwei Schalter Einzel/Doppel statt drei Knoepfe. Beide an = "both" (alles);
// der letzte noch aktive Schalter laesst sich nicht abwaehlen, damit die Auswahl nie leer ist.
export default function ModePick({ value, onChange, inline }) {
  const Wrap = inline ? ModeInline : "div";
  const on = (key) => value === "both" || value === key;
  const toggle = (key) => {
    const other = key === "single" ? "double" : "single";
    if (value === "both") onChange(other);
    else if (value !== key) onChange("both");
  };
  return (
    <Wrap className="disc-picks compact">
      {MODES.filter(([key]) => key !== "both").map(([key, label]) => (
        <button key={key} type="button" className={"disc-pick compact mode-pick" + (on(key) ? " sel" : "")}
          aria-pressed={on(key)} aria-label={t(label)} title={t(label)} onClick={() => toggle(key)}>
          <ModeGlyph mode={key} />
        </button>
      ))}
    </Wrap>
  );
}

// Als Teil der Disziplin-Zeile (DiscPickRow trailing): Trennstrich + Knoepfe, kein eigener Block.
function ModeInline({ children }) {
  return (
    <>
      <span className="disc-sep" aria-hidden="true" />
      {children}
    </>
  );
}
