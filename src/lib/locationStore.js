import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "../supabase";

/* Standort-Katalog (supabase/2026-10-27b_locations.sql), modulweit wie clubStore: Live (Ping, Planung), PingCard,
   PlanungCard und Verwaltung brauchen ihn. useLocations() laedt beim ersten Gebrauch (und hoechstens alle 60 s neu);
   fehlt die Tabelle noch, bleibt `available` false und die App faellt auf das alte Freitextfeld zurueck. */
let data = { list: [], available: false, loaded: false, planLoc: {}, planTime: {}, planPos: {}, confirms: [] };
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
    supabase.from("location_confirmations").select("location_id, player_id"), // fehlt die Migration 27d: leer
    supabase.from("plannings").select("id, planned_time").not("planned_time", "is", null), // fehlt 2026-11-03_planning_time.sql: leer
    supabase.from("plannings").select("id, place_text, lat, lng").not("place_text", "is", null), // fehlt 2026-11-03b_planning_position.sql: leer
  ])
    .then(([{ data: rows, error }, { data: pl }, { data: cf }, { data: pt }, { data: pp }]) => {
      loadedAt = Date.now();
      const planLoc = {};
      (pl || []).forEach((p) => { planLoc[p.id] = p.location_id; });
      const planTime = {}; // Planung -> "HH:MM"
      (pt || []).forEach((p) => { planTime[p.id] = String(p.planned_time).slice(0, 5); });
      const planPos = {}; // Planung -> { place_text, lat, lng } (eigener Ort ohne Lokal)
      (pp || []).forEach((p) => { planPos[p.id] = p; });
      data = error ? { list: [], available: false, loaded: true, planLoc: {}, planTime: {}, planPos: {}, confirms: [] } : { list: rows || [], available: true, loaded: true, planLoc, planTime, planPos, confirms: cf || [] };
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

// Koordinaten -> Adresse (Nominatim), fuer den Klick auf die Karte; null bei Fehler
export async function reverseAddress(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=de&zoom=18&lat=${lat}&lon=${lng}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const r = await res.json();
    return r.display_name ? r.display_name.split(", ").slice(0, 4).join(", ") : null;
  } catch { return null; }
}

// Namen von Orten in der Naehe einer Position (fuer "neues Lokal": der Name muss nicht getippt werden). Quelle: OpenStreetMap (Overpass: benannte
// Bars, Cafes, Vereine, Billard ... im Umkreis von 80 m, nach Art und Abstand sortiert) plus der Name der Stelle laut Nominatim. Fehler/Offline: leere Liste.
export async function nearbyNames(lat, lng) {
  const found = []; // { name, rank, d }
  const add = (n, rank, d) => {
    const name = String(n || "").trim();
    if (name.length < 2 || name.length > 60 || found.some((f) => f.name.toLowerCase() === name.toLowerCase())) return;
    found.push({ name, rank, d });
  };
  const withTimeout = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; }; // nie laenger als ein paar Sekunden warten
  await Promise.all([
    (async () => {
      try {
        const q = `[out:json][timeout:6];nwr(around:80,${lat},${lng})[name][~"^(amenity|leisure|shop|sport|tourism)$"~"."];out tags center 25;`;
        const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(q), signal: withTimeout(7000) });
        if (!res.ok) return;
        const j = await res.json();
        (j.elements || []).forEach((e) => {
          const tg = e.tags || {};
          const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
          const d = la != null && lo != null ? distanceM({ lat, lng }, { lat: la, lng: lo }) : 999;
          const rank = tg.sport === "billiards" || /billiard|pool|snooker/i.test(tg.name || "") ? 0 : /^(bar|pub|cafe|restaurant|nightclub|biergarten|fast_food|community_centre|social_centre|club)$/.test(tg.amenity || "") || tg.leisure === "sports_centre" ? 1 : 2;
          add(tg.name, rank, d);
        });
      } catch { /* offline/Overpass nicht erreichbar: dann eben nur der Nominatim-Name */ }
    })(),
    (async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&namedetails=1&zoom=18&accept-language=de&lat=${lat}&lon=${lng}`, { headers: { Accept: "application/json" }, signal: withTimeout(5000) });
        if (res.ok) { const r = await res.json(); add(r.namedetails?.name || r.name, 1, 0); }
      } catch { /* egal */ }
    })(),
  ]);
  return found.sort((a, b) => a.rank - b.rank || a.d - b.d).slice(0, 8).map((f) => f.name);
}
