import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Navigation, ChevronDown, Check } from "lucide-react";
import { t } from "../../lib/i18n";

/* Route zu einem Lokal in der Lieblings-Karten-App. Beim ersten Tippen waehlt man die App (Google Maps, Apple Karten,
   HERE WeGo, Waze, OpenStreetMap; am Android-Handy zusaetzlich "Andere App" = Systemauswahl ueber geo:), die Wahl wird
   pro Geraet gemerkt (localStorage routeApp), danach oeffnet ein Tipp direkt diese App; der kleine Pfeil daneben
   wechselt die App. Alles sind normale Web-Links: Ist die App installiert, oeffnet sie das Handy, sonst die Webseite. */
const KEY = "routeApp";
const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
const isApple = /iPhone|iPad|iPod|Macintosh/.test(ua);
const isAndroid = /Android/.test(ua);

const APPS = [
  { id: "google", label: "Google Maps", url: (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}` },
  { id: "apple", label: "Apple Karten", only: () => isApple, url: (p) => `https://maps.apple.com/?daddr=${p.lat},${p.lng}&dirflg=d` },
  { id: "here", label: "HERE WeGo", url: (p) => `https://share.here.com/r/mylocation/${p.lat},${p.lng}?m=d` },
  { id: "waze", label: "Waze", url: (p) => `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes` },
  { id: "osm", label: "OpenStreetMap", url: (p) => `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B${p.lat}%2C${p.lng}` },
  { id: "geo", label: "Andere App …", only: () => isAndroid, url: (p) => `geo:${p.lat},${p.lng}?q=${p.lat},${p.lng}(${encodeURIComponent(p.name || "")})` },
].filter((a) => !a.only || a.only());

const read = () => { try { const v = localStorage.getItem(KEY); return APPS.some((a) => a.id === v) ? v : null; } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, v); } catch { /* Privatmodus */ } };

export default function RouteButton({ place, className = "icon-btn small", size = 16, children }) {
  const [pref, setPref] = useState(read);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const pop = useRef(null);
  // Das Menue haengt am Body (fixed), nicht im Knopf: in einklappbaren Karten (overflow: hidden) wurde es sonst abgeschnitten
  const [at, setAt] = useState(null);
  const openMenu = () => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const h = 8 * 2 + 28 + APPS.length * 40; // grobe Menuehoehe
    const below = r.bottom + 4 + h <= window.innerHeight || r.top < h;
    setAt({ right: Math.max(8, window.innerWidth - r.right), top: below ? r.bottom + 4 : undefined, bottom: below ? undefined : window.innerHeight - r.top + 4 });
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!box.current?.contains(e.target) && !pop.current?.contains(e.target)) setOpen(false); };
    const shut = () => setOpen(false);
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", shut, true);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("scroll", shut, true); };
  }, [open]);

  const go = (app) => { window.open(app.url(place), app.id === "geo" ? "_self" : "_blank", "noopener"); };
  const choose = (app) => { write(app.id); setPref(app.id); setOpen(false); go(app); };
  const app = APPS.find((a) => a.id === pref);
  const label = app ? `${t("Route")} – ${app.label}` : t("Route öffnen");

  return (
    <span className="route-btn" ref={box}>
      <button type="button" className={className} title={label} aria-label={label}
        onClick={(e) => { e.stopPropagation(); if (app) go(app); else if (open) setOpen(false); else openMenu(); }}>
        <Navigation size={size} />{children}
      </button>
      {app && (
        <button type="button" className="route-more" aria-label={t("Karten-App wechseln")} title={t("Karten-App wechseln")}
          aria-expanded={open} onClick={(e) => { e.stopPropagation(); if (open) setOpen(false); else openMenu(); }}><ChevronDown size={13} /></button>
      )}
      {open && at && createPortal(
        <div className="route-pop" ref={pop} style={{ right: at.right, top: at.top, bottom: at.bottom }}>
          <span className="route-menu" role="menu">
            <b className="route-menu-title">{t("Route mit …")}</b>
            {APPS.map((a) => (
              <button key={a.id} type="button" role="menuitem" className="route-opt" onClick={() => choose(a)}>
                {a.label}{pref === a.id && <Check size={14} />}
              </button>
            ))}
          </span>
        </div>, document.body)}
    </span>
  );
}
