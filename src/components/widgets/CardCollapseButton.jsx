import { ChevronDown } from "lucide-react";
import { t } from "../../lib/i18n";

/* Ein-/Ausklapp-Knopf fuer eine Statistik-Karte (Nutzer-Feedback: "du
   solltest alle Karten herunterklappbar machen") - gleiches visuelles
   Muster wie die einklappbaren Bereiche auf Live (siehe .cat-chev dort),
   nur pro einzelner Karte statt pro Abschnitt. Wird typischerweise neben
   einem InfoButton im Kartenkopf platziert (siehe .stat-block-head-actions
   in App.css), deshalb ohne eigenen rechten Rand-Trick wie .card-info-btn -
   das uebernimmt der umgebende Flex-Wrapper. */
export default function CardCollapseButton({ collapsed, onToggle }) {
  return (
    <button type="button" className="card-collapse-btn" onClick={onToggle}
      aria-label={collapsed ? t("Karte aufklappen") : t("Karte einklappen")}
      title={collapsed ? t("Karte aufklappen") : t("Karte einklappen")}>
      <ChevronDown size={16} className={"cat-chev" + (!collapsed ? " open" : "")} />
    </button>
  );
}
