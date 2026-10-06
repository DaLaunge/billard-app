import { RULE_CASES } from "../lib/ruleScenes";
import { t } from "../lib/i18n";
import RuleScene from "./widgets/RuleScene";
import InfoButton from "./widgets/InfoButton";
import DiscBall from "./widgets/DiscBall";

/* Regelkunde-Prototyp, nur in der Verwaltung (wird von AdminScreen per
   React.lazy erst nach dem Aufklappen geladen, alle anderen Nutzer laden
   davon nichts). Welche Faelle spaeter fuer alle freigegeben werden, steht
   in RULE_CASES (`released`). Pro Fall zwei Varianten nebeneinander: Foul und
   kein Foul, das Urteil kommt erst im letzten Schritt. */
export default function RuleScenesAdmin() {
  return (
    <div className="rs-cases">
      {RULE_CASES.map((c) => (
        <div key={c.id} className="rs-case">
          <div className="rs-case-head">
            <DiscBall disc={c.disc} size={20} />
            <h4>{t(c.title)}</h4>
            {!c.released && <span className="rs-badge">{t("nur Verwaltung")}</span>}
            <InfoButton title={t(c.title)}>{t(c.rule)}</InfoButton>
          </div>
          <div className="rs-pair">
            {c.variants.map((v) => <RuleScene key={c.id + v.label} scene={v} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
