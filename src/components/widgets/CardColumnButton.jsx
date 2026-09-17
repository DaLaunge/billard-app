import { ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "../../lib/i18n";

/* Manuelle Spalten-Zuordnung einer Statistik-Karte (Nutzer-Feedback: "die
   Entscheidung ob eine Karte in der Mitte oder rechts steht trifft der
   User" - siehe cardLayout.js fuer die volle Vorgeschichte, warum ein
   automatischer Hoehen-Ausgleich dafuer nicht mehr infrage kam). Nur am
   Desktop sichtbar (siehe .card-column-btn in App.css) - am Handy gibt es
   keine zwei Spalten, dort bleibt cardOrder die einzige Sortierung. */
export default function CardColumnButton({ column, onToggle }) {
  const toRight = column !== "right";
  const label = toRight ? t("In die rechte Spalte verschieben") : t("In die mittlere Spalte verschieben");
  return (
    <button type="button" className="card-column-btn" onClick={onToggle} aria-label={label} title={label}>
      {toRight ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
    </button>
  );
}
