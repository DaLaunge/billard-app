// Ausfallsicherheit fuers Melden eines Matches ohne Internetverbindung:
// Der Report wird lokal zwischengespeichert und automatisch nachgesendet,
// sobald wieder eine Verbindung besteht. Aendert nichts an der eigentlichen
// Bestaetigungslogik (RPCs bleiben identisch) - nur der Versand wird robuster.
import { supabase } from "../supabase";

const KEY = "pendingMatchReport";

export function isNetworkError(error) {
  if (!error) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return /fetch|network|load failed/i.test(error.message || "");
}

export function savePendingReport(report) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...report, savedAt: Date.now() })); } catch { /* ignore */ }
}

export function getPendingReport() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearPendingReport() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Versucht, ein zwischengespeichertes Match zu senden. Gibt null zurueck,
// wenn nichts wartet, sonst { ok, data, error, report }.
export async function sendPendingReport() {
  const report = getPendingReport();
  if (!report) return null;
  const fn = report.type === "double" ? "report_doubles" : report.type === "tournament" ? report.rpc : "report_match";
  const { data, error } = await supabase.rpc(fn, report.params);
  if (error) return { ok: false, error, report };
  clearPendingReport();
  return { ok: true, data, report };
}
