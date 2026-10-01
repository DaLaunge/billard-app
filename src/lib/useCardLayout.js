import { useRef, useState } from "react";
import { t } from "./i18n";
import {
  normalizeCardOrder, normalizeCardColumns, normalizeHiddenCards,
  mergeCardLayout, moveInOrder, screenCards, screenColumns, splitCardColumns, groupOrder, screenUnits, deckColumn,
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
  // Angezeigte Reihenfolge (siehe groupOrder() in cardLayout.js): auf der
  // Statistik nach Spalte gruppiert. Alles, was der Bildschirm oder die
  // Einstellungen als "die Reihenfolge" lesen, kommt von hier - der rohe
  // Zustand "order" dient nur noch dem Speichern.
  const shown = groupOrder(order, columns, screen);
  const grouped = shown !== order;
  const visibleOrder = shown.filter((id) => !hidden.has(id));

  return {
    order: shown,
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
    //
    // Auf gruppierten Bildschirmen (Statistik) rechnen die Pfeile auf der
    // ANGEZEIGTEN Reihenfolge. Ueber die Spaltengrenze hinweg wechselt die
    // Karte dabei die Spalte und landet direkt hinter (nach oben) bzw. vor
    // (nach unten) ihrem Nachbarn - dieselbe Bewegung wie beim Ziehen. Ein
    // reines Vertauschen der Positionen waere dort unsichtbar, weil die
    // Gruppierung die Karte sofort wieder in ihre alte Spalte einsortiert.
    moveCard: (id, dir) => {
      const i = shown.indexOf(id);
      const nb = shown[i + dir];
      if (i === -1 || nb === undefined) return;
      if (!grouped || columns[nb] === columns[id]) {
        const next = moveInOrder(shown, id, dir);
        if (next !== shown) withOrder(next);
        return;
      }
      const rest = shown.filter((x) => x !== id);
      const k = rest.indexOf(nb);
      const next = [...rest];
      next.splice(dir < 0 ? k + 1 : k, 0, id);
      withOrder(next, { ...columns, [id]: columns[nb] });
    },
    canMove: (id, dir) => {
      const i = shown.indexOf(id);
      return i !== -1 && shown[i + dir] !== undefined;
    },
    // Einheiten-Variante von moveCard() fuer die Einstellungen: "ids" ist EINE
    // Karte oder alle Teile einer Reiter-Karte, die gemeinsam als Block
    // wandern (und dabei wieder lueckenlos nebeneinander landen). Ueber eine
    // Spaltengrenze wechselt der Block die Spalte wie beim Ziehen.
    moveUnit: (ids, dir) => {
      const units = screenUnits(screen, shown);
      const i = units.findIndex((u) => u.ids[0] === ids[0]);
      const nb = units[i + dir];
      if (i === -1 || !nb) return;
      const colOf = (u) => (u.deck ? deckColumn(columns, u.deck.ids, screen) : columns[u.ids[0]]);
      const cross = grouped && colOf(nb) !== colOf(units[i]);
      const rest = shown.filter((x) => !ids.includes(x));
      const nbFirst = rest.indexOf(nb.ids[0]);
      const nbLast = rest.indexOf(nb.ids[nb.ids.length - 1]);
      // Innerhalb der Spalte: vor bzw. hinter den Nachbarn. Ueber die Grenze:
      // ans ENDE der vorigen bzw. an den ANFANG der naechsten Spalte.
      const at = (dir < 0) === !cross ? nbFirst : nbLast + 1;
      const next = [...rest];
      next.splice(at, 0, ...ids);
      withOrder(next, grouped ? { ...columns, ...Object.fromEntries(ids.map((x) => [x, cross ? colOf(nb) : colOf(units[i])])) } : undefined);
    },
    // Einen Reiter innerhalb seiner Reiter-Karte einen Platz verschieben.
    moveInDeck: (id, deckIds, dir) => {
      const parts = shown.filter((x) => deckIds.includes(x));
      const j = parts.indexOf(id);
      const other = parts[j + dir];
      if (j === -1 || other === undefined) return;
      const next = [...shown];
      const a = next.indexOf(id), b = next.indexOf(other);
      next[a] = other; next[b] = id;
      withOrder(next);
    },
    // Alle Reiter einer Reiter-Karte auf einmal aus-/einblenden.
    setDeckHidden: (deckIds, hide) => {
      const n = new Set(hidden);
      deckIds.forEach((x) => (hide ? n.add(x) : n.delete(x)));
      withHidden(n);
    },
    setLayout: (nextOrder, nextColumns) => withOrder(nextOrder, nextColumns),
    setColumn: (id, col) => {
      if (!allowedColumns.includes(col) || columns[id] === col) return;
      withOrder(order, { ...columns, [id]: col });
    },
    // Reihum durch die waehlbaren Spalten dieses Bildschirms - fuer den
    // Spalten-Knopf an der Karte (zwei Spalten = Umschalter) und die
    // Spaltenwahl in den Einstellungen (Profil hat drei).
    // "ids" darf mehrere Karten umfassen: eine zusammengelegte Karte (siehe
    // CardDeck.jsx) ist am Desktop EINE Karte, also muessen alle ihre Teile
    // gemeinsam die Spalte wechseln - sonst zoege der Knopf nur den gerade
    // ersten sichtbaren Teil um und die Karte spraenge beim naechsten
    // Ausblenden wieder zurueck.
    cycleColumn: (id) => {
      const ids = Array.isArray(id) ? id : [id];
      const cur = allowedColumns.indexOf(columns[ids[0]]);
      const next = allowedColumns[(cur + 1) % allowedColumns.length];
      withOrder(order, { ...columns, ...Object.fromEntries(ids.map((x) => [x, next])) });
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
