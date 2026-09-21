/* Duenne Huelle um EINE Karte auf einem Bildschirm, dessen Karten der Nutzer
   selbst anordnen darf (Live, Profil - auf der Statistik uebernimmt das die
   Drag&Drop-Huelle SortableCard.jsx, die denselben "order"-Wert traegt).

   Der "order"-Wert ist der Platz der Karte in der gespeicherten
   Gesamtreihenfolge (siehe cardLayout.js). Am Handy sind die Spalten-Huellen
   display:contents (siehe App.css), die Karten also direkte Flex-Kinder des
   Bildschirms - "order" macht daraus EINE Liste quer ueber die Spalten
   hinweg, genau in der Reihenfolge aus den Einstellungen. Am Desktop wirkt
   derselbe Wert nur innerhalb der eigenen Spalte, die ohnehin schon so
   sortiert ist, und aendert dort nichts. */
export default function CardSlot({ order, children }) {
  return <div className="card-slot" style={{ order }}>{children}</div>;
}
