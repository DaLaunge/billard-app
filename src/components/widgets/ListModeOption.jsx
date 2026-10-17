import { t } from "../../lib/i18n";

/* Wahlkachel "Tab-Freak" / "Doomscroller" mit kleiner erklaerender Animation (Dialog beim ersten Start und Einstellungen).
   Tab-Freak: oben leuchten nacheinander die Kapitel-Buttons, darunter wechselt der Inhalt wie bei Tabs.
   Doomscroller: eine lange Liste laeuft durch, die Kapitelueberschrift bleibt oben stehen.
   Die Zeichnung ist reines CSS (.lm-*, App.css); ohne Animationen steht sie im Ruhezustand (erster Button aktiv, erstes Kapitel). */
function Anim({ mode }) {
  if (mode === "chapters") {
    return (
      <span className="lm-anim lm-tabs" aria-hidden="true">
        <span className="lm-pills"><i /><i /><i /></span>
        <span className="lm-window">
          <span className="lm-panels">
            {[0, 1, 2].map((k) => (
              <span className="lm-panel" key={k}><b /><u /><u /><u /></span>
            ))}
          </span>
        </span>
      </span>
    );
  }
  const chapter = (k) => (
    <span className="lm-chap" key={k}><b /><u /><u /><u /><u /></span>
  );
  return (
    <span className="lm-anim lm-stack" aria-hidden="true">
      <span className="lm-sticky"><b /></span>
      <span className="lm-window">
        <span className="lm-track">
          {[0, 1, 2, 0, 1, 2].map((k, i) => chapter(i))}
        </span>
      </span>
    </span>
  );
}

export default function ListModeOption({ mode, active = false, recommended = false, onClick }) {
  const isTabs = mode === "chapters";
  return (
    <button type="button" className={"list-opt" + (active ? " active" : "") + (recommended ? " recommended" : "")}
      aria-pressed={active} onClick={onClick}>
      <Anim mode={mode} />
      <span className="list-opt-text">
        <strong>{isTabs ? t("Tab-Freak") : t("Doomscroller")}{recommended && <em>{t("empfohlen")}</em>}</strong>
        <small>{isTabs ? t("Oben stehen Buttons für die Kapitel. Ein Tipp zeigt das Kapitel, wie bei Tabs.") : t("Alles steht in einer langen Liste, du scrollst einfach durch.")}</small>
      </span>
    </button>
  );
}
