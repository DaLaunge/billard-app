/* ============================================================
   FARBTHEMEN
   Alle Werte entsprechen den CSS-Variablen aus App.css (:root).
   Anwenden = dieselben Variablen als Inline-Styles auf <html>
   setzen (hoehere Spezifitaet als :root, kein eigener CSS-Block
   pro Thema noetig). --win/--loss/--warn und die Medaillenfarben
   bleiben bewusst fix (Sieg=gruen, Niederlage=rot, Warnung=gelb
   soll sich nicht mit der Themenfarbe vermischen).

   Ein Thema hat GENAU EINE Akzentfarbe (accent, in der Auswahl der
   farbige Punkt; accentDeep ist nur ihre dunklere Stufe). Bis
   2026-09-22 gab es daneben ein fest verdrahtetes Gold (#D6A425),
   das jedes Thema mitgeschleppt hat - Hervorhebungen und
   Zusatztexte blieben dadurch golden, egal welches Thema (oder
   welche eigene Akzentfarbe) gewaehlt war. Alles davon haengt
   jetzt an --accent, siehe :root in App.css.
   ============================================================ */

export const THEME_CATALOG = {
  green: { name: "Grün", felt: "#0A2B21", felt2: "#10382C", felt3: "#17493A", line: "#24564660",
    accent: "#7CC1E8", accentDeep: "#3E82B4", ivory: "#F2EDE0", ivoryDim: "#9DBAAE" },
  black: { name: "Schwarz", felt: "#0B0B0D", felt2: "#171719", felt3: "#232326", line: "#3A3A4060",
    accent: "#8FA8C7", accentDeep: "#5C7699", ivory: "#F2EDE0", ivoryDim: "#A8A8AE" },
  red: { name: "Rot", felt: "#2B0A12", felt2: "#38101C", felt3: "#491726", line: "#56242F60",
    accent: "#E8B87C", accentDeep: "#B48446", ivory: "#F2EDE0", ivoryDim: "#C4A0A6" },
  blue: { name: "Blau", felt: "#0A1A2B", felt2: "#102538", felt3: "#173049", line: "#24405660",
    accent: "#6FDCE0", accentDeep: "#3E9CB4", ivory: "#F2EDE0", ivoryDim: "#9DAFBA" },
  purple: { name: "Lila", felt: "#1E0A2B", felt2: "#291038", felt3: "#361749", line: "#3F245660",
    accent: "#C87CE8", accentDeep: "#8E46B4", ivory: "#F2EDE0", ivoryDim: "#B7A0C4" },
  brown: { name: "Braun", felt: "#2B1D0A", felt2: "#382610", felt3: "#493117", line: "#56412460",
    accent: "#E8C17C", accentDeep: "#B4923E", ivory: "#F2EDE0", ivoryDim: "#C4B49D" },
  teal: { name: "Petrol", felt: "#0A2B28", felt2: "#103833", felt3: "#174943", line: "#24565060",
    accent: "#7CE8C4", accentDeep: "#3EB491", ivory: "#F2EDE0", ivoryDim: "#9DBAB2" },
};

export const THEME_KEYS = Object.keys(THEME_CATALOG);

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}
function hslToHex(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  const hue2rgb = (p, q, tIn) => {
    let t = tIn;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Baut aus zwei frei gewaehlten Farben (Hintergrund, Akzent) ein
// vollstaendiges Thema: felt-2/felt-3 sind hellere Stufen des
// Hintergrunds (gleicher Farbton, steigende Helligkeit), accent-deep
// ist eine dunklere Stufe des Akzents.
export function buildCustomTheme(bgHex, accentHex) {
  const safeBg = /^#[0-9A-Fa-f]{6}$/.test(bgHex || "") ? bgHex : "#0A2B21";
  const safeAccent = /^#[0-9A-Fa-f]{6}$/.test(accentHex || "") ? accentHex : "#7CC1E8";
  const [bh, bs] = hexToHsl(safeBg);
  const [ah, as_] = hexToHsl(safeAccent);
  // Bei sehr geringer Saettigung (Schwarz/Weiss/Grau) ist der berechnete
  // Farbton mathematisch bedeutungslos (hexToHsl liefert dafuer immer 0Â° =
  // Rot) - ihn trotzdem hochzusaettigen wuerde z.B. echtes Schwarz in ein
  // sattes Rot verwandeln statt neutral zu bleiben. Die Mindest-Saettigung
  // gilt daher nur, wenn die Farbe ueberhaupt einen erkennbaren Farbton hat.
  const bSat = bs < 6 ? bs : Math.max(28, bs);
  const aSat = as_ < 6 ? as_ : Math.max(40, as_);
  // Ein farbloser (schwarz/grauer) Hintergrund braucht deutlich weniger
  // Helligkeit als ein farbiger, sonst wirkt "Schwarz" wie ein mittleres
  // Grau statt wie das eigene Schwarz-Preset (das bewusst 5/9/14% statt
  // 12/17/23% nutzt) - Saettigung kann bei Grautoenen die fehlende
  // "Dunkelheit" nicht kompensieren, wie sie es bei Farben tut.
  const [feltL, felt2L, felt3L] = bSat < 6 ? [5, 9, 14] : [12, 17, 23];
  const felt = hslToHex(bh, bSat, feltL);
  const felt2 = hslToHex(bh, bSat, felt2L);
  const felt3 = hslToHex(bh, bSat, felt3L);
  const accent = hslToHex(ah, aSat, 72);
  const accentDeep = hslToHex(ah, aSat, 48);
  // Der gedaempfte Textton folgt dem HINTERGRUND-Farbton, nicht dem Akzent -
  // genau wie in den Presets (Gruen #9DBAAE, Rot #C4A0A6, Lila #B7A0C4: alle
  // schwach gesaettigt im Farbton ihres eigenen felt). Bis 2026-09-25 stand
  // hier ein fester neutralgrauer Wert, wodurch bei einem eigenen Thema JEDER
  // Nebentext und (ueber --btn-border) jeder Knopfrahmen kalt grau auf einem
  // farbigen Hintergrund lag und wie ein Fremdkoerper wirkte (Nutzer-Feedback).
  // Bei farblosem Hintergrund bleibt es fast neutral - das Schwarz-Preset
  // macht es mit #A8A8AE genauso.
  const ivoryDim = hslToHex(bh, bSat < 6 ? 4 : 18, 68);
  return {
    name: "Eigenes Thema", felt, felt2, felt3, line: `${felt3}60`,
    accent, accentDeep, ivory: "#F2EDE0", ivoryDim,
  };
}

export function resolveTheme(themeKey, customColors) {
  if (themeKey === "custom") return buildCustomTheme(customColors?.bg, customColors?.accent);
  return THEME_CATALOG[themeKey] || THEME_CATALOG.green;
}

export function applyTheme(themeKey, customColors) {
  const th = resolveTheme(themeKey, customColors);
  const root = document.documentElement.style;
  root.setProperty("--felt", th.felt);
  root.setProperty("--felt-2", th.felt2);
  root.setProperty("--felt-3", th.felt3);
  root.setProperty("--line", th.line);
  root.setProperty("--accent", th.accent);
  root.setProperty("--accent-deep", th.accentDeep);
  root.setProperty("--ivory", th.ivory);
  root.setProperty("--ivory-dim", th.ivoryDim);
}
