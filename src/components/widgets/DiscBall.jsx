import { poolBallStyle, DISC_BALL } from "../../lib/pool";
import { t } from "../../lib/i18n";

/* Die Disziplin als Billardkugel statt als Kuerzel ("8B", "9B", ...).
   Nutzer-Feedback 2026-09-30: "verwende bei den Turnieren statt langweiligen
   Zahlen die entsprechenden Billardkugeln als Hinweis fuer die Disziplin ...
   Verwende dieselben Graphiken" wie beim 14/1-Protokoll - deshalb kommt die
   Kugel aus derselben Quelle (poolBallStyle in lib/pool.js) und dieselben
   Klassen (.pool-ball/.pb-no), nur skalierbar und nicht klickbar.

   8 Ball -> Kugel 8 (schwarz), 9 Ball -> 9 (gelb gestreift), 10 Ball -> 10
   (blau gestreift), 14/1 Endlos -> 14 (gruen gestreift).

   Der Name der Disziplin bleibt als title/aria-label erhalten: eine Kugel
   allein sagt Vorlesehilfen nichts, und ein laengeres Antippen zeigt ihn.
   Eine Disziplin ohne Kugel (z.B. "Gesamt") faellt auf den Text zurueck,
   statt eine leere Stelle zu hinterlassen. */
export default function DiscBall({ disc, size = 18 }) {
  const n = DISC_BALL[disc];
  if (n == null) return <span>{t(disc)}</span>;
  return (
    <span className="pool-ball disc-ball" role="img" aria-label={t(disc)} title={t(disc)}
      style={{ ...poolBallStyle(n), width: size, height: size }}>
      {/* Nummer nur, wo sie noch lesbar ist - unter ~14px ist sie ein Fleck. */}
      {size >= 14 && <span className="pb-no" style={{ fontSize: Math.max(6, Math.round(size * 0.34)) }}>{n}</span>}
    </span>
  );
}
