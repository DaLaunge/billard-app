/* Kleine Struktur-Zeichnungen der vier Turnierformate.

   Nutzer-Feedback 2026-09-30: "Versuche moeglichst viele Erklaerungen
   visuell an den User weiterzugeben und nicht textuell zu beschreiben."
   Genau dafuer sind Turnierformate der beste Fall: "Doppel-K.O." sagt
   einem Neuling nichts, ein Baum mit zweitem Pfad darunter schon.

   Gezeichnet wird ausschliesslich mit currentColor, damit die Kachel die
   Farbe vorgibt (ausgewaehlt = Akzent, sonst gedaempft) und beide Themes
   ohne Sonderfall funktionieren. Kein Text im SVG - der Name steht als
   echter Text unter der Zeichnung, damit er uebersetzt und vorgelesen
   werden kann. aria-hidden, weil die Zeichnung nichts sagt, was nicht
   daneben steht. */

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
const wrap = (children) => (
  <svg viewBox="0 0 56 34" className="fmt-glyph" aria-hidden="true" focusable="false">{children}</svg>
);

// K.O.: vier Startfelder, die sich ueber zwei Runden zu einem Sieger
// verjuengen - wer verliert, ist raus.
export const KoGlyph = () => wrap(
  <g {...S}>
    <path d="M4 5h8v6h8" /><path d="M4 17h8v-6" />
    <path d="M4 23h8v6h8" /><path d="M4 29h8v-6" />
    <path d="M20 11h6v8h8" /><path d="M20 29h6v-8" />
    <circle cx="40" cy="19" r="3.2" fill="currentColor" stroke="none" />
  </g>
);

// Doppel-K.O.: derselbe Baum, darunter gestrichelt der zweite Weg - eine
// Niederlage wirft dich in die Verliererrunde, nicht aus dem Turnier.
export const DoubleKoGlyph = () => wrap(
  <g {...S}>
    <path d="M4 4h7v5h7" /><path d="M4 14h7V9" />
    <path d="M18 9h8v6h7" />
    <path d="M4 24h7v5h7" strokeDasharray="3 2.5" />
    <path d="M4 30h7v-1" strokeDasharray="3 2.5" />
    <path d="M18 29h8v-9" strokeDasharray="3 2.5" />
    <path d="M11 14v10" strokeDasharray="2 2.5" />
    <circle cx="38" cy="17" r="3.2" fill="currentColor" stroke="none" />
  </g>
);

// Jeder gegen jeden: vier Spieler, jeder mit jedem verbunden.
export const RoundRobinGlyph = () => wrap(
  <g {...S}>
    <path d="M16 8h24M16 26h24M16 8 40 26M40 8 16 26M16 8v18M40 8v18" opacity="0.65" />
    <circle cx="16" cy="8" r="3.4" fill="currentColor" stroke="none" />
    <circle cx="40" cy="8" r="3.4" fill="currentColor" stroke="none" />
    <circle cx="16" cy="26" r="3.4" fill="currentColor" stroke="none" />
    <circle cx="40" cy="26" r="3.4" fill="currentColor" stroke="none" />
  </g>
);

// Winner Stays: ein Tisch, der Sieger bleibt (gefuellter Punkt oben), der
// Verlierer geht hinten in die Schlange (Pfeil im Kreis).
export const WinnerStaysGlyph = () => wrap(
  <g {...S}>
    <rect x="17" y="4" width="22" height="13" rx="3" />
    <circle cx="23.5" cy="10.5" r="2.2" fill="currentColor" stroke="none" />
    <circle cx="32.5" cy="10.5" r="2.2" />
    <path d="M39 22c4 0 4 7 0 7H20" />
    <path d="M23 26l-3 3 3 3" />
    <circle cx="14" cy="29" r="2.2" opacity="0.6" fill="currentColor" stroke="none" />
    <circle cx="7" cy="29" r="2.2" opacity="0.35" fill="currentColor" stroke="none" />
  </g>
);

export const FORMAT_GLYPH = {
  ko: KoGlyph,
  double_ko: DoubleKoGlyph,
  round_robin: RoundRobinGlyph,
  winner_stays: WinnerStaysGlyph,
};
