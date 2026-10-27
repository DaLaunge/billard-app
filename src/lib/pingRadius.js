// Ping-Radius: wie weit der "Ping" (Live-Bildschirm) nach Live-Spielern sucht. Pro Geraet in localStorage, Standard 5 km.
// Der Schieberegler deckt 100 m bis 50 km ab; groessere Werte (bis ueber den halben Erdumfang hinaus) gehen nur per Eingabefeld (Easteregg).
export const PING_RADIUS_DEFAULT = 5;
export const PING_RADIUS_MIN = 0.1;
export const PING_RADIUS_SLIDER_MAX = 50;
export const PING_RADIUS_MAX = 20100; // halber Erdumfang ~20.015 km: vom Suedpol aus reicht der Radius damit bis zum Nordpol
const KEY = "pingRadiusKm";

export function getPingRadiusKm() {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v >= PING_RADIUS_MIN && v <= PING_RADIUS_MAX ? snapKm(v) : PING_RADIUS_DEFAULT;
  } catch { return PING_RADIUS_DEFAULT; }
}

export function setPingRadiusKm(km) {
  try { if (km === PING_RADIUS_DEFAULT) localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(km)); } catch { /* Privatmodus */ }
}

// Schieberegler 0..100 <-> Kilometer, logarithmisch (100 m .. 50 km), gerundet auf sinnvolle Schritte
const RATIO = PING_RADIUS_SLIDER_MAX / PING_RADIUS_MIN;
// unter 1 km in 100-m-Schritten (0,1 km), ab 1 km in ganzen Kilometern - keine Kommazahlen bei Kilometern
export const snapKm = (v) => (v < 1 ? Math.max(0.1, Math.round(v * 10) / 10) : Math.max(1, Math.round(v)));
export const sliderToKm = (p) => Math.min(PING_RADIUS_SLIDER_MAX, Math.max(PING_RADIUS_MIN, snapKm(PING_RADIUS_MIN * Math.pow(RATIO, p / 100))));
export const kmToSlider = (km) => (km >= PING_RADIUS_SLIDER_MAX ? 100 : Math.max(0, Math.min(100, (Math.log(km / PING_RADIUS_MIN) / Math.log(RATIO)) * 100)));

// "500 m" / "5 km" / "4.650 km"
export const fmtRadius = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(km))} km`);

// Easteregg: reicht der Radius bis zum Nordpol, ist dort der Weihnachtsmann live (Entfernung in km, sonst null)
export function santaDistanceKm(pos, radiusKm) {
  if (!pos) return null;
  const R = 6371, rad = Math.PI / 180;
  const km = (90 - pos.lat) * rad * R; // Grosskreis zum Nordpol (lat 90): Entfernung = Breitenabstand
  return km <= radiusKm ? Math.round(km) : null;
}

// Namen vergleichbar machen (Gross-/Kleinschreibung, Akzente, Sonderzeichen)
export const normName = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
