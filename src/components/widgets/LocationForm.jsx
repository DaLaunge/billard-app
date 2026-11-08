import { useState, useEffect, lazy, Suspense } from "react";
import { Search, Check, X, ExternalLink, MapPin, Map as MapIcon, AlertTriangle } from "lucide-react";
import { supabase } from "../../supabase";
import { t } from "../../lib/i18n";
import { loadLocations, useLocations, distanceM, parseCoords, searchAddress, reverseAddress, mapUrl, nearbyNames } from "../../lib/locationStore";

const LocationMap = lazy(() => import("./LocationMap"));

/* Lokal anlegen oder korrigieren. Wer ein Lokal kennt, kennt den NAMEN, nicht die Adresse: der Name wird getippt, der Ort
   dann ueber "Mein Standort" (GPS), Adresse oder Karte bestimmt - Koordinaten tippen ist nur der letzte Ausweg.
   Ohne Ortsangabe laesst sich kein Lokal anlegen (ohne Position gibt es auch keine Route). Mit Position wird gegengeprueft,
   ob im Umkreis von 100 m schon ein Lokal existiert. */
export default function LocationForm({ initial, initialPos, fixedName, onSaved, onCancel, toast }) {
  // initialPos { lat, lng, address }: die Position ist schon bestimmt (z. B. "Mein Standort" beim Online gehen) - sie wird direkt uebernommen, ohne Karte;
  // "Position aendern" bringt die Auswahl (Standort, Adresse, Karte) zurueck. Namensvorschlaege kommen aus den Ortsnamen in der Naehe.
  const { list } = useLocations();
  const [ownName, setName] = useState(initial?.name || "");
  const name = fixedName !== undefined ? fixedName : ownName; // beim neuen Lokal steht der Name im Feld darueber
  const [address, setAddress] = useState(initial?.address || initialPos?.address || "");
  const [pos, setPos] = useState(initial ? { lat: initial.lat, lng: initial.lng } : initialPos ? { lat: initialPos.lat, lng: initialPos.lng } : null);
  const [changePos, setChangePos] = useState(false);
  const posLocked = !!initialPos && !initial && !changePos;
  const [names, setNames] = useState([]);
  const [coordText, setCoordText] = useState("");
  const [results, setResults] = useState(null);
  const [showAddr, setShowAddr] = useState(false);
  const [showMap, setShowMap] = useState(!!initial);
  const [showCoords, setShowCoords] = useState(false);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  // Ortsnamen in der Naehe als Namensvorschlaege (nur beim Neuanlegen, solange noch kein Name steht)
  const posKey = pos ? `${pos.lat.toFixed(4)},${pos.lng.toFixed(4)}` : "";
  useEffect(() => {
    if (!pos || initial?.id) { setNames([]); return undefined; }
    let live = true;
    nearbyNames(pos.lat, pos.lng).then((n) => { if (live) setNames(n); });
    return () => { live = false; };
  }, [posKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const nearby = pos ? list.find((l) => l.id !== initial?.id && distanceM(l, pos) < 100) : null;

  const search = async () => {
    const q = address.trim();
    if (q.length < 3) return;
    setBusy(true);
    try { setResults(await searchAddress(q)); } catch { toast(t("Adresssuche gerade nicht erreichbar.")); setResults([]); }
    setBusy(false);
  };
  const pick = (r) => {
    setPos({ lat: r.lat, lng: r.lng });
    setAddress(r.label.split(", ").slice(0, 4).join(", "));
    setResults(null); setShowMap(true); setGpsDenied(false);
  };
  const gps = () => {
    if (!navigator.geolocation) { setGpsDenied(true); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const np = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) };
        setPos(np); setShowMap(true); setGpsDenied(false); setBusy(false);
        const a = await reverseAddress(np.lat, np.lng);
        if (a) setAddress(a);
      },
      () => { setGpsDenied(true); setBusy(false); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };
  // Tippen/Ziehen auf der Karte: Position uebernehmen und die Adresse dazu nachschlagen
  const onMapPick = async (p) => {
    setPos(p); setCoordText(""); setGpsDenied(false);
    const a = await reverseAddress(p.lat, p.lng);
    if (a) setAddress(a);
  };
  const onCoords = (v) => { setCoordText(v); const c = parseCoords(v); if (c) { setPos(c); setShowMap(true); setGpsDenied(false); } };

  const save = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("save_location", {
      p_id: initial?.id || null, p_name: name, p_address: address.trim() || null, p_lat: pos.lat, p_lng: pos.lng,
    });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    if (!data) { toast(t("Konnte nicht gespeichert werden – gibt es den Namen schon?")); return; }
    await loadLocations(true);
    // Neue Lokale sind sofort frei; hat die Pruefung etwas Auffaelliges gefunden (zu nah an einem anderen, weit weg, aehnlicher Name ...),
    // ist es den Admins gemeldet - das sagen wir dem Eintragenden gleich, damit er es ggf. korrigieren kann.
    let note = null;
    if (!initial?.id || name.trim().toLowerCase() !== String(initial.name || "").trim().toLowerCase() || pos.lat !== initial.lat || pos.lng !== initial.lng) {
      try { const { data: row } = await supabase.from("locations").select("check_note").eq("id", data).maybeSingle(); note = row?.check_note || null; } catch { /* Spalte fehlt noch: keine Meldung */ }
    }
    toast(note ? t("Gespeichert – den Admins zur Kontrolle gemeldet: {note}", { note }) : initial?.id ? t("Standort geändert.") : t("Standort gespeichert."));
    onSaved?.(data);
  };

  return (
    <div className="loc-form">
      {fixedName === undefined && <div className="search-row">
        <MapPin size={16} className="mail-ico" />
        <input autoFocus={!name} placeholder={t("Name des Lokals, z. B. Billardcafe Mitte")} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </div>}
      {fixedName === undefined && !initial?.id && names.length > 0 && (
        <div className="chips small loc-names" role="group" aria-label={t("Ortsnamen in der Nähe")}>
          <span className="rank-meta">{t("In der Nähe")}</span>
          {names.map((n) => <button key={n} type="button" className={"chip" + (name.trim().toLowerCase() === n.toLowerCase() ? " active" : "")} onClick={() => setName(n)}>{n}</button>)}
        </div>
      )}

      {!posLocked && (<>
      <p className="loc-q">{t("Wo liegt das Lokal?")}</p>
      <div className="loc-how">
        <button type="button" className={"chip" + (pos && !showAddr ? " active" : "")} onClick={gps} disabled={busy}><MapPin size={14} /> {t("Mein Standort")}</button>
        <button type="button" className={"chip" + (showAddr ? " active" : "")} onClick={() => setShowAddr((v) => !v)}><Search size={14} /> {t("Adresse")}</button>
        <button type="button" className={"chip" + (showMap ? " active" : "")} onClick={() => setShowMap((v) => !v)}><MapIcon size={14} /> {t("Karte")}</button>
      </div>

      {showAddr && (
        <div className="search-row">
          <Search size={16} className="mail-ico" />
          <input autoFocus placeholder={t("Adresse, z. B. Praterstraße 1, Wien")} value={address} maxLength={200}
            onChange={(e) => setAddress(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} />
          <button type="button" className="icon-btn small" onClick={search} disabled={busy || address.trim().length < 3}
            aria-label={t("Adresse suchen")} title={t("Adresse suchen")}><Search size={16} /></button>
        </div>
      )}
      {results && (
        <div className="loc-results">
          {results.length === 0 && <p className="hint">{t("Nichts gefunden – Adresse genauer eingeben oder auf der Karte wählen.")}</p>}
          {results.map((r, i) => (
            <button key={i} type="button" className="loc-result" onClick={() => pick(r)}>{r.label}</button>
          ))}
        </div>
      )}
      {showMap && (
        <>
          <Suspense fallback={<div className="loc-map" />}>
            <LocationMap pos={pos} onPick={onMapPick} />
          </Suspense>
          <p className="hint" style={{ margin: 0 }}>{t("Karte antippen, um den Standort zu setzen – der Marker lässt sich ziehen.")}</p>
        </>
      )}

      {gpsDenied && (
        <div className="loc-warn"><AlertTriangle size={15} /> {t("Dein Standort wird nicht freigegeben. Ohne Standortdaten kann das Lokal nicht angelegt werden und wir können nicht prüfen, ob es schon existiert – gib die Adresse ein oder wähle den Ort auf der Karte.")}</div>
      )}
      {!pos && !gpsDenied && (
        <p className="hint" style={{ margin: 0 }}>{t("Ohne Standortdaten (Standort, Adresse oder Karte) ist das Lokal nicht verfügbar.")}</p>
      )}
      </>)}
      {pos && (
        <p className="hint loc-pos">
          <Check size={14} /> {address || `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`}{" "}
          <a href={mapUrl(pos.lat, pos.lng)} target="_blank" rel="noreferrer"><MapPin size={13} /> {t("Auf der Karte prüfen")}</a>
          {posLocked && <> <button type="button" className="loc-linkbtn" onClick={() => setChangePos(true)}>{t("Position ändern")}</button></>}
        </p>
      )}
      {nearby && (
        <div className="loc-near">
          {t("Hier gibt es schon ein Lokal: {name}. Meinst du das?", { name: nearby.name })}
          <button type="button" className="chip-btn ok" onClick={() => onSaved?.(nearby.id)}><Check size={15} /> {t("Dieses nehmen")}</button>
        </div>
      )}

      {!posLocked && (showCoords ? (
        <div className="search-row">
          <input placeholder={t("Exakte Koordinaten, z. B. 48.2082, 16.3738")} value={coordText} onChange={(e) => onCoords(e.target.value)} />
        </div>
      ) : (
        <button type="button" className="loc-linkbtn" onClick={() => setShowCoords(true)}>{t("Exakte Koordinaten eingeben")}</button>
      ))}

      <div className="sp-controls">
        <button type="button" className="btn ghost" onClick={onCancel}><X size={15} /> {t("Abbrechen")}</button>
        <button type="button" className="btn primary" disabled={busy || !pos || name.trim().length < 2} onClick={save}>
          <Check size={16} /> {t("Speichern")}
        </button>
      </div>
      {!initial?.id && <p className="hint">{t("Neue Lokale sind sofort für alle da. Auffälliges (z. B. sehr nah an einem bekannten Lokal) melden wir den Admins.")}</p>}
    </div>
  );
}
