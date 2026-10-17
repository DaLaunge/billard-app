import { Timer, Pause, Play } from "lucide-react";
import { t } from "../../lib/i18n";

/* Spieldauer-Uhr im Ergebnis-Schritt: laeuft ab Beginn der Eingabe, mit
   Pause/Weiter (beschrifteter Knopf; waehrend der Pause sperrt MatchScreen die Eingabe). Reine Anzeige - der Zustand ({acc, since, paused}) gehoert
   MatchScreen und steht im Match-Entwurf, damit ein Neuladen die Zeit nicht
   verliert. */
export function formatClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function MatchClock({ elapsedMs, paused, onToggle }) {
  return (
    <div className={"match-clock" + (paused ? " paused" : "")}>
      <Timer size={16} />
      <span className="match-clock-time" aria-live="off">{formatClock(elapsedMs)}</span>
      <button type="button" className={"clock-pause-btn" + (paused ? " on" : "")} onClick={onToggle}
        title={paused ? t("Fortsetzen") : t("Pause")} aria-label={paused ? t("Fortsetzen") : t("Pause")}>
        {paused ? <Play size={16} /> : <Pause size={16} />} {paused ? t("Fortsetzen") : t("Pause")}
      </button>
    </div>
  );
}
