import { t } from "../../lib/i18n";

const PING_LETTERS = ["P", "I", "N", "G"];
// Das Wort PING links und rechts vom Radar: die Buchstaben huepfen nacheinander von innen nach aussen (--d = Abstand zum Radar)
const PingWord = ({ side }) => (
  <span className={"ping-word " + side} aria-hidden="true">
    {PING_LETTERS.map((c, i) => <i key={i} style={{ "--d": side === "l" ? PING_LETTERS.length - 1 - i : i }}>{c}</i>)}
  </span>
);

/* Der Radar-Knopf mit PING-Schriftzug und Ringen - derselbe auf dem Live-Bildschirm und in den Einstellungen (compact = kleiner) */
export default function PingButton({ pinging, onClick, hint, compact }) {
  return (
    <button type="button" className={"ping-btn" + (pinging ? " pinging" : "") + (compact ? " compact" : "")} onClick={onClick} aria-label={t("Ping – wer spielt in meiner Nähe?")}>
      <PingWord side="l" />
      <span className="ping-orb">
        <i className="ping-ring" /><i className="ping-ring r2" /><i className="ping-ring r3" />
        <i className="ping-sweep" />
        <svg viewBox="0 0 100 100" className="ping-scope" aria-hidden="true">
          <circle cx="50" cy="50" r="46" /><circle cx="50" cy="50" r="31" /><circle cx="50" cy="50" r="16" />
          <path d="M50 4V96M4 50H96" />
          <circle cx="67" cy="33" r="4" className="ping-blip" /><circle cx="36" cy="62" r="3" className="ping-blip" />
        </svg>
      </span>
      <PingWord side="r" />
      {hint && <span className="ping-txt"><span className="rank-meta">{hint}</span></span>}
    </button>
  );
}
