/* Karierte Zielflagge (Symbol fuer "Turnier beenden"): Fahnenstange plus Flagge mit 4 x 3 Karos. Nur currentColor, kein Text im SVG
   (der Name steht in title/aria-label am Knopf) - wie FormatGlyph/DiscBall. */
export default function CheckeredFlag({ size = 22 }) {
  const cols = 4, rows = 3, x0 = 6.5, y0 = 3.5, w = 13, h = 9.75, cw = w / cols, ch = h / rows;
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if ((r + c) % 2 === 0) cells.push(<rect key={`${r}-${c}`} x={x0 + c * cw} y={y0 + r * ch} width={cw} height={ch} fill="currentColor" />);
  return (
    <svg className="checkered-flag" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <line x1="4.5" y1="2.5" x2="4.5" y2="21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {cells}
      <rect x={x0} y={y0} width={w} height={h} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
