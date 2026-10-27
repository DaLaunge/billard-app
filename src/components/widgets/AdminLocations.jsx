import { useState } from "react";
import { MapPin, Check, Pencil, Trash2, Navigation, Plus } from "lucide-react";
import { supabase } from "../../supabase";
import { t } from "../../lib/i18n";
import { appConfirm } from "../../lib/confirmDialog";
import { useLocations, loadLocations, routeUrl } from "../../lib/locationStore";
import LocationForm from "./LocationForm";

/* Verwaltung: alle Standorte (auch noch nicht freigegebene) pruefen, freigeben, korrigieren, loeschen. */
export default function AdminLocations({ players, toast }) {
  const { list } = useLocations();
  const [editId, setEditId] = useState(null); // id | "new" | null
  const nick = (id) => players.find((p) => p.id === id)?.nickname;
  const rows = [...list].sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || a.name.localeCompare(b.name));

  const call = async (fn, args, msg) => {
    const { error } = await supabase.rpc(fn, args);
    if (error) toast(t("Fehler: ") + error.message); else toast(msg);
    loadLocations(true);
  };
  const remove = async (l) => {
    if (await appConfirm(t("Standort „{name}“ löschen? Bestehende Live-Einträge behalten ihren Namen.", { name: l.name }))) {
      call("delete_location", { p_id: l.id }, t("Standort gelöscht."));
    }
  };

  return (
    <div className="admin-locs">
      {rows.length === 0 && <p className="hint">{t("Noch keine Standorte.")}</p>}
      {rows.map((l) => (
        <div key={l.id} className="admin-loc-row">
          {editId === l.id ? (
            <LocationForm initial={l} toast={toast} onCancel={() => setEditId(null)} onSaved={() => setEditId(null)} />
          ) : (
            <>
              <div className="loc-sel-txt">
                <b><MapPin size={14} /> {l.name}{l.status === "pending" ? " ⏳" : ""}</b>
                {l.address && <span className="rank-meta">{l.address}</span>}
                <span className="rank-meta">
                  {l.status === "pending" ? t("Vorschlag von {n}", { n: nick(l.created_by) || "?" }) : (l.updated_by ? t("zuletzt geändert von {n}", { n: nick(l.updated_by) || "?" }) : "")}
                </span>
              </div>
              <div className="admin-loc-actions">
                {l.status === "pending" && (
                  <button type="button" className="icon-btn small primary" onClick={() => call("approve_location", { p_id: l.id }, t("Standort freigegeben."))}
                    aria-label={t("Freigeben")} title={t("Freigeben")}><Check size={16} /></button>
                )}
                <a className="icon-btn small" href={routeUrl(l)} target="_blank" rel="noreferrer" aria-label={t("Route in Google Maps")} title={t("Route in Google Maps")}><Navigation size={15} /></a>
                <button type="button" className="icon-btn small" onClick={() => setEditId(l.id)} aria-label={t("Standort korrigieren")} title={t("Standort korrigieren")}><Pencil size={15} /></button>
                <button type="button" className="icon-btn small" onClick={() => remove(l)} aria-label={t("Löschen")} title={t("Löschen")}><Trash2 size={15} /></button>
              </div>
            </>
          )}
        </div>
      ))}
      {editId === "new" ? (
        <LocationForm toast={toast} onCancel={() => setEditId(null)} onSaved={() => setEditId(null)} />
      ) : (
        <button type="button" className="btn ghost small" onClick={() => setEditId("new")}><Plus size={15} /> {t("Neuer Standort")}</button>
      )}
    </div>
  );
}
