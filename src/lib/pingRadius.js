// Ping-Radius: wie weit der "Ping" (Live-Bildschirm) nach Live-Spielern sucht. Pro Geraet in localStorage, Standard 5 km.
export const PING_RADIUS_OPTIONS = [1, 2, 5, 10, 25, 50, 100, 500, 1000, 5000, 10000];
export const PING_RADIUS_DEFAULT = 5;
const KEY = "pingRadiusKm";

export function getPingRadiusKm() {
  try {
    const v = Number(localStorage.getItem(KEY));
    return PING_RADIUS_OPTIONS.includes(v) ? v : PING_RADIUS_DEFAULT;
  } catch { return PING_RADIUS_DEFAULT; }
}

export function setPingRadiusKm(km) {
  try { if (km === PING_RADIUS_DEFAULT) localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(km)); } catch { /* Privatmodus */ }
}

// Easteregg: reicht der Radius bis zum Nordpol, ist dort der Weihnachtsmann live (Entfernung in km, sonst null)
export function santaDistanceKm(pos, radiusKm) {
  if (!pos) return null;
  const R = 6371, rad = Math.PI / 180;
  const km = (90 - pos.lat) * rad * R; // Grosskreis zum Nordpol (lat 90): Entfernung = Breitenabstand
  return km <= radiusKm ? Math.round(km) : null;
}

// Namen vergleichbar machen (Gross-/Kleinschreibung, Akzente, Sonderzeichen)
export const normName = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
