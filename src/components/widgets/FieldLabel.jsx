import InfoButton from "./InfoButton";

/* Feld-Ueberschrift in den Anlege-Formularen ("Neues Turnier" und "Neues
   Match" - beide sollen gleich aufgebaut sein, Nutzer-Feedback 2026-09-30).
   Der Erklaertext gehoert in den Info-Knopf daneben und nicht als Dauertext
   darunter; "actions" sind kleine Symbolknoepfe am rechten Rand derselben
   Zeile (statt breiter Textknoepfe unter dem Feld). */
export default function FieldLabel({ label, info, actions }) {
  return (
    <div className="field-label">
      <span>{label}</span>
      {actions && <span className="field-label-actions">{actions}</span>}
      {info && <InfoButton title={label}>{info}</InfoButton>}
    </div>
  );
}
