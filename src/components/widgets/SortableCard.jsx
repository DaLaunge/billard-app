import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* Duenne Huelle um eine bestehende Karte (.stat-block), die per @dnd-kit
   sortierbar wird - der Karteninhalt selbst (RankingBlock, LeaderboardBlock,
   RecordsBoard, ...) bleibt unveraendert, nur diese Huelle traegt Ref/Drag-
   Listener. activationConstraint.delay sitzt am Sensor in StatistikScreen.jsx
   ("lange druecken, dann verschieben" - Nutzer-Feedback: normales Wischen/
   Scrollen soll nichts ausloesen). touchAction bewusst NICHT "none": bei
   verzoegerter Aktivierung entscheidet @dnd-kit selbst per Bewegungstoleranz,
   ob eine Beruehrung ein Scroll oder ein langer Druck ist - "none" wuerde dem
   Browser das native Scrollen von Anfang an komplett verbieten und genau das
   Wischen blockieren, das laut Aufgabenstellung weiter funktionieren soll.
   "manipulation" unterdrueckt nur Doppeltipp-Zoom, laesst Scrollen intakt.

   CSS.Translate statt CSS.Transform (Nutzer-Feedback: "beim drag and drop
   verzerren sich die Karten in die Länge, was auch sehr seltsam anmutet"):
   rectSortingStrategy liefert bei unterschiedlich hohen Karten (z.B. kurze
   Bestenliste vs. hohe Spielehistorie) einen transform-Wert MIT scaleX/
   scaleY, damit die Karte waehrend der Zieh-Animation optisch auf die
   Groesse ihres Zielplatzes "einrastet" - CSS.Transform.toString gibt genau
   diese Skalierung mit aus, was wie ein Verzerren/Strecken der Karte
   aussieht. CSS.Translate.toString uebernimmt nur die Verschiebung
   (translateX/Y), keine Skalierung - die Karte bewegt sich beim Ziehen,
   verzerrt sich aber nicht mehr. */
export default function SortableCard({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    touchAction: "manipulation",
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };
  return (
    <div ref={setNodeRef} style={style} className="sortable-card" {...attributes} {...listeners}>
      {children}
    </div>
  );
}
