import { useState, lazy, Suspense } from "react";
import { Search, LocateFixed, Check, X, ExternalLink, MapPin } from "lucide-react";
import { supabase } from "../../supabase";
import { t } from "../../lib/i18n";
import { loadLocations, useLocations, distanceM, parseCoords, searchAddress, reverseAddress, mapUrl } from "../../lib/locationStore";

const LocationMap = lazy(() => import("./LocationMap"));

/* Standort anlegen oder korrigieren. Niemand muss Koordinaten tippen: Adresse suchen (OpenStreetMap), "Mein Standort"
   (GPS) oder Koordinaten aus Google Maps einfuegen. Liegt schon ein Standort im Umkreis von 100 m, wird er stattdessen
   vorgeschlagen (keine Doppelten mit leicht anderem Namen). */
export default function LocationForm({ initial, onSaved, onCancel, toast }) {
  const { list } = useLocations();
  const [name, setName] = useState(initial?.name || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [pos, setPos] = useState(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [coordText, setCoordText] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);

  const nearby = pos ? list.find((l) => l.id !== initial?.id && distanceM(l, pos) < 100) : null;

  const search = async () => {
    const q = address.trim();
    if (q.length < 3) return;
    setBusy(true);
    try { setResults(await searchAddress(q)); } catch { toast(t("Adresssuche gerade nicht erreichbar.")); setResults([]); }
    setBusy(false);
  };
  const pick = (r) => {
    setPos({ lat: r.lat, lng: r.lng });
    setAddress(r.label.split(", ").slice(0, 4).join(", "));
    if (!name.trim() && r.name) setName(r.name);
    setResults(null);
  };
  const gps = () => {
    if (!navigator.geolocation) { toast(t("Dieses Gerät kann den Standort nicht bestimmen.")); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }); setBusy(false); },
      () => { toast(t("Standort nicht verfügbar – Zugriff erlauben oder Adresse suchen.")); setBusy(false); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };
  // Tippen/Ziehen auf der Karte: Position uebernehmen und die Adresse dazu nachschlagen
  const onMapPick = async (p) => {
    setPos(p); setCoordText("");
    const a = await reverseAddress(p.lat, p.lng);
    if (a) setAddress(a);
  };
  const onCoords = (v) => { setCoordText(v); const c = parseCoords(v); if (c) setPos(c); };

  const save = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("save_location", {
      p_id: initial?.id || null, p_name: name, p_address: address.trim() || null, p_lat: pos.lat, p_lng: pos.lng,
    });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    await loadLocations(true);
    toast(initial ? t("Standort geändert.") : t("Standort gespeichert."));
    onSaved?.(data);
  };

  return (
    <div className="loc-form">
      <div className="search-row">
        <MapPin size={16} className="mail-ico" />
        <input placeholder={t("Name, z. B. Billardcafe Mitte")} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="search-row">
        <Search size={16} className="mail-ico" />
        <input placeholder={t("Adresse suchen, z. B. Praterstraße 1, Wien")} value={address} maxLength={200}
          onChange={(e) => setAddress(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} />
        <button type="button" className="icon-btn small" onClick={search} disabled={busy || address.trim().length < 3}
          aria-label={t("Adresse suchen")} title={t("Adresse suchen")}><Search size={16} /></button>
        <button type="button" className="icon-btn small" onClick={gps} disabled={busy}
          aria-label={t("Mein Standort")} title={t("Mein Standort")}><LocateFixed size={16} /></button>
      </div>
      {results && (
        <div className="loc-results">
          {results.length === 0 && <p className="hint">{t("Nichts gefunden – Adresse genauer eingeben oder Koordinaten einfügen.")}</p>}
          {results.map((r, i) => (
            <button key={i} type="button" className="loc-result" onClick={() => pick(r)}>{r.label}</button>
          ))}
        </div>
      )}
      <Suspense fallback={<div className="loc-map" />}>
        <LocationMap pos={pos} onPick={onMapPick} />
      </Suspense>
      <p className="hint" style={{ margin: 0 }}>{t("Karte antippen, um den Standort zu setzen – der Marker lässt sich ziehen.")}</p>
      <div className="search-row">
        <input placeholder={t("oder Koordinaten aus Google Maps einfügen: 48.2082, 16.3738")} value={coordText} onChange={(e) => onCoords(e.target.value)} />
      </div>
      {pos && (
        <p className="hint loc-pos">
          <Check size={14} /> {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}{" "}
          <a href={mapUrl(pos.lat, pos.lng)} target="_blank" rel="noreferrer"><ExternalLink size={13} /> {t("Auf der Karte prüfen")}</a>
        </p>
      )}
      {nearby && (
        <div className="loc-near">
          {t("Hier gibt es schon einen Standort: {name}. Meinst du den?", { name: nearby.name })}
          <button type="button" className="chip-btn ok" onClick={() => onSaved?.(nearby.id)}><Check size={15} /> {t("Diesen nehmen")}</button>
        </div>
      )}
      <div className="sp-controls">
        <button type="button" className="btn ghost" onClick={onCancel}><X size={15} /> {t("Abbrechen")}</button>
        <button type="button" className="btn primary" disabled={busy || !pos || name.trim().length < 2} onClick={save}>
          <Check size={16} /> {t("Speichern")}
        </button>
      </div>
      {!initial && <p className="hint">{t("Neue Standorte sind für andere erst nach Freigabe durch einen Admin sichtbar.")}</p>}
    </div>
  );
}
