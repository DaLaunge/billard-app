import { useState } from "react";
import { ArrowRight, Plus, RotateCcw } from "lucide-react";
import { t } from "../lib/i18n";
import { initials } from "../lib/format";
import { poolBallStyle } from "../lib/pool";
import Ball from "./Ball";

export default function StraightPoolScorer({ me, opp, colorOf, badgeOf, photoOf, onFinish, toast, sideNames, sideAvatars }) {
  const PRESETS = [50, 70, 80, 90, 100, 150];
  const [target, setTarget] = useState(100);
  const [custom, setCustom] = useState("");
  const [started, setStarted] = useState(false);

  const [sc, setSc] = useState([0, 0]);
  const [active, setActive] = useState(0);
  const [starter, setStarter] = useState(0);
  const [breakPhase, setBreakPhase] = useState(true);
  const [breakChoose, setBreakChoose] = useState(false);   // nach Anstoß-Foul: wer stößt als Nächstes an
  const [hi, setHi] = useState([0, 0]);
  const [fouls, setFouls] = useState([0, 0]);
  const [maxDef, setMaxDef] = useState([0, 0]);
  const [onTable, setOnTable] = useState(15);
  const [inningRun, setInningRun] = useState(0);
  const [pocketed, setPocketed] = useState([0, 0]);        // versenkte Kugeln gesamt (Zähler für Schnitt)
  const [missInn, setMissInn] = useState([0, 0]);          // Aufnahmen mit Miss/Foul
  const [safeInn, setSafeInn] = useState([0, 0]);          // Aufnahmen mit Safe/Anstoß
  const [twoBall, setTwoBall] = useState([0, 0]);          // Zwei-Kugel-Räumungen (0 Kugeln am Tisch)
  const [entry, setEntry] = useState(null);                // null | 'miss' | 'safe' | 'foul'
  const [remain, setRemain] = useState(15);
  const [hist, setHist] = useState([]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [log, setLog] = useState([]);                       // Verlauf: eine Zeile je Aufnahme/Ereignis
  const pushLog = (e) => setLog((l) => [...l, e]);
  // Egal wie oft der Anstoss foult (moeglicherweise von wechselnden Spielern
  // versucht): die eroeffnende Aufnahme wird nur EINMAL gezaehlt, nicht pro
  // Fehlversuch. Wird beim ersten Anstoss-Foul auf true gesetzt und bleibt
  // es fuer den Rest des Spiels (die breakPhase endet ohnehin mit dem
  // ersten regulaeren Stoss und startet nie wieder).
  const [breakCharged, setBreakCharged] = useState(false);

  const names = sideNames || [me.nickname, opp.nickname];
  const membersOf = (i) => (sideAvatars ? sideAvatars[i] : [i === 0 ? me : opp]);
  const inningNo = missInn[0] + missInn[1] + safeInn[0] + safeInn[1] + 1;
  const inningsOf = (i) => missInn[i] + safeInn[i];
  const offAvg = (p, MI = missInn, PK = pocketed) => (MI[p] > 0 ? PK[p] / MI[p] : 0);
  const allAvg = (p, MI = missInn, SI = safeInn, PK = pocketed) =>
    (MI[p] + SI[p] > 0 ? PK[p] / (MI[p] + SI[p]) : 0);
  const fmt = (x) => x.toFixed(1);
  const logForPlayer = (i) => log.filter((e) => e.player === i);
  // Jede Zeile ist eigenstaendig nachvollziehbar: welche Aufnahme, was ist
  // passiert (inkl. Foul-Abzug), welche Serie stand zu dem Zeitpunkt, und
  // wie hoch war der Gesamtpunktestand des Spielers UNMITTELBAR danach
  // (e.scoreAfter) - Score wird separat zurueckgegeben, damit er in einer
  // eigenen rechtsbuendigen Spalte dargestellt werden kann.
  const describeLog = (e) => {
    const parts = [t("Aufnahme {n}", { n: e.inning })];
    switch (e.type) {
      case "rack": parts.push(t("Rack +{n}", { n: e.potted })); break;
      case "safe": parts.push(t("Safe")); break;
      case "breakfoul": parts.push(t("Anstoß-Foul −2")); break;
      case "foul":
        parts.push(e.bonus ? t("Foul −1, 3er-Foul −15") : t("Foul −1"));
        break;
      default: parts.push(t("Fehler")); break; // "miss"
    }
    if (e.run > 0) parts.push(t("Serie {n}", { n: e.run }));
    return { label: parts.join(" · "), score: e.scoreAfter };
  };

  const snap = () => ({ sc: [...sc], active, breakPhase, hi: [...hi], fouls: [...fouls],
    maxDef: [...maxDef], onTable, inningRun, pocketed: [...pocketed],
    missInn: [...missInn], safeInn: [...safeInn], twoBall: [...twoBall], breakCharged, log: [...log] });
  const pushHist = (x) => setHist((h) => [...h.slice(-80), x]);
  const withDeficit = (scores, md) => {
    const nd = [...md];
    const d0 = scores[1] - scores[0]; if (d0 > nd[0]) nd[0] = d0;
    const d1 = scores[0] - scores[1]; if (d1 > nd[1]) nd[1] = d1;
    return nd;
  };

  // Ergebnis fürs Speichern zusammenbauen (Offensivschnitt nur ab 3 Miss-Aufnahmen für Belohnungen)
  const buildResult = (scores, HI, MD, PK, MI, TB, LOG = log) => ({
    s1: scores[0], s2: scores[1], hr1: HI[0], hr2: HI[1], def1: MD[0], def2: MD[1],
    avg1: MI[0] >= 3 ? Math.round((PK[0] / MI[0]) * 100) / 100 : null,
    avg2: MI[1] >= 3 ? Math.round((PK[1] / MI[1]) * 100) / 100 : null,
    tb1: TB[0], tb2: TB[1],
    log: LOG,
  });

  // Rack ausgeschossen: seit letzter Aufnahme versenkt (bis auf die Anstoßkugel), Serie läuft weiter.
  const bookRack = () => {
    const pts = Math.max(0, onTable - 1);
    pushHist(snap());
    const ns = [...sc]; ns[active] += pts;
    const nir = inningRun + pts;
    const nhi = [...hi]; if (nir > nhi[active]) nhi[active] = nir;
    const npk = [...pocketed]; npk[active] += pts;
    const nf = [...fouls]; nf[active] = 0;
    const nmd = withDeficit(ns, maxDef);
    setSc(ns); setInningRun(nir); setHi(nhi); setPocketed(npk); setFouls(nf); setMaxDef(nmd); setOnTable(15); setBreakPhase(false);
    const nlog = [...log, { type: "rack", player: active, potted: pts, run: nir, scoreAfter: ns[active], inning: inningNo }];
    setLog(nlog);
    if (ns[active] >= target) onFinish(buildResult(ns, nhi, nmd, npk, missInn, twoBall, nlog));
  };

  const openEntry = (type) => { setEntry(type); setRemain(onTable); };
  const partial = Math.max(0, onTable - remain);

  const applyEntry = (continueActive = false) => {
    const run = inningRun + partial;
    const penalty = entry === "foul" ? 1 : 0;
    pushHist(snap());
    const ns = [...sc]; ns[active] += partial;
    const nhi = [...hi]; if (run > nhi[active]) nhi[active] = run;
    const npk = [...pocketed]; npk[active] += partial;
    const ntb = [...twoBall]; if (remain === 0) ntb[active] += 1;
    const nf = [...fouls];
    let threeFoul = false;
    if (penalty > 0) {
      ns[active] -= penalty;
      if (run > 0) nf[active] = 0;
      else { nf[active] += 1; if (nf[active] >= 3) { ns[active] -= 15; nf[active] = 0; threeFoul = true; } }
    } else { nf[active] = 0; }
    const nmd = withDeficit(ns, maxDef);
    const rerack = remain <= 1 || threeFoul;
    const finished = ns[active] >= target;
    setSc(ns); setHi(nhi); setPocketed(npk); setTwoBall(ntb); setFouls(nf); setMaxDef(nmd);
    setOnTable(rerack ? 15 : remain); setEntry(null); setBreakPhase(false);
    const nMI = [...missInn], nSI = [...safeInn];
    if (!finished) {
      if (continueActive && !threeFoul) {
        setInningRun(run);                                  // gleicher Spieler, keine Aufnahme gezählt
      } else {
        setInningRun(0);
        if (entry === "safe") { nSI[active] += 1; setSafeInn(nSI); }
        else { nMI[active] += 1; setMissInn(nMI); }         // Miss & Foul zählen als Miss-Aufnahme
        setActive((a) => 1 - a);
      }
    }
    const nlog = [...log, { type: entry, player: active, potted: partial, run: threeFoul ? 0 : run,
      bonus: threeFoul ? 15 : 0, scoreAfter: ns[active], inning: inningNo }];
    setLog(nlog);
    if (threeFoul && toast) toast(t("3 Fouls in Folge – {name} bekommt −15 Strafpunkte!", { name: names[active] }));
    if (finished) onFinish(buildResult(ns, nhi, nmd, npk, nMI, ntb, nlog));
  };

  // Anstoß regulär gespielt (Safety-Anstoß): zählt als Safe-Aufnahme, Gegner ist dran
  // Anstoß-Foul −2: Safe-Aufnahme, danach Wahl, wer als Nächstes anstößt (mehrere Anstöße
  // moeglich) - egal wie viele Anstoss-Fouls es dabei gibt, die Eroeffnung
  // zaehlt insgesamt nur als EINE Aufnahme (des ersten Anstoss-Versuchs).
  const breakFoul = () => {
    pushHist(snap());
    const ns = [...sc]; ns[active] -= 2;
    const nSI = [...safeInn];
    if (!breakCharged) { nSI[active] += 1; setBreakCharged(true); }
    const nmd = withDeficit(ns, maxDef);
    setSc(ns); setSafeInn(nSI); setMaxDef(nmd); setOnTable(15); setInningRun(0);
    pushLog({ type: "breakfoul", player: active, run: 0, scoreAfter: ns[active], inning: inningNo });
    setBreakChoose(true);
  };
  const chooseBreaker = (who) => { setActive(who); setBreakChoose(false); };

  const undo = () => {
    setHist((h) => {
      if (!h.length) return h;
      const l = h[h.length - 1];
      setSc(l.sc); setActive(l.active); setBreakPhase(l.breakPhase); setHi(l.hi); setFouls(l.fouls);
      setMaxDef(l.maxDef); setOnTable(l.onTable); setInningRun(l.inningRun); setPocketed(l.pocketed);
      setMissInn(l.missInn); setSafeInn(l.safeInn); setTwoBall(l.twoBall);
      setBreakCharged(l.breakCharged ?? false);
      setLog(l.log ?? []);
      setEntry(null); setBreakChoose(false);
      return h.slice(0, -1);
    });
  };

  // ---- Setup ----
  if (!started) {
    return (
      <div className="sp-setup">
        <p className="q">{t("Zielpunktzahl für 14/1 Endlos")}</p>
        <div className="disc-grid target-grid">
          {PRESETS.map((t) => (
            <button key={t} className={"disc-card compact" + (target === t && custom === "" ? " sel" : "")}
              onClick={() => { setTarget(t); setCustom(""); }}>{t}</button>
          ))}
        </div>
        <div className="search-row" style={{ marginTop: 4 }}>
          <input type="number" inputMode="numeric" placeholder={t("oder eigenes Ziel eingeben …")}
            value={custom} onChange={(e) => {
              setCustom(e.target.value);
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n) && n > 0) setTarget(n);
            }} />
        </div>
        <p className="q" style={{ marginTop: 8 }}>{t("Wer hat den Anstoß?")}</p>
        <div className="disc-grid">
          {[0, 1].map((i) => (
            <button key={i} className={"disc-card" + (starter === i ? " sel" : "")}
              onClick={() => setStarter(i)}>{names[i]}</button>
          ))}
        </div>
        <button className="btn primary" disabled={!(target > 0)}
          onClick={() => { setActive(starter); setStarted(true); }}>
          {t("Los geht's – bis")} {target} <ArrowRight size={18} />
        </button>
        <p className="hint center">{t("Jede versenkte Kugel = 1 Punkt. Aufnahme beenden mit")} <b>{t("Fehler")}</b> {t("(zählt für den Schnitt) oder")} <b>{t("Safe")}</b> {t("(zählt nicht). Rack ausgeschossen tippst du sofort ein. Foul = −1, Anstoß −2, drei Fouls in Folge zusätzlich −15.")}</p>
      </div>
    );
  }

  // ---- Wahl nach Anstoß-Foul ----
  if (breakChoose) {
    return (
      <div className="sp-entry">
        <p className="sp-entry-title">{t("Anstoß-Foul −2 · Wer stößt als Nächstes an?")}</p>
        <div className="opp-grid">
          {[0, 1].map((i) => (
            <button key={i} className="opp-card" onClick={() => chooseBreaker(i)}>
              <div className="sc-avatars">
                {membersOf(i).map((mm) => (
                  <Ball key={mm.id} color={colorOf(mm.nickname)} label={initials(mm.nickname)} badge={badgeOf(mm.nickname)} photo={photoOf(mm.nickname)} size={44} />
                ))}
              </div>
              <span>{names[i]}</span>
            </button>
          ))}
        </div>
        <p className="hint center">{t("So sind mehrere Anstöße hintereinander möglich (Wiederholungs-Anstoß).")}</p>
      </div>
    );
  }

  // ---- Aufnahme abschließen ----
  if (entry) {
    const lbl = entry === "foul" ? t(" (Foul −1)") : entry === "safe" ? t(" (Safe)") : t(" (Fehler)");
    return (
      <div className="sp-entry">
        <p className="sp-entry-title">{names[active]}: {t("Aufnahme abschließen")}{lbl}</p>
        <div className="sp-entry-lbl">{t("Kugeln noch am Tisch")}</div>
        <div className="num-grid">
          {Array.from({ length: onTable + 1 }, (_, n) => n).map((n) => (
            <button key={n} className={"pool-ball" + (remain === n ? " sel" : "")} style={poolBallStyle(n)}
              onClick={() => setRemain(n)}><span className="pb-no">{n}</span></button>
          ))}
        </div>
        <div className="sp-run-preview">{t("Serie dieser Aufnahme:")} <b>{inningRun + partial}</b></div>
        {remain === 0 && <p className="hint center" style={{ marginTop: 0 }}>{t("Zwei-Kugel-Räumung! Tisch wird neu aufgebaut.")}</p>}
        {remain === 1 && <p className="hint center" style={{ marginTop: 0 }}>{t("Tisch wird neu aufgebaut (15 Kugeln).")}</p>}
        <div className="sp-controls">
          <button className="btn ghost" onClick={() => setEntry(null)}>{t("Abbrechen")}</button>
          <button className="btn primary" onClick={() => applyEntry(false)}>{t("Übernehmen")}</button>
        </div>
      </div>
    );
  }

  // ---- Laufendes Spiel ----
  const need = target - sc[active];
  const rail = (i) => (
    <div className={"sp-rail" + (active === i ? " active" : "")}>
      <div className="sp-rail-avatar">
        {membersOf(i).map((mm) => (
          <Ball key={mm.id} color={colorOf(mm.nickname)} label={initials(mm.nickname)} badge={badgeOf(mm.nickname)} photo={photoOf(mm.nickname)} size={88} />
        ))}
      </div>
      <span className="sp-rail-name">{names[i]}</span>
      <div className="sp-mini-log">
        {[...logForPlayer(i)].reverse().map((e, idx) => {
          const d = describeLog(e);
          return (
            <div key={logForPlayer(i).length - idx} className="sp-mini-log-row">
              <span className="sp-mini-log-label">{d.label}</span>
              <span className="sp-mini-log-score">{d.score}</span>
            </div>
          );
        })}
        {logForPlayer(i).length === 0 && <div className="sp-mini-log-row hint">{t("Noch keine Aufnahme.")}</div>}
      </div>
    </div>
  );
  return (
    <div className="sp">
      {rail(0)}
      <div className="sp-center">
      <div className="sp-board">
        {[0, 1].map((i) => (
          <div key={i} className={"sp-side" + (active === i ? " active" : "")}>
            <div className="sc-avatars">
              {membersOf(i).map((mm) => (
                <Ball key={mm.id} color={colorOf(mm.nickname)} label={initials(mm.nickname)} badge={badgeOf(mm.nickname)} photo={photoOf(mm.nickname)} size={52} />
              ))}
            </div>
            <span className="sp-name">{names[i]}</span>
            <div className="sp-score">{sc[i]}</div>
            <div className="sp-meta">{t("Höchstserie")} {hi[i]} · {t("{n} Aufnahmen", { n: inningsOf(i) })}</div>
            <div className="sp-avg">Ø {fmt(offAvg(i))} <span>{t("Fehler")}</span> · {fmt(allAvg(i))} <span>{t("ges.")}</span></div>
            {fouls[i] > 0 && (
              <div className={"sp-foulwarn" + (fouls[i] >= 2 ? " danger" : "")}>
                {fouls[i]} Foul{fouls[i] > 1 ? "s" : ""} {t("in Folge")}{fouls[i] >= 2 ? t(" – Vorsicht!") : ""}
              </div>
            )}
            {active === i && <div className="sp-turn">{t("am Tisch")}{inningRun > 0 ? ` · ${t("Serie {n}", { n: inningRun })}` : ""}</div>}
          </div>
        ))}
      </div>

      <div className="sp-actions">
        <div className="sp-target">Ziel {target} · Aufnahme {inningNo} · {onTable} Kugeln am Tisch</div>
        {need > 0 && need <= 14 && (
          <div className="sp-need">{t("Nur noch")} <b>{need}</b> Kugel{need > 1 ? "n" : ""} bis {names[active]} gewinnt!</div>
        )}

        {breakPhase && (
          <div className="sp-need" style={{ color: "var(--ivory-dim)" }}>{t("Anstoß: {name} ist dran", { name: names[active] })}</div>
        )}
        <div className="sp-primary-actions">
          <button className="sp-rack" onClick={bookRack} disabled={onTable <= 1}>
            <Plus size={20} /> Rack ausgeschossen (+{Math.max(0, onTable - 1)})
          </button>
          <div className="sp-controls">
            <button className="sp-pot half" onClick={() => openEntry("miss")}>{t("Fehler")}</button>
            <button className="sp-pot half safe" onClick={() => openEntry("safe")}>{t("Safe")}</button>
          </div>
          <div className="sp-controls">
            {breakPhase ? (
              <button className="btn ghost warn" onClick={breakFoul}>{t("Anstoß-Foul −2")}</button>
            ) : (
              <button className="btn ghost warn" onClick={() => openEntry("foul")}>{t("Foul −1")}</button>
            )}
            <button className="btn ghost" onClick={undo} disabled={hist.length === 0}><RotateCcw size={15} /> {t("Rückgängig")}</button>
          </div>
        </div>

        {!confirmEnd ? (
          <button className="btn subtle" onClick={() => setConfirmEnd(true)}>{t("Match vorzeitig beenden")}</button>
        ) : (
          <div className="sp-endbox">
            <p className="hint center" style={{ marginTop: 0 }}>Aktueller Stand {sc[0]} : {sc[1]} – wirklich beenden?</p>
            <div className="sp-controls">
              <button className="btn ghost" onClick={() => setConfirmEnd(false)}>{t("Weiterspielen")}</button>
              <button className="btn primary" disabled={sc[0] === sc[1]}
                onClick={() => onFinish(buildResult(sc, hi, maxDef, pocketed, missInn, twoBall))}>
                {t("Beenden")}
              </button>
            </div>
            {sc[0] === sc[1] && <p className="hint center">{t("Bei Gleichstand kann nicht beendet werden.")}</p>}
          </div>
        )}

        {log.length > 0 && (
          <div className="sp-log">
            <h4>{t("Verlauf")}</h4>
            <div className="sp-log-list">
              {[...log].reverse().map((e, idx) => {
                const d = describeLog(e);
                return (
                <div key={log.length - idx} className="sp-log-row">
                  <span className="sp-log-player">{names[e.player]}</span>
                  <span className="sp-log-label">{d.label}</span>
                  <span className="sp-log-score">{d.score}</span>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </div>
      {rail(1)}
    </div>
  );
}
