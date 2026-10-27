import { useState } from "react";
import { t } from "../../lib/i18n";
import { useLocations, distanceM } from "../../lib/locationStore";
import { PING_RADIUS_OPTIONS, getPingRadiusKm, setPingRadiusKm, normName, santaDistanceKm } from "../../lib/pingRadius";
import Emoji from "../Emoji";
import PingButton from "./PingButton";
import InfoButton from "./InfoButton";

/* Einstellung "Ping-Radius": derselbe Radar-Knopf wie auf dem Live-Bildschirm (antippbar) plus die Radiuswahl. Ein Tipp pingt
   mit dem gewaehlten Radius und zeigt, wie viele Spieler dort gerade live sind. Gilt nur auf diesem Geraet, Standard 5 km. */
export default function PingRadiusSetting({ pings = [], meId, toast }) {
  const { list } = useLocations();
  const [km, setKm] = useState(getPingRadiusKm);
  const [pinging, setPinging] = useState(false);
  const [found, setFound] = useState(null);
  const [pos, setPos] = useState(null);

  const countAt = (pos, radius) => {
    const ids = new Set();
    pings.forEach((p) => {
      if (p.player_id === meId) return;
      const v = list.find((l) => normName(l.name) === normName(p.location));
      if (v && v.lat != null && distanceM(pos, v) <= radius * 1000) ids.add(p.player_id);
    });
    return ids.size + (santaDistanceKm(pos, radius) != null ? 1 : 0); // + Weihnachtsmann (Easteregg)
  };
  const ping = () => {
    setPinging(true);
    const stop = setTimeout(() => setPinging(false), 1900);
    if (!navigator.geolocation) { clearTimeout(stop); setPinging(false); toast?.(t("Dein Gerät kann den Standort nicht bestimmen.")); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { const here = { lat: p.coords.latitude, lng: p.coords.longitude }; setPos(here); setFound(countAt(here, km)); },
      () => { clearTimeout(stop); setPinging(false); toast?.(t("Standort nicht verfügbar – bitte in den Browser-Einstellungen freigeben.")); },
      { timeout: 8000, maximumAge: 60000 },
    );
  };
  const choose = (k) => {
    setKm(k); setPingRadiusKm(k);
    if (pos) setFound(countAt(pos, k));
  };

  return (
    <div className="ping-setting">
      <div className="ping-setting-head">
        <b>{t("Ping-Radius")}</b>
        <InfoButton title={t("Ping-Radius")}>
          {t("So weit sucht der Ping auf dem Live-Bildschirm nach Spielern, die gerade live sind. Tippe auf den Radar, um mit dem gewählten Radius zu testen, wie viele Spieler gerade in deiner Nähe live sind. Gilt nur auf diesem Gerät.")}
        </InfoButton>
      </div>
      <PingButton compact pinging={pinging} onClick={ping} />
      <div className="chips small ping-radius-chips">
        {PING_RADIUS_OPTIONS.map((k) => (
          <button key={k} type="button" className={"chip" + (km === k ? " active" : "")} onClick={() => choose(k)}>{k.toLocaleString()} km</button>
        ))}
      </div>
      {pos && santaDistanceKm(pos, km) != null && (
        <p className="ping-santa"><Emoji e="🎅" /> {t("Der Weihnachtsmann ist auch live – im Nordpol-Workshop, {d} km entfernt!", { d: santaDistanceKm(pos, km) })}</p>
      )}
      <p className="ping-found">
        {found == null
          ? t("Tippe auf den Radar, um zu sehen, wie viele Spieler in deinem Radius live sind.")
          : t("{n} Spieler im Umkreis von {km} km live", { n: found, km })}
      </p>
    </div>
  );
}
