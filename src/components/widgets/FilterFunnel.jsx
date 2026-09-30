import { useState } from "react";
import { Filter, Check } from "lucide-react";
import { t } from "../../lib/i18n";

/* Trichter-Symbol im Kartenkopf + das Auswahlfeld, das es aufklappt.

   Vorher steckte das fest in CardDeck.jsx. Herausgeloest, weil ein und
   dieselbe Auswahl ("Auswahl fuer alle Statistiken") an ZWEI Stellen
   erreichbar sein muss: im Kopf der Bestenlisten-Karte - und, falls die
   Nutzerin alle Bestenlisten ausgeblendet hat, im Kopf des Verlaufs-Graphen.
   Sonst gaebe es dann keinen Weg mehr, die Disziplin des Graphen zu
   aendern (der Trichter verschwand mit der Karte, an der er hing).

   Nutzung: const funnel = useFunnel(); dann <FunnelButton .../> in die
   Aktionsgruppe des Kartenkopfs und <FunnelPanel .../> unter den Kopf. Der
   Zustand "offen" gehoert bewusst der Karte, nicht diesem Baustein - so
   kann die Karte das Feld z.B. beim Zuklappen selbst mit ausblenden. Die
   Auswahl selbst (Disziplin, Top-N) lebt weiter im Bildschirm. */
export function useFunnel() {
  const [open, setOpen] = useState(false);
  return { open, toggle: () => setOpen((o) => !o), close: () => setOpen(false) };
}

export function FunnelButton({ funnel, label }) {
  return (
    <button type="button" className={"card-filter-btn" + (funnel.open ? " on" : "")}
      aria-expanded={funnel.open} aria-label={label} title={label} onClick={funnel.toggle}>
      <Filter size={16} />
    </button>
  );
}

/* Auf-/Zuklappen mit echter Hoehen-Animation (.collapsible, siehe App.css).
   "inert" nimmt das geschlossene Feld aus der Tab-Reihenfolge - es hat Hoehe
   0, ist aber weiter im DOM, und ohne das wuerde die Tastatur unsichtbare
   Knoepfe ansteuern. */
export function FunnelPanel({ funnel, children }) {
  return (
    <div className={"collapsible" + (funnel.open ? " open" : "")} inert={funnel.open ? undefined : ""}>
      <div className="collapsible-inner">
        <div className="deck-filter">
          {children}
          <div className="deck-filter-foot">
            <button type="button" className="btn primary small" onClick={funnel.close}>
              <Check size={15} /> {t("OK")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
