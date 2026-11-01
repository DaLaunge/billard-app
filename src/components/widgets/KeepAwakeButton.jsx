import { LightbulbOff } from "lucide-react";
import { t } from "../../lib/i18n";
import { wakeLockSupported } from "../../lib/wakeLock";

/* Schnellschalter "Bildschirm bleibt an" im Kopf der Live-Eingabe-Screens
   (Match, Winner-Stays). Gilt nur fuer die laufende Eingabe - der dauerhafte
   Standard steht im Profil unter Einstellungen (siehe App.jsx,
   keepAwakeDefault/keepAwakeNow).

   Kann das Geraet gar keinen Wake Lock (iOS vor Safari 16.4), erscheint der
   Knopf nicht: ein Schalter, der sichtbar nichts bewirkt, ist schlechter als
   gar keiner. */
/* Leuchtende Birne im Comic-Stil: die Lucide-Birne plus kurze, abgerundete Strahlen in wechselnder Laenge (wie hingekritzelt).
   Alles in currentColor, damit Thema und Akzentfarbe gelten; bewusst ohne Animation (lenkt in der Turnieransicht ab). */
function GlowBulb() {
  return (
    <svg className="glow-bulb" width="36" height="36" viewBox="-6 -6 36 36" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g className="kw-rays">
        <path d="M12 -1.5V-4.5M5.4 2.4L3.2 0.2M18.6 2.4L20.8 0.2M3.2 9H-0.5M20.8 9H24.5M5.6 15.6L3.6 17.4M18.4 15.6L20.4 17.4" />
      </g>
      <g className="kw-bulb">
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6" /><path d="M10 22h4" />
      </g>
    </svg>
  );
}

export default function KeepAwakeButton({ on, onChange, toast }) {
  if (!wakeLockSupported()) return null;
  const label = on ? t("Bildschirm bleibt an") : t("Bildschirm darf sich sperren");
  return (
    <button className={"keepawake-btn" + (on ? " on" : "")} aria-pressed={on}
      title={label} aria-label={label}
      onClick={() => {
        const next = !on;
        onChange(next);
        toast?.(next ? t("Bildschirm bleibt an") : t("Bildschirm darf sich sperren"));
      }}>
      {on ? <GlowBulb /> : <LightbulbOff size={18} />}
    </button>
  );
}
