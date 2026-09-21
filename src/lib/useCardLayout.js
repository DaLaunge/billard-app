import { useRef, useState } from "react";
import { t } from "./i18n";
import {
  normalizeCardOrder, normalizeCardColumns, normalizeHiddenCards,
  mergeCardLayout, moveInOrder, screenCards, screenColumns, splitCardColumns,
} from "./cardLayout";

/* Karten-Anordnung + Sichtbarkeit EINES Bildschirms - der gemeinsame
   Zustand hinter

     - dem Drag & Drop auf der Statistik (setzt order/columns),
     - dem Spalten-Knopf an jeder Statistik-Karte (columns),
     - dem Ausblenden-Knopf im Kartenmenue jeder Karte (hidden),
     - dem "Alle Karten einblenden"-Knopf ganz unten auf jedem Bildschirm,
     - und der Karten-Liste in den Einstellungen (Profil bearbeiten ->
       Karten), die Reihenfolge, Spalte und Sichtbarkeit aller Bildschirme
       an EINER Stelle zeigt.

   Frueher waren das zwei getrennte Wege (useHiddenCards fuer die
   Sichtbarkeit, eigener State in StatistikScreen fuer Reihenfolge/Spalte).
   Beide schrieben in denselben card_layout-Eintrag, was jedes Mal ein
   sorgfaeltiges mergeCardLayout() erforderte, damit nicht einer den Teil
   des anderen ueberschreibt. Seit die Anordnung auf allen Bildschirmen
   aenderbar ist, liegt beides hier zusammen: EIN Zustand, EIN Schreibweg,
   und der Merge-Fehler ist strukturell nicht mehr moeglich.

   Optimistisches Update: die Aenderung ist sofort sichtbar und wird bei
   einem RPC-Fehler wieder zurueckgerollt. Der lokale Zustand wird bewusst
   nur EINMAL aus den Props initialisiert - jeder Bildschirm wird beim
   Tab-Wechsel neu gemountet (siehe tab-basiertes Rendering in App.jsx) und
   liest dabei den frischen Serverstand; ein useEffect-Resync waehrend der
   Anzeige wuerde nur mit dem optimistischen Update kollidieren.

   cardLayout ist der komplette card_layout-Wert des Spielers (alle
   Bildschirme), damit mergeCardLayout() Eintraege anderer Bildschirme
   nicht antastet.

   toast ist optional - wo er mitkommt, meldet das Ausblenden sich mit einem
   "Rueckgaengig" (Nutzer-Feedback: "mach ein Rueckgaengig moeglich", nachdem
   schon das versehentliche Ausblenden als Problem aufgefallen war). Das
   betrifft bewusst nur hideCard(), also den Weg ueber das Kartenmenue: in
   den Einstellungen liegt der Schalter zum Zurueckschalten ohnehin direkt
   unter dem Finger. */
export function useCardLayout(screen, cardLayout, onSetCardLayout, toast) {
  const saved = cardLayout?.[screen];
  const [order, setOrder] = useState(() => normalizeCardOrder(saved, screen));
  const [columns, setColumns] = useState(() => normalizeCardColumns(saved, normalizeCardOrder(saved, screen), screen));
  const [hidden, setHidden] = useState(() => new Set(normalizeHiddenCards(saved, screen)));
  // Ein Schritt Rueckgaengig fuer Anordnungs-Aenderungen (Nutzer-Feedback:
  // "vergiss nicht, einen Rückgängig Button zu implementieren") - haelt den
  // Stand VOR der letzten Aenderung, nicht einen ganzen Verlauf. Wird beim
  // Rueckgaengig-Machen selbst geleert statt erneut befuellt; ein zweites
  // Rueckgaengig in Folge macht daher nichts (bewusst einfach gehalten).
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  // Immer den FRISCHEN Serverstand mergen, nicht den aus dem Render, in dem
  // die Aktion entstanden ist: zwischen Ausblenden und "Rueckgaengig" liegen
  // bis zu 6,5 s, in denen z.B. eine Karte verschoben worden sein kann -
  // ohne Ref schriebe das Rueckgaengig diese Verschiebung wieder weg.
  const savedRef = useRef(saved);
  savedRef.current = saved;

  // Schreibt IMMER alle drei Felder: seit sie in einem Zustand liegen, ist
  // das billiger und eindeutiger als ein Teil-Patch.
  const apply = async (next, undoable) => {
    if (!onSetCardLayout) return false;
    const prev = { order, columns, hidden };
    if (undoable) setUndoSnapshot(prev);
    setOrder(next.order);
    setColumns(next.columns);
    setHidden(next.hidden);
    const ok = await onSetCardLayout(screen, mergeCardLayout(savedRef.current, {
      order: next.order, columns: next.columns, hidden: [...next.hidden],
    }));
    if (!ok) {
      setOrder(prev.order);
      setColumns(prev.columns);
      setHidden(prev.hidden);
      if (undoable) setUndoSnapshot(null);
    }
    return ok;
  };
  const withOrder = (nextOrder, nextColumns) =>
    apply({ order: nextOrder, columns: nextColumns || columns, hidden }, true);
  const withHidden = (nextHidden) => apply({ order, columns, hidden: nextHidden }, false);

  const allowedColumns = screenColumns(screen);
  // Ausgeblendete Karten fliegen erst beim Anzeigen raus, nicht schon aus
  // order: ihre Position und ihre Spalte bleiben gespeichert, so steht eine
  // wieder eingeblendete Karte genau dort, wo sie vorher war.
  const visibleOrder = order.filter((id) => !hidden.has(id));

  return {
    order,
    columns,
    hidden,
    visibleOrder,
    // Spalten-Aufteilung der SICHTBAREN Karten, je Spalte in der
    // Reihenfolge aus order (Desktop). Am Handy zaehlt stattdessen
    // orderIndex() als CSS-"order" - siehe die Bildschirme.
    byColumn: splitCardColumns(visibleOrder, columns, screen),
    orderIndex: (id) => visibleOrder.indexOf(id),
    isHidden: (id) => hidden.has(id),
    hiddenCount: hidden.size,
    canUndo: !!undoSnapshot,
    // Anordnung: einen Platz nach oben/unten (Einstellungen) bzw. eine
    // ganze neue Reihenfolge (Drag & Drop auf der Statistik).
    moveCard: (id, dir) => {
      const next = moveInOrder(order, id, dir);
      if (next !== order) withOrder(next);
    },
    canMove: (id, dir) => moveInOrder(order, id, dir) !== order,
    setLayout: (nextOrder, nextColumns) => withOrder(nextOrder, nextColumns),
    setColumn: (id, col) => {
      if (!allowedColumns.includes(col) || columns[id] === col) return;
      withOrder(order, { ...columns, [id]: col });
    },
    // Reihum durch die waehlbaren Spalten dieses Bildschirms - fuer den
    // Spalten-Knopf an der Karte (zwei Spalten = Umschalter) und die
    // Spaltenwahl in den Einstellungen (Profil hat drei).
    cycleColumn: (id) => {
      const cur = allowedColumns.indexOf(columns[id]);
      const next = allowedColumns[(cur + 1) % allowedColumns.length];
      withOrder(order, { ...columns, [id]: next });
    },
    undo: () => {
      if (!undoSnapshot) return;
      const snap = undoSnapshot;
      setUndoSnapshot(null);
      apply({ ...snap, hidden }, false);
    },
    // Das Rueckgaengig beim Ausblenden stellt den Stand VOR dem Ausblenden
    // wieder her (die Momentaufnahme "prev"), statt nur diese eine Karte
    // wieder einzublenden - bei genau einer Aenderung ist das dasselbe, aber
    // es kann per Definition nichts anderes mit verstellen.
    hideCard: (id) => {
      if (hidden.has(id)) return;
      const prev = hidden;
      withHidden(new Set([...hidden, id]));
      const label = screenCards(screen).find((c) => c.id === id)?.label;
      if (toast) {
        toast(label ? t("Ausgeblendet: {name}", { name: t(label) }) : t("Karte ausgeblendet"),
          { label: t("Rückgängig"), onAction: () => withHidden(prev) });
      }
    },
    showCard: (id) => { if (hidden.has(id)) { const n = new Set(hidden); n.delete(id); withHidden(n); } },
    toggleCard: (id) => { const n = new Set(hidden); n.has(id) ? n.delete(id) : n.add(id); withHidden(n); },
    showAll: () => { if (hidden.size) withHidden(new Set()); },
    // Nur den lokalen Stand zuruecksetzen, ohne zu speichern - fuer den
    // "Zuruecksetzen"-Knopf im Profil, der per reset_card_layout() ohnehin
    // schon den ganzen card_layout-Eintrag geloescht hat (ein Schreibweg
    // danach wuerde ihn gleich wieder anlegen).
    clearLocal: () => {
      setHidden(new Set());
      setOrder(normalizeCardOrder(null, screen));
      setColumns(normalizeCardColumns(null, normalizeCardOrder(null, screen), screen));
      setUndoSnapshot(null);
    },
  };
}
