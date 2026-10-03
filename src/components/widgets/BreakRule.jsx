import { Crown, ArrowLeftRight } from "lucide-react";
import { t } from "../../lib/i18n";

/* Anstoss-Regel: wer das naechste Rack anstoesst.
   'alternate' = Wechselbreak (Vorgabe), 'winner' = der Sieger des vorigen Racks.
   Gilt fuer Turniere, Winner-Stays-Runden und die normale Matchaufzeichnung,
   aber nur dort, wo ueberhaupt Racks gezaehlt werden - beim 14/1 gibt es kein
   Rack-fuer-Rack-Anstossen (siehe breakApplies()). */
export const DEFAULT_BREAK_RULE = "alternate";
export const normalizeBreakRule = (v) => (v === "winner" ? "winner" : DEFAULT_BREAK_RULE);
export const breakApplies = (disc) => !!disc && disc !== "14/1 Endlos";
export const breakRuleName = (rule) => (rule === "winner" ? t("Winner-Break") : t("Wechselbreak"));
const shortName = (rule) => (rule === "winner" ? t("Winner") : t("Wechsel"));

/* Wer stoesst das NAECHSTE Rack an (0 = erste, 1 = zweite Seite)?
   score: [s1, s2] aktueller Stand; log: Punktestand-Protokoll [[s1,s2,ts], ...];
   first: wer das erste Rack anstoesst. Wechselbreak: abwechselnd ab `first`.
   Winner-Break: der Sieger des letzten Racks - aus dem Protokoll nachgespielt,
   Korrekturen (minus) nehmen das zuletzt gewonnene Rack dieser Seite zurueck. */
export function nextBreaker(rule, first, score, log) {
  const played = (score?.[0] || 0) + (score?.[1] || 0);
  if (rule !== "winner") return played % 2 === 0 ? first : 1 - first;
  const winners = [];
  let prev = [0, 0];
  for (const e of log || []) {
    const [a, b] = e;
    if (a > prev[0]) winners.push(0);
    else if (b > prev[1]) winners.push(1);
    else if (a < prev[0]) { const i = winners.lastIndexOf(0); if (i >= 0) winners.splice(i, 1); }
    else if (b < prev[1]) { const i = winners.lastIndexOf(1); if (i >= 0) winners.splice(i, 1); }
    prev = [a, b];
  }
  return winners.length ? winners[winners.length - 1] : first;
}

/* Laengliches Symbol: Queue mit Kugel. Nur currentColor, kein Text im SVG
   (der Name steht daneben bzw. im title) - wie FormatGlyph/DiscBall. */
export function BreakGlyph({ width = 34 }) {
  return (
    <svg className="break-glyph" viewBox="0 0 40 12" width={width} height={(width * 12) / 40} aria-hidden="true" focusable="false">
      <polygon points="1,4 26,5.2 26,6.8 1,8" fill="currentColor" />
      <rect x="22" y="4.9" width="1.6" height="2.2" fill="var(--felt)" opacity="0.55" />
      <circle cx="33.5" cy="6" r="4.6" fill="currentColor" />
    </svg>
  );
}

const RuleIcon = ({ rule, size = 12 }) => (rule === "winner" ? <Crown size={size} aria-hidden="true" /> : <ArrowLeftRight size={size} aria-hidden="true" />);

/* Reine Anzeige (Kopfzeile von Turnier/Runde/Match). Mit onClick wird sie zum
   Knopf, der die Regel umschaltet (nur Turnierleitung). */
export function BreakPill({ rule, onClick, disabled }) {
  const r = normalizeBreakRule(rule);
  const body = (
    <>
      <BreakGlyph width={30} /><RuleIcon rule={r} size={11} /><span>{shortName(r)}</span>
    </>
  );
  const title = breakRuleName(r);
  return onClick
    ? <button type="button" className="break-pill editable" onClick={onClick} disabled={disabled} title={title} aria-label={title}>{body}</button>
    : <span className="break-pill" title={title} aria-label={title}>{body}</span>;
}

/* Umschalter mit den beiden Regeln, kompakt (eine Zeile, auch am Handy). */
export function BreakSwitch({ value, onChange }) {
  const v = normalizeBreakRule(value);
  return (
    <span className="break-switch" role="group" aria-label={t("Anstoß")}>
      {["alternate", "winner"].map((r) => (
        <button key={r} type="button" className={"break-opt" + (v === r ? " active" : "")} aria-pressed={v === r}
          title={breakRuleName(r)} onClick={() => onChange(r)}>
          <BreakGlyph width={26} /><RuleIcon rule={r} size={11} /><span>{shortName(r)}</span>
        </button>
      ))}
    </span>
  );
}
