/* Gemeinsame Stammdaten der Regelkunde: Regelwerk, Disziplinen, Themen.
   Ein Regelfall (cases/*.js) verweist nur per Schluessel darauf. */

export const SOURCE = "ÖPBV/WPA-Spielregeln, gültig ab 12.02.2026";
/* Weitere Quellen fuer Faelle, die in den Spielregeln 2026 fehlen oder dort anders stehen.
   Ein Fall gibt sie mit `src` an; die Fundstelle steht in `ref`. */
export const SOURCE_OBERSCHIRI = "ÖPBV Oberschiedsrichter-Lehrunterlagen (Okt. 2019)";
export const SOURCE_REGULARIEN = "WPA-Regularien (Version 29.07.2016)";

export const ALL_DISCS = ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"];

/* Thema = Gruppe fuer die Hilfe-Seite (spaeter Filter/Ueberschrift). Schluessel
   sind stabil, die Beschriftung wird per t() uebersetzt. */
export const TOPICS = {
  kontakt: "Erstkontakt",
  bande: "Bande & Tasche",
  weisse: "Weiße",
  anstoss: "Anstoß",
  ablauf: "Ablauf & Reihenfolge",
  tisch: "Kugeln & Tisch",
  stoss: "Haltung & Stoß",
};

export const TOPICS_EN = {
  "Erstkontakt": "First contact",
  "Bande & Tasche": "Cushion & pocket",
  "Weiße": "Cue ball",
  "Anstoß": "Break",
  "Ablauf & Reihenfolge": "Procedure & order",
  "Kugeln & Tisch": "Balls & table",
  "Haltung & Stoß": "Stance & stroke",
};

/* Schlagwoerter (klickbar in der Hilfe-Seite): ein Fall hat mehrere (`tags`), ein Klick zeigt nur Faelle mit demselben.
   Die Reihenfolge hier ist die Reihenfolge der Auswahl. */
export const TAGS = {
  foul: "Foul", anstoss: "Anstoß", weisse: "Weiße", bande: "Bande", tasche: "Tasche", erstkontakt: "Erstkontakt",
  kopffeld: "Kopffeld", aufbau: "Aufbau", ansage: "Ansage", stoss: "Stoß", ablauf: "Ablauf", tisch: "Tisch & Kugeln",
  verhalten: "Verhalten", zeit: "Zeit", doppel: "Doppel",
};
export const TAGS_EN = {
  "Foul": "Foul", "Anstoß": "Break", "Weiße": "Cue ball", "Bande": "Cushion", "Tasche": "Pocket", "Erstkontakt": "First contact",
  "Kopffeld": "Kitchen", "Aufbau": "Rack", "Ansage": "Call", "Stoß": "Stroke", "Ablauf": "Procedure", "Tisch & Kugeln": "Table & balls",
  "Verhalten": "Conduct", "Zeit": "Time", "Doppel": "Doubles",
};

/* Dieselben Varianten fuer mehrere Disziplin-Gruppen, nur mit anderem Etikett am
   Tisch: tagSets(varianten, [[["9 Ball","10 Ball"], "Niedrigste Kugel: 5"], ...]).
   Das Etikett sagt, in welcher Situation man sich befindet (z. B. welche Gruppe
   man beim 8-Ball spielt) - die Kugeln der Szene muessen dazu passen. */
export const tagSets = (variants, spec) => spec.map(([discs, tag]) => ({ discs, tag, variants }));

export const D89 = ["9 Ball", "10 Ball"];
export const D8 = ["8 Ball"];
export const D141 = ["14/1 Endlos"];

export const SOURCES_EN = {
  "ÖPBV/WPA-Spielregeln, gültig ab 12.02.2026": "ÖPBV/WPA rules of play, effective 12 Feb 2026",
  "ÖPBV Oberschiedsrichter-Lehrunterlagen (Okt. 2019)": "ÖPBV head referee training material (Oct 2019)",
  "WPA-Regularien (Version 29.07.2016)": "WPA regulations (version 29 Jul 2016)",
};
