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
    // "Auswahl fuer alle Statistiken" (Disziplin + Top-N) war bis 2026-09-30
    // eine eigene Karte und sitzt jetzt hinter dem Trichter-Symbol der
    // Bestenlisten-Karte (siehe CardDeck.jsx, Prop "filter"). Alte
    // gespeicherte Reihenfolgen nennen die id "globalFilter" noch -
    // normalizeCardOrder() wirft sie automatisch raus.
    // Die sechs Bestenlisten sind seit 2026-09-30 EINE Karte mit Reitern
    // (siehe "decks" unten): jede laesst sich weiter fuer sich ein-/
    // ausblenden und sortieren, nur zeigt sich das als Reiter.
    decks: [
      { id: "bestenlisten", label: "Bestenlisten", ids: ["rangliste", "meisteSiege", "besteSiegquote", "aktuelleSerien", "schnellstesTempo", "schnellste141"] },
    ],
    cards: [
      { id: "entwicklung", label: "Entwicklung über die Zeit", col: "middle" },
      { id: "letzteMatches", label: "Letzte Matches", col: "middle" },
      { id: "rangliste", label: "Rangliste", col: "right" },
      { id: "meisteSiege", label: "Meiste Siege", col: "right" },
      { id: "besteSiegquote", label: "Beste Siegquote", col: "right" },
      { id: "aktuelleSerien", label: "Aktuelle Serien", col: "right" },
      { id: "schnellstesTempo", label: "Schnellstes Tempo", col: "right" },
      { id: "schnellste141", label: "Schnellstes 14/1-Tempo", col: "right" },
      { id: "rekordeClub", label: "Rekorde", col: "right" },
    ],
  },
  {
    screen: "live",
    label: "Live",
    columns: ["middle", "right"],
    // Alle drei teilen sich EINE Karte mit Reitern (siehe CardDeck.jsx) und
    // stehen deshalb in derselben Standard-Spalte - sonst haengt ihr Platz
    // davon ab, welcher Teil gerade der erste sichtbare ist.
    decks: [
      { id: "mitspieler", label: "Mitspieler finden", ids: ["duelle", "pings", "planung"] },
    ],
    cards: [
      { id: "duelle", label: "Duelle", col: "middle" },
      { id: "pings", label: "Live", col: "middle" },
      { id: "planung", label: "Planung", col: "middle" },
    ],
  },
  {
    screen: "profil",
    label: "Profil",
    columns: ["left", "middle", "right"],
    // Zwei Gruppen, die sich je EINE Karte mit Reitern teilen (siehe
    // "decks" und CardDeck.jsx). Jede Gruppe steht zusammenhaengend und ganz
    // in DERSELBEN Standard-Spalte - die Karte uebernimmt Platz und Spalte
    // des ersten sichtbaren Teils, und so landen am Desktop verlaesslich die
    // Zahlen links und die Erfolge in der breiten Mitte, egal welcher Teil
    // der erste sichtbare ist. Steckten sie in verschiedenen Spalten,
    // saessen beide Karten je nach Ausblendung ploetzlich uebereinander in
    // einer Spalte und die anderen blieben leer.
    decks: [
      { id: "erfolge", label: "Erfolge", ids: ["erfolgeFortschritt", "erfolge"] },
      { id: "zahlen", label: "Meine Zahlen", ids: ["ratings", "rekorde", "headToHead", "tempo"] },
    ],
    cards: [
      { id: "erfolgeFortschritt", label: "Erfolge (Fortschritt)", col: "middle" },
      { id: "erfolge", label: "Erfolge (alle)", col: "middle" },
      { id: "ratings", label: "Ratings nach Disziplin", col: "left" },
      { id: "rekorde", label: "Rekorde", col: "left" },
      { id: "headToHead", label: "Head-to-Head", col: "left" },
      { id: "tempo", label: "Spielgeschwindigkeit", col: "left" },
      // "Anmeldung & Sicherheit", "Feedback" und "Meine Tickets" waren bis
      // 2026-09-25 ebenfalls frei anordenbare Karten hier. Sie stehen jetzt
      // fest unter "Profil bearbeiten": das Profil selbst zeigt nur noch,
      // was ueber DICH etwas aussagt (Erfolge, Ratings, Rekorde), alles
      // Einstellungs- und Kontoartige liegt hinter dem Zahnrad. Alte
      // gespeicherte Reihenfolgen/Ausblendungen nennen diese ids noch -
      // normalizeCardOrder()/normalizeHiddenCards() werfen sie automatisch
      // raus, weil sie hier nicht mehr stehen.
    ],
  },
];

export const CARD_SCREEN_BY_ID = Object.fromEntries(CARD_SCREENS.map((s) => [s.screen, s]));

// Die Katalog-ids einer Reiter-Karte ("deck") eines Bildschirms - die eine
// Quelle, aus der Bildschirm UND Einstellungen ihre Gruppen lesen.
export function deckIds(screen, deckId) {
  return CARD_SCREEN_BY_ID[screen]?.decks?.find((d) => d.id === deckId)?.ids || [];
}

// Was der Nutzer als EINE Karte erlebt: eine Einzelkarte oder eine ganze
// Reiter-Karte. Die Einstellungen ordnen, spalten und blenden diese
// Einheiten (Nutzer-Feedback 2026-09-30: nach der Zusammenlegung standen dort
// noch die urspruenglichen Einzelkarten - "die Sichtbarkeit muss auch
// verbessert werden"). Die Einheit steht an der Stelle ihres ERSTEN Teils in
// "order"; ids in der Reihenfolge von "order" (= Reihenfolge der Reiter).
export function screenUnits(screen, order) {
  const decks = CARD_SCREEN_BY_ID[screen]?.decks || [];
  const deckOf = {};
  decks.forEach((d) => d.ids.forEach((id) => { deckOf[id] = d; }));
  const units = [];
  const seen = new Set();
  order.forEach((id) => {
    const d = deckOf[id];
    if (!d) { units.push({ key: id, ids: [id] }); return; }
    if (seen.has(d.id)) return;
    seen.add(d.id);
    units.push({ key: "deck:" + d.id, deck: d, ids: order.filter((x) => d.ids.includes(x)) });
  });
  return units;
}

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

// ---------------------------------------------------------------------------
// "Meine Zahlen" (widgets/NumbersDeck.jsx) ist die linke Spalte am PC und
// soll auf Statistik, Live und Profil dieselbe sein. Die Teile stehen im
// Katalog des PROFILS - dort wird ausgeblendet und sortiert - und die
// anderen Bildschirme lesen von dort mit, statt eine eigene Zusammenstellung
// zu haben. Eine einzige Quelle fuer die Ids, damit Profil und Seitenspalte
// nie auseinanderlaufen.
export const NUMBERS_DECK_IDS = deckIds("profil", "zahlen");

// Die sichtbaren Reiter von "Meine Zahlen" in gespeicherter Reihenfolge, aus
// dem card_layout-Eintrag des Profils (players.card_layout.profil).
export function numbersParts(savedProfilLayout) {
  const hidden = new Set(normalizeHiddenCards(savedProfilLayout, "profil"));
  return normalizeCardOrder(savedProfilLayout, "profil")
    .filter((id) => NUMBERS_DECK_IDS.includes(id) && !hidden.has(id));
}

// Zusammengelegte Karten (siehe CardDeck.jsx): mehrere Katalog-Eintraege
// teilen sich EINE Karte mit Reitern, bleiben hier aber einzeln stehen und
// damit einzeln sortier- und ausblendbar.
//
// foldedDeck() liefert die noch sichtbaren Teile in der gespeicherten
// Reihenfolge (= Reihenfolge der Reiter) und den "Anker": an dessen Platz
// und Spalte steht die gemeinsame Karte. Kein sichtbarer Teil mehr -> anchor
// ist null, der Bildschirm rendert die Karte dann gar nicht.
export function foldedDeck(visibleOrder, ids) {
  const set = new Set(ids);
  const parts = visibleOrder.filter((id) => set.has(id));
  return { parts, anchor: parts[0] || null };
}

// Spalte einer zusammengelegten Karte am Desktop: die Spalte, in der die
// MEISTEN ihrer Teile stehen; bei Gleichstand die Standard-Spalte des
// ersten Teils. Einfach die Spalte des Ankers zu nehmen waere kuerzer,
// haengt aber davon ab, welcher Teil gerade der erste SICHTBARE ist - und
// bei schon gespeicherten Layouts (die von vor der Zusammenlegung stammen
// und die Teile quer ueber die Spalten verteilen) landeten dann leicht
// zwei Karten in derselben Spalte, waehrend eine andere ganz leer blieb.
export function deckColumn(columns = {}, ids, screen) {
  const allowed = screenColumns(screen);
  const defaults = defaultCardColumns(screen);
  const tally = {};
  ids.forEach((id) => {
    const col = allowed.includes(columns[id]) ? columns[id] : defaults[id];
    if (col) tally[col] = (tally[col] || 0) + 1;
  });
  let best = defaults[ids[0]] || allowed[0];
  let bestN = tally[best] || 0;
  allowed.forEach((col) => { if ((tally[col] || 0) > bestN) { best = col; bestN = tally[col]; } });
  return best;
}

// Entfernt die zusammengelegten ids bis auf den Anker aus einer Liste
// (Reihenfolge, Spaltenaufteilung, @dnd-kit-"items"). Mehrfach anwendbar,
// wenn ein Bildschirm mehrere solcher Karten hat.
export function withoutFolded(list, ids, anchor) {
  const set = new Set(ids);
  return list.filter((id) => !set.has(id) || id === anchor);
}

// Reihenfolge der Spalten am HANDY, auf JEDEM Bildschirm gleich (Nutzer-
// Feedback 2026-09-30: "Mitte zuerst, dann rechts soll ueber die gesamte App
// funktionieren. Es sollte alles einheitlich sein" - zuerst nur auf der
// Statistik gemeldet: "wenn ich am PC die Fensterbreite reduziere und dadurch
// ein Handy simuliere, erwarte ich, dass die Karten in der Mitte ganz oben
// angezeigt werden und die Karten, die rechts stehen, nach unten rutschen").
// Die linke Spalte gibt es nur im Profil; sie ist dort die Seitenspalte
// neben der Identitaetskarte und kommt am Handy ans Ende, hinter die
// Hauptinhalte. Die Identitaetskarte selbst steht dort ohnehin fest ganz oben.
export const PHONE_COLUMN_ORDER = ["middle", "right", "left"];
export const phoneRank = (col) => {
  const i = PHONE_COLUMN_ORDER.indexOf(col);
  return i === -1 ? 0 : i;
};
// CSS-"order" einer Karte am Handy: Spaltenrang zuerst, darin die Position.
// Ab 10, damit feste Elemente (Identitaetskarte 0) davor bleiben koennen; der
// Vorsprung von 1000 je Spalte ist grosszuegig gegen die Kartenzahl.
export const phoneSlotOrder = (col, indexInColumn) => 10 + phoneRank(col) * 1000 + indexInColumn;

// Die ANGEZEIGTE Reihenfolge eines Bildschirms: die gespeicherte Reihenfolge,
// stabil nach Spalte gruppiert (siehe PHONE_COLUMN_ORDER), je Spalte in
// gespeicherter Reihenfolge. Genau das sieht man am Handy, und genau daran
// muessen Ziehen und die Pfeile in den Einstellungen rechnen: die rohe
// Reihenfolge kann Karten verschiedener Spalten beliebig mischen (Ziehen und
// Spaltenwechsel am PC tun das), und das Handy zeigte dann eine Reihenfolge,
// die zu nichts passte, was man am PC gesehen hatte. Bildschirme mit nur
// einer Spalte: unveraendert.
export function groupOrder(order, columns, screen) {
  if (screenColumns(screen).length < 2) return order;
  return order
    .map((id, i) => ({ id, i, r: phoneRank(columns[id]) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.id);
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
