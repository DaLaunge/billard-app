/* Duenner Fortschrittsbalken (3px) fuer Erfolge und Erfolgskategorien.

   Bewusst aria-hidden: an JEDER Stelle, an der er vorkommt, steht die
   gleiche Information schon als Text daneben ("5 / 29", "Fortschritt:
   12 / 25 Matches", "noch 1 Spiel"). Der Balken ist die schnelle
   Zweitlesung fuers Auge, keine eigene Aussage - ein zusaetzliches
   role="progressbar" wuerde Screenreader-Nutzern dieselbe Zahl ein
   zweites Mal vorlesen.

   Kostet 3px Hoehe und ersetzt keine Zeile - genau deshalb passt er zur
   Regel "Bedienelemente und Deko klein halten, Inhalt dominieren lassen". */
export default function ProgressBar({ current, target, className = "" }) {
  // Bei einem Ziel von 1 ("dein ERSTER zweiter Platz") gibt es keinen
  // Fortschritt, nur an oder aus - ein Balken, der garantiert leer ist,
  // solange man den Erfolg sieht, ist reine Deko. Solche Zeilen bleiben
  // beim Text.
  if (!(target > 1)) return null;
  const roh = Math.max(0, Math.min(100, Math.round((current / target) * 100)));
  // Ein angefangener Fortschritt soll auch sichtbar sein: 1 von 100 waere
  // sonst auf 1% gerundet und bei 3px Hoehe schlicht nicht zu erkennen.
  const pct = current > 0 && roh < 3 ? 3 : roh;
  return (
    <span className={"progress-bar" + (className ? " " + className : "")} aria-hidden="true">
      <span className="progress-bar-fill" style={{ width: pct + "%" }} />
    </span>
  );
}
