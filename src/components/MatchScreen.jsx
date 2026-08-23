import { useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ChevronLeft, Check, X, Minus, Plus, Pencil, Search, QrCode, ArrowRight } from "lucide-react";
import { supabase } from "../supabase";
import { t } from "../lib/i18n";
import { winProb, initials } from "../lib/format";
import Ball from "./Ball";
import StraightPoolScorer from "./StraightPoolScorer";
import InviteScreen from "./InviteScreen";

export default function MatchScreen({ me, players, matches, disciplines, ratingOf, onDone, onCancel, onReload, toast, colorOf, badgeOf, initialOpp }) {
  const [step, setStep] = useState(initialOpp ? 1 : 0);
  const [opp, setOpp] = useState(initialOpp || null);
  const [showMyQr, setShowMyQr] = useState(false);
  const [mode, setMode] = useState("single");
  const [partner, setPartner] = useState(null);
  const [opp2, setOpp2] = useState(null);
  const [s1, setS1] = useState(0);
  const [s2, setS2] = useState(0);
  const [disc, setDisc] = useState(null);
  const [hr, setHr] = useState([null, null]);   // Höchstserie [ich, Gegner] (nur 14/1)
  const [def, setDef] = useState([null, null]); // aufgeholter Rückstand (nur 14/1)
  const [avg, setAvg] = useState([null, null]); // Offensivschnitt (nur 14/1)
  const [tb, setTb] = useState([null, null]);   // Zwei-Kugel-Räumungen (nur 14/1)
  const [oppQuery, setOppQuery] = useState("");
  const [pendingDisc, setPendingDisc] = useState(null);
  const [leaveWarn, setLeaveWarn] = useState(false);
  const [abortAsk, setAbortAsk] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [busy, setBusy] = useState(false);

  const is141 = disc === "14/1 Endlos";
  const teamA = mode === "double" && partner ? `${me.nickname} & ${partner.nickname}` : me.nickname;
  const teamB = mode === "double" && opp2 ? `${opp?.nickname} & ${opp2.nickname}` : (opp?.nickname || "");
  const pickPlayer = (p) => {
    if (mode === "single") { setOpp(p); setStep(1); return; }
    if (partner?.id === p.id) { setPartner(null); return; }
    if (opp?.id === p.id) { setOpp(null); return; }
    if (opp2?.id === p.id) { setOpp2(null); return; }
    if (!partner) setPartner(p); else if (!opp) setOpp(p); else if (!opp2) setOpp2(p);
  };

  // Wie oft habe ich gegen wen gespielt? (häufigste Gegner zuerst)
  const freqByNick = useMemo(() => {
    const f = {};
    (matches || []).forEach((m) => {
      if (m.player1b_id) return;
      let o = null;
      if (m.p1?.nickname === me.nickname) o = m.p2?.nickname;
      else if (m.p2?.nickname === me.nickname) o = m.p1?.nickname;
      if (o) f[o] = (f[o] || 0) + 1;
    });
    return f;
  }, [matches, me]);

  const ghost = players.find((p) => p.is_ghost);
  const opponents = players
    .filter((p) => p.id !== me.id && !p.is_ghost && !p.blocked)
    .filter((p) => p.nickname.toLowerCase().includes(oppQuery.trim().toLowerCase()))
    .sort((a, b) => (freqByNick[b.nickname] || 0) - (freqByNick[a.nickname] || 0) || a.nickname.localeCompare(b.nickname));

  const myRating = ratingOf(me.nickname);
  const oppRating = opp ? ratingOf(opp.nickname) : 500;
  const prob = winProb(myRating, oppRating);
  const total = s1 + s2;
  const steps = ["Gegner", "Disziplin", "Ergebnis", "Pruefen"];

  // --- Punkte-Vorschau (#1) + Gegner-Vorschlag (#2) ---
  const fmtD = (x) => (x >= 0 ? "+" : "−") + Math.abs(Math.round(x));
  const previewFor = (dsc, oppNick) => {
    const ea = winProb(ratingOf(me.nickname, dsc), ratingOf(oppNick, dsc));
    const is141d = dsc === "14/1 Endlos";
    const D = is141d ? 50 : 4;
    const nf = (tot) => Math.min(tot, 16);
    return {
      ea, is141d,
      winMin: 4 * nf(2 * D - 1) * (D / (2 * D - 1) - ea),
      winMax: 4 * nf(D) * (1 - ea),
      lossMin: 4 * nf(2 * D - 1) * ((D - 1) / (2 * D - 1) - ea),
      lossMax: 4 * nf(D) * (0 - ea),
    };
  };
  const STREAK_THR = [2, 3, 4, 5, 7, 10, 15, 20];
  const myStreak = (() => {
    const mine = matches
      .filter((m) => m.player1_id === me.id || m.player2_id === me.id)
      .sort((a, b) => new Date(b.played_at) - new Date(a.played_at));
    let s = 0;
    for (const m of mine) {
      const won = (m.player1_id === me.id && m.score1 > m.score2) || (m.player2_id === me.id && m.score2 > m.score1);
      if (won) s++; else break;
    }
    return s;
  })();
  const nextStreak = STREAK_THR.find((tt) => tt === myStreak + 1);
  const suggestions = opponents
    .map((p) => ({ p, gain: previewFor("Gesamt", p.nickname).winMax }))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 2);

  const resetScores = () => { setS1(0); setS2(0); setHr([null, null]); setDef([null, null]); setAvg([null, null]); setTb([null, null]); };

  // Disziplin wählen: bei Wechsel zwischen 8/9/10 bleibt das Ergebnis erhalten;
  // ein Wechsel zu oder von 14/1 ändert das Punkteschema -> nachfragen.
  const chooseDisc = (d) => {
    const from = disc;
    if (!from || d === from) { setDisc(d); setStep(2); return; }
    const crosses141 = (from === "14/1 Endlos") !== (d === "14/1 Endlos");
    if (crosses141 && (s1 > 0 || s2 > 0)) { setPendingDisc(d); return; }
    setDisc(d);
    if (crosses141) resetScores();   // Schema-Wechsel ohne bisheriges Ergebnis: sauber starten
    setStep(2);
  };
  const confirmDiscChange = () => {
    setDisc(pendingDisc); resetScores(); setPendingDisc(null); setStep(2);
  };

  const isGhost = !!opp?.is_ghost;

  const save = async () => {
    if (mode === "double") {
      setBusy(true);
      const { error } = await supabase.rpc("report_doubles", {
        p_partner_id: partner.id, p_opp1_id: opp.id, p_opp2_id: opp2.id,
        p_my_score: s1, p_opp_score: s2, p_discipline: disc,
      });
      setBusy(false);
      if (error) { toast(t("Fehler: ") + error.message); return; }
      setStep(4); return;
    }
    if (isGhost) { try { await supabase.rpc("record_ghost_game"); } catch (e) { /* Zählung optional */ } setStep(4); return; }   // Trainingsmatch: nicht speichern, nur zählen
    setBusy(true);
    const { error } = await supabase.rpc("report_match", {
      p_opponent_id: opp.id, p_my_score: s1, p_opp_score: s2, p_discipline: disc,
      p_high_run_me: is141 ? hr[0] : null, p_high_run_opp: is141 ? hr[1] : null,
      p_deficit_me: is141 ? def[0] : null, p_deficit_opp: is141 ? def[1] : null,
      p_avg_me: is141 ? avg[0] : null, p_avg_opp: is141 ? avg[1] : null,
      p_twoball_me: is141 ? tb[0] : null, p_twoball_opp: is141 ? tb[1] : null,
    });
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    setStep(4);
  };

  const DiscChip = () => (
    <button className="disc-chip" onClick={() => { if (is141) setLeaveWarn(true); else setStep(1); }}>
      <span>{t(disc)}</span><Pencil size={15} />
    </button>
  );

  if (showInvite) {
    return <InviteScreen me={me} toast={toast}
      onBack={() => { setShowInvite(false); onReload && onReload(); }} />;
  }

  return (
    <div className="screen">
      <header className="screen-head with-back">
        <button className="back-btn" onClick={() => { if (step === 0 || step === 4) onCancel(); else setAbortAsk(true); }} aria-label="Zurueck">
          <ChevronLeft size={22} />
        </button>
        <h2>{t("Neues Match")}</h2>
      </header>

      {abortAsk && (
        <div className="modal-overlay" onClick={() => setAbortAsk(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{t("Match abbrechen?")}</h3>
            <p>{t("Alle Eingaben gehen verloren")}{is141 ? t(" – ein 14/1-Protokoll lässt sich nicht wiederherstellen") : ""}.</p>
            <div className="sp-controls">
              <button className="btn ghost warn" onClick={() => { setAbortAsk(false); onCancel(); }}>{t("Ja – beenden")}</button>
              <button className="btn primary" onClick={() => setAbortAsk(false)}>{t("Match fortführen")}</button>
            </div>
          </div>
        </div>
      )}

      {step < 4 && (
        <div className="steps">
          {steps.map((s, i) => (
            <div key={s} className={"step-dot" + (i === step ? " cur" : i < step ? " done" : "")}>
              <span>{i < step ? <Check size={12} /> : i + 1}</span>{s}
            </div>
          ))}
        </div>
      )}

      {step === 0 && (
        <>
          <p className="q">{t("Gegen wen trittst du an?")}</p>
          <div className="mode-row">
            <button className={"mode-btn" + (mode === "single" ? " active" : "")}
              onClick={() => { setMode("single"); setPartner(null); setOpp2(null); }}>{t("Einzel")}</button>
            <button className={"mode-btn" + (mode === "double" ? " active" : "")}
              onClick={() => { setMode("double"); setOpp(null); }}>{t("Doppel")}</button>
          </div>

          {mode === "double" && (
            <button className="btn primary" disabled={!(partner && opp && opp2)} onClick={() => setStep(1)}>
              {t("Weiter")} <ArrowRight size={18} />
            </button>
          )}

          {mode === "single" && (
            <>
              <button className="btn ghost" onClick={() => setShowMyQr((v) => !v)}>
                <QrCode size={16} /> {showMyQr ? t("Code ausblenden") : t("Ihr trefft euch? Meinen Code zeigen")}
              </button>
              {showMyQr && (
                <div className="my-qr">
                  <div className="qr-box">
                    <QRCodeSVG value={`${window.location.origin}/?vs=${me.id}`} size={190} level="M"
                      bgColor="#F2EDE0" fgColor="#0A2B21" />
                  </div>
                  <p className="hint center">{t("Der andere scannt das mit der Handykamera und trägt danach das Ergebnis ein.")}</p>
                </div>
              )}
            </>
          )}

          {mode === "double" && (
            <div className="dbl-roster">
              <div className="dbl-slot"><span>{t("Dein Partner")}</span><b>{partner?.nickname || "–"}</b></div>
              <div className="dbl-slot"><span>{t("Gegner 1")}</span><b>{opp?.nickname || "–"}</b></div>
              <div className="dbl-slot"><span>{t("Gegner 2")}</span><b>{opp2?.nickname || "–"}</b></div>
              <p className="hint">{t("Tippe drei Spieler an: zuerst deinen Partner, dann die beiden Gegner.")}</p>
            </div>
          )}

          <div className="search-row">
            <Search size={16} className="mail-ico" />
            <input placeholder={t("Spieler suchen …")} value={oppQuery} onChange={(e) => setOppQuery(e.target.value)} />
            {oppQuery && <button className="clear-btn" onClick={() => setOppQuery("")} aria-label="Suche loeschen"><X size={15} /></button>}
          </div>
          {opponents.length === 0 && <p className="hint">{t("Kein Spieler gefunden.")}</p>}
          {mode === "single" && !oppQuery && suggestions.length > 0 && (
            <div className="suggest-card">
              <div className="suggest-title">💡 {t("Empfehlung")}</div>
              {nextStreak && (
                <div className="suggest-streak">{t("Noch 1 Sieg bis zur {n}er-Serie!", { n: nextStreak })}</div>
              )}
              {suggestions.map(({ p, gain }) => (
                <button key={p.id} className="suggest-row" onClick={() => { setOpp(p); setStep(1); }}>
                  <Ball color={colorOf(p.nickname)} label={initials(p.nickname)} badge={badgeOf(p.nickname)} size={34} />
                  <span className="suggest-name">{p.nickname}</span>
                  <span className="suggest-gain">{t("bis zu")} {fmtD(gain)}</span>
                </button>
              ))}
            </div>
          )}
          {mode === "single" && ghost && !oppQuery && (
            <button className="ghost-card" onClick={() => { setOpp(ghost); setStep(1); }}>
              <div className="ghost-ball">👻</div>
              <div className="ghost-info">
                <span className="ghost-name">{t("Training gegen Ghost")}</span>
                <span className="ghost-sub">{t("Übungsmatch – zählt nicht fürs Rating")}</span>
              </div>
              <ArrowRight size={18} />
            </button>
          )}
          <div className="opp-grid">
            {opponents.map((p) => {
              const role = mode === "double"
                ? (partner?.id === p.id ? t("Partner") : opp?.id === p.id ? t("Gegner 1") : opp2?.id === p.id ? t("Gegner 2") : null)
                : (opp?.id === p.id ? "•" : null);
              return (
                <button key={p.id} className={"opp-card" + (role ? " sel" : "")} onClick={() => pickPlayer(p)}>
                  <Ball color={colorOf(p.nickname)} label={initials(p.nickname)} badge={badgeOf(p.nickname)} size={48} />
                  <span>{p.nickname}</span>
                  {mode === "double" && role && <span className="dbl-role">{role}</span>}
                </button>
              );
            })}
          </div>
          <button className="btn ghost" onClick={() => setShowInvite(true)}>
            <QrCode size={16} /> {t("Neues Mitglied? Jetzt einladen")}
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <p className="q">{t("Welche Disziplin?")}</p>
          <div className="disc-grid">
            {disciplines.filter((d) => d !== "Doppel" && d !== "Gesamt").map((d) => (
              <button key={d} className={"disc-card" + (disc === d ? " sel" : "")}
                onClick={() => chooseDisc(d)}>{t(d)}</button>
            ))}
          </div>
          {pendingDisc ? (
            <div className="confirm-box">
              <p>{t("Wechsel zu bzw. von")} <b>14/1 Endlos</b> {t("ändert das Punkteschema – das bisherige Ergebnis ({s1} : {s2}) geht dabei verloren. Fortfahren?", { s1, s2 })}</p>
              <div className="sp-controls">
                <button className="btn ghost" onClick={() => setPendingDisc(null)}>{t("Abbrechen")}</button>
                <button className="btn primary" onClick={confirmDiscChange}>{t("Wechseln & zurücksetzen")}</button>
              </div>
            </div>
          ) : (
            <p className="hint center">{t("Zwischen 8/9/10 Ball bleibt dein Ergebnis beim Wechsel erhalten.")}</p>
          )}
        </>
      )}

      {step === 2 && opp && disc && (
        <>
          <div className="score-head">
            <DiscChip />
          </div>
          {mode === "single" && (() => {
            const pv = previewFor(disc, opp.nickname);
            return (
              <div className="pt-preview">
                <span className="pt-chance">{t("Siegchance")} <b>{Math.round(pv.ea * 100)}%</b></span>
                <span className="pt-range">{pv.is141d ? t("Bei Distanz 50") : t("Bei Race to 4")}: {t("Sieg")} {fmtD(pv.winMin)}…{fmtD(pv.winMax)} · {t("Niederlage")} {fmtD(pv.lossMin)}…{fmtD(pv.lossMax)}</span>
              </div>
            );
          })()}
          {leaveWarn && (
            <div className="confirm-box">
              <p>{t("Ein 14/1-Spiel läuft. Beim Disziplinwechsel geht der aktuelle Spielstand verloren. Fortfahren?")}</p>
              <div className="sp-controls">
                <button className="btn ghost" onClick={() => setLeaveWarn(false)}>{t("Weiterspielen")}</button>
                <button className="btn primary" onClick={() => { setLeaveWarn(false); resetScores(); setDisc(null); setStep(1); }}>
                  {t("Disziplin wechseln")}
                </button>
              </div>
            </div>
          )}
          {is141 ? (
            <StraightPoolScorer me={me} opp={opp} colorOf={colorOf} badgeOf={badgeOf} toast={toast}
              sideNames={mode === "double" ? [teamA, teamB] : undefined}
              sideAvatars={mode === "double" ? [[me, partner], [opp, opp2]] : undefined}
              onFinish={({ s1: a, s2: b, hr1, hr2, def1, def2, avg1, avg2, tb1, tb2 }) => {
                setS1(a); setS2(b); setHr([hr1, hr2]); setDef([def1, def2]);
                setAvg([avg1, avg2]); setTb([tb1, tb2]); setStep(3);
              }} />
          ) : (
            <>
              <p className="q">{t("Wie steht's?")} <span className="q-sub">(gewonnene Spiele)</span></p>
              <div className="score-row">
                {(mode === "double"
                  ? [{ members: [me, partner], name: teamA, v: s1, set: setS1 }, { members: [opp, opp2], name: teamB, v: s2, set: setS2 }]
                  : [{ members: [me], name: me.nickname, v: s1, set: setS1 }, { members: [opp], name: opp.nickname, v: s2, set: setS2 }]
                ).map(({ members, name, v, set }) => (
                  <div key={name} className="score-col">
                    <div className="sc-avatars">
                      {members.map((pl) => (
                        <Ball key={pl.id} color={colorOf(pl.nickname)} label={initials(pl.nickname)} badge={badgeOf(pl.nickname)} size={44} />
                      ))}
                    </div>
                    <span className="score-name">{name}</span>
                    <div className="score-num">{v}</div>
                    <div className="score-btns">
                      <button className="round-btn" onClick={() => set(Math.max(0, v - 1))} aria-label="minus"><Minus size={20} /></button>
                      <button className="round-btn plus" onClick={() => set(v + 1)} aria-label="plus"><Plus size={20} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn primary" disabled={total === 0 || s1 === s2} onClick={() => setStep(3)}>
                {t("Weiter")} <ArrowRight size={18} />
              </button>
              {s1 === s2 && total > 0 && <p className="hint center">{t("Unentschieden gibt's beim Billard nicht ;-)")}</p>}
            </>
          )}
        </>
      )}

      {step === 3 && opp && (
        <>
          <div className="summary">
            <div className="sum-vs">
              <div className="sum-side">
                {mode === "double" ? (
                  <div className="sum-avatars">
                    <Ball color={colorOf(me.nickname)} label={initials(me.nickname)} badge={badgeOf(me.nickname)} size={40} />
                    <Ball color={colorOf(partner.nickname)} label={initials(partner.nickname)} badge={badgeOf(partner.nickname)} size={40} />
                  </div>
                ) : (
                  <Ball color={colorOf(me.nickname)} label={initials(me.nickname)} badge={badgeOf(me.nickname)} size={52} />
                )}
                <span>{teamA}</span>
              </div>
              <div className="sum-score">{s1}<i>:</i>{s2}</div>
              <div className="sum-side">
                {mode === "double" ? (
                  <div className="sum-avatars">
                    <Ball color={colorOf(opp.nickname)} label={initials(opp.nickname)} badge={badgeOf(opp.nickname)} size={40} />
                    <Ball color={colorOf(opp2.nickname)} label={initials(opp2.nickname)} badge={badgeOf(opp2.nickname)} size={40} />
                  </div>
                ) : (
                  <Ball color={colorOf(opp.nickname)} label={initials(opp.nickname)} badge={badgeOf(opp.nickname)} size={52} />
                )}
                <span>{teamB}</span>
              </div>
            </div>
            <div className="sum-disc">{t(disc)}{isGhost ? t(" · Training") : ""}</div>
            {is141 && (hr[0] != null || hr[1] != null) && (
              <div className="sum-141">
                {t("Höchstserie:")} {me.nickname} {hr[0]} · {opp.nickname} {hr[1]}
                {(avg[0] != null || avg[1] != null) && (
                  <><br />Ø pro Fehler-Aufnahme: {me.nickname} {avg[0] ?? "–"} · {opp.nickname} {avg[1] ?? "–"}</>
                )}
              </div>
            )}
            {isGhost ? (
              <p className="hint center" style={{ marginBottom: 0 }}>{t("Trainingsmatch – wird nicht gespeichert und zählt nicht fürs Rating.")}</p>
            ) : (
              <div className="prob-wrap">
                <div className="prob-label">
                  <span>Erwartung laut Rating ({myRating} : {oppRating})</span>
                  <span>{Math.round(prob * 100)} % : {Math.round((1 - prob) * 100)} %</span>
                </div>
                <div className="prob-bar"><div style={{ width: `${prob * 100}%` }} /></div>
              </div>
            )}
          </div>
          <button className="btn primary" disabled={busy} onClick={save}>
            {busy ? t("Speichere ...") : isGhost ? <>{t("Training abschließen")} <Check size={18} /></> : <>{t("Match speichern")} <Check size={18} /></>}
          </button>
          {!isGhost && <p className="hint center">{mode === "double"
            ? t("Das Doppel zählt erst, wenn alle drei anderen bestätigt haben.")
            : t("Das Match fliesst erst ins Rating ein, wenn {name} es bestaetigt.", { name: opp.nickname })}</p>}
        </>
      )}

      {step === 4 && opp && (
        <div className="saved">
          <div className="sent-check big"><Check size={34} /></div>
          {isGhost ? (
            <>
              <h3>{t("Training beendet!")}</h3>
              <p>{t("Ergebnis gegen den Ghost:")} <b>{s1} : {s2}</b>.<br />
                {t("Trainingsmatches werden nicht gespeichert und beeinflussen dein Rating nicht.")}</p>
            </>
          ) : (
            <>
              <h3>{t("Gespeichert!")}</h3>
              {mode === "double" ? (
                <p>{t("Wartet auf Bestätigung der drei anderen. Sobald alle bestätigt haben, wird das Ranking neu berechnet.")}</p>
              ) : (
                <p>{t("Wartet auf Bestaetigung von")} <b>{opp.nickname}</b>.<br />
                  {t("Sobald {name} die App öffnet und auf Passt tippt, wird das Ranking neu berechnet.", { name: opp.nickname })}</p>
              )}
            </>
          )}
          <button className="btn primary" onClick={onDone}>{t("Zur Rangliste")}</button>
        </div>
      )}
    </div>
  );
}
