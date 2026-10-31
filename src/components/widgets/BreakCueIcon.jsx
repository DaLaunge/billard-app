/* "Hier wird angestossen": senkrechtes, etwas comichaftes Symbol aus Sicht des Spielers - der Queue kommt von UNTEN, zielt nach oben und
   trifft die Kugel; drei Spritzer markieren den Stoss. Der Queue waechst in der Hoehe mit (flex), damit er die ganze Karte entlangreicht;
   Kugel und Spritzer behalten ihr Seitenverhaeltnis. Nur currentColor und die Filzfarbe als Aussparung, kein Text. */
export default function BreakCueIcon({ className = "" }) {
  return (
    <span className={"break-cue-icon " + className} aria-hidden="true">
      <svg viewBox="0 0 24 36" focusable="false">
        {/* Kugel oben mit Glanzpunkt */}
        <circle cx="12" cy="12" r="10.5" fill="currentColor" />
        <circle cx="8.6" cy="8.2" r="3" fill="var(--felt)" opacity="0.45" />
        {/* Stoss-Spritzer zwischen Kugel und Queue-Spitze */}
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="3.5" y1="27.5" x2="7" y2="25" />
          <line x1="20.5" y1="27.5" x2="17" y2="25" />
          <line x1="12" y1="25.5" x2="12" y2="29.5" />
        </g>
      </svg>
      <span className="bci-stick" />
    </span>
  );
}
