import { Lightbulb, LightbulbOff } from "lucide-react";
import { t } from "../../lib/i18n";
import { wakeLockSupported } from "../../lib/wakeLock";

/* Schnellschalter "Bildschirm bleibt an" im Kopf der Live-Eingabe-Screens
   (Match, Winner-Stays). Gilt nur fuer die laufende Eingabe - der dauerhafte
   Standard steht im Profil unter Einstellungen (siehe App.jsx,
   keepAwakeDefault/keepAwakeNow).

   Kann das Geraet gar keinen Wake Lock (iOS vor Safari 16.4), erscheint der
   Knopf nicht: ein Schalter, der sichtbar nichts bewirkt, ist schlechter als
   gar keiner. */
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
      {on ? <Lightbulb size={18} /> : <LightbulbOff size={18} />}
    </button>
  );
}
