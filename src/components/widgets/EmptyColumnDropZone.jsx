import { useDroppable } from "@dnd-kit/core";
import { t } from "../../lib/i18n";

/* Ablageflaeche fuer eine LEERE Spalte (Nutzer-Feedback: "ich habe alle
   Karten in der Mitte, kann aber keine Karte nach rechts schieben") - ohne
   sie gibt es in einer leeren Spalte schlicht keine Karte, auf die man beim
   Ziehen zielen koennte, @dnd-kit erkennt daher gar keine Ablageposition
   dort. useDroppable() (nicht useSortable() - hier wird nichts sortiert,
   nur eine Spalte als gueltiges Ziel registriert) macht die leere Spalte
   selbst zu einem Ziel; handleDragEnd in StatistikScreen.jsx erkennt die
   feste id und setzt nur die Spalte der gezogenen Karte, wie der
   CardColumnButton es auch taete. */
export default function EmptyColumnDropZone({ id, label }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={"stat-empty-dropzone" + (isOver ? " over" : "")}>
      {t(label)}
    </div>
  );
}
