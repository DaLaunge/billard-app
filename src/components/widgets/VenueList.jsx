import { useState, useEffect } from "react";
import { MapPin, Search, Radio, Calendar, Plus, Check } from "lucide-react";
import { t } from "../../lib/i18n";
import { supabase } from "../../supabase";
import { useLocations, loadLocations } from "../../lib/locationStore";
import RouteButton from "./RouteButton";
import LocationForm from "./LocationForm";

/* Alle Lokale auf einen Blick, mit Suche: Der schnelle Weg zu einer Planung ueber den ORT. Pro Lokal zwei Knoepfe
   ("Live" / "Planung"), die das jeweilige Formular mit diesem Lokal vorbelegt oeffnen. Der andere Weg (erst Live/Planung,
   Lokal dort optional waehlen) bleibt in den Formularen selbst. */
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const SHOWN = 30;

export default function VenueList({ me, onLive, onPlan, liveBusy, toast }) {
  const { list, confirms } = useLocations();
  const [busy, setBusy] = useState(null);
  const [q, setQ] = useState("");
  // Neues Lokal: Formular klappt unter der Suche auf (Name aus der Suche, wenn getippt; sonst eigenes Namensfeld)
  const [adding, setAdding] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (adding) { setMounted(true); return undefined; }
    const id = setTimeout(() => setMounted(false), 350);
    return () => clearTimeout(id);
  }, [adding]);
  // Noch offene Lokale anderer sieht man hier zum Bestaetigen (zwei Bestaetigungen geben sie frei)
  const visible = list
    .sort((a, b) => a.name.localeCompare(b.name));
  const nq = norm(q);
  const found = nq ? visible.filter((l) => norm(`${l.name} ${l.address || ""}`).includes(nq)) : visible;
  const rows = found.slice(0, SHOWN);
  const count = (id) => confirms.filter((c) => c.location_id === id).length;
  const done = (id) => confirms.some((c) => c.location_id === id && c.player_id === me?.id);
  const usable = (l) => l.status === "approved" || l.created_by === me?.id || me?.role === "admin";
  const confirm = async (l) => {
    setBusy(l.id);
    const { data, error } = await supabase.rpc("confirm_location", { p_id: l.id });
    setBusy(null);
    if (error) { toast?.(t("Fehler: ") + error.message); return; }
    toast?.(data >= 2 ? t("Danke! „{name}“ ist jetzt freigegeben.", { name: l.name }) : t("Danke fürs Bestätigen!"));
    loadLocations(true);
  };

  return (
    <>
      <div className="search-row">
        <Search size={16} className="mail-ico" />
        <input placeholder={t("Lokal suchen …")} value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} />
      </div>
      <button type="button" className="btn ghost small" onClick={() => { if (!adding) setFormKey((k) => k + 1); setAdding((v) => !v); }} aria-expanded={adding}>
        <Plus size={15} /> {t("Neues Lokal anlegen")}
      </button>
      <div className={"collapsible" + (adding ? " open" : "")} inert={adding ? undefined : ""}>
        <div className="collapsible-inner">
          <div className="loc-panel">
            {mounted && (
              <LocationForm key={formKey} fixedName={nq.length >= 2 ? q.trim() : undefined} toast={toast}
                onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); setQ(""); }} />
            )}
          </div>
        </div>
      </div>
      {visible.length === 0 && <p className="hint center">{t("Noch kein Lokal eingetragen – leg das erste bei „Live“ oder „Planung“ an.")}</p>}
      {visible.length > 0 && found.length === 0 && <p className="hint center">{t("Kein Lokal gefunden.")}</p>}
      <div className="venue-list">
        {rows.map((l) => (
          <div key={l.id} className="venue-row">
            <div className="loc-sel-txt">
              <b><MapPin size={14} /> {l.name}{l.status === "pending" ? " ⏳" : ""}</b>
              {l.address && <span className="rank-meta">{l.address}</span>}
              {l.status === "pending" && <span className="rank-meta">{count(l.id)}/2 {t("bestätigt")}</span>}
            </div>
            <RouteButton place={l} size={15} />
            {l.status === "pending" && l.created_by !== me?.id && (done(l.id)
              ? <span className="loc-review-done"><Check size={14} /> {t("Bestätigt")}</span>
              : <button type="button" className="chip-btn ok" disabled={busy === l.id} onClick={() => confirm(l)}><Check size={14} /> {t("Stimmt")}</button>)}
            {usable(l) && onLive && !liveBusy && (
              <button type="button" className="chip-btn" onClick={() => onLive(l.id)} title={t("Hier live gehen")} aria-label={t("Hier live gehen")}>
                <Radio size={14} /> {t("Live")}
              </button>
            )}
            {usable(l) && onPlan && (
              <button type="button" className="chip-btn" onClick={() => onPlan(l.id)} title={t("Hier einen Termin planen")} aria-label={t("Hier einen Termin planen")}>
                <Calendar size={14} /> {t("Planung")}
              </button>
            )}
          </div>
        ))}
      </div>
      {found.length > SHOWN && <p className="hint center">{t("{n} weitere – Suche eingrenzen.", { n: found.length - SHOWN })}</p>}
    </>
  );
}
