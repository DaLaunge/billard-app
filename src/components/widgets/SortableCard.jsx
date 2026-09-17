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
   "manipulation" unterdrueckt nur Doppeltipp-Zoom, laesst Scrollen intakt. */
export default function SortableCard({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
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
