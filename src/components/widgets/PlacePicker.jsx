import { useState, useEffect, lazy, Suspense } from "react";
import { MapPin, X, Crosshair, Map as MapIcon, Plus } from "lucide-react";
import { t } from "../../lib/i18n";
import { useLocations, distanceM, reverseAddress, searchAddress, parseCoords } from "../../lib/locationStore";
import LocationPicker from "./LocationPicker";
import LocationForm from "./LocationForm";

const LocationMap = lazy(() => import("./LocationMap"));

const fmtDist = (m) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(m / 1000)} km`);

/* Ort wie bei "Live gehen" und "Planung" (VenueMask in VenueList.jsx), fuer Formulare, die den Ort als Lokal ODER Text speichern (Turnier):
   ein Lokal suchen/eintippen, "Mein Standort" (GPS) mit bekannten Lokalen in der Naehe (bis 300 m), die Karte zum Setzen per Tipp, eine
   getippte Adresse. Das Ergebnis geht als onChange(locId, text) an den Aufrufer: ein Lokal -> (id, null); Standort/Karte/Adresse -> (null, Adresse).
   Ein Lokal wird nie heimlich vorgewaehlt, der Standort allein genuegt. */
export default function PlacePicker({ locId, text, onChange, toast, me }) {
  const { list } = useLocations();
  const [near, setNear] = useState(null); // null = noch nicht abgefragt, sonst [{ l, d }]
  const [here, setHere] = useState(null); // eigene Position { lat, lng }
  const [addr, setAddr] = useState(null); // Adresse dazu, "" = keine gefunden, null = wird gesucht
  const [locating, setLocating] = useState(false);
  const [acc, setAcc] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [gps, setGps] = useState(false); // Position kommt vom GPS (sonst Karte/Koordinaten)
  const [newVenue, setNewVenue] = useState(false); // eigene Position als neues Lokal speichern
  const known = list.filter((l) => l.lat != null && (l.status === "approved" || l.created_by === me?.id || me?.role === "admin"));

  // Standort/Karte -> Text fuer den Aufrufer, sobald die Adresse da ist (sonst die Koordinaten)
  useEffect(() => {
    if (!here || locId || addr === null) return;
    onChange(null, addr || `${here.lat.toFixed(5)}, ${here.lng.toFixed(5)}`);
  }, [here, addr]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyPos = (p, address) => {
    setHere(p);
    if (address !== undefined) setAddr(address);
    else { setAddr(null); reverseAddress(p.lat, p.lng).then((a) => setAddr(a || "")); }
    setNear(known.map((l) => ({ l, d: distanceM(p, l) })).filter((x) => x.d <= 300).sort((a, b) => a.d - b.d));
    onChange(null, "");
  };
  const clearOwn = () => { setNewVenue(false); setHere(null); setAddr(null); setNear(null); setAcc(null); setShowMap(false); onChange(null, ""); };
  const findMe = () => {
    if (!navigator.geolocation) { toast?.(t("Dein Gerät kann den Standort nicht bestimmen.")); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setGps(true); setAcc(Math.round(p.coords.accuracy || 0)); applyPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); },
      () => { setLocating(false); toast?.(t("Standort nicht verfügbar – gib unten eine Adresse oder ein Lokal ein.")); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };
  // getippter Ort: gehoert er zu einem bekannten Lokal (bis 100 m), wird gleich dieses gewaehlt
  const useText = async (txt) => {
    const c = parseCoords(txt); // nur Koordinaten getippt (z. B. 48.2082, 16.3738): wie ein Tipp auf die Karte
    if (c) { setGps(false); setAcc(null); applyPos(c); return; }
    let hit = null;
    try { hit = (await searchAddress(txt))[0] || null; } catch { /* ohne Position weiter */ }
    if (hit) {
      const p = { lat: hit.lat, lng: hit.lng };
      const k = known.map((l) => ({ l, d: distanceM(p, l) })).filter((x) => x.d <= 100).sort((a, b) => a.d - b.d)[0];
      if (k) { onChange(k.l.id, null); toast?.(t("Dort gibt es schon ein Lokal: {name}.", { name: k.l.name })); return; }
    }
    setHere(null); setNear(null); onChange(null, txt);
  };
  const pickVenue = (id) => { setNewVenue(false); setHere(null); setNear(null); setAddr(null); setAcc(null); onChange(id, null); };
  const hasOwn = !locId && (here || text);

  return (
    <div className="place-picker">
      <div className="venue-here-row">
        <button type="button" className="icon-btn small" onClick={findMe} disabled={locating} aria-label={t("Mein Standort")} title={t("Mein Standort")}><Crosshair size={16} /></button>
        <button type="button" className={"icon-btn small" + (showMap ? " primary" : "")} onClick={() => setShowMap((v) => !v)} aria-label={t("Karte")} title={t("Karte")}><MapIcon size={16} /></button>
        <div className="venue-picker-inline">
          <LocationPicker value={locId} onChange={pickVenue} toast={toast} me={me} onUseText={useText} pos={here ? { lat: here.lat, lng: here.lng, address: addr || "" } : null} placeholder={t("Lokal oder Adresse suchen oder eingeben")} />
        </div>
      </div>
      {locating && !here && <span className="rank-meta">{t("Standort wird gesucht …")}</span>}
      {near && near.length > 0 && (
        <div className="venue-here-row">
          {near.map(({ l, d }) => (
            <button key={l.id} type="button" className="chip-btn" onClick={() => pickVenue(l.id)}>
              <MapPin size={14} /> {l.name}<span className="rank-meta"> · {fmtDist(d)}</span>
            </button>
          ))}
        </div>
      )}
      {hasOwn && (
        <div className="loc-sel">
          <MapPin size={18} className="loc-sel-ico" />
          <div className="loc-sel-txt">
            <b>{here ? (gps ? t("Mein Standort") : t("Gewählter Punkt")) : text}</b>
            {here && <span className="rank-meta">{addr === null ? t("Adresse wird gesucht …") : addr || `${here.lat.toFixed(5)}, ${here.lng.toFixed(5)}`}</span>}
          </div>
          {here && <button type="button" className={"icon-btn small" + (newVenue ? " primary" : "")} onClick={() => setNewVenue((v) => !v)} aria-label={t("Als neues Lokal speichern")} title={t("Als neues Lokal speichern")}><Plus size={16} /></button>}
          <button type="button" className="icon-btn small" onClick={clearOwn} aria-label={t("Anderer Ort")} title={t("Anderer Ort")}><X size={16} /></button>
        </div>
      )}
      {here && newVenue && (
        <div className="loc-panel">
          <LocationForm initialPos={{ lat: here.lat, lng: here.lng, address: addr || "" }} toast={toast}
            onCancel={() => setNewVenue(false)} onSaved={(id) => { setNewVenue(false); if (id) pickVenue(id); }} />
        </div>
      )}
      {showMap && (
        <>
          <Suspense fallback={<div className="loc-map" />}>
            <LocationMap pos={here} onPick={(p) => { setGps(false); setAcc(null); applyPos(p); }} />
          </Suspense>
          <p className="hint" style={{ margin: 0 }}>{t("Karte antippen, um den Standort zu setzen – der Marker lässt sich ziehen.")}</p>
        </>
      )}
      {acc != null && acc > 100 && <p className="hint">{t("Genauigkeit ca. {m} m – bei Bedarf auf der Karte korrigieren.", { m: acc })}</p>}
    </div>
  );
}
