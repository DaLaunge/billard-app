import { Radio, Flag, UserPlus, Lock, Pencil } from "lucide-react";
import { t } from "../../lib/i18n";
import { FORMAT_GLYPH } from "./FormatGlyph";
import { formatLabel } from "../../lib/turnierLayout";

/* Symbole statt Woerter in der Info-Zeile der Turnier-Kopfzeile (Nutzer 2026-11-01): Schiedsrichter-Pfeife fuer die Turnierleitung,
   Funk-Symbol fuer "laeuft", Flagge fuer "beendet", Person+ fuer "Anmeldung offen". Der Name steht nur im title/aria-label. */
export function RefereeIcon({ size = 18 }) {
  const label = t("Turnierleitung");
  return (
    <span className="info-ico" title={label} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="15" cy="14" r="5" /><circle cx="15" cy="14" r="1.2" fill="currentColor" />
        <path d="M10.4 11.2 3 8.8v3.9l5.4 1.3" /><path d="M15 9V5.5h3.5" />
      </svg>
    </span>
  );
}

export function StatusIcon({ status, size = 16 }) {
  const [Icon, label] = status === "finished" ? [Flag, t("beendet")] : status === "setup" ? [UserPlus, t("Anmeldung offen")] : [Radio, t("läuft")];
  return <span className={"info-ico status-" + status} title={label} role="img" aria-label={label}><Icon size={size} /></span>;
}

// Turnierformat als kleine Baumzeichnung (dieselbe wie in der Turnierliste), in JEDEM Modus gleich in der Info-Zeile; der Name steht im title.
export function FormatInfoIcon({ format }) {
  const Glyph = FORMAT_GLYPH[format] || FORMAT_GLYPH.ko;
  const label = format === "winner_stays" ? t("Winner Stays") : formatLabel(format);
  return <span className="info-ico info-ico-format" title={label} role="img" aria-label={label}><Glyph /></span>;
}

// Beendetes Turnier: Schloss = Ergebnisse bestaetigt (gesperrt), Stift = Korrekturen noch moeglich. Symbol statt Satz, damit die Info-Zeile
// in jedem Zustand eine Zeile bleibt und die Knoepfe darunter immer an derselben Stelle stehen.
export function ResultsLockIcon({ locked, size = 15 }) {
  const label = locked ? t("Ergebnisse bestätigt") : t("Korrekturen noch möglich");
  const Icon = locked ? Lock : Pencil;
  return <span className={"info-ico" + (locked ? " status-locked" : "")} title={label} role="img" aria-label={label}><Icon size={size} /></span>;
}
