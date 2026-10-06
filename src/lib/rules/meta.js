/* Gemeinsame Stammdaten der Regelkunde: Regelwerk, Disziplinen, Themen.
   Ein Regelfall (cases/*.js) verweist nur per Schluessel darauf. */

export const SOURCE = "ÖPBV/WPA-Spielregeln, gültig ab 12.02.2026";

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
};

export const TOPICS_EN = {
  "Erstkontakt": "First contact",
  "Bande & Tasche": "Cushion & pocket",
  "Weiße": "Cue ball",
  "Anstoß": "Break",
  "Ablauf & Reihenfolge": "Procedure & order",
  "Kugeln & Tisch": "Balls & table",
};

/* Dieselben Varianten fuer mehrere Disziplin-Gruppen, nur mit anderem Etikett am
   Tisch: tagSets(varianten, [[["9 Ball","10 Ball"], "Niedrigste Kugel: 5"], ...]).
   Das Etikett sagt, in welcher Situation man sich befindet (z. B. welche Gruppe
   man beim 8-Ball spielt) - die Kugeln der Szene muessen dazu passen. */
export const tagSets = (variants, spec) => spec.map(([discs, tag]) => ({ discs, tag, variants }));

export const D89 = ["9 Ball", "10 Ball"];
export const D8 = ["8 Ball"];
export const D141 = ["14/1 Endlos"];
