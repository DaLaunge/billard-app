import { Radio } from "lucide-react";
import { t } from "../../lib/i18n";

/* Eigenstaendiges Modul: zeigt nur etwas an, wenn's was zu zeigen gibt
   (aktive Live-Eintraege oder offene Herausforderungen an mich). */
export default function LiveStatusCard({ pings, openChallengesToMe, onGoToLive }) {
  if (pings.length === 0 && openChallengesToMe.length === 0) return null;
  return (
    <button className="dash-live" onClick={onGoToLive}>
      <Radio size={15} />
      <span>
        {pings.length > 0 && t("{n} live", { n: pings.length })}
        {pings.length > 0 && openChallengesToMe.length > 0 && " · "}
        {openChallengesToMe.length > 0 && t("{n} Herausforderung(en)", { n: openChallengesToMe.length })}
      </span>
    </button>
  );
}
