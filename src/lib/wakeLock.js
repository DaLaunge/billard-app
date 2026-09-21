import { useEffect } from "react";

/* Bildschirm waehrend der Match-Eingabe wachhalten (Screen Wake Lock API).

   Waehrend eines Spiels liegt das Handy meist unberuehrt auf dem Tisch,
   waehrend am Tisch gespielt wird - ohne Wake Lock schaltet es sich nach
   Sekunden ab und muss vor jedem Aufnahme-/Punkteeintrag erst wieder
   entsperrt werden.

   Zwei Eigenheiten der API, die beide beachtet sein wollen:

   1. Der Lock wird vom Browser AUTOMATISCH freigegeben, sobald die Seite in
      den Hintergrund geht (Tab-Wechsel, Bildschirm aus, App weggewischt).
      Er kommt danach NICHT von selbst zurueck - darum die Neuanforderung
      beim visibilitychange zurueck auf "visible".
   2. request() ist asynchron und kann abgelehnt werden (kein Browser-
      Support, Batteriesparmodus, Seite nicht sichtbar). Kein Support ist
      der Normalfall auf aelteren iOS-Versionen (erst ab Safari 16.4) - das
      ist kein Fehler, die App verhaelt sich dann einfach wie vorher.

   Der Lock haelt nur, solange `active` gilt; beim Verlassen des Screens wird
   er sofort freigegeben, damit der Bildschirm nicht ueber das Match hinaus
   anbleibt. */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !navigator.wakeLock) return;

    let sentinel = null;
    // Der Effekt kann aufgeraeumt werden, WAEHREND ein request() noch laeuft
    // (schneller Screenwechsel) - ohne dieses Flag bliebe der danach
    // eintreffende Lock fuer immer liegen.
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || sentinel || document.visibilityState !== "visible") return;
      try {
        const s = await navigator.wakeLock.request("screen");
        if (cancelled) { s.release().catch(() => {}); return; }
        sentinel = s;
        // Vom Browser selbst freigegeben (siehe 1.) - merken, damit die
        // naechste Anforderung nicht an "sentinel ist schon gesetzt"
        // scheitert.
        s.addEventListener("release", () => { if (sentinel === s) sentinel = null; });
      } catch { /* nicht unterstuetzt oder abgelehnt - dann eben nicht */ }
    };

    const onVisibility = () => { if (document.visibilityState === "visible") acquire(); };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (sentinel) { sentinel.release().catch(() => {}); sentinel = null; }
    };
  }, [active]);
}

/* Nutzereinstellung "Bildschirm waehrend eines Matches anlassen".

   Bewusst in localStorage und nicht im Profil (players-Tabelle): das ist eine
   Geraete-Eigenschaft, keine Kontoeinstellung - wer am Tisch das Handy neben
   sich liegen hat, will es dort an haben, am PC ist es egal. Gleiche Logik wie
   beim Update-Intervall.

   Standard ist AN: wer nichts einstellt, bekommt das Verhalten, das waehrend
   eines Matches am wenigsten stoert. Nur ein ausdrueckliches "aus" wird
   gespeichert, darum der Vergleich gegen "0" statt auf "1". */
const KEEP_AWAKE_KEY = "keepScreenAwake";

export function getKeepAwake() {
  try { return localStorage.getItem(KEEP_AWAKE_KEY) !== "0"; } catch { return true; }
}

export function storeKeepAwake(on) {
  try { localStorage.setItem(KEEP_AWAKE_KEY, on ? "1" : "0"); } catch { /* ignore */ }
}

/* Unterstuetzt das Geraet die Wake Lock API ueberhaupt? (iOS erst ab Safari
   16.4). Wird genutzt, um den Schnellschalter im Match gar nicht erst
   anzuzeigen, wo er ohnehin nichts bewirken wuerde. */
export function wakeLockSupported() {
  try { return !!navigator.wakeLock; } catch { return false; }
}
