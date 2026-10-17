import { useState } from "react";
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* Segment-Leiste: waehlt, welche Kartengruppe eines Bildschirms sichtbar ist.
   Nur am Handy (Klasse .seg-bar, ab 900px per CSS aus) - am PC stehen die
   Gruppen ohnehin nebeneinander. Ein einziges Segment braucht keine Leiste.

   Die Reihenfolge ist per langem Druck + Ziehen aenderbar und wird je Geraet
   unter "segOrder:<storageKey>" gemerkt (wie die uebrigen Geraete-Einstellungen).
   Verzoegerter Sensor wie bei den Statistik-Karten: normales Tippen waehlt aus,
   Wischen scrollt weiter. */
const readOrder = (key) => { try { return JSON.parse(localStorage.getItem("segOrder:" + key) || "[]"); } catch { return []; } };

function Item({ s, active, onChange }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.6 : 1, touchAction: "manipulation", zIndex: isDragging ? 2 : undefined };
  return (
    <button ref={setNodeRef} style={style} role="tab" aria-selected={active === s.id} {...attributes} {...listeners}
      className={"seg-bar-item" + (active === s.id ? " on" : "") + (isDragging ? " dragging" : "")}
      onClick={() => onChange(s.id)}>{s.label}</button>
  );
}

export default function SegmentBar({ segments, active, onChange, label, storageKey }) {
  const [saved, setSaved] = useState(() => (storageKey ? readOrder(storageKey) : []));
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  if (!segments || segments.length < 2) return null;
  const rank = (id) => { const i = saved.indexOf(id); return i === -1 ? 999 : i; };
  const ordered = [...segments].sort((a, b) => rank(a.id) - rank(b.id));
  const onDragEnd = ({ active: a, over }) => {
    if (!over || a.id === over.id) return;
    const ids = ordered.map((s) => s.id);
    const next = arrayMove(ids, ids.indexOf(a.id), ids.indexOf(over.id));
    setSaved(next);
    if (storageKey) { try { localStorage.setItem("segOrder:" + storageKey, JSON.stringify(next)); } catch { /* ignore */ } }
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ordered.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
        <div className="seg-bar" role="tablist" aria-label={label}>
          {ordered.map((s) => <Item key={s.id} s={s} active={active} onChange={onChange} />)}
        </div>
      </SortableContext>
    </DndContext>
  );
}
