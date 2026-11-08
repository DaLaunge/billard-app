import { useState } from "react";
import { ChevronDown } from "lucide-react";
import InfoButton from "./InfoButton";

/* Einklappbare Karte der Verwaltung (2026-11-08, Nutzer: "als Admin ist das Menue schwierig zu bedienen, so viele Punkte"): Werkzeuge, die man selten braucht
   (Match nachtragen, Testmail, neuen Nutzer anlegen, Gaeste ...), stehen zugeklappt - nur der Kopf mit Symbol, Titel, Zaehler und Info-Knopf. Der Erklaertext
   steckt im Info-Knopf statt als Absatz in der Karte. Zustand je Karte pro Geraet in localStorage (`adminFold:<id>`). Der Kopf ist wie bei allen Karten ein
   `.stat-block-head`. */
export default function AdminFold({ id, icon, title, count, info, actions, nested = false, defaultOpen = false, children }) {
  const key = "adminFold:" + id;
  const [open, setOpen] = useState(() => {
    try { const v = localStorage.getItem(key); return v == null ? defaultOpen : v === "1"; } catch { return defaultOpen; }
  });
  const toggle = () => setOpen((v) => {
    const n = !v;
    try { localStorage.setItem(key, n ? "1" : "0"); } catch { /* egal */ }
    return n;
  });
  return (
    <section className={"stat-block admin-fold" + (open ? " is-open" : "") + (nested ? " nested" : "")}>
      <div className="stat-block-head">
        <button type="button" className="admin-fold-btn" onClick={toggle} aria-expanded={open}>
          {icon}
          <span className="admin-fold-title">{title}{count != null ? ` (${count})` : ""}</span>
          <ChevronDown size={16} className={"duel-chev" + (open ? " open" : "")} />
        </button>
        {(actions || info) && (
          <span className="stat-block-head-actions">
            {actions}
            {info && <InfoButton title={title}>{info}</InfoButton>}
          </span>
        )}
      </div>
      <div className={"collapsible" + (open ? " open" : "")} inert={open ? undefined : ""}>
        <div className="collapsible-inner">
          <div className="admin-fold-body">{children}</div>
        </div>
      </div>
    </section>
  );
}
