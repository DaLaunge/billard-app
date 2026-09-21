import { useRef, useState } from "react";
import { t } from "./i18n";
import { normalizeHiddenCards, mergeCardLayout, screenCards } from "./cardLayout";

/* Ausgeblendete Karten EINES Bildschirms (Nutzer-Feedback: "es werden
   mittlerweile so viele Karten, dass es unuebersichtlich ist") - der
   gemeinsame Zustand hinter dem Ausblenden-Knopf an jeder Karte, dem
   "Alle Karten einblenden"-Knopf ganz unten auf jedem Bildschirm und der
   Karten-Liste in den Einstellungen (Profil bearbeiten).

   Optimistisches Update wie bei der Kartenreihenfolge (siehe persistLayout
   in StatistikScreen.jsx): die Aenderung ist sofort sichtbar und wird bei
   einem RPC-Fehler wieder zurueckgerollt. Der lokale Zustand wird bewusst
   nur EINMAL aus den Props initialisiert - jeder Bildschirm wird beim
   Tab-Wechsel neu gemountet (siehe tab-basiertes Rendering in App.jsx) und
   liest dabei den frischen Serverstand; ein useEffect-Resync waehrend der
   Anzeige wuerde nur mit dem optimistischen Update kollidieren.

   cardLayout ist der komplette card_layout-Wert des Spielers (alle
   Bildschirme), damit mergeCardLayout() die Reihenfolge/Spaltenwahl
   desselben Bildschirms nicht ueberschreibt.

   toast ist optional - wo er mitkommt, meldet das Ausblenden sich mit einem
   "Rueckgaengig" (Nutzer-Feedback: "mach ein Rueckgaengig moeglich", nachdem
   schon das versehentliche Ausblenden als Problem aufgefallen war). Das
   betrifft bewusst nur hideCard(), also den Weg ueber das Kartenmenue: in
   den Einstellungen liegt der Chip zum Zurueckschalten ohnehin direkt unter
   dem Finger. */
export function useHiddenCards(screen, cardLayout, onSetCardLayout, toast) {
  const saved = cardLayout?.[screen];
  const [hidden, setHidden] = useState(() => new Set(normalizeHiddenCards(saved, screen)));
  // Immer den FRISCHEN Serverstand mergen, nicht den aus dem Render, in dem
  // die Aktion entstanden ist: zwischen Ausblenden und "Rueckgaengig" liegen
  // bis zu 6,5 s, in denen z.B. eine Karte verschoben worden sein kann -
  // ohne Ref schriebe das Rueckgaengig diese Verschiebung wieder weg.
  const savedRef = useRef(saved);
  savedRef.current = saved;

  const persist = async (next) => {
    if (!onSetCardLayout) return;
    const prev = hidden;
    setHidden(next);
    const ok = await onSetCardLayout(screen, mergeCardLayout(savedRef.current, { hidden: [...next] }));
    if (!ok) setHidden(prev);
  };

  return {
    hidden,
    isHidden: (id) => hidden.has(id),
    hiddenCount: hidden.size,
    // Das Rueckgaengig stellt den Stand VOR dem Ausblenden wieder her (die
    // Momentaufnahme "prev"), statt nur diese eine Karte wieder
    // einzublenden - bei genau einer Aenderung ist das dasselbe, aber es
    // kann per Definition nichts anderes mit verstellen.
    hideCard: (id) => {
      if (hidden.has(id)) return;
      const prev = hidden;
      persist(new Set([...hidden, id]));
      const label = screenCards(screen).find((c) => c.id === id)?.label;
      if (toast) {
        toast(label ? t("Ausgeblendet: {name}", { name: t(label) }) : t("Karte ausgeblendet"),
          { label: t("Rückgängig"), onAction: () => persist(prev) });
      }
    },
    showCard: (id) => { if (hidden.has(id)) { const n = new Set(hidden); n.delete(id); persist(n); } },
    toggleCard: (id) => { const n = new Set(hidden); n.has(id) ? n.delete(id) : n.add(id); persist(n); },
    hideAll: () => persist(new Set(screenCards(screen).map((c) => c.id))),
    showAll: () => { if (hidden.size) persist(new Set()); },
    // Nur den lokalen Stand leeren, ohne zu speichern - fuer den
    // "Zuruecksetzen"-Knopf im Profil, der per reset_card_layout() ohnehin
    // schon den ganzen card_layout-Eintrag geloescht hat (ein showAll()
    // danach wuerde ihn mit {"hidden": []} gleich wieder anlegen).
    clearLocal: () => setHidden(new Set()),
  };
}
