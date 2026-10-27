import { useState } from "react";
import { t } from "../../lib/i18n";
import { useLocations, distanceM } from "../../lib/locationStore";
import {
  getPingRadiusKm, setPingRadiusKm, normName, santaDistanceKm, sliderToKm, kmToSlider, fmtRadius, snapKm,
  PING_RADIUS_MIN, PING_RADIUS_MAX, PING_RADIUS_SLIDER_MAX,
} from "../../lib/pingRadius";
import PingButton from "./PingButton";
import InfoButton from "./InfoButton";
import Emoji from "../Emoji";

/* Einstellung "Ping-Radius": derselbe Radar-Knopf wie auf dem Live-Bildschirm (antippbar), ein Schieberegler von 100 m bis 50 km
   und ein Eingabefeld fuer genaue (auch groessere) Werte. Ein Tipp auf den Radar pingt mit dem gewaehlten Radius und zeigt, wie viele
   Spieler dort gerade live sind. Gilt nur auf diesem Geraet, Standard 5 km. */
export default function PingRadiusSetting({ pings = [], meId, toast, onFoundSanta, santaKnown }) {
  const { list } = useLocations();
  const [km, setKm] = useState(getPingRadiusKm);
  // Feld: unter 1 km in Metern ("500" + "m"), ab 1 km in Kilometern; Eingaben duerfen die Einheit tragen ("750 m", "2 km")
  const unitOf = (v) => (v < 1 ? "m" : "km");
  const shown = (v) => String(unitOf(v) === "m" ? Math.round(v * 1000) : v).replace(".", ",");
  const [unit, setUnit] = useState(() => unitOf(getPingRadiusKm()));
  const [txt, setTxt] = useState(() => shown(getPingRadiusKm()));
  const [pinging, setPinging] = useState(false);
  // Ergebnis des LETZTEN Pings (Anzahl, Radius, Weihnachtsmann): aendert sich nur durch einen Klick auf den Radar, nie durch den Regler
  const [result, setResult] = useState(null);

  const countAt = (here, radius) => {
    const ids = new Set();
    pings.forEach((p) => {
      if (p.player_id === meId) return;
      const v = list.find((l) => normName(l.name) === normName(p.location));
      if (v && v.lat != null && distanceM(here, v) <= radius * 1000) ids.add(p.player_id);
    });
    return ids.size + (santaDistanceKm(here, radius) != null ? 1 : 0); // + Weihnachtsmann (Easteregg)
  };
  // Radius aendern speichert nur den Wert - die Anzeige unten bleibt, bis man wieder auf den Radar tippt
  const apply = (v, fromInput) => {
    setKm(v); setPingRadiusKm(v);
    if (!fromInput) { setTxt(shown(v)); setUnit(unitOf(v)); }
  };
  const onInput = (e) => {
    const raw = e.target.value;
    setTxt(raw);
    const m = raw.trim().toLowerCase().match(/^([\d.,]+)\s*(km|m)?$/);
    if (!m) return;
    const u = m[2] || unit;
    const num = Number(m[1].replace(",", "."));
    if (m[2]) setUnit(u);
    const v = snapKm(u === "m" ? num / 1000 : num);
    if (Number.isFinite(num) && num > 0 && v >= PING_RADIUS_MIN && v <= PING_RADIUS_MAX) apply(v, true);
  };
  const ping = () => {
    setPinging(true);
    const stop = setTimeout(() => setPinging(false), 1900);
    if (!navigator.geolocation) { clearTimeout(stop); setPinging(false); toast?.(t("Dein Gerät kann den Standort nicht bestimmen.")); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        const santa = santaDistanceKm(here, km);
        setResult({ n: countAt(here, km), km, santa });
        if (!santaKnown && santa != null) onFoundSanta?.();
      },
      () => { clearTimeout(stop); setPinging(false); toast?.(t("Standort nicht verfügbar – bitte in den Browser-Einstellungen freigeben.")); },
      { timeout: 8000, maximumAge: 60000 },
    );
  };

  return (
    <div className="ping-setting">
      <div className="ping-setting-head">
        <b>{t("Ping-Radius")}</b>
        <InfoButton title={t("Ping-Radius")}>
          {t("So weit sucht der Ping auf dem Live-Bildschirm nach Spielern, die gerade live sind. Der Regler reicht von 100 m bis 50 km, im Feld daneben kannst du den Wert genau eingeben. Tippe auf den Radar, um mit dem gewählten Radius zu testen, wie viele Spieler gerade in deiner Nähe live sind. Gilt nur auf diesem Gerät.")}
        </InfoButton>
      </div>
      <PingButton compact pinging={pinging} onClick={ping} />
      <div className="ping-radius-row">
        <input type="range" className="ping-slider" min={0} max={100} step={0.5} value={kmToSlider(km)}
          onChange={(e) => apply(sliderToKm(Number(e.target.value)))} aria-label={t("Ping-Radius")}
          aria-valuetext={fmtRadius(km)} />
        <label className="ping-km-field">
          <input type="text" inputMode="decimal" value={txt} onChange={onInput}
            onBlur={() => { setTxt(shown(km)); setUnit(unitOf(km)); }} aria-label={unit === "m" ? t("Radius in m") : t("Radius in km")} />
          <span>{unit}</span>
        </label>
      </div>
      <div className="ping-radius-scale"><span>100 m</span><b>{fmtRadius(km)}</b><span>{PING_RADIUS_SLIDER_MAX} km</span></div>
      {result && result.santa != null && (
        <p className="ping-santa"><Emoji e="🎅" /> {t("Der Weihnachtsmann ist auch live – im Nordpol-Workshop, {d} km entfernt!", { d: result.santa })}</p>
      )}
      <p className="ping-found">
        {result == null
          ? t("Tippe auf den Radar, um zu sehen, wie viele Spieler in deinem Radius live sind.")
          : t("{n} Spieler im Umkreis von {r} live", { n: result.n, r: fmtRadius(result.km) })}
      </p>
    </div>
  );
}
