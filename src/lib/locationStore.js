import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "../supabase";

/* Standort-Katalog (supabase/2026-10-27b_locations.sql), modulweit wie clubStore: Live (Ping, Planung), PingCard,
   PlanungCard und Verwaltung brauchen ihn. useLocations() laedt beim ersten Gebrauch (und hoechstens alle 60 s neu);
   fehlt die Tabelle noch, bleibt `available` false und die App faellt auf das alte Freitextfeld zurueck. */
let data = { list: [], available: false, loaded: false, planLoc: {} };
let loadedAt = 0;
let inflight = null;
const subs = new Set();
const emit = () => subs.forEach((f) => f());

export const loadLocations = (force = false) => {
  if (inflight) return inflight;
  if (!force && Date.now() - loadedAt < 60000) return Promise.resolve();
  // Planung -> Standort extra holen (nicht im Haupt-Select von App.jsx: fehlt die Migration, darf der nicht scheitern)
  inflight = Promise.all([
    supabase.from("locations").select("id, name, address, lat, lng, status, created_by, updated_by, updated_at").order("name"),
    supabase.from("plannings").select("id, location_id").not("location_id", "is", null),
  ])
    .then(([{ data: rows, error }, { data: pl }]) => {
      loadedAt = Date.now();
      const planLoc = {};
      (pl || []).forEach((p) => { planLoc[p.id] = p.location_id; });
      data = error ? { list: [], available: false, loaded: true, planLoc: {} } : { list: rows || [], available: true, loaded: true, planLoc };
      emit();
    })
    .catch(() => { /* offline: alter Stand bleibt */ })
    .finally(() => { inflight = null; });
  return inflight;
};

export const useLocations = () => {
  useEffect(() => { loadLocations(); }, []);
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => data);
};

// Google-Maps-Route zum Standort (ein Klick, kein API-Schluessel)
export const routeUrl = (l) => `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`;
export const mapUrl = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

// Abstand in Metern (Haversine) - fuer die Warnung vor Doppelten
export function distanceM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// "48.2082, 16.3738" (Google Maps: Rechtsklick -> Zahlen kopieren) -> {lat, lng}
export function parseCoords(s) {
  const m = String(s || "").trim().match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1].replace(",", ".")), lng = parseFloat(m[2].replace(",", "."));
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

// Adresssuche ueber OpenStreetMap/Nominatim (kostenlos, ohne Schluessel; nur auf Knopfdruck, nie bei jedem Tastendruck)
export async function searchAddress(q) {
  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=de&q=" + encodeURIComponent(q);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("search");
  const rows = await res.json();
  return rows.map((r) => ({ label: r.display_name, name: r.name || "", lat: parseFloat(r.lat), lng: parseFloat(r.lon) }));
}
