/* "Hier wird angestossen": senkrechtes, etwas comichaftes Symbol - ein Queue von oben trifft eine Kugel, drei Spritzer markieren den Stoss.
   Nur currentColor und die Filzfarbe als Aussparung, kein Text im SVG (der Satz steht in title/aria-label am Aufrufer). */
export default function BreakCueIcon({ className = "" }) {
  return (
    <svg className={"break-cue-icon " + className} viewBox="0 0 24 64" aria-hidden="true" focusable="false">
      {/* Queue: schmale Spitze unten, dicker Griff oben */}
      <polygon points="9.2,0 14.8,0 13.2,33 10.8,33" fill="currentColor" />
      <rect x="9.2" y="22" width="5.6" height="2.2" fill="var(--felt)" opacity="0.55" />
      {/* Stoss-Spritzer */}
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <line x1="3.5" y1="33" x2="7" y2="35.5" />
        <line x1="20.5" y1="33" x2="17" y2="35.5" />
        <line x1="12" y1="35" x2="12" y2="38.5" />
      </g>
      {/* Kugel mit Glanzpunkt */}
      <circle cx="12" cy="51" r="10.5" fill="currentColor" />
      <circle cx="8.6" cy="47.2" r="3" fill="var(--felt)" opacity="0.45" />
    </svg>
  );
}
