import { Fragment, useState, useRef, useEffect } from "react";
import { Plus, X, ChevronDown, RefreshCw, Check, Pin } from "lucide-react";
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
function Row({ e, pinned, slot, pickOpen, pinnedEntries, onPick, onSwap, go, tourOpen, onToggleTour, onTutorial }) {
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
      {pinned ? (
        <span className="app-drawer-slot" title={t("Platz {n} in der Leiste", { n: slot })} aria-label={t("Platz {n} in der Leiste", { n: slot })}>{slot}</span>
      ) : (
        <button type="button" className={"app-drawer-pin" + (pickOpen ? " on" : "")} onClick={onPick} aria-expanded={pickOpen}
          aria-label={t("An die Leiste anheften")} title={t("An die Leiste anheften")}>
          <Pin size={15} />
        </button>
      )}
      {!pinned && pickOpen && (
        <div className="app-drawer-pick" role="group" aria-label={t("Welchen Punkt ersetzen?")}>
          <span className="app-drawer-pick-title">{t("Statt welchem Punkt anheften?")}</span>
          <div className="app-drawer-pick-chips">
            {pinnedEntries.map((pe, i) => {
              const PIcon = pe.icon;
              return (
                <button key={pe.id} type="button" className="app-drawer-pick-chip" onClick={() => onSwap(e.id, pe.id)}>
                  <b>{i + 1}</b><PIcon size={15} /><span>{t(pe.label)}</span>
                </button>
              );
            })}
          </div>
        </div>
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
  entries, pinnedIds, onChange, onSwap,
}) {
  const [tourOpen, setTourOpen] = useState(false);
  const [pickFor, setPickFor] = useState(null);
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
    useSensor(MouseSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  // Zwei Gruppen: oben die in der Leiste angehefteten, darunter die uebrigen. Zwischen den Gruppen ziehen
  // heftet an bzw. loest. Gespeichert wird die Reihenfolge der angezeigten Liste.
  const pinnedList = entries.filter((x) => pinnedIds.includes(x.id));
  const otherList = entries.filter((x) => !pinnedIds.includes(x.id));
  const display = [...pinnedList, ...otherList];
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const ids = display.map((x) => x.id);
    const aPinned = pinnedIds.includes(active.id);
    const oPinned = pinnedIds.includes(over.id);
    if (aPinned === oPinned) { onChange(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)), pinnedIds); return; }
    // Ueber die Gruppen hinweg TAUSCHEN die beiden ihre Plaetze: die Leiste bleibt dadurch immer voll.
    const swapped = [...ids];
    const ai = ids.indexOf(active.id), oi = ids.indexOf(over.id);
    swapped[ai] = over.id; swapped[oi] = active.id;
    onChange(swapped, pinnedIds.map((x) => (x === active.id ? over.id : x === over.id ? active.id : x)));
  };
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
          <SortableContext items={display.map((x) => x.id)} strategy={verticalListSortingStrategy}>
            <div className="app-drawer-label">{t("Menüleiste")}</div>
            <nav className="app-drawer-nav">
              {/* Genau wie unten in der Leiste: Plaetze 1 bis n von links nach rechts, das runde "+" steht dazwischen. */}
              {pinnedList.map((e, i) => (
                <Fragment key={e.id}>
                  {i === Math.ceil(pinnedList.length / 2) && (
                    <button data-tour="tab-fab" className="app-drawer-item app-drawer-new" onClick={go(onNewMatch)}>
                      <span className="app-drawer-fab"><Plus size={16} /></span><span>{t("Neues Match")}</span>
                    </button>
                  )}
                  <Row e={e} pinned slot={i + 1} go={go} tourOpen={tourOpen} onToggleTour={() => setTourOpen((v) => !v)} onTutorial={onTutorial} />
                </Fragment>
              ))}
            </nav>
            <div className="app-drawer-sep" />
            <div className="app-drawer-label">{t("Weitere Menüs")}</div>
            <nav className="app-drawer-nav">
              {otherList.map((e) => (
                <Row key={e.id} e={e} pinned={false} pickOpen={pickFor === e.id} pinnedEntries={pinnedList}
                  onPick={() => setPickFor((cur) => (cur === e.id ? null : e.id))}
                  onSwap={(newId, oldId) => { setPickFor(null); onSwap(newId, oldId); }}
                  go={go} tourOpen={tourOpen} onToggleTour={() => setTourOpen((v) => !v)} onTutorial={onTutorial} />
              ))}
              {otherList.length === 0 && <p className="app-drawer-hint">{t("Alles ist an der Leiste angeheftet.")}</p>}
            </nav>
          </SortableContext>
        </DndContext>
        <p className="app-drawer-hint">{t("Gedrückt halten zum Verschieben. Nadel: einen Punkt in die Leiste holen und dafür einen anderen ersetzen.")}</p>
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
