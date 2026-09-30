/* EIN Code fuer zwei Zwecke (Nutzer-Feedback 2026-09-30: "der QR-Code koennte
   eine Doppelfunktion haben: wenn ein nicht registrierter Spieler scannt,
   zaehlt es wie eine Einladung; wenn ein registrierter scannt, funktioniert es
   wie ein 'Spieler hinzufuegen'").

   Der Link traegt beide Parameter: ?ref=<Einladungscode> und ?vs=<Spieler-id>.
   Wer noch kein Konto hat, landet bei der Anmeldung, der Code wird beim
   Registrieren gutgeschrieben (session.js, captureRef); wer schon angemeldet
   ist, bekommt das Match gegen den Code-Zeiger vorbereitet (captureVs + App.jsx).
   Beide Parameter lesen unabhaengig voneinander - fehlt einer, gilt nur der
   andere. */
export function myCodeLink(code, meId) {
  const u = new URL("/", window.location.origin);
  if (code) u.searchParams.set("ref", code);
  if (meId) u.searchParams.set("vs", meId);
  return u.toString();
}
