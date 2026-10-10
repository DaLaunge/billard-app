import { useState } from "react";
import { Search, X, ArrowDownAZ, ListOrdered, ChevronRight, ChevronsDownUp, ChevronsUpDown, Tag } from "lucide-react";
import { RULE_CASES, ALL_DISCS, casesForDisc, searchCases, sourceLine, setsOf, setFor, sortCases, bookChapter, BOOK_CHAPTERS, displayTitle, TAGS } from "../lib/rules";
import { t } from "../lib/i18n";
import RuleScene from "./widgets/RuleScene";
import InfoButton from "./widgets/InfoButton";
import DiscBall, { DiscAll, DiscPickRow } from "./widgets/DiscBall";

const ALL = "alle";
const SORT_KEY = "ruleSort";
const CH_KEY = "ruleChaptersOpen";
const readChapters = () => { try { return new Set(JSON.parse(localStorage.getItem(CH_KEY) || "[]")); } catch { return new Set(); } };
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
   onView(id) wird gemeldet, wenn alle Animationen (Varianten) des gezeigten Satzes eines freigegebenen Falls bis
             zum Urteil angesehen wurden - nur Aufklappen zaehlt nicht (Erfolge "Regeln angesehen")
   onlyReleased  nur fuer alle freigegebene Faelle (Standard); die Verwaltung
             schaltet es aus. Der Katalog selbst: lib/rules/index.js. */
export default function RuleHelp({ disc: discProp, lockDisc = false, ids, onlyReleased = true, onView }) {
  const [q, setQ] = useState("");
  const [disc, setDisc] = useState(discProp || ALL);
  const [watched, setWatched] = useState({}); // Fall+Satz -> Varianten, die bis zum Ende gesehen wurden
  const markWatched = (c, set, label) => {
    const key = c.id + set.discs.join();
    const cur = new Set(watched[key] || []);
    if (cur.has(label)) return;
    cur.add(label);
    setWatched((w) => ({ ...w, [key]: [...cur] }));
    if (c.released && set.variants.every((v) => cur.has(v.label))) onView?.(c.id);
  };
  const [pick, setPick] = useState({}); // Fall-id -> Disziplin, deren Satz gezeigt wird

  const [sort, setSort] = useState(readSort); // "book" = wie im Regelwerk (Standard), "az" = alphabetisch
  const pickSort = (m) => { setSort(m); try { localStorage.setItem(SORT_KEY, m); } catch { /* Privatmodus */ } };

  // Aufklappen: Kapitel (nur in der Regelwerk-Reihenfolge) und einzelne Faelle. Standard: alles zu - so sieht man
  // zuerst nur die Gliederung und kommt mit zwei Klicks zum Ergebnis. Kapitel merkt das Geraet.
  const [openCh, setOpenCh] = useState(readChapters);
  const [caseOpen, setCaseOpen] = useState({}); // Fall-id -> true/false (ueberschreibt den Standard)
  const saveCh = (set) => { setOpenCh(set); try { localStorage.setItem(CH_KEY, JSON.stringify([...set])); } catch { /* Privatmodus */ } };
  const toggleCh = (n) => { const set = new Set(openCh); if (set.has(n)) set.delete(n); else set.add(n); saveCh(set); };

  const [tag, setTag] = useState(null); // Schlagwort-Filter: nur Faelle mit diesem Tag
  const pool = casesForDisc(disc === ALL ? null : disc, { onlyReleased, ids }).filter((c) => !tag || (c.tags || []).includes(tag));
  const chOpen = (n) => !!tag || openCh.has(n); // mit Tag-Filter sind alle Kapitel offen: das Ergebnis steht sofort da
  // Mit Suchbegriff gilt die Treffer-Reihenfolge (das Beste zuerst); ohne ihn die gewaehlte Sortierung.
  const shown = q.trim() ? searchCases(pool, q) : sortCases(pool, sort);
  const grouped = !q.trim() && sort === "book";
  const chapters = grouped ? [...new Set(shown.map(bookChapter))] : [];
  const countIn = (n) => shown.filter((c) => bookChapter(c) === n).length;
  // Wenige Treffer (Suche) oder ein gezielt angeforderter Fall sind gleich aufgeklappt.
  const autoOpen = (q.trim() && shown.length <= 3) || (ids && ids.length <= 3);
  const isCaseOpen = (id) => (id in caseOpen ? caseOpen[id] : !!autoOpen);
  const allOpen = grouped ? chapters.length > 0 && chapters.every((n) => chOpen(n)) : shown.length > 0 && shown.every((c) => isCaseOpen(c.id));
  const toggleAll = () => {
    if (grouped) saveCh(allOpen ? new Set() : new Set(chapters));
    else setCaseOpen(Object.fromEntries(shown.map((c) => [c.id, !allOpen])));
  };

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
          <button type="button" className="chip chip-icon" onClick={toggleAll} title={allOpen ? t("Alle zuklappen") : t("Alle aufklappen")}
            aria-label={allOpen ? t("Alle zuklappen") : t("Alle aufklappen")}>{allOpen ? <ChevronsDownUp size={16} /> : <ChevronsUpDown size={16} />}</button>
        </span>
      </div>
      {tag && (
        <div className="rs-activetag">
          <button type="button" className="chip active" onClick={() => setTag(null)} title={t("Schlagwort-Filter aufheben")} aria-label={t("Schlagwort-Filter aufheben")}>
            <Tag size={14} /> {t(TAGS[tag])} <X size={14} />
          </button>
          <span className="rs-activetag-n">{t("{n} Regeln", { n: shown.length })}</span>
        </div>
      )}
      {shown.length === 0 && <p className="hint">{t("Keine passende Regel gefunden.")}</p>}
      {shown.map((c, i) => {
        const chap = bookChapter(c);
        const heading = grouped && (i === 0 || bookChapter(shown[i - 1]) !== chap) ? BOOK_CHAPTERS[chap] : null;
        const set = setFor(c, pick[c.id] || (disc === ALL ? null : disc));
        const multi = setsOf(c).length > 1;
        if (grouped && !chOpen(chap) && !heading) return null; // Fall eines zugeklappten Kapitels: nichts, auch keinen Abstand
        return (
          <div key={c.id} className="rs-case-wrap">
            {heading && (
              <h3 className="rs-chapter">
                <button type="button" className={"rs-chapter-btn" + (chOpen(chap) ? " open" : "")} aria-expanded={chOpen(chap)} onClick={() => toggleCh(chap)}>
                  <ChevronRight size={16} className="rs-chev" />
                  <span>{t(heading)}</span>
                  <span className="rs-chapter-count">{countIn(chap)}</span>
                </button>
              </h3>
            )}
            {(!grouped || chOpen(chap)) && (
          <div className={"rs-case" + (isCaseOpen(c.id) ? " open" : "")}>
            <div className="rs-case-head">
              <h4>
                <button type="button" className="rs-case-toggle" aria-expanded={isCaseOpen(c.id)} onClick={() => setCaseOpen((m) => ({ ...m, [c.id]: !isCaseOpen(c.id) }))}>
                  <ChevronRight size={15} className="rs-chev" />
                  <span>{displayTitle(c)}</span>
                </button>
              </h4>
              <DiscTags discs={c.discs} active={set.discs} onPick={multi ? (d) => { setPick((p) => ({ ...p, [c.id]: d })); setCaseOpen((m) => ({ ...m, [c.id]: true })); } : undefined} />
              {!c.released && <span className="rs-badge">{t("nur Verwaltung")}</span>}
              <InfoButton title={t(c.title)}>{t(c.rule)} {t("Quelle:")} {sourceLine(c)}</InfoButton>
            </div>
            <div className="rs-tagrow">
              {(c.tags || []).map((k) => (
                <button key={k} type="button" className={"rs-tagpill" + (tag === k ? " on" : "")} aria-pressed={tag === k}
                  onClick={() => setTag(tag === k ? null : k)} title={t("Nur Regeln mit diesem Schlagwort zeigen")}>{t(TAGS[k])}</button>
              ))}
            </div>
            {isCaseOpen(c.id) && (
              <>
                <div className="rs-pair">
                  {set.variants.map((v) => <RuleScene key={c.id + set.discs.join() + v.label} scene={{ ...v, tag: v.tag || set.tag }} onEnd={() => markWatched(c, set, v.label)} />)}
                </div>
              </>
            )}
          </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { RULE_CASES };
