import { useState, useRef, useEffect } from "react";
import { Plus, X, ChevronDown, RefreshCw, Check } from "lucide-react";
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TUTORIAL_STEPS } from "../lib/tutorial/steps";
import Ball from "./Ball";
import { initials } from "../lib/format";
import { t } from "../lib/i18n";
import { APP_VERSION } from "../lib/constants";

/* Menue-Drawer am Handy, feste Seitenleiste am PC (ab 900px, siehe .app-drawer
   in App.css). Alle Farben nur ueber die Theme-Variablen, damit Farbdesigns
   und eigener Akzent unveraendert greifen. Die vier Hauptpunkte stehen hier
   noch einmal, damit Seitenleiste und Leiste unten dieselben Ziele haben. */
function Row({ e, pinned, slot, go, tourOpen, onToggleTour, onTutorial }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: e.id });
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.7 : 1, touchAction: "manipulation", zIndex: isDragging ? 3 : undefined };
  const Icon = e.icon;
  const isTour = e.id === "tutorial";
  return (
    <div ref={setNodeRef} style={style} className={"app-drawer-row" + (isDragging ? " dragging" : "") + (pinned ? " pinned" : "")} {...attributes} {...listeners}>
      <button data-tour={e.tour} className={"app-drawer-item" + (e.on || (isTour && tourOpen) ? " on" : "")}
        onClick={isTour ? onToggleTour : go(e.run)} aria-expanded={isTour ? tourOpen : undefined}>
        <Icon size={19} /><span>{t(e.label)}</span>
        {e.badge ? <em className="app-drawer-badge">{e.badge}</em> : null}
        {isTour && <ChevronDown size={16} className={"app-drawer-chev" + (tourOpen ? " up" : "")} />}
      </button>
      {pinned && (
        <span className="app-drawer-slot" title={t("Platz {n} in der Leiste", { n: slot })} aria-label={t("Platz {n} in der Leiste", { n: slot })}>{slot}</span>
      )}
      {isTour && tourOpen && (
        <div className="app-drawer-sub">
          <button className="app-drawer-item" onClick={go(() => onTutorial(null))}><span>{t("Ganze Tour")}</span></button>
          {TUTORIAL_STEPS.filter((st) => st.id !== "welcome").map((st) => (
            <button key={st.id} className="app-drawer-item" onClick={go(() => onTutorial(st.id))}><span>{t(st.title)}</span></button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppDrawer({
  open, onClose, player, onNewMatch, onTutorial, onCheckUpdate, colorOf, badgeOf, photoOf,
  entries, maxPinned, onReorder,
}) {
  const [tourOpen, setTourOpen] = useState(false);
  // Update-Zeile: idle | checking | found | current | error | unavailable (vorher im Profil)
  const [updState, setUpdState] = useState("idle");
  const updTimer = useRef(null);
  useEffect(() => () => clearTimeout(updTimer.current), []);
  const runUpdateCheck = async () => {
    clearTimeout(updTimer.current);
    setUpdState("checking");
    // Mindestens 1,2 s, sonst blitzt der Laufbalken nur kurz auf und man weiss nicht, ob geprueft wurde.
    const [res] = await Promise.all([onCheckUpdate(), new Promise((r) => setTimeout(r, 1200))]);
    setUpdState(res || "error");
    if (res !== "found") updTimer.current = setTimeout(() => setUpdState("idle"), 7000);
  };
  const go = (fn) => () => { onClose(); fn(); };
  const sensors = useSensors(
    // Maus: sofort ab 6 px Bewegung (ein Klick bleibt ein Klick). Die frueheren 250 ms Halten galten auch fuer die Maus - wer gleich zog,
    // brach die Aktivierung ab, und das Verschieben "ging nicht mehr". Touch behaelt das Halten (sonst waere Scrollen unmoeglich).
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  // EINE Liste (Nutzer-Wunsch): die obersten maxPinned Punkte sind die Leiste unten, alle anderen "Weitere Menues". Ziehen verschiebt wie in jeder
  // normalen Liste - ueber die Grenze hinweg ruecken die uebrigen Punkte einfach nach (kein Tausch).
  const pinnedList = entries.slice(0, maxPinned);
  const otherList = entries.slice(maxPinned);
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const ids = entries.map((x) => x.id);
    onReorder(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)));
  };
  // EIN flaches Array mit stabilen keys: nur so behaelt React die Zeile, wenn sie zwischen den Gruppen wandert (verschachtelte Arrays waeren
  // getrennte Slots und bauten die Zeile neu auf).
  const drawerItems = [];
  drawerItems.push(<div key="label-bar" className="app-drawer-label">{t("Menüleiste")}</div>);
  pinnedList.forEach((e, i) => {
    if (i === Math.ceil(pinnedList.length / 2)) {
      drawerItems.push(
        <button key="fab" data-tour="tab-fab" className="app-drawer-item app-drawer-new" onClick={go(onNewMatch)}>
          <span className="app-drawer-fab"><Plus size={16} /></span><span>{t("Neues Match")}</span>
        </button>
      );
    }
    drawerItems.push(<Row key={e.id} e={e} pinned slot={i + 1} go={go} tourOpen={tourOpen} onToggleTour={() => setTourOpen((v) => !v)} onTutorial={onTutorial} />);
  });
  drawerItems.push(<div key="sep" className="app-drawer-sep" />);
  drawerItems.push(<div key="label-more" className="app-drawer-label">{t("Weitere Menüs")}</div>);
  otherList.forEach((e) => {
    drawerItems.push(
      <Row key={e.id} e={e} pinned={false} go={go} tourOpen={tourOpen} onToggleTour={() => setTourOpen((v) => !v)} onTutorial={onTutorial} />
    );
  });
  if (otherList.length === 0) drawerItems.push(<p key="none" className="app-drawer-hint">{t("Alles ist an der Leiste angeheftet.")}</p>);
  return (
    <>
      {open && <div className="app-drawer-scrim" onClick={onClose} aria-hidden="true" />}
      <aside data-tour="burger" className={"app-drawer" + (open ? " open" : "")} aria-label={t("Menü")} aria-hidden={!open ? undefined : false}>
        <div className="app-drawer-top">
          <Ball nick={player?.nickname} color={colorOf(player?.nickname)} label={initials(player?.nickname)} badge={badgeOf(player?.nickname)}
            photo={photoOf(player?.nickname)} size={40} />
          <div className="app-drawer-who">
            <strong>{player?.nickname}</strong>
          </div>
          <button className="app-drawer-close" onClick={onClose} aria-label={t("Schließen")}><X size={18} /></button>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={entries.map((x) => x.id)} strategy={verticalListSortingStrategy}>
            {/* EIN Behaelter fuer beide Gruppen und jede Zeile mit stabilem key (418.0): zieht man einen Punkt zwischen "Menueleiste" und
                "Weitere Menues", wird die Zeile nur verschoben und nicht neu aufgebaut. Zwei getrennte <nav> mit verschiedenen Elternknoten
                bauten die Zeile bei jedem Tausch neu auf - ein laufender Touch verlor dabei sein Ziel, das zweite Verschieben ging nicht mehr. */}
            <nav className="app-drawer-nav">
              {drawerItems}
            </nav>
          </SortableContext>
        </DndContext>
        <p className="app-drawer-hint">{t("Zum Verschieben ziehen (am Handy gedrückt halten). Die obersten vier Punkte stehen unten in der Leiste.")}</p>
        <button type="button" className={"app-drawer-update " + updState} data-tour="update-btn"
          disabled={updState === "checking" || updState === "found"} onClick={runUpdateCheck}>
          {updState === "found" || updState === "current" ? <Check size={18} /> : <RefreshCw size={17} className={updState === "checking" ? "spin" : ""} />}
          <span className="app-drawer-update-text" aria-live="polite">
            <strong>
              {updState === "checking" ? t("Suche nach Updates …")
                : updState === "found" ? t("Update gefunden – wird installiert …")
                : updState === "current" ? t("Du hast die neueste Version.")
                : updState === "error" ? t("Prüfung fehlgeschlagen – bist du online?")
                : updState === "unavailable" ? t("Updates können hier nicht geprüft werden.")
                : t("Nach Updates suchen")}
            </strong>
            <small>{t("Version")} {APP_VERSION}</small>
          </span>
        </button>
      </aside>
    </>
  );
}
