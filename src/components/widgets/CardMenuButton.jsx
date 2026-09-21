import { useEffect, useRef, useState } from "react";
import { MoreVertical, EyeOff } from "lucide-react";
import { t } from "../../lib/i18n";

/* Kartenmenü (Drei-Punkte) mit dem Ausblenden-Befehl darin.
   Nutzer-Feedback: "der Button für 'Karte ausblenden' kann irrtuemlich
   leicht vom User getroffen werden, da das Wiederherstellen muehsam ist,
   muss ein Missklick moeglichst ausgeschlossen sein" - vorher war
   Ausblenden ein einzelnes Symbol direkt neben dem Einklapp-Pfeil, also
   EIN Fehlgriff von "Karte weg". Jetzt braucht es zwei bewusste Schritte,
   und der erste (Menue oeffnen) ist folgenlos: daneben zu tippen kostet
   hoechstens ein Menue, das man wieder zuklappt.
   Deshalb steht der Menue-Knopf auch ganz LINKS in der Aktionsgruppe, also
   moeglichst weit weg vom Einklapp-Pfeil am Kartenrand, der am oeftesten
   getroffen wird.
   Der Eintrag ist bewusst Text statt Symbol - im Menue ist Platz dafuer,
   und "Karte ausblenden" ausgeschrieben laesst keinen Zweifel, was
   passiert. */
export default function CardMenuButton({ onHide }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // pointerdown statt click: schliesst das Menue auch, wenn woanders
    // gescrollt/gezogen wird. Klicks INNERHALB der Huelle (also auf den
    // Menueeintrag selbst) sind ausgenommen - sonst waere der Eintrag
    // schon aus dem DOM, bevor sein onClick ueberhaupt feuert.
    const onDoc = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!onHide) return null;

  return (
    <div className="card-menu-wrap" ref={wrapRef}>
      <button type="button" className="card-menu-btn" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        aria-label={t("Kartenmenü")} title={t("Kartenmenü")}>
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="card-menu" role="menu">
          <button type="button" className="card-menu-item" role="menuitem"
            onClick={() => { setOpen(false); onHide(); }}>
            <EyeOff size={15} /> {t("Karte ausblenden")}
          </button>
        </div>
      )}
    </div>
  );
}
