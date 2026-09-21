/* Einladungs-Code aus der URL (?ref=CODE) sichern, bis die Registrierung
   durch ist.

   WICHTIG: localStorage, NICHT sessionStorage. sessionStorage gilt pro Tab,
   und genau daran ist die Werbe-Zuordnung bisher immer gescheitert: wer den
   QR-Code scannt, landet in Tab A, fordert dort den Magic-Link an und tippt
   ihn dann in der Mail-App an - die oeffnet einen NEUEN Tab (oft sogar ein
   eigenes In-App-Webview). Dort war der Code weg, register_player() bekam
   p_ref = null, players.invited_by blieb leer und die recruit-Erfolge konnten
   nie ausloesen. localStorage ueberlebt den Tabwechsel; zusaetzlich haengt
   LoginScreen den Code an die Rueckkehradresse des Magic-Links, damit auch
   ein komplett anderer Browser ihn noch mitbekommt.

   Ablaufdatum, damit ein nie eingeloester Code nicht ewig liegen bleibt und
   Monate spaeter eine fremde Registrierung faelschlich jemandem gutschreibt. */
const REF_KEY = "invite_ref";
const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage

function storeRef(code) {
  try {
    localStorage.setItem(REF_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch { /* ignore */ }
}

function captureRef() {
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (ref) {
      storeRef(ref.trim());
      // Parameter aus der Adresszeile entfernen (sauberer Look)
      url.searchParams.delete("ref");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  } catch { /* ignore */ }
}
captureRef();

export const getRef = () => {
  try {
    const raw = localStorage.getItem(REF_KEY);
    if (raw) {
      const { code, at } = JSON.parse(raw);
      if (code && Date.now() - at < REF_TTL_MS) return code;
      localStorage.removeItem(REF_KEY);
    }
    // Uebergangsweise: Codes, die vor dem Umbau noch im sessionStorage liegen.
    return sessionStorage.getItem(REF_KEY) || null;
  } catch { return null; }
};

export const clearRef = () => {
  try { localStorage.removeItem(REF_KEY); } catch { /* */ }
  try { sessionStorage.removeItem(REF_KEY); } catch { /* */ }
};

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
