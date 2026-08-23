import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, User, X, Check, Pencil, Trophy, Award, ChevronDown, Swords, QrCode, Shield, LogOut } from "lucide-react";
import { t } from "../lib/i18n";
import { computeStats, todayStr } from "../lib/stats";
import { initials, hashColor, BALL_PALETTE } from "../lib/format";
import { APP_VERSION } from "../lib/constants";
import Ball from "./Ball";
import PasswordSection from "./PasswordSection";

export default function ProfilScreen({ nickname, matches, rangliste, onBack, isMe, onLogout, colorOf, badgeOf,
  players, meRow, onSaveProfile, onOpenAdmin, earnedBadges, onSelectBadge, catalog, onInvite, toast, lang, onLang }) {
  const catalogByCategory = useMemo(() => {
    const groups = {};
    [...catalog].sort((a, b) => a.sort - b.sort).forEach((b) => {
      (groups[b.category] ||= []).push(b);
    });
    return Object.entries(groups);
  }, [catalog]);
  // Kategorien mit mind. 1 erreichten Erfolg sind anfangs aufgeklappt, der Rest zugeklappt.
  const [openCats, setOpenCats] = useState(() => {
    try { const s = localStorage.getItem("badgeCats"); if (s) return new Set(JSON.parse(s)); } catch { /* ignore */ }
    return new Set();  // Standard: alles eingeklappt
  });
  useEffect(() => {
    try { localStorage.setItem("badgeCats", JSON.stringify([...openCats])); } catch { /* ignore */ }
  }, [openCats]);
  const toggleCat = (cat) => setOpenCats((prev) => {
    const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n;
  });
  const expandAll = () => setOpenCats(new Set(catalogByCategory.map(([c]) => c)));
  const collapseAll = () => setOpenCats(new Set());
  const [edit, setEdit] = useState(false);
  const [nick, setNick] = useState(nickname);
  const [color, setColor] = useState(meRow?.avatar_color || null);
  const [motto, setMotto] = useState(meRow?.motto || "");
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => computeStats(matches)[nickname], [matches, nickname]);

  // Zusatzkennzahlen, die aus den bereits geladenen Matches berechenbar sind
  // (Zu-Null-Siege, Rekord gegen einen einzelnen Gegner, Rekord an einem Tag).
  const liveExtras = useMemo(() => {
    let shutoutWins = 0, highRun = 0;
    const perOpp = {}, perDay = {};
    matches.forEach((m) => {
      if (m.player1b_id) return;
      let my, opp, oppNick, myRun;
      if (m.p1.nickname === nickname) { my = m.score1; opp = m.score2; oppNick = m.p2.nickname; myRun = m.high_run1; }
      else if (m.p2.nickname === nickname) { my = m.score2; opp = m.score1; oppNick = m.p1.nickname; myRun = m.high_run2; }
      else return;
      if (my > opp && opp === 0) shutoutWins++;
      if (myRun != null && myRun > highRun) highRun = myRun;
      perOpp[oppNick] = (perOpp[oppNick] || 0) + 1;
      const day = todayStr(new Date(m.played_at));
      perDay[day] = (perDay[day] || 0) + 1;
    });
    const myId = players.find((p) => p.nickname === nickname)?.id;
    const recruitedCount = myId ? players.filter((p) => p.invited_by === myId).length : 0;
    return {
      shutoutWins,
      highRun,
      recruitedCount,
      maxVsOpponent: Math.max(0, ...Object.values(perOpp)),
      maxPerDay: Math.max(0, ...Object.values(perDay)),
    };
  }, [matches, players, nickname]);

  // Live-Stand je Erfolgs-Familie: an den (unübersetzten) Beschreibungstexten der
  // Katalog-Einträge erkannt, nicht an der Kategorie - Kategorien kommen aus der DB
  // und ihre Zuordnung ist der App nicht fix bekannt.
  const catLiveStat = (items, s, extras) => {
    const has = (re) => items.some((b) => re.test(b.description));
    const parts = [];
    if (has(/Siege in Folge$/) && s) {
      const curTxt = s.streak > 0 ? `+${s.streak}` : `${s.streak}`;
      parts.push(`${t("Aktuell")}: ${curTxt} · ${t("Beste Serie")}: ${s.longestStreak}`);
    }
    if (has(/^\d+ Siege insgesamt$/) && s) parts.push(`${t("Insgesamt")}: ${s.siege}`);
    if (has(/zu null gewonnen/)) parts.push(`${t("Zu-Null-Siege")}: ${extras.shutoutWins}`);
    if (has(/Matches gegen denselben Gegner/)) parts.push(`${t("Rekord")}: ${extras.maxVsOpponent}`);
    if (has(/Matches an einem Tag/)) parts.push(`${t("Rekord")}: ${extras.maxPerDay}`);
    if (has(/14\/1: Höchstserie/)) parts.push(`${t("Rekord")}: ${extras.highRun}`);
    if (has(/Spieler geworben/)) parts.push(`${t("Insgesamt")}: ${extras.recruitedCount}`);
    return parts.length ? parts.join(" · ") : null;
  };

  const myRows = rangliste.filter((r) => r.nickname === nickname);
  const gesamt = myRows.find((r) => r.discipline === "Gesamt");
  const playerObj = players.find((p) => p.nickname === nickname);

  const cleanNick = nick.trim();
  const taken = players.some(
    (p) => p.nickname.toLowerCase() === cleanNick.toLowerCase() && p.nickname !== nickname
  );
  const nickValid = cleanNick.length >= 2 && cleanNick.length <= 30 && !taken;

  const h2h = useMemo(() => {
    const map = {};
    matches.forEach((m) => {
      if (m.player1b_id) return;
      let opp = null, w = 0, l = 0;
      if (m.p1.nickname === nickname) { opp = m.p2.nickname; w = m.score1 > m.score2 ? 1 : 0; l = 1 - w; }
      if (m.p2.nickname === nickname) { opp = m.p1.nickname; w = m.score2 > m.score1 ? 1 : 0; l = 1 - w; }
      if (!opp) return;
      map[opp] ||= { opp, w: 0, l: 0 };
      map[opp].w += w; map[opp].l += l;
    });
    return Object.values(map).sort((a, b) => b.w + b.l - (a.w + a.l)).slice(0, 6);
  }, [matches, nickname]);

  const save = async () => {
    setBusy(true);
    const ok = await onSaveProfile(cleanNick, color, motto);
    setBusy(false);
    if (ok) setEdit(false);
  };

  if (edit) {
    return (
      <div className="screen">
        <header className="screen-head with-back">
          <button className="back-btn" onClick={() => setEdit(false)} aria-label="Zurueck"><ChevronLeft size={22} /></button>
          <h2>{t("Profil bearbeiten")}</h2>
        </header>

        <section className="stat-block">
          <label className="field-label" htmlFor="pnick">{t("Nickname")}</label>
          <div className="mail-row">
            <User size={18} className="mail-ico" />
            <input id="pnick" value={nick} maxLength={30} onChange={(e) => setNick(e.target.value)} />
          </div>
          {taken && <p className="nick-status err"><X size={14} /> {t("Dieser Name ist schon vergeben.")}</p>}
          {!taken && cleanNick !== nickname && nickValid && (
            <p className="nick-status ok"><Check size={14} /> "{cleanNick}" {t("is available.")}</p>
          )}

          <label className="field-label">{t("Deine Kugel")}</label>
          <div className="swatch-row">
            <button className={"swatch auto" + (color === null ? " sel" : "")}
              onClick={() => setColor(null)} aria-label={t("Automatische Farbe")}>{t("Auto")}</button>
            {BALL_PALETTE.map((c) => (
              <button key={c} className={"swatch" + (color === c ? " sel" : "")}
                style={{ background: c }} onClick={() => setColor(c)} aria-label={`Farbe ${c}`}>
                {color === c && <Check size={16} />}
              </button>
            ))}
            {/* Eigene Wunschfarbe per Farb-Picker */}
            <label className={"swatch picker" + (color && !BALL_PALETTE.includes(color) ? " sel" : "")}
              style={color && !BALL_PALETTE.includes(color) ? { background: color } : undefined}
              title={t("Eigene Farbe wählen")}>
              {color && !BALL_PALETTE.includes(color)
                ? <Check size={16} />
                : <Pencil size={15} />}
              <input type="color" className="color-input"
                value={color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : hashColor(cleanNick || nickname)}
                onChange={(e) => setColor(e.target.value)}
                aria-label={t("Eigene Kugelfarbe wählen")} />
            </label>
          </div>
          <div className="swatch-preview">
            <Ball color={color || hashColor(cleanNick || nickname)} label={initials(cleanNick || nickname)} size={56} />
            <span className="hint" style={{ marginTop: 0 }}>
              {t("So sehen dich die anderen.")}{color && !BALL_PALETTE.includes(color) ? ` Deine Farbe: ${color.toUpperCase()}` : ""}
            </span>
          </div>

          <label className="field-label" htmlFor="pmotto">{t("Motto (optional)")}</label>
          <div className="mail-row">
            <Pencil size={18} className="mail-ico" />
            <input id="pmotto" value={motto} maxLength={80}
              placeholder={t("z. B. 'Die 9 faellt immer'")} onChange={(e) => setMotto(e.target.value)} />
          </div>

          <label className="field-label">{t("Sprache")}</label>
          <div className="lang-row" style={{ marginBottom: 6 }}>
            <button className={"lang-btn" + (lang === "de" ? " active" : "")} onClick={() => onLang("de")} aria-label="Deutsch">
              <span className="flag">🇩🇪</span><span>Deutsch</span>
            </button>
            <button className={"lang-btn" + (lang === "en" ? " active" : "")} onClick={() => onLang("en")} aria-label="English">
              <span className="flag">🇬🇧</span><span>English</span>
            </button>
          </div>

          <button className="btn primary" disabled={!nickValid || busy} onClick={save}>
            {busy ? t("Speichere ...") : <>{t("Speichern")} <Check size={18} /></>}
          </button>
          {cleanNick !== nickname && (
            <p className="hint">{t("Hinweis: Dein Name aendert sich ueberall - auch in alten Matches und der Rangliste.")}</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="screen-head with-back">
        {onBack && <button className="back-btn" onClick={onBack} aria-label="Zurueck"><ChevronLeft size={22} /></button>}
        <h2>{isMe ? t("Mein Profil") : t("Spielerprofil")}</h2>
      </header>

      <div className="profile-hero">
        <Ball color={colorOf(nickname)} label={initials(nickname)} badge={badgeOf(nickname)} size={72} />
        <div style={{ minWidth: 0 }}>
          <h3 className="p-name">{nickname}</h3>
          <div className="p-rating">
            {gesamt ? gesamt.rating : "-"}
            {gesamt?.vorlaeufig && <span className="prov-badge">{t("vorlaeufig")}</span>}
          </div>
          {playerObj?.motto && <p className="p-motto">"{playerObj.motto}"</p>}
        </div>
      </div>

      {isMe && (
        <button className="btn ghost" style={{ marginBottom: 14 }} onClick={() => {
          setNick(nickname); setColor(meRow?.avatar_color || null); setMotto(meRow?.motto || ""); setEdit(true);
        }}>
          <Pencil size={15} /> {t("Profil bearbeiten")}
        </button>
      )}


      <div className="kpis">
        <div className="kpi"><b>{stats?.spiele ?? 0}</b><span>{t("Spiele")}</span></div>
        <div className="kpi"><b>{stats?.siege ?? 0}</b><span>{t("Siege")}</span></div>
        <div className="kpi"><b>{stats?.quote ?? 0} %</b><span>{t("Quote")}</span></div>
        <div className="kpi"><b>{stats ? (stats.streak > 0 ? `+${stats.streak}` : stats.streak) : 0}</b><span>{t("Serie")}</span></div>
      </div>

      <section className="stat-block">
        <h3><Trophy size={17} /> {t("Ratings nach Disziplin")}</h3>
        {myRows.map((r) => (
          <div key={r.discipline} className="stat-row">
            <span className="stat-name">{t(r.discipline)}</span>
            <span className="rank-meta" style={{ marginRight: 10 }}>{r.spiele} {t("Spiele")}</span>
            <span className="stat-val">{r.rating}</span>
          </div>
        ))}
        {myRows.length === 0 && <p className="hint">{t("Noch kein Rating - erst ein Match spielen!")}</p>}
      </section>

      <section className="stat-block">
        <h3><Award size={17} /> {t("Erfolge")} ({earnedBadges.size} / {catalog.length})</h3>
        {isMe && (
          <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
            {t("Tippe einen freigeschalteten Erfolg an, um ihn als Avatar zu zeigen.")}
          </p>
        )}
        <div className="badge-tools">
          <button className="badge-tool-btn" onClick={expandAll}>{t("Alles aufklappen")}</button>
          <button className="badge-tool-btn" onClick={collapseAll}>{t("Alles zuklappen")}</button>
        </div>
        {catalogByCategory.map(([cat, items]) => {
          // eigenes Profil: ALLE Erfolge zeigen (gesperrte gedimmt) -> Symbole + korrekte Gesamtzahl.
          // fremde Profile: nur erreichte zeigen.
          const visible = items.filter((b) => {
            if (!isMe) return earnedBadges.has(b.badge_key);
            return true;
          });
          if (visible.length === 0) return null;
          // Zähler immer gegen die ECHTE Gesamtzahl der Kategorie (items.length).
          const earnedCount = items.filter((b) => earnedBadges.has(b.badge_key)).length;
          const open = openCats.has(cat);
          const liveStat = isMe ? catLiveStat(items, stats, liveExtras) : null;
          return (
            <div key={cat} className="badge-cat">
              <button className="badge-cat-head" onClick={() => toggleCat(cat)}>
                <div className="badge-cat-head-row">
                  <span className="badge-cat-title">{t(cat)}</span>
                  <span className="badge-cat-count">{earnedCount} / {items.length}</span>
                  <ChevronDown size={16} className={"cat-chev" + (open ? " open" : "")} />
                </div>
                {liveStat && <span className="badge-cat-live">{liveStat}</span>}
              </button>
              {open && (
                <div className="badge-grid">
                  {visible.map((b) => {
                    const key = b.badge_key;
                    const earned = earnedBadges.has(key);
                    const selected = meRow?.selected_badge === key && isMe;
                    return (
                      <button key={key}
                        className={"badge-chip" + (earned ? " earned" : " locked") + (selected ? " selected" : "")}
                        disabled={!isMe || !earned}
                        onClick={() => isMe && earned && onSelectBadge(selected ? null : key)}
                        title={t(b.description)}>
                        <span className={"badge-emoji" + (earned ? "" : " locked-emoji")}>{b.emoji}</span>
                        <span className="badge-name">{t(b.name)}</span>
                        <span className="badge-desc">{t(b.description)}</span>
                        {selected && <span className="badge-active">{t("Als Avatar aktiv")}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {isMe && meRow?.selected_badge && (
          <button className="btn ghost" onClick={() => onSelectBadge(null)}>
            {t("Wieder meine Kugel zeigen")}
          </button>
        )}
        {!isMe && earnedBadges.size === 0 && <p className="hint">{t("Noch keine Erfolge freigeschaltet.")}</p>}
      </section>

      <section className="stat-block">
        <h3><Swords size={17} /> {t("Head-to-Head (Match-Siege)")}</h3>
        {h2h.map(({ opp, w, l }) => (
          <div key={opp} className="h2h-row">
            <Ball color={colorOf(opp)} label={initials(opp)} badge={badgeOf(opp)} size={34} />
            <span className="stat-name">{opp}</span>
            <div className="h2h-bar"><div className="h2h-w" style={{ width: `${(100 * w) / Math.max(1, w + l)}%` }} /></div>
            <span className="h2h-score">{w}:{l}</span>
          </div>
        ))}
        {h2h.length === 0 && <p className="hint">{t("Noch keine Matches.")}</p>}
      </section>

      {isMe && <PasswordSection toast={toast} />}

      {isMe && (
        <button className="btn ghost" onClick={onInvite}><QrCode size={16} /> {t("Freund einladen")}</button>
      )}
      {isMe && meRow?.role === "admin" && (
        <button className="btn ghost" onClick={onOpenAdmin}><Shield size={16} /> {t("Verwaltung oeffnen")}</button>
      )}
      {isMe && (
        <button className="btn ghost" onClick={onLogout}><LogOut size={16} /> {t("Abmelden")}</button>
      )}

      <footer className="imprint">
        <div className="imprint-title">{t("Impressum")}</div>
        <p>
          Break &amp; Rank · {t("Version")} {APP_VERSION}<br />
          © {new Date().getFullYear()} Break &amp; Rank<br />
          {t("Kontakt")}: <a href="mailto:dalaunge@gmx.at">dalaunge@gmx.at</a>
        </p>
      </footer>
    </div>
  );
}
