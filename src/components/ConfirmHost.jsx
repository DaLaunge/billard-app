import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { registerConfirmListener } from "../lib/confirmDialog";

// Einmal in App.jsx gemountetes Popup fuer appConfirm() (siehe
// lib/confirmDialog.js) - ersetzt window.confirm() app-weit durch das
// bestehende modal-overlay/modal-box-Muster (siehe TurnierRasterScreen.jsx
// pendingReport), statt fuer jede der 16 bisherigen window.confirm()-Stellen
// eine eigene lokale Modal-Loesung zu bauen.
export default function ConfirmHost() {
  const [state, setState] = useState(null); // { message, resolve } | null

  useEffect(() => {
    registerConfirmListener((s) => setState(s));
    return () => registerConfirmListener(null);
  }, []);

  if (!state) return null;
  const finish = (result) => { state.resolve(result); setState(null); };

  return (
    <div className="modal-overlay" onClick={() => finish(false)}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <p style={{ marginBottom: 16 }}>{state.message}</p>
        <div className="sp-controls">
          <button className="btn ghost" onClick={() => finish(false)}>{t("Abbrechen")}</button>
          <button className="btn primary" onClick={() => finish(true)}>{t("Bestätigen")}</button>
        </div>
      </div>
    </div>
  );
}
