/* Einladungs-Code aus der URL (?ref=CODE) einmalig sichern.
   Übersteht den Magic-Link-Umweg über sessionStorage. */
function captureRef() {
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (ref) {
      sessionStorage.setItem("invite_ref", ref.trim());
      // Parameter aus der Adresszeile entfernen (sauberer Look)
      url.searchParams.delete("ref");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  } catch { /* ignore */ }
}
captureRef();
export const getRef = () => { try { return sessionStorage.getItem("invite_ref") || null; } catch { return null; } };
export const clearRef = () => { try { sessionStorage.removeItem("invite_ref"); } catch { /* */ } };

/* Schnellmatch-Code aus der URL (?vs=PLAYER_ID) einmalig sichern. */
function captureVs() {
  try {
    const url = new URL(window.location.href);
    const vs = url.searchParams.get("vs");
    if (vs) {
      sessionStorage.setItem("match_vs", vs.trim());
      url.searchParams.delete("vs");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  } catch { /* ignore */ }
}
captureVs();
export const getVs = () => { try { return sessionStorage.getItem("match_vs") || null; } catch { return null; } };
export const clearVs = () => { try { sessionStorage.removeItem("match_vs"); } catch { /* */ } };
