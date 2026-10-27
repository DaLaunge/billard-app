import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { t } from "../../lib/i18n";

/* Karte zum Waehlen des Standorts (OpenStreetMap + Leaflet, ohne API-Schluessel). Tippen setzt den Marker, der Marker
   laesst sich ziehen; `pos` von aussen (Adresssuche, GPS) verschiebt Marker und Ausschnitt. Wird von LocationForm per
   React.lazy geladen, damit Leaflet nur beim Oeffnen des Formulars geholt wird. */
const DEFAULT = { lat: 48.2082, lng: 16.3738 }; // Wien
const pin = L.divIcon({ className: "loc-pin", html: "<span></span>", iconSize: [26, 26], iconAnchor: [13, 26] });

export default function LocationMap({ pos, onPick }) {
  const el = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const cb = useRef(onPick);
  cb.current = onPick;

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(pos || DEFAULT, pos ? 16 : 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "© <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\" rel=\"noreferrer\">OpenStreetMap</a>",
    }).addTo(m);
    const put = (ll) => {
      if (marker.current) marker.current.setLatLng(ll);
      else {
        marker.current = L.marker(ll, { icon: pin, draggable: true }).addTo(m);
        marker.current.on("dragend", () => { const p = marker.current.getLatLng(); cb.current({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) }); });
      }
    };
    if (pos) put(pos);
    m.on("click", (e) => { put(e.latlng); cb.current({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }); });
    map.current = m;
    map.current.__put = put;
    setTimeout(() => m.invalidateSize(), 50);
    return () => { m.remove(); map.current = null; marker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Position kam von aussen (Suche/GPS/Koordinaten-Feld): Marker und Ausschnitt nachziehen
  useEffect(() => {
    const m = map.current;
    if (!m || !pos) return;
    const cur = marker.current?.getLatLng();
    if (cur && Math.abs(cur.lat - pos.lat) < 1e-7 && Math.abs(cur.lng - pos.lng) < 1e-7) return;
    m.__put(pos);
    m.setView(pos, Math.max(m.getZoom(), 16));
  }, [pos]);

  return <div ref={el} className="loc-map" role="application" aria-label={t("Karte: Standort antippen")} />;
}
