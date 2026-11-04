import { useState, useEffect } from "react";
import { Clock, Lock, Swords, UserX, X } from "lucide-react";
import { supabase } from "../../supabase";
import { t } from "../../lib/i18n";
import { activeDisciplines } from "../../lib/constants";
import { fmtPlanned, isoToParts, plannedToIso } from "../../lib/turnierTime";
import { DiscPick } from "./DiscBall";
import { BreakSwitch, breakApplies, normalizeBreakRule } from "./BreakRule";
import FieldLabel from "./FieldLabel";

/* Gemeinsame Bausteine der "Allgemein"-Angaben ALLER Turniermodi (Nutzer-Wunsch 2026-11-04): dieselben Felder beim Anlegen und in der
   Kopfzeile jedes Turniers - Name, Ort, Disziplin, Anstoss, Zeitpunkt, Leitung (spielt mit oder nicht). Name und Ort sind nach dem Anlegen
   fest, alles andere aendert die Leitung. */

// Zeitpunkt in der Info-Zeile (Uhr + "Fr 19:00"); nichts, wenn keiner gesetzt ist
export function PlannedPill({ iso }) {
  const txt = fmtPlanned(iso);
  if (!txt) return null;
  return <span className="info-ico planned-pill" title={t("Zeitpunkt")}><Clock size={14} /> {txt}</span>;
}

// Spielt die Turnierleitung mit? Immer sichtbar (an oder aus), damit man es auf einen Blick sieht.
export function OrganizerPlays({ plays }) {
  const label = plays ? t("Turnierleitung spielt mit") : t("Turnierleitung spielt nicht mit");
  return (
    <span className={"info-ico plays-chip " + (plays ? "on" : "off")} title={label} role="img" aria-label={label}>
      {plays ? <Swords size={14} /> : <UserX size={14} />}<span>{plays ? t("spielt mit") : t("leitet nur")}</span>
    </span>
  );
}

// Datum + Uhrzeit (zwei native Felder - am Handy der gewohnte Auswahldialog). onChange({date, time}).
export function PlannedPicker({ date, time, onChange, onClear }) {
  return (
    <div className="planned-picker">
      <input type="date" value={date} onChange={(e) => onChange({ date: e.target.value, time })} aria-label={t("Datum")} />
      <input type="time" value={time} onChange={(e) => onChange({ date, time: e.target.value })} aria-label={t("Uhrzeit")} />
      {onClear && (date || time) && (
        <button type="button" className="icon-btn small" onClick={onClear} aria-label={t("Zeitpunkt entfernen")} title={t("Zeitpunkt entfernen")}><X size={15} /></button>
      )}
    </div>
  );
}

/* Inhalt des Bearbeiten-Panels (ToolPanel) in der Kopfzeile jedes Turniers. Aenderungen gelten sofort (wie bei den Filtern): Disziplin
   (nur bis zum ersten Ergebnis), Anstoss-Regel, Zeitpunkt, und - nur fuer die Leitung selbst - ob sie mitspielt. */
export function TurnierInfoEditor({ kind, tour, name, placeName, canChangeDiscipline, plays, canTogglePlays, playsHint, onTogglePlays, onChanged, toast }) {
  const k = kind === "ws" ? "winner_stays" : "tournament";
  const [parts, setParts] = useState(() => isoToParts(tour.planned_at));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setParts(isoToParts(tour.planned_at)); }, [tour.planned_at]);
  const finished = tour.status === "finished";

  const run = async (fn, args) => {
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return false; }
    await onChanged?.();
    return true;
  };
  const setDiscipline = (d) => { if (d !== tour.discipline) run("set_tournament_info", { p_kind: k, p_id: tour.id, p_discipline: d, p_planned_at: null, p_clear_time: false }); };
  const setBreak = (r) => run("set_break_rule", { p_kind: k, p_id: tour.id, p_rule: r });
  const saveTime = (p) => {
    setParts(p);
    const iso = plannedToIso(p.date, p.time);
    if (iso) run("set_tournament_info", { p_kind: k, p_id: tour.id, p_discipline: null, p_planned_at: iso, p_clear_time: false });
  };
  const clearTime = () => { setParts({ date: "", time: "" }); run("set_tournament_info", { p_kind: k, p_id: tour.id, p_discipline: null, p_planned_at: null, p_clear_time: true }); };

  return (
    <div className="tinfo-editor">
      <div className="tinfo-locked">
        <Lock size={14} /> <b>{name}</b>{placeName && <span className="rank-meta"> · {placeName}</span>}
        <span className="rank-meta tinfo-locked-note">{t("Name und Ort sind nach dem Anlegen fest.")}</span>
      </div>

      <FieldLabel label={t("Disziplin")} info={canChangeDiscipline ? undefined : t("Die Disziplin lässt sich nach dem ersten gemeldeten Ergebnis nicht mehr ändern.")}
        actions={breakApplies(tour.discipline) ? <BreakSwitch value={normalizeBreakRule(tour.break_rule)} onChange={setBreak} /> : null} />
      <div className={"disc-picks" + (canChangeDiscipline && !finished ? "" : " locked")}>
        {activeDisciplines().map((d) => (
          <DiscPick key={d} disc={d} selected={tour.discipline === d} onSelect={() => { if (canChangeDiscipline && !finished && !busy) setDiscipline(d); }} />
        ))}
      </div>

      <FieldLabel label={t("Zeitpunkt")} />
      <PlannedPicker date={parts.date} time={parts.time} onChange={saveTime} onClear={tour.planned_at ? clearTime : undefined} />

      {canTogglePlays && (
        <>
          <FieldLabel label={t("Turnierleitung spielt mit")} info={playsHint} />
          <div className="chips small">
            <button type="button" className={"chip" + (plays ? " active" : "")} disabled={busy} onClick={() => { if (!plays) onTogglePlays(true); }}>{t("Ja")}</button>
            <button type="button" className={"chip" + (!plays ? " active" : "")} disabled={busy} onClick={() => { if (plays) onTogglePlays(false); }}>{t("Nein")}</button>
          </div>
        </>
      )}
    </div>
  );
}
