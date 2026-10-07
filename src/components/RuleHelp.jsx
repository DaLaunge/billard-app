import { useState } from "react";
import { Search, X, ArrowDownAZ, ListOrdered } from "lucide-react";
import { RULE_CASES, ALL_DISCS, TOPICS, casesForDisc, searchCases, sourceLine, setsOf, setFor, sortCases, bookChapter, BOOK_CHAPTERS } from "../lib/rules";
import { t } from "../lib/i18n";
import RuleScene from "./widgets/RuleScene";
import InfoButton from "./widgets/InfoButton";
import DiscBall, { DiscAll, DiscPickRow } from "./widgets/DiscBall";

const ALL = "alle";
const SORT_KEY = "ruleSort";
const readSort = () => { try { return localStorage.getItem(SORT_KEY) === "az" ? "az" : "book"; } catch { return "book"; } };

/* Disziplinen eines Falls als Kugel-Tags: nur die Kugeln, ohne Text. Gilt der
   Fall fuer alle vier, genuegt der Haufen (DiscAll) - das spart Platz. Hat der
   Fall mehrere Saetze (je Disziplin eine passende Situation), sind die Kugeln
   zugleich der Umschalter: die Kugeln des gezeigten Satzes sind umrandet. */
export function DiscTags({ discs, active, onPick }) {
  const all = ALL_DISCS.every((d) => discs.includes(d));
  if (all && !onPick) return <span className="rs-tags"><DiscAll size={22} /></span>;
  return (
    <span className="rs-tags">
      {discs.map((d) => (onPick
        ? <button key={d} type="button" className={"rs-tagbtn" + (active.includes(d) ? " on" : "")} onClick={() => onPick(d)}
            aria-pressed={active.includes(d)} aria-label={t(d)} title={t(d)}><DiscBall disc={d} size={16} /></button>
        : <DiscBall key={d} disc={d} size={16} />))}
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
  const [pick, setPick] = useState({}); // Fall-id -> Disziplin, deren Satz gezeigt wird

  const [sort, setSort] = useState(readSort); // "book" = wie im Regelwerk (Standard), "az" = alphabetisch
  const pickSort = (m) => { setSort(m); try { localStorage.setItem(SORT_KEY, m); } catch { /* Privatmodus */ } };

  const pool = casesForDisc(disc === ALL ? null : disc, { onlyReleased, ids });
  // Mit Suchbegriff gilt die Treffer-Reihenfolge (das Beste zuerst); ohne ihn die gewaehlte Sortierung.
  const shown = q.trim() ? searchCases(pool, q) : sortCases(pool, sort);
  const grouped = !q.trim() && sort === "book";

  return (
    <div className="rs-cases">
      <div className="search-row">
        <Search size={16} className="mail-ico" />
        <input placeholder={t("Regel suchen …")} value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button className="clear-btn" onClick={() => setQ("")} aria-label={t("Suche loeschen")}><X size={15} /></button>}
      </div>
      <div className="rs-filters">
        {!lockDisc && <DiscPickRow discs={ALL_DISCS} value={disc} onChange={setDisc} all={ALL} />}
        <span className="rs-sort" role="group" aria-label={t("Sortierung")}>
          <button type="button" className={"chip chip-icon" + (sort === "book" ? " active" : "")} onClick={() => pickSort("book")}
            title={t("Wie im Regelwerk")} aria-label={t("Wie im Regelwerk")} aria-pressed={sort === "book"}><ListOrdered size={16} /></button>
          <button type="button" className={"chip chip-icon" + (sort === "az" ? " active" : "")} onClick={() => pickSort("az")}
            title={t("Alphabetisch")} aria-label={t("Alphabetisch")} aria-pressed={sort === "az"}><ArrowDownAZ size={16} /></button>
        </span>
      </div>
      {shown.length === 0 && <p className="hint">{t("Keine passende Regel gefunden.")}</p>}
      {shown.map((c, i) => {
        const chap = bookChapter(c);
        const heading = grouped && (i === 0 || bookChapter(shown[i - 1]) !== chap) ? BOOK_CHAPTERS[chap] : null;
        const set = setFor(c, pick[c.id] || (disc === ALL ? null : disc));
        const multi = setsOf(c).length > 1;
        return (
          <div key={c.id} className="rs-case-wrap">
            {heading && <h3 className="rs-chapter">{t(heading)}</h3>}
          <div className="rs-case">
            <div className="rs-case-head">
              <h4>{t(c.title)}</h4>
              <DiscTags discs={c.discs} active={set.discs} onPick={multi ? (d) => setPick((p) => ({ ...p, [c.id]: d })) : undefined} />
              {!c.released && <span className="rs-badge">{t("nur Verwaltung")}</span>}
              <InfoButton title={t(c.title)}>{t(c.rule)} {t("Quelle:")} {sourceLine(c)}</InfoButton>
            </div>
            <p className="rs-topic">{t(TOPICS[c.topic])}</p>
            <div className="rs-pair">
              {set.variants.map((v) => <RuleScene key={c.id + set.discs.join() + v.label} scene={{ ...v, tag: v.tag || set.tag }} />)}
            </div>
          </div>
          </div>
        );
      })}
    </div>
  );
}

export { RULE_CASES };
