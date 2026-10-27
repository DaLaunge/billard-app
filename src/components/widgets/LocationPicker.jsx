import { useState, useEffect } from "react";
import { MapPin, Plus, Pencil, Navigation, X, Search } from "lucide-react";
import { t } from "../../lib/i18n";
import { useLocations, routeUrl } from "../../lib/locationStore";
import LocationForm from "./LocationForm";

/* Lokal TIPPEN und AUSWAEHLEN: Der Name wird getippt, passende Lokale erscheinen darunter zum Antippen. Gibt es das Lokal
   noch nicht, bietet die letzte Zeile an, es gleich anzulegen (Name bleibt uebernommen). Das Gewaehlte zeigt Adresse,
   Routen-Knopf und einen Stift zum Korrigieren; das X hebt die Auswahl auf. */
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export default function LocationPicker({ value, onChange, toast, me }) {
  const { list } = useLocations();
  const [mode, setMode] = useState(null); // null | "new" | "edit"
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const visible = list.filter((l) => l.status === "approved" || l.created_by === me?.id || me?.role === "admin");
  const sel = list.find((l) => l.id === value);
  // Das Formular klappt unter dem Feld auf (kein Seitenwechsel) und bleibt waehrend des Zuklappens gemountet.
  const [formMounted, setFormMounted] = useState(false);
  const [formMode, setFormMode] = useState("new");
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (mode) { setFormMode(mode); setFormMounted(true); return undefined; }
    const id = setTimeout(() => setFormMounted(false), 350);
    return () => clearTimeout(id);
  }, [mode]);
  const openForm = (m) => { setFormKey((k) => k + 1); setMode(m); };

  const formPanel = (
    <div className={"collapsible" + (mode ? " open" : "")} inert={mode ? undefined : ""}>
      <div className="collapsible-inner">
        <div className="loc-panel">
          {formMounted && (
            <LocationForm key={formKey} initial={formMode === "edit" ? sel : null} fixedName={formMode === "new" ? q : undefined} toast={toast}
              onCancel={() => setMode(null)} onSaved={(id) => { setMode(null); setQ(""); if (id) onChange(id); }} />
          )}
        </div>
      </div>
    </div>
  );

  if (sel) {
    return (
      <>
      <div className="loc-sel">
        <MapPin size={18} className="loc-sel-ico" />
        <div className="loc-sel-txt">
          <b>{sel.name}</b>
          {sel.address && <span className="rank-meta">{sel.address}</span>}
          {sel.status === "pending" && <span className="rank-meta">{t("wartet auf Freigabe – nur für dich sichtbar")}</span>}
        </div>
        <a className="icon-btn small" href={routeUrl(sel)} target="_blank" rel="noreferrer" aria-label={t("Route in Google Maps")} title={t("Route in Google Maps")}><Navigation size={16} /></a>
        <button type="button" className="icon-btn small" onClick={() => (mode ? setMode(null) : openForm("edit"))} aria-label={t("Standort korrigieren")} title={t("Standort korrigieren")}><Pencil size={15} /></button>
        <button type="button" className="icon-btn small" onClick={() => { setMode(null); onChange(null); }} aria-label={t("Anderes Lokal")} title={t("Anderes Lokal")}><X size={16} /></button>
      </div>
      {formPanel}
      </>
    );
  }

  const nq = norm(q);
  const matches = (nq ? visible.filter((l) => norm(l.name).includes(nq)) : visible).slice(0, 6);
  const exact = visible.some((l) => norm(l.name) === nq);
  const open = focus || nq.length > 0;
  return (
    <div className="loc-picker">
      <div className="search-row">
        <Search size={16} className="mail-ico" />
        <input placeholder={t("Lokal suchen oder eingeben, z. B. Billardcafe Mitte")} value={q} maxLength={60}
          onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className={"collapsible" + (open && !mode ? " open" : "")} inert={open && !mode ? undefined : ""}>
       <div className="collapsible-inner">
        <div className="loc-results">
          {matches.map((l) => (
            <button key={l.id} type="button" className="loc-result" onClick={() => { onChange(l.id); setQ(""); }}>
              <MapPin size={13} /> <b>{l.name}</b>{l.address ? <span className="rank-meta"> · {l.address}</span> : null}{l.status === "pending" ? " ⏳" : ""}
            </button>
          ))}
          {nq.length >= 2 && !exact && (
            <button type="button" className="loc-result loc-new" onClick={() => openForm("new")}>
              <Plus size={14} /> {t("„{name}“ als neues Lokal anlegen", { name: q.trim() })}
            </button>
          )}
          {nq.length < 2 && visible.length === 0 && <p className="hint">{t("Noch kein Lokal – Namen eintippen, um das erste anzulegen.")}</p>}
        </div>
       </div>
      </div>
      {formPanel}
    </div>
  );
}
