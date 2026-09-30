import { t } from "../../lib/i18n";

/* Einzel / Doppel / Beides - der zweite Filter neben der Disziplin.

   Nutzer-Feedback 2026-09-30: "Doppel blendet die anderen Filter fuer
   Disziplinen aus. Das sollte nicht sein. Es sollte Filter pro Disziplin plus
   Auswahl Doppel, Einzel oder Beides geben." "Doppel" war vorher ein
   Eintrag in der Disziplin-Reihe (weil das Rating dafuer als eigene
   "Disziplin" gefuehrt wird) - man konnte also nie "8 Ball im Doppel"
   waehlen. Jetzt sind es zwei unabhaengige Achsen.

   Werte: "single" | "double" | "both". */
export const MODES = [["single", "Einzel"], ["double", "Doppel"], ["both", "Beides"]];

export default function ModePick({ value, onChange }) {
  return (
    <div className="chips small" style={{ marginBottom: 0 }}>
      {MODES.map(([key, label]) => (
        <button key={key} type="button" className={"chip" + (value === key ? " active" : "")} onClick={() => onChange(key)}>
          {t(label)}
        </button>
      ))}
    </div>
  );
}
