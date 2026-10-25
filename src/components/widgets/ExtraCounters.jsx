import { useState } from "react";
import { Clover, Zap, CircleSlash, Flag, ChevronDown, Minus, Plus, AlertTriangle, Crosshair, CornerDownRight, Link2, Orbit, Triangle } from "lucide-react";
import { t } from "../../lib/i18n";
import InfoButton from "./InfoButton";
import { COUNTER_KEYS, ALL_KEYS, hasCounters } from "../../lib/matchCounters";

/* Optionale Zusatzzaehler im Match: Fluke, Runout, Scratch, Foul - je Seite.
   Standardmaessig zugeklappt (kostet nur eine schmale Zeile), die Summe steht
   am Kopf, damit man auch zugeklappt sieht, dass etwas mitgezaehlt wird. Die
   Erklaerung steckt im Info-Knopf. Gespeichert wird nur, wenn mindestens ein
   Zaehler > 0 ist (siehe lib/matchCounters.js). */
export const META = {
  fluke: { icon: Clover, label: "Fluke" },
  runout: { icon: Zap, label: "Runout" },
  scratch: { icon: CircleSlash, label: "Scratch" },
  foul: { icon: Flag, label: "Foul" },
  badbreak: { icon: Triangle, label: "Fehlanstoß" },
  longpot: { icon: Crosshair, label: "Long Pot" },
  bank: { icon: CornerDownRight, label: "Bandenstoß" },
  combo: { icon: Link2, label: "Kombination" },
  carom: { icon: Orbit, label: "Karambol" },
};

// single = Training gegen den Ghost: nur die eigene Seite zaehlt (kein Gegner), dazu die guten Stoesse (ALL_KEYS).
export default function ExtraCounters({ value, onBump, names, defaultOpen = false, warnings = [], single = false }) {
  const keys = single ? ALL_KEYS : COUNTER_KEYS;
  const [open, setOpen] = useState(defaultOpen);
  const total = keys.reduce((n, k) => n + (value[k]?.[0] || 0) + (value[k]?.[1] || 0), 0);
  return (
    <section className="extra-counters">
      <div className="extra-head">
        <button type="button" className="extra-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="extra-title">{t("Zusatzzähler")}</span>
          <span className="extra-opt">{t("optional")}</span>
          {total > 0 && <span className="extra-total">{total}</span>}
          <ChevronDown size={16} className={"extra-chev" + (open ? " open" : "")} />
        </button>
        <InfoButton title={t("Zusatzzähler")}>
          {single
            ? t("Training: zähle, was du am Tisch machst – Fehler (Scratch, Foul, Fehlanstoß) und gute Stöße (Long Pot, Bandenstoß, Kombination, Karambol). Die Zähler werden nur für dich gespeichert und ändern nichts am Training.")
            : t("Optional: Fluke (Glückstreffer), Runout (Tisch leergeräumt), Scratch (weiße Kugel versenkt) und Foul zählen. Die Zähler werden mit dem Match gespeichert, ändern aber weder das Ergebnis noch das Rating.")}
        </InfoButton>
      </div>
      <div className={"collapsible" + (open ? " open" : "")} inert={open ? undefined : ""}>
        <div className="collapsible-inner">
          <div className={"extra-grid" + (single ? " single" : "")}>
            {!single && (
              <div className="extra-row extra-names">
                <span>{names[0]}</span><span /><span>{names[1]}</span>
              </div>
            )}
            {keys.map((k) => {
              const Icon = META[k].icon;
              const label = t(META[k].label);
              return (
                <div key={k} className="extra-row">
                  {single ? (
                    <>
                      <span className="extra-label"><Icon size={15} />{label}</span>
                      <Step label={label} v={value[k][0]} onMinus={() => onBump(k, 0, -1)} onPlus={() => onBump(k, 0, 1)} />
                    </>
                  ) : (
                    <>
                      <Step label={label} v={value[k][0]} onMinus={() => onBump(k, 0, -1)} onPlus={() => onBump(k, 0, 1)} />
                      <span className="extra-label"><Icon size={15} />{label}</span>
                      <Step label={label} v={value[k][1]} onMinus={() => onBump(k, 1, -1)} onPlus={() => onBump(k, 1, 1)} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <Warnings list={warnings} />
    </section>
  );
}

/* Hinweise zu unplausiblen Eingaben (lib/matchCounters.js counterWarnings) -
   auch bei zugeklapptem Feld sichtbar, blockieren nichts. */
export function Warnings({ list }) {
  if (!list?.length) return null;
  return (
    <div className="extra-warn" role="status">
      {list.map((w) => <p key={w.id}><AlertTriangle size={15} /> <span>{w.text}</span></p>)}
    </div>
  );
}

function Step({ label, v, onMinus, onPlus }) {
  return (
    <span className="extra-step">
      <button type="button" onClick={onMinus} disabled={v <= 0} aria-label={`${label} −`}><Minus size={14} /></button>
      <b key={v}>{v}</b>
      <button type="button" onClick={onPlus} aria-label={`${label} +`}><Plus size={14} /></button>
    </span>
  );
}

/* Schmale Zusammenfassung fuer die Pruef-Seite: nur Zaehler mit Wert. */
export function CountersSummary({ value, warnings, single = false }) {
  if (!hasCounters(value)) return null;
  return (
    <>
    <div className="sum-counters">
      {(single ? ALL_KEYS : COUNTER_KEYS).filter((k) => (value[k][0] + value[k][1]) > 0).map((k) => {
        const Icon = META[k].icon;
        return <span key={k} title={t(META[k].label)}><Icon size={14} /> {t(META[k].label)} {single ? value[k][0] : `${value[k][0]}:${value[k][1]}`}</span>;
      })}
    </div>
    <Warnings list={warnings} />
    </>
  );
}
