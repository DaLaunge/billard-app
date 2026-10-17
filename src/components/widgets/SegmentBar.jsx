/* Segment-Leiste: waehlt, welche Kartengruppe eines Bildschirms sichtbar ist.
   Nur am Handy (Klasse .seg-bar, ab 900px per CSS aus) - am PC stehen die
   Gruppen ohnehin nebeneinander. Ein einziges Segment braucht keine Leiste. */
export default function SegmentBar({ segments, active, onChange, label }) {
  if (!segments || segments.length < 2) return null;
  return (
    <div className="seg-bar" role="tablist" aria-label={label}>
      {segments.map((s) => (
        <button key={s.id} role="tab" aria-selected={active === s.id} className={"seg-bar-item" + (active === s.id ? " on" : "")}
          onClick={() => onChange(s.id)}>{s.label}</button>
      ))}
    </div>
  );
}
