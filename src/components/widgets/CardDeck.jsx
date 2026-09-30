import CardMenuButton from "./CardMenuButton";
import CardCollapseButton from "./CardCollapseButton";
import CardColumnButton from "./CardColumnButton";
import InfoButton from "./InfoButton";
import { t } from "../../lib/i18n";

/* Eine Karte, die mehrere gleichartige Karten als REITER buendelt, ohne
   dass eine davon ihren eigenen Eintrag im Karten-Katalog verliert
   (Nutzer-Feedback 2026-09-30: "Aufgrund der Fuelle an Features ist die App
   unuebersichtlich geworden" - zugleich aber "ich moechte kein einziges
   Feature vermissen").

   Das Muster dahinter, gueltig fuer jede weitere Zusammenlegung:
   - Alle Teile bleiben einzeln in CARD_SCREENS. Damit funktionieren die
     Liste unter "Profil bearbeiten" -> "Karten", die Pfeile zum Sortieren
     und die Schalter zum Aus-/Einblenden unveraendert weiter.
   - "tabs" sind genau die gerade SICHTBAREN Teile, in der gespeicherten
     Reihenfolge - Sortieren ordnet also die Reiter. Ist kein Teil mehr
     sichtbar, rendert der Aufrufer die Karte gar nicht erst (foldedDeck()
     in cardLayout.js liefert dann anchor = null).
   - Die Karte steht an Platz und Spalte des ERSTEN sichtbaren Teils
     ("Anker"); die uebrigen ids rendern nichts. Nur so bleibt die Liste,
     die @dnd-kit als "items" bekommt, deckungsgleich mit den wirklich
     gerenderten Knoten.
   - "Karte ausblenden" im Kartenmenue blendet den OFFENEN REITER aus, nicht
     die ganze Karte - sonst waere die Einzel-Auswahl aus den Einstellungen
     von der Karte aus gar nicht mehr erreichbar. Deshalb der abweichende
     Menuetext.

   Reiter bekommen bewusst die .chip-Klasse: sie liegen damit im selben
   Button-System wie alle anderen Chips (siehe App.css). Neu ist nur, dass
   die Zeile waagrecht scrollt statt umzubrechen - eine zweite Reiterzeile
   holte genau die Hoehe zurueck, die diese Karte einspart. */
export default function CardDeck({
  icon, title, tabs, activeId, onActive,
  collapsed, onToggleCollapse, column, onToggleColumn, onHide, hideLabel,
  roomy, id, soloTitle = true,
}) {
  const active = tabs.find((x) => x.id === activeId) || tabs[0];
  if (!active) return null;
  const info = active.info;
  // Ist nur noch EIN Teil sichtbar, gibt es nichts umzuschalten - dann
  // traegt die Karte wieder den Namen dieses Teils statt des Sammelnamens
  // (sonst hiesse eine einzelne Head-to-Head-Karte "Meine Zahlen"), und das
  // Kartenmenue sagt wieder schlicht "Karte ausblenden". soloTitle={false}
  // fuer Decks, deren Sammelname auch allein stimmt ("Erfolge (20 / 149)").
  const solo = tabs.length === 1;
  const useSolo = solo && soloTitle;
  return (
    <section className="stat-block" id={id}>
      <div className={"stat-block-head" + (roomy ? " roomy" : "")}>
        <h3>{useSolo ? (active.icon || icon) : icon} <span className="stat-block-title-text">{useSolo ? (active.title || title) : title}</span></h3>
        <div className="stat-block-head-actions">
          {onHide && <CardMenuButton onHide={onHide} label={solo ? undefined : (hideLabel || t("Diesen Reiter ausblenden"))} />}
          {info && <InfoButton title={active.title || title}>{info}</InfoButton>}
          {onToggleColumn && <CardColumnButton column={column} onToggle={onToggleColumn} />}
          {onToggleCollapse && <CardCollapseButton collapsed={collapsed} onToggle={onToggleCollapse} />}
        </div>
      </div>
      {!collapsed && (
        <>
          {tabs.length > 1 && (
            <div className="deck-tabs" role="tablist">
              {tabs.map((x) => (
                <button key={x.id} type="button" role="tab" aria-selected={x.id === active.id}
                  className={"chip" + (x.id === active.id ? " active" : "")}
                  onClick={() => onActive(x.id)} title={x.title || x.tab}>
                  {x.icon} <span>{x.tab}</span>
                </button>
              ))}
            </div>
          )}
          {active.render()}
        </>
      )}
    </section>
  );
}
