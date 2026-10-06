import { useState } from "react";
import { Search, X } from "lucide-react";
import { RULE_CASES, ALL_DISCS, TOPICS, casesForDisc, searchCases, sourceLine } from "../lib/rules";
import { t } from "../lib/i18n";
import RuleScene from "./widgets/RuleScene";
import InfoButton from "./widgets/InfoButton";
import DiscBall, { DiscAll, DiscPickRow } from "./widgets/DiscBall";

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

/* Die Regelkunde als wiederverwendbare Hilfe-Seite: Suche, Disziplinfilter,
   Faelle mit Animation. Eine Komponente fuer alle Stellen:
     <RuleHelp onlyReleased={false} />            Verwaltung (alle Faelle)
     <RuleHelp disc="9 Ball" lockDisc />          Hilfe im laufenden 9-Ball-Match
     <RuleHelp disc="9 Ball" ids={["push-out"]} /> gezielt ein Streitfall
   disc      vorgewaehlte Disziplin (sonst alle)
   lockDisc  Disziplinfilter ausblenden (die Disziplin steht im Match fest)
   ids       nur diese Faelle
   onlyReleased  nur fuer alle freigegebene Faelle (Standard); die Verwaltung
             schaltet es aus. Der Katalog selbst: lib/rules/index.js. */
export default function RuleHelp({ disc: discProp, lockDisc = false, ids, onlyReleased = true }) {
  const [q, setQ] = useState("");
  const [disc, setDisc] = useState(discProp || ALL);

  const pool = casesForDisc(disc === ALL ? null : disc, { onlyReleased, ids });
  const shown = searchCases(pool, q);

  return (
    <div className="rs-cases">
      <div className="search-row">
        <Search size={16} className="mail-ico" />
        <input placeholder={t("Regel suchen …")} value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button className="clear-btn" onClick={() => setQ("")} aria-label={t("Suche loeschen")}><X size={15} /></button>}
      </div>
      {!lockDisc && <DiscPickRow discs={ALL_DISCS} value={disc} onChange={setDisc} all={ALL} />}
      {shown.length === 0 && <p className="hint">{t("Keine passende Regel gefunden.")}</p>}
      {shown.map((c) => (
        <div key={c.id} className="rs-case">
          <div className="rs-case-head">
            <h4>{t(c.title)}</h4>
            <DiscTags discs={c.discs} />
            {!c.released && <span className="rs-badge">{t("nur Verwaltung")}</span>}
            <InfoButton title={t(c.title)}>{t(c.rule)} {t("Quelle:")} {sourceLine(c)}</InfoButton>
          </div>
          <p className="rs-topic">{t(TOPICS[c.topic])}</p>
          <div className="rs-pair">
            {c.variants.map((v) => <RuleScene key={c.id + v.label} scene={v} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export { RULE_CASES };
