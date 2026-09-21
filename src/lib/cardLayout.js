// Karten-Anordnung (Reihenfolge + Spalte) und Karten-Sichtbarkeit fuer ALLE
// Bildschirme mit mehreren Karten - Statistik, Live und Profil. Bis
// 2026-09-21 galt die Anordnung nur fuer die Statistik (Drag & Drop), die
// Sichtbarkeit fuer alle drei; jetzt liegt beides fuer alle drei im selben
// Format, und die Anordnung laesst sich fuer jeden Bildschirm in EINER
// Liste unter "Profil bearbeiten" -> "Karten" aendern (Nutzer-Feedback:
// "dass in jedem Menuepunkt die Anordnung der Karten durch den User
// veraenderbar ist ... vielleicht laesst sich das mit dem Ein- und
// Ausblenden in der User-Konfiguration kombinieren").
//
// Pro Bildschirm liegt EIN Objekt am Spielerprofil (players.card_layout):
//
//   {"order": [...], "columns": {id: "left"|"middle"|"right"}, "hidden": [...]}
//
// order  = eine einzige flache Reihenfolge ueber alle Karten des
//          Bildschirms. Am Handy ist sie die Anzeigereihenfolge (jede Karte
//          bekommt ihren Platz per CSS-"order", siehe die Bildschirme).
// columns= die vom Nutzer gewaehlte Spalte je Karte - ein reines
//          Desktop-Konzept (ab 900px stehen die Karten neben-, darunter nur
//          untereinander). INNERHALB einer Spalte gilt wieder "order".
// hidden = ausgeblendete Karten (siehe weiter unten).
//
// Jeder Schreibzugriff muss die jeweils anderen Felder mit uebernehmen -
// sonst loescht ein Ausblenden die Reihenfolge und umgekehrt. Genau dafuer
// ist mergeCardLayout() da; alle Schreibwege gehen darueber (siehe
// useCardLayout.js).
//
// ---------------------------------------------------------------------------
// Vorgeschichte der Spaltenwahl (Statistik, Stufe 1-4):
//
// Stufe 4 (nach drei frueheren Versuchen, siehe Git-Historie): keine
// automatische Spaltenzuteilung mehr ueberhaupt - der Nutzer entscheidet
// selbst, ob eine Karte in der mittleren oder rechten Spalte steht, entweder
// per Ziehen auf eine Karte der Zielspalte oder per Knopf an jeder Karte
// (siehe CardColumnButton.jsx - noetig, weil eine LEERE Spalte keine Karte
// zum Zielen bietet). Reihenfolge (cardOrder) und Spalte (cardColumns) sind
// zwei unabhaengige Werte, aber Ziehen darf beide gleichzeitig aendern: die
// Reihenfolge IMMER, die Spalte NUR fuer die gerade gezogene Karte selbst -
// keine andere Karte wechselt dabei ihre Spalte (siehe handleDragEnd in
// StatistikScreen.jsx). Nutzer-Feedback, das zu dieser Entscheidung
// fuehrte: "es könnte ja durchaus sein, dass der User zb. alles in der
// Mitte anzeigen will" (ein automatischer Hoehen-Ausgleich verhindert das
// strukturell), "am Smartphone sollte die Sortierung gleich bleiben, aber
// am PC wirkt sich eine solche Verschiebung aus" (die Spaltenwahl ist ein
// reines Desktop-Konzept - am Handy gibt es nur eine gemeinsame Liste in
// cardOrder) und schliesslich "ich versuche die oberste Karte aus der
// rechten Spalte an die 1. Stelle in der breiten Spalte zu ziehen - das
// funktioniert aber nicht" (ein erster Entwurf dieser Stufe liess Ziehen
// NUR die Reihenfolge aendern, nie die Spalte - das widersprach der
// normalen Erwartung an Drag & Drop zwischen zwei sichtbaren Spalten).
//
// Vorgeschichte: Stufe 1 (ein flaches Array + EINE Hoehe pro Karte) fuehlte
// sich beim Ziehen unvorhersehbar an, weil eine verschobene Karte die
// Spaltenzuordnung mehrerer anderer Karten mit veraendern konnte. Stufe 2
// (zwei vom Nutzer direkt kontrollierte Spalten-Arrays, je eine eigene
// SortableContext) loeste das, erzeugte aber ein sichtbares Einfrieren der
// gezogenen Karte beim Ueberqueren der Spaltengrenze (jede SortableContext
// kennt nur Positionen innerhalb ihrer eigenen Liste), weil Ziehen dort
// GLEICHZEITIG zum Umsortieren auch zum Spaltenwechsel diente. Stufe 3 (ein
// automatischer Hoehen-Ausgleich, zuerst als freie Durchmischung, dann als
// Praefix/Suffix-Schnitt) vermied das Einfrieren wieder (nur noch EINE
// SortableContext), hatte aber weiterhin das Grundproblem: die Spalte einer
// Karte war nie wirklich frei waehlbar, sondern immer nur eine Folge der
// Reihenfolge. Stufe 4 loest genau das: Ziehen bleibt bei EINER
// SortableContext (kein Einfrieren moeglich), ein Spaltenwechsel durch
// Ziehen betrifft aber immer nur die gezogene Karte selbst - dadurch kann
// Ziehen niemals mehr eine andere, unbeteiligte Karte in die jeweils
// andere Spalte verschieben (der eigentliche Fehler in den fruehreren
// Stufen, nicht die Moeglichkeit eines Spaltenwechsels an sich).
export const STAT_CARD_SCREEN = "stats";

// ---------------------------------------------------------------------------
// Der Katalog ist die einzige Stelle, die alle sortier- und ausblendbaren
// Karten kennt: die Einstellungsseite im Profil baut ihre Liste daraus, die
// Bildschirme rendern danach, und normalizeCardOrder()/normalizeHiddenCards()
// werfen damit ids weg, die es nicht mehr gibt.
//
// Die REIHENFOLGE der Karten hier ist zugleich die Standard-Reihenfolge (was
// ein Nutzer ohne eigene Anordnung sieht), "col" die Standard-Spalte. Beides
// ist bewusst so gewaehlt, dass sich fuer bestehende Nutzer beim Umstieg auf
// die frei sortierbaren Bildschirme nichts sichtbar aendert - die Liste
// entspricht also genau der bisherigen Anzeigereihenfolge am Handy, "col"
// der bisherigen festen Spalte am Desktop.
//
// Absichtlich NICHT dabei: die Identitaets-/Profilkarte in der Seitenspalte
// (sie ist der Kopf des Bildschirms, kein Modul unter vielen), die
// Konto-Knoepfe im Profil (Turniere/Verwaltung/Abmelden - "Abmelden"
// ausblenden zu koennen waere eine Falle) und die Turnier-Liste (der ganze
// Inhalt des Turnier-Menuepunkts - ausblenden wuerde dort eine leere Seite
// hinterlassen).
//
// "columns" listet die auf diesem Bildschirm waehlbaren Spalten in der
// Reihenfolge, in der sie am Desktop nebeneinander stehen. Statistik und
// Live haben links eine feste Spalte (UserPanel), deshalb nur Mitte/Rechts.
export const CARD_SCREENS = [
  {
    screen: "stats",
    label: "Statistik",
    columns: ["middle", "right"],
    cards: [
      { id: "entwicklung", label: "Entwicklung über die Zeit", col: "middle" },
      { id: "letzteMatches", label: "Letzte Matches", col: "middle" },
      { id: "aktuelleSerien", label: "Aktuelle Serien", col: "middle" },
      { id: "schnellste141", label: "Schnellstes 14/1-Tempo", col: "middle" },
      { id: "globalFilter", label: "Auswahl fuer alle Statistiken", col: "right" },
      { id: "rekordeClub", label: "Rekorde", col: "right" },
      { id: "rangliste", label: "Rangliste", col: "right" },
      { id: "meisteSiege", label: "Meiste Siege", col: "right" },
      { id: "besteSiegquote", label: "Beste Siegquote", col: "right" },
      { id: "schnellstesTempo", label: "Schnellstes Tempo", col: "right" },
    ],
  },
  {
    screen: "live",
    label: "Live",
    columns: ["middle", "right"],
    cards: [
      { id: "duelle", label: "Duelle", col: "middle" },
      { id: "pings", label: "Live", col: "right" },
      { id: "planung", label: "Planung", col: "middle" },
    ],
  },
  {
    screen: "profil",
    label: "Profil",
    columns: ["left", "middle", "right"],
    cards: [
      { id: "erfolgeFortschritt", label: "Erfolge (Fortschritt)", col: "left" },
      { id: "ratings", label: "Ratings nach Disziplin", col: "left" },
      { id: "rekorde", label: "Rekorde", col: "left" },
      { id: "headToHead", label: "Head-to-Head", col: "left" },
      { id: "tempo", label: "Spielgeschwindigkeit", col: "right" },
      { id: "erfolge", label: "Erfolge (alle)", col: "middle" },
      { id: "anmeldung", label: "Anmeldung & Sicherheit", col: "right" },
      { id: "feedback", label: "Feedback", col: "right" },
      { id: "tickets", label: "Meine Tickets", col: "right" },
    ],
  },
];

export const CARD_SCREEN_BY_ID = Object.fromEntries(CARD_SCREENS.map((s) => [s.screen, s]));

export function screenCards(screen) {
  return CARD_SCREEN_BY_ID[screen]?.cards || [];
}

// Waehlbare Spalten eines Bildschirms; die erste gilt als Rueckfallwert fuer
// eine Karte ohne (gueltige) Spaltenangabe.
export function screenColumns(screen) {
  return CARD_SCREEN_BY_ID[screen]?.columns || ["middle"];
}

export function defaultCardOrder(screen) {
  return screenCards(screen).map((c) => c.id);
}

export function defaultCardColumns(screen) {
  const allowed = screenColumns(screen);
  const out = {};
  screenCards(screen).forEach((c) => {
    out[c.id] = allowed.includes(c.col) ? c.col : allowed[0];
  });
  return out;
}

// Bekannte, aber inzwischen entfernte Karten fallen beim Normalisieren
// einfach weg; neue, dem Nutzer noch unbekannte Karten werden ans Ende
// angehaengt statt zu verschwinden. Erkennt zusaetzlich die Formate
// frueherer Stufen ({order, columns} von Stufe 4 selbst nach einem
// zukuenftigen Schema-Wechsel, {middle:[...], right:[...]} von Stufe 2) und
// fuehrt sie zu EINER Reihenfolge zusammen (Mitte zuerst, dann Rechts),
// damit eine bereits gespeicherte Anordnung nicht einfach verloren geht,
// nur weil sich das Speicherformat geaendert hat.
export function normalizeCardOrder(saved, screen = STAT_CARD_SCREEN) {
  const defaultOrder = defaultCardOrder(screen);
  const known = new Set(defaultOrder);
  let flat;
  if (Array.isArray(saved)) flat = saved;
  else if (saved && Array.isArray(saved.order)) flat = saved.order;
  else if (saved && (Array.isArray(saved.middle) || Array.isArray(saved.right))) {
    flat = [...(saved.middle || []), ...(saved.right || [])];
  } else flat = [];
  const cleaned = flat.filter((id) => known.has(id));
  const seen = new Set(cleaned);
  const missing = defaultOrder.filter((id) => !seen.has(id));
  return [...cleaned, ...missing];
}

// Liest die vom Nutzer explizit gewaehlte Spalte je Karte (Stufe 4 - siehe
// Kommentar ganz oben). saved.columns ist das aktuelle Format ({cardId:
// "right"}). Das aeltere {middle, right}-Format aus Stufe 2 wird ebenfalls
// erkannt, damit eine schon vom Nutzer getroffene Spaltenwahl beim Umstieg
// erhalten bleibt, statt auf den Standard zurueckzufallen. Fuer jede Karte
// OHNE gueltige fruehere Wahl (reines Stufe-1/3-Array, komplett neue Karte
// oder eine Spalte, die es auf diesem Bildschirm nicht gibt) greift der
// Katalog-Standard.
export function normalizeCardColumns(saved, order, screen = STAT_CARD_SCREEN) {
  const allowed = screenColumns(screen);
  const defaults = defaultCardColumns(screen);
  let explicit = null;
  if (saved && saved.columns && typeof saved.columns === "object") {
    explicit = saved.columns;
  } else if (saved && (Array.isArray(saved.middle) || Array.isArray(saved.right))) {
    explicit = {};
    (saved.middle || []).forEach((id) => { explicit[id] = "middle"; });
    (saved.right || []).forEach((id) => { explicit[id] = "right"; });
  }
  const columns = {};
  order.forEach((id) => {
    const chosen = explicit?.[id];
    columns[id] = allowed.includes(chosen) ? chosen : (defaults[id] || allowed[0]);
  });
  return columns;
}

// Teilt eine Kartenreihenfolge anhand der vom Nutzer gewaehlten Spalte auf
// (reines Filtern, keine Berechnung mehr - siehe Kommentar ganz oben, warum
// ein automatischer Ausgleich abgeschafft wurde). Die relative Reihenfolge
// innerhalb jeder Spalte kommt unveraendert aus "order". Das Ergebnis
// enthaelt IMMER alle Spalten des Bildschirms (ggf. als leeres Array), damit
// der Aufrufer nicht auf undefined pruefen muss.
export function splitCardColumns(order, columns = {}, screen = STAT_CARD_SCREEN) {
  const allowed = screenColumns(screen);
  const out = Object.fromEntries(allowed.map((c) => [c, []]));
  order.forEach((id) => {
    const col = allowed.includes(columns[id]) ? columns[id] : allowed[0];
    out[col].push(id);
  });
  return out;
}

// Eine Karte in der Reihenfolge um einen Platz nach oben/unten schieben
// (dir = -1/+1) - der Weg, auf dem die Anordnung in den Einstellungen
// geaendert wird. Ausgeblendete Karten zaehlen dabei ganz normal mit: die
// Liste in den Einstellungen zeigt sie ja mit an, und ihre gespeicherte
// Position soll erhalten bleiben, damit eine wieder eingeblendete Karte
// dort auftaucht, wo der Nutzer sie zuletzt hatte. Gibt bei einem Zug ueber
// den Rand hinaus die unveraenderte Liste zurueck.
export function moveInOrder(order, id, dir) {
  const from = order.indexOf(id);
  const to = from + dir;
  if (from === -1 || to < 0 || to >= order.length) return order;
  const next = [...order];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

// ---------------------------------------------------------------------------
// Sichtbarkeit einzelner Karten (Nutzer-Feedback: "es werden mittlerweile so
// viele Karten, dass es unuebersichtlich ist"). Bewusst getrennt vom
// Einklappen (collapsedCards, nur localStorage): Einklappen ist eine kurze
// Geste auf EINEM Geraet, Ausblenden eine dauerhafte Entscheidung, die der
// Nutzer in den Einstellungen wiederfinden und auf jedem Geraet gleich haben
// soll - deshalb am Spielerprofil gespeichert, im selben card_layout-Eintrag
// wie Reihenfolge und Spalte (siehe supabase/2026-09-21_card_visibility.sql).

// Liest die ausgeblendeten Karten eines Bildschirms. Unbekannte ids (frueher
// ausgeblendete, inzwischen entfernte Karten) fallen weg - sonst wuerde eine
// Karte, die spaeter mit derselben id wiederkommt, unsichtbar bleiben, ohne
// dass der Nutzer das je entschieden haette. Ein reines Array als gespeicherter
// Wert ist das alte Format von Stufe 1 (nur Reihenfolge, siehe oben) und
// enthaelt daher nie ausgeblendete Karten.
export function normalizeHiddenCards(saved, screen) {
  const known = new Set(screenCards(screen).map((c) => c.id));
  const raw = saved && !Array.isArray(saved) && Array.isArray(saved.hidden) ? saved.hidden : [];
  return raw.filter((id) => known.has(id));
}

// Baut den neuen card_layout-Eintrag EINES Bildschirms: der gespeicherte
// Stand plus die geaenderten Felder. Aeltere Formate (flaches Array =
// Reihenfolge, {middle,right} = Stufe 2) werden dabei nicht mitgeschleppt -
// die lesenden Normalisierer (normalizeCardOrder/-Columns) haben sie beim
// Laden ohnehin schon in order/columns uebersetzt, und der Aufrufer schickt
// genau diese uebersetzten Werte wieder mit.
export function mergeCardLayout(saved, patch) {
  const base = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  return { ...base, ...patch };
}
