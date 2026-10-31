import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { t } from "../../lib/i18n";
import CheckeredFlag from "./CheckeredFlag";

/* DAS Zaehlermodul (Nutzer 2026-11-01: "Counter moeglichst ueberall genau gleich, als ein einziges Modul"). Zwei Seiten, der
   Spielstand gross in der Mitte, je Seite eine Kapsel "- | +", dazwischen die Hauptaktion. Alles Aussehen steckt in den
   .ws-board-Regeln (App.css); die Modi liefern nur Inhalt:

   sides[i] = { id, person (Knoten ODER Funktion(avatarGroesse) -> Knoten: Avatar + Name im .ws-b-person), score, onBump(d), label (aria), breakMark? (Knoten in der
                Randspalte, nur wenn hasBreak) }
   counters  false -> keine Kapseln, in der Mitte steht "vs" (Teilnehmer ohne Eingabe-Recht)
   note      Knoten im reservierten Streifen unter den Zahlen (blendet nur ein/aus, verschiebt nichts)
   action    { onClick, busy, label }   Haken: gesperrt bei Gleichstand, "ready" (pulsiert leise) sobald ein Ergebnis feststeht
   emptyAction { onClick, label, disabled? }  nur wenn gegeben UND beide Seiten 0 sind: statt des Hakens die karierte Fahne
             (gleiche Stelle, gleiche Groesse). Bei 0:0 gibt es kein gueltiges Ergebnis - der Haken waere ohnehin tot, und die
             Fahne schlaegt den einzigen sinnvollen Schritt vor. Ohne emptyAction bleibt es beim gesperrten Haken. */
const PHI = 1.618;
// Gleiche Formel wie --ws-u in der CSS: clamp(11px, 7px + 1,25 % der Tafelbreite, 18px).
const wsUnit = (w) => Math.min(18, Math.max(11, 7 + 0.0125 * w));
// Im flachen Querformat (Handy quer) wird der Avatar zusaetzlich nach der Hoehe begrenzt, damit die Tafel samt Haken ohne Scrollen passt.
const avatarFor = (boardWidth, winH) => {
  const base = Math.round(wsUnit(boardWidth) * PHI ** 4);
  return winH && winH < 520 ? Math.min(base, Math.round(winH * 0.13)) : base;
};

export default function ScoreBoard({ sides, counters = true, hasBreak = false, note = null, action, emptyAction = null, className = "" }) {
  // Die Avatargroesse richtet sich nach der Breite der TAFEL (nicht des Fensters): am PC steht links noch das Menue, am Tablet ist die App
  // schmaler als das Fenster. person(size) bekommt sie als Zahl.
  const [avatar, setAvatar] = useState(56);
  const roRef = useRef(null);
  const wRef = useRef(0);
  const wrapRef = useCallback((node) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => { wRef.current = e.contentRect.width; setAvatar(avatarFor(wRef.current, window.innerHeight)); });
    ro.observe(node);
    roRef.current = ro;
  }, []);
  useEffect(() => {
    const onResize = () => { if (wRef.current) setAvatar(avatarFor(wRef.current, window.innerHeight)); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [a, b] = sides;
  const digits = Math.max(String(a.score).length, String(b.score).length);
  const empty = counters && a.score === 0 && b.score === 0;
  const showFlag = empty && !!emptyAction;
  return (
    <div className="ws-board-wrap" ref={wrapRef}>
      <section className={"stat-block ws-board" + (hasBreak ? " has-break" : "") + (className ? " " + className : "")}>
        {sides.map((s, i) => {
          const k = i === 0 ? "a" : "b";
          return (
            <Fragment key={s.id}>
              <div className={"ws-b-person p" + k + (s.paused ? " is-paused" : "")}>{typeof s.person === "function" ? s.person(avatar) : s.person}</div>
              {hasBreak && s.breakMark}
              {counters && (
                <div className={"ws-b-cap c" + k} role="group" aria-label={s.label}>
                  <button type="button" disabled={s.score === 0} onClick={() => s.onBump(-1)} aria-label="minus"><Minus size={20} /></button>
                  <button type="button" onClick={() => s.onBump(1)} aria-label="plus"><Plus size={20} /></button>
                </div>
              )}
            </Fragment>
          );
        })}
        {/* Beide Zahlen haben eine feste Breite fuer mindestens zwei Stellen (--d): die linke waechst nach links, die rechte nach
            rechts, der Doppelpunkt bleibt in der Mitte der Karte. Ab drei Stellen wird die Schrift kleiner (--sc). */}
        <div className="ws-b-score" aria-live="polite" style={{ "--d": Math.max(2, digits), "--sc": digits > 2 ? 2 / digits : 1 }}>
          {counters ? (
            <>
              <span className="score-num sc-a" key={"a" + a.score}>{a.score}</span>
              <span className="ws-b-colon">:</span>
              <span className="score-num sc-b" key={"b" + b.score}>{b.score}</span>
            </>
          ) : <span className="ws-b-colon">vs</span>}
          <span className="ws-b-note" role="status" aria-live="polite">{note}</span>
        </div>
        {counters && (showFlag ? (
          <button type="button" key="flag" className="icon-btn ws-ok ws-b-ok flag" disabled={emptyAction.disabled} onClick={emptyAction.onClick}
            aria-label={emptyAction.label} title={emptyAction.label}>
            <CheckeredFlag size={26} />
          </button>
        ) : (
          <button type="button" key="check" className={"icon-btn primary ws-ok ws-b-ok" + (a.score !== b.score ? " ready" : "")}
            disabled={action.busy || a.score === b.score} onClick={action.onClick}
            aria-label={action.label || t("Eintragen")} title={action.label || t("Eintragen")}>
            <Check size={26} />
          </button>
        ))}
      </section>
    </div>
  );
}
