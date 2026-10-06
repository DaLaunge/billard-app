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
