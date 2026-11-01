import { useState } from "react";
import { MapPin, Check, ShieldCheck, ExternalLink, ChevronDown } from "lucide-react";
import { supabase } from "../../supabase";
import { t } from "../../lib/i18n";
import { useLocations, loadLocations, mapUrl } from "../../lib/locationStore";
import RouteButton from "./RouteButton";

/* Lokale anderer Spieler bestaetigen (supabase/2026-10-27d_location_confirmations.sql): ein neues Lokal wird nach zwei
   Bestaetigungen anderer Mitglieder freigegeben. Zeigt je Lokal "n/2 bestaetigt", einen Knopf "Stimmt" und den Zaehler,
   wie viele Lokale man selbst schon bestaetigt hat. Erscheint nur, wenn etwas zu bestaetigen ist oder man schon bestaetigt hat. */
const NEEDED = 2;

export default function LocationReview({ me, players, toast }) {
  const { list, confirms, available } = useLocations();
  const [busy, setBusy] = useState(null);
  const [open, setOpen] = useState(true);
  if (!available || !me) return null;

  const mine = confirms.filter((c) => c.player_id === me.id).length;
  const todo = list.filter((l) => l.status === "pending" && l.created_by !== me.id);
  const nick = (id) => players?.find((p) => p.id === id)?.nickname || "?";
  const count = (id) => confirms.filter((c) => c.location_id === id).length;
  const done = (id) => confirms.some((c) => c.location_id === id && c.player_id === me.id);
  if (todo.length === 0 && mine === 0) return null;

  const confirm = async (l) => {
    setBusy(l.id);
    const { data, error } = await supabase.rpc("confirm_location", { p_id: l.id });
    setBusy(null);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(data >= NEEDED ? t("Danke! „{name}“ ist jetzt freigegeben.", { name: l.name }) : t("Danke fürs Bestätigen!"));
    loadLocations(true);
  };

  return (
    <section className="stat-block loc-review">
      <div className="stat-block-head">
        <h3><ShieldCheck size={17} /> {t("Lokale bestätigen")}{todo.length > 0 ? ` (${todo.length})` : ""}</h3>
        <span className="loc-review-count" title={t("Von dir bestätigte Lokale")}><Check size={13} /> {mine}</span>
        <button type="button" className="icon-btn small" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          aria-label={open ? t("Zuklappen") : t("Aufklappen")} title={open ? t("Zuklappen") : t("Aufklappen")}>
          <ChevronDown size={16} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </button>
      </div>
      <div className={"collapsible" + (open ? " open" : "")} inert={open ? undefined : ""}>
        <div className="collapsible-inner">
          {todo.length === 0 && <p className="hint">{t("Gerade ist nichts zu bestätigen.")}</p>}
          {todo.map((l) => (
            <div key={l.id} className="loc-review-row">
              <div className="loc-sel-txt">
                <b><MapPin size={14} /> {l.name}</b>
                {l.address && <span className="rank-meta">{l.address}</span>}
                <span className="rank-meta">{t("Eingetragen von {n}", { n: nick(l.created_by) })} · {count(l.id)}/{NEEDED} {t("bestätigt")}</span>
              </div>
              <a className="icon-btn small" href={mapUrl(l.lat, l.lng)} target="_blank" rel="noreferrer"
                aria-label={t("Auf der Karte ansehen")} title={t("Auf der Karte ansehen")}><MapPin size={15} /></a>
              <RouteButton place={l} size={15} />
              {done(l.id) ? (
                <span className="loc-review-done"><Check size={14} /> {t("Bestätigt")}</span>
              ) : (
                <button type="button" className="chip-btn ok" disabled={busy === l.id} onClick={() => confirm(l)}>
                  <Check size={15} /> {t("Stimmt")}
                </button>
              )}
            </div>
          ))}
          <p className="hint">{t("Bestätige ein Lokal nur, wenn du es kennst oder der Ort auf der Karte passt. Zwei Bestätigungen geben es frei.")}</p>
        </div>
      </div>
    </section>
  );
}
