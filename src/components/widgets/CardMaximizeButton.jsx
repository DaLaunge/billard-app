import { Maximize2, Minimize2 } from "lucide-react";
import { t } from "../../lib/i18n";

/* Maximieren-Knopf fuer eine einzelne Statistik-Karte (Nutzer-Feedback: "es
   fehlt fuer den PC-Modus ein Maximieren-Button", zuerst am Entwicklung-
   ueber-Zeit-Graphen). Gleiches Prinzip wie der Maximieren-Modus im
   Turnierraster (siehe .turnier-maximize-btn/.is-maximized in App.css und
   der ausfuehrliche Kommentar dort, warum bewusst kein :fullscreen benutzt
   wird) - eigener CSS-Zustand statt der nativen Fullscreen-API. Nur am
   Desktop sichtbar (siehe .card-maximize-btn in App.css), wie
   CardColumnButton: am Handy ist eine Karte ohnehin schon so breit wie der
   Bildschirm, Maximieren bringt dort kaum Zugewinn. */
export default function CardMaximizeButton({ maximized, onToggle }) {
  const label = t(maximized ? "Minimieren" : "Maximieren");
  return (
    <button type="button" className="card-maximize-btn" onClick={onToggle} aria-label={label} title={label}>
      {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
    </button>
  );
}
