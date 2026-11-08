import { useState, useEffect } from "react";
import { MapPin, Check, Pencil, Trash2, Plus, AlertTriangle, Merge, Split } from "lucide-react";
import { supabase } from "../../supabase";
import { t } from "../../lib/i18n";
import { appConfirm } from "../../lib/confirmDialog";
import { useLocations, loadLocations, distanceM } from "../../lib/locationStore";
import RouteButton from "./RouteButton";
import LocationForm from "./LocationForm";

const RADII = [50, 100, 150, 300];

/* Verwaltung: alle Standorte pruefen, korrigieren, loeschen - und eng beieinander liegende zu einem zusammenfassen.
   Neue Lokale sind sofort frei (2026-11-08_locations_instant.sql); die Pruefung beim Eintragen meldet Auffaelliges (zu nah an einem anderen,
   weit weg, aehnlicher Name ...) in check_note an die Admins. Hier steht es oben und laesst sich mit "In Ordnung" abhaken. */
export default function AdminLocations({ players, toast }) {
  const { list, confirms } = useLocations();
  const [editId, setEditId] = useState(null); // id | "new" | null
  const [extra, setExtra] = useState({}); // id -> { check_note, check_ok_at, created_at } (eigene Abfrage: fehlt die Migration, bleibt es leer)
  const [radius, setRadius] = useState(150);
  const [keep, setKeep] = useState({}); // Cluster-Schluessel -> id des behaltenen Lokals
  const [busy, setBusy] = useState(false);
  const [distinct, setDistinct] = useState([]); // Ausnahmen: Paare {a, b}, die bewusst getrennte Lokale sind (eng beieinander, aber zwei Orte)
  const [showDistinct, setShowDistinct] = useState(false);
  const nick = (id) => players.find((p) => p.id === id)?.nickname;

  const loadExtra = async () => {
    const { data } = await supabase.from("locations").select("id, check_note, check_ok_at, created_at");
    const m = {};
    (data || []).forEach((r) => { m[r.id] = r; });
    setExtra(m);
    const { data: dp } = await supabase.from("location_distinct").select("a, b"); // fehlt die Migration: leer
    setDistinct(dp || []);
  };
  useEffect(() => { loadExtra(); }, [list.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const flagged = (l) => !!(extra[l.id]?.check_note && !extra[l.id]?.check_ok_at);
  const rows = [...list].sort((a, b) => (flagged(b) ? 1 : 0) - (flagged(a) ? 1 : 0) || (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || a.name.localeCompare(b.name));
  const nFlagged = list.filter(flagged).length;

  const call = async (fn, args, msg) => {
    const { error } = await supabase.rpc(fn, args);
    if (error) toast(t("Fehler: ") + error.message); else toast(msg);
    await loadLocations(true);
    loadExtra();
  };
  const remove = async (l) => {
    if (await appConfirm(t("Standort „{name}“ löschen? Bestehende Live-Einträge behalten ihren Namen.", { name: l.name }))) {
      call("delete_location", { p_id: l.id }, t("Standort gelöscht."));
    }
  };

  const pairKey = (x, y) => (x < y ? x + "|" + y : y + "|" + x);
  const distinctSet = new Set(distinct.map((d) => pairKey(d.a, d.b)));
  const isDistinct = (x, y) => distinctSet.has(pairKey(x, y));
  // Cluster: Lokale, die (ueber Ketten) hoechstens `radius` Meter auseinander liegen
  const clusters = (() => {
    const parent = list.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      if (distanceM(list[i], list[j]) <= radius && !isDistinct(list[i].id, list[j].id)) parent[find(i)] = find(j);
    }
    const g = {};
    list.forEach((l, i) => { (g[find(i)] ||= []).push(l); });
    return Object.values(g).filter((c) => c.length > 1).map((c) => {
      const members = [...c].sort((a, b) => String(extra[a.id]?.created_at || "").localeCompare(String(extra[b.id]?.created_at || "")) || a.name.localeCompare(b.name));
      return { key: members.map((m) => m.id).join("|"), members };
    });
  })();
  const merge = async (c) => {
    const keepId = keep[c.key] && c.members.some((m) => m.id === keep[c.key]) ? keep[c.key] : c.members[0].id;
    const keeper = c.members.find((m) => m.id === keepId);
    const drops = c.members.filter((m) => m.id !== keepId);
    if (!(await appConfirm(t("„{keep}“ behalten und {drop} hineinfassen? Planungen, Turniere und Herausforderungen werden umgehängt, die anderen Lokale gelöscht.", { keep: keeper.name, drop: drops.map((d) => `„${d.name}“`).join(", ") })))) return;
    setBusy(true);
    // erst alles auf das behaltene Lokal umhaengen, dann die doppelten loeschen (zwei getrennte Schritte: die SQL-Funktion ist eine einzelne Anweisung)
    const { data, error } = await supabase.rpc("merge_locations", { p_keep: keepId, p_drop: drops.map((d) => d.id) });
    if (error || !data) { toast(t("Fehler: ") + (error?.message || t("Zusammenführen nicht möglich."))); setBusy(false); return; }
    for (const d of drops) {
      const { error: e2 } = await supabase.rpc("delete_location", { p_id: d.id });
      if (e2) { toast(t("Fehler: ") + e2.message); break; }
    }
    toast(t("Lokale zusammengeführt."));
    await loadLocations(true);
    loadExtra();
    setBusy(false);
  };

  const keepApart = async (c) => {
    setBusy(true);
    await call("mark_locations_distinct", { p_ids: c.members.map((m) => m.id) }, t("Als getrennte Lokale gemerkt."));
    setBusy(false);
  };
  const name = (id) => list.find((l) => l.id === id)?.name || "?";

  return (
    <div className="admin-locs">
      {nFlagged > 0 && <p className="hint admin-loc-flagcount"><AlertTriangle size={14} /> {t("Zu prüfen")}: {nFlagged}</p>}
      {rows.length === 0 && <p className="hint">{t("Noch keine Standorte.")}</p>}
      {rows.map((l) => (
        <div key={l.id} className={"admin-loc-row" + (flagged(l) ? " flagged" : "")}>
          {editId === l.id ? (
            <LocationForm initial={l} toast={toast} onCancel={() => setEditId(null)} onSaved={() => { setEditId(null); loadExtra(); }} />
          ) : (
            <>
              <div className="loc-sel-txt">
                <b><MapPin size={14} /> {l.name}{l.status === "pending" ? " ⏳" : ""}</b>
                {l.address && <span className="rank-meta">{l.address}</span>}
                {flagged(l) && <span className="admin-loc-note"><AlertTriangle size={13} /> {extra[l.id].check_note}</span>}
                <span className="rank-meta">
                  {l.status === "pending" ? t("Vorschlag von {n}", { n: nick(l.created_by) || "?" }) + ` · ${confirms.filter((c) => c.location_id === l.id).length}/2 ${t("bestätigt")}`
                    : flagged(l) ? t("Eingetragen von {n}", { n: nick(l.created_by) || "?" })
                    : (l.updated_by ? t("zuletzt geändert von {n}", { n: nick(l.updated_by) || "?" }) : "")}
                </span>
              </div>
              <div className="admin-loc-actions">
                {l.status === "pending" && (
                  <button type="button" className="icon-btn small primary" onClick={() => call("approve_location", { p_id: l.id }, t("Standort freigegeben."))}
                    aria-label={t("Freigeben")} title={t("Freigeben")}><Check size={16} /></button>
                )}
                {l.status !== "pending" && flagged(l) && (
                  <button type="button" className="icon-btn small primary" onClick={() => call("review_location", { p_id: l.id }, t("Meldung erledigt."))}
                    aria-label={t("In Ordnung")} title={t("In Ordnung")}><Check size={16} /></button>
                )}
                <RouteButton place={l} size={15} />
                <button type="button" className="icon-btn small" onClick={() => setEditId(l.id)} aria-label={t("Standort korrigieren")} title={t("Standort korrigieren")}><Pencil size={15} /></button>
                <button type="button" className="icon-btn small" onClick={() => remove(l)} aria-label={t("Löschen")} title={t("Löschen")}><Trash2 size={15} /></button>
              </div>
            </>
          )}
        </div>
      ))}
      {editId === "new" ? (
        <LocationForm toast={toast} onCancel={() => setEditId(null)} onSaved={() => { setEditId(null); loadExtra(); }} />
      ) : (
        <button type="button" className="btn ghost small" onClick={() => setEditId("new")}><Plus size={15} /> {t("Neuer Standort")}</button>
      )}

      <div className="admin-loc-merge">
        <h4><Merge size={16} /> {t("Lokale zusammenführen")}</h4>
        <p className="hint">{t("Lokale, die sehr eng beieinander liegen, lassen sich zu einem zusammenfassen: Das gewählte bleibt, die anderen werden gelöscht, alles was auf sie zeigt (Planungen, Turniere, Herausforderungen, Winner-Stays-Runden) zeigt danach auf das behaltene.")}</p>
        <div className="chips small" role="group" aria-label={t("Umkreis")}>
          <span className="rank-meta">{t("Umkreis")}</span>
          {RADII.map((r) => <button key={r} type="button" className={"chip" + (radius === r ? " active" : "")} onClick={() => setRadius(r)}>{r} m</button>)}
        </div>
        {clusters.length === 0 && <p className="hint">{t("Keine Lokale, die so eng beieinander liegen.")}</p>}
        {clusters.map((c) => {
          const keepId = keep[c.key] && c.members.some((m) => m.id === keep[c.key]) ? keep[c.key] : c.members[0].id;
          const keeper = c.members.find((m) => m.id === keepId);
          return (
            <div key={c.key} className="admin-loc-cluster">
              {c.members.map((m) => (
                <label key={m.id} className={"admin-loc-pick" + (m.id === keepId ? " on" : "")}>
                  <input type="radio" name={"keep-" + c.key} checked={m.id === keepId} onChange={() => setKeep((k) => ({ ...k, [c.key]: m.id }))} />
                  <span className="loc-sel-txt">
                    <b>{m.name}</b>
                    {m.address && <span className="rank-meta">{m.address}</span>}
                  </span>
                  <span className="rank-meta">{m.id === keepId ? t("behalten") : `${Math.round(distanceM(keeper, m))} m`}</span>
                </label>
              ))}
              <div className="admin-loc-cluster-actions">
                <button type="button" className="btn primary small" disabled={busy} onClick={() => merge(c)}><Merge size={15} /> {t("{n} Lokale zusammenführen", { n: c.members.length })}</button>
                <button type="button" className="btn ghost small" disabled={busy} onClick={() => keepApart(c)} title={t("Sind wirklich verschiedene Orte – nicht wieder vorschlagen")}><Split size={15} /> {t("Getrennt lassen")}</button>
              </div>
            </div>
          );
        })}
        {distinct.length > 0 && (
          <>
            <button type="button" className="loc-linkbtn" onClick={() => setShowDistinct((v) => !v)}>{t("Bewusst getrennt")} ({distinct.length})</button>
            {showDistinct && distinct.map((d) => (
              <div key={pairKey(d.a, d.b)} className="admin-loc-pick">
                <span className="loc-sel-txt"><b>{name(d.a)}</b><span className="rank-meta">{name(d.b)}</span></span>
                <button type="button" className="btn ghost small" onClick={() => call("unmark_locations_distinct", { p_a: d.a, p_b: d.b }, t("Ausnahme aufgehoben."))}>{t("Aufheben")}</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
