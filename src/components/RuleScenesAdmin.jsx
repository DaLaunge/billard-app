import { useState } from "react";
import { Search, X } from "lucide-react";
import { RULE_CASES } from "../lib/ruleScenes";
import { DISC_BALL } from "../lib/pool";
import { t } from "../lib/i18n";
import RuleScene from "./widgets/RuleScene";
import InfoButton from "./widgets/InfoButton";
import DiscBall, { DiscAll, DiscPickRow } from "./widgets/DiscBall";

const ALL_DISCS = Object.keys(DISC_BALL);
const ALL = "alle";

/* Disziplinen eines Falls als Kugel-Tags: nur die Kugeln, ohne Text. Gilt der
   Fall fuer alle vier, genuegt der Haufen (DiscAll) - das spart Platz. */
export function DiscTags({ discs }) {
  const all = ALL_DISCS.every((d) => discs.includes(d));
  return (
    <span className="rs-tags">
      {all ? <DiscAll size={22} /> : discs.map((d) => <DiscBall key={d} disc={d} size={16} />)}
    </span>
  );
}

/* Regelkunde-Prototyp, nur in der Verwaltung (wird von AdminScreen per
   React.lazy erst nach dem Aufklappen geladen, alle anderen Nutzer laden
   davon nichts). Welche Faelle spaeter fuer alle freigegeben werden, steht
   in RULE_CASES (`released`). Pro Fall zwei Varianten nebeneinander: Foul und
   kein Foul, das Urteil kommt erst im letzten Schritt. Suche ueber Name,
   Suchbegriffe, Regeltext und Disziplinnamen (deutsch und englisch). */
export default function RuleScenesAdmin() {
  const [q, setQ] = useState("");
  const [disc, setDisc] = useState(ALL);

  const needle = q.trim().toLowerCase();
  const hay = (c) => [c.title, ...c.keywords, c.rule, ...c.discs]
    .flatMap((s) => [s, t(s)]).join("\n").toLowerCase();
  const shown = RULE_CASES.filter((c) => (disc === ALL || c.discs.includes(disc)) && (!needle || hay(c).includes(needle)));

  return (
    <div className="rs-cases">
      <div className="search-row">
        <Search size={16} className="mail-ico" />
        <input placeholder={t("Regel suchen …")} value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button className="clear-btn" onClick={() => setQ("")} aria-label={t("Suche loeschen")}><X size={15} /></button>}
      </div>
      <DiscPickRow discs={ALL_DISCS} value={disc} onChange={setDisc} all={ALL} />
      {shown.length === 0 && <p className="hint">{t("Keine passende Regel gefunden.")}</p>}
      {shown.map((c) => (
        <div key={c.id} className="rs-case">
          <div className="rs-case-head">
            <h4>{t(c.title)}</h4>
            <DiscTags discs={c.discs} />
            {!c.released && <span className="rs-badge">{t("nur Verwaltung")}</span>}
            <InfoButton title={t(c.title)}>{t(c.rule)} {t("Quelle:")} {t(c.source)}</InfoButton>
          </div>
          <div className="rs-pair">
            {c.variants.map((v) => <RuleScene key={c.id + v.label} scene={v} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
