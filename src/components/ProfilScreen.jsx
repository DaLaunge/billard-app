import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, User, X, Check, Pencil, Trophy, Award, ChevronDown, Swords, QrCode, Shield, LogOut, RefreshCw, Share, Download, MessageCircle, AlertTriangle } from "lucide-react";
import { t } from "../lib/i18n";
import { computeStats } from "../lib/stats";
import { computeAchievementExtras, nextAchievementHint } from "../lib/achievements";
import { useInstallPrompt } from "../lib/installPrompt";
import { initials, hashColor, BALL_PALETTE } from "../lib/format";
import { APP_VERSION } from "../lib/constants";
import Ball from "./Ball";
import PasswordSection from "./PasswordSection";
import LegalModal from "./LegalModal";
import AvatarPhotoField from "./AvatarPhotoField";
import MyFeedbackTickets from "./MyFeedbackTickets";

const H2H_COUNT_OPTIONS = [3, 10, 20, "all"];

export default function ProfilScreen({ nickname, matches, rangliste, onBack, isMe, onLogout, colorOf, badgeOf, photoOf,
  players, meRow, onSaveProfile, onOpenAdmin, earnedBadges, onSelectBadge, catalog, onInvite, toast, lang, onLang, onOpenProfile,
  onChallenge, challenges, updateInterval, onSetUpdateInterval, onCheckUpdate, onSubmitFeedback, onDeleteAccount, onReload }) {
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
  const [challengeForm, setChallengeForm] = useState(false);
  const [challengeMsg, setChallengeMsg] = useState("");
  const installPrompt = useInstallPrompt();
  const [edit, setEdit] = useState(false);
  const [nick, setNick] = useState(nickname);
  const [color, setColor] = useState(meRow?.avatar_color || null);
  const [motto, setMotto] = useState(meRow?.motto || "");
  const [busy, setBusy] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCat, setFeedbackCat] = useState("bug");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0); // 0 versteckt, 1 erste Warnung, 2 Namen eintippen
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [ticketsRefresh, setTicketsRefresh] = useState(0);
  const heroPhoto = photoOf(nickname);

  const sendFeedback = async () => {
    if (!feedbackMsg.trim()) return;
    setFeedbackBusy(true);
    const ok = await onSubmitFeedback(feedbackCat, feedbackMsg.trim());
    setFeedbackBusy(false);
    if (ok) { setFeedbackMsg(""); setFeedbackSent(true); setTicketsRefresh((n) => n + 1); }
  };
  const closeFeedback = () => { setFeedbackOpen(false); setFeedbackSent(false); setFeedbackMsg(""); setFeedbackCat("bug"); };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    await onDeleteAccount();
    setDeleteBusy(false);
  };

  const stats = useMemo(() => computeStats(matches)[nickname], [matches, nickname]);

  // Zusatzkennzahlen (Serien, Zu-Null-Siege, Rekorde, geworbene Spieler, ...),
  // geteilt mit MatchScreen fuer den Fortschritts-Hinweis dort.
  const liveExtras = useMemo(
    () => computeAchievementExtras(nickname, matches, players, challenges),
    [matches, players, nickname, challenges]
  );
  const achievementHint = useMemo(() => nextAchievementHint(catalog, liveExtras, nickname, earnedBadges), [catalog, liveExtras, nickname, earnedBadges]);

  // Live-Stand je Erfolgs-Familie: an den (unübersetzten) Beschreibungstexten der
  // Katalog-Einträge erkannt, nicht an der Kategorie - Kategorien kommen aus der DB
  // und ihre Zuordnung ist der App nicht fix bekannt.
  const catLiveStat = (items, extras) => {
    const has = (re) => items.some((b) => re.test(b.description));
    const parts = [];
    if (has(/Siege in Folge$/)) {
      const curTxt = extras.streak > 0 ? `+${extras.streak}` : `${extras.streak}`;
      parts.push(`${t("Serie aktuell: {n}", { n: curTxt })} · ${t("Beste Serie: {n}", { n: extras.longestStreak })}`);
    }
    if (has(/^\d+ Siege insgesamt$/)) parts.push(t("{n} Siege insgesamt", { n: extras.siege }));
    if (has(/zu null gewonnen/)) parts.push(t("{n} Zu-Null-Siege", { n: extras.shutoutWins }));
    if (has(/Matches gegen denselben Gegner/)) parts.push(t("Rekord gegen 1 Gegner: {n} Matches", { n: extras.maxVsOpponent }));
    if (has(/Matches an einem Tag/)) parts.push(t("Rekord an 1 Tag: {n} Matches", { n: extras.maxPerDay }));
    if (has(/14\/1: Höchstserie/)) parts.push(t("Höchstserie: {n}", { n: extras.highRun }));
    if (has(/Spieler geworben/)) parts.push(t("{n} Spieler geworben", { n: extras.recruitedCount }));
    if (has(/Herausforderung(en)? angenommen/)) parts.push(t("{n} Herausforderungen angenommen", { n: extras.challengesAccepted }));
    if (has(/Siege in Folge gegen denselben Gegner$/)) parts.push(t("Laufende Serie gegen 1 Gegner: {n}", { n: extras.maxOpponentStreak }));
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
    return Object.values(map).sort((a, b) => b.w + b.l - (a.w + a.l));
  }, [matches, nickname]);
  const [h2hCount, setH2hCount] = useState(3);
  const visibleH2h = h2hCount === "all" ? h2h : h2h.slice(0, h2hCount);

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
          <button className="back-btn" onClick={() => setEdit(false)} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
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
            <p className="nick-status ok"><Check size={14} /> "{cleanNick}" {t("ist verfügbar.")}</p>
          )}

          <label className="field-label">{t("Profilfoto")}</label>
          <div className="swatch-preview">
            <Ball color={color || hashColor(cleanNick || nickname)} label={initials(cleanNick || nickname)}
              photo={photoOf(nickname)} size={56} />
            <AvatarPhotoField hasPhoto={!!photoOf(nickname)} onReload={onReload} toast={toast} />
          </div>
          <p className="hint">{t("Ohne Foto zeigt deine Kugel Initialen in deiner gewählten Farbe.")}</p>

          <label className="field-label">{t("Deine Kugel")}</label>
          <div className="swatch-row">
            <button className={"swatch auto" + (color === null ? " sel" : "")}
              onClick={() => setColor(null)} aria-label={t("Automatische Farbe")}>{t("Auto")}</button>
            {BALL_PALETTE.map((c) => (
              <button key={c} className={"swatch" + (color === c ? " sel" : "")}
                style={{ background: c }} onClick={() => setColor(c)} aria-label={t("Farbe {c}", { c })}>
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
              {t("So sehen dich die anderen.")}{color && !BALL_PALETTE.includes(color) ? ` ${t("Deine Farbe: {c}", { c: color.toUpperCase() })}` : ""}
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
        {onBack && <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>}
        <h2>{isMe ? t("Mein Profil") : t("Spielerprofil")}</h2>
      </header>

      <div className="profile-hero">
        {heroPhoto ? (
          <button className="avatar-tap" onClick={() => setPhotoViewerOpen(true)} aria-label={t("Foto ansehen")}>
            <Ball color={colorOf(nickname)} label={initials(nickname)} badge={badgeOf(nickname)} photo={heroPhoto} size={72} />
          </button>
        ) : (
          <Ball color={colorOf(nickname)} label={initials(nickname)} badge={badgeOf(nickname)} size={72} />
        )}
        <div style={{ minWidth: 0 }}>
          <h3 className="p-name">{nickname}</h3>
          <div className="p-rating">
            {gesamt ? gesamt.rating : "-"}
            {gesamt?.vorlaeufig && <span className="prov-badge">{t("vorlaeufig")}</span>}
          </div>
          {playerObj?.motto && <p className="p-motto">"{playerObj.motto}"</p>}
        </div>
      </div>

      {!isMe && playerObj && !challengeForm && (
        <button className="btn ghost" style={{ marginBottom: 14 }} onClick={() => setChallengeForm(true)}>
          <Swords size={15} /> {t("Herausfordern")}
        </button>
      )}
      {!isMe && playerObj && challengeForm && (
        <div className="challenge-form">
          <div className="search-row" style={{ marginBottom: 8 }}>
            <input placeholder={t("z. B. 'Hast du heute Abend Zeit?'")} value={challengeMsg}
              maxLength={200} onChange={(e) => setChallengeMsg(e.target.value)} />
          </div>
          <div className="sp-controls">
            <button className="btn ghost" onClick={() => { setChallengeForm(false); setChallengeMsg(""); }}>
              {t("Abbrechen")}
            </button>
            <button className="btn primary" onClick={() => {
              onChallenge(playerObj.id, challengeMsg); setChallengeForm(false); setChallengeMsg("");
            }}>
              <Swords size={15} /> {t("Herausfordern")}
            </button>
          </div>
        </div>
      )}

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
        {isMe && achievementHint && (
          <p className="hint-highlight" style={{ marginTop: 0, marginBottom: 10 }}>🎯 {achievementHint}</p>
        )}
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
          const liveStat = isMe ? catLiveStat(items, liveExtras) : null;
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
        <div className="stat-block-head">
          <h3><Swords size={17} /> {t("Head-to-Head (Match-Siege)")}</h3>
          {h2h.length > 0 && (
            <div className="chips small">
              {H2H_COUNT_OPTIONS.map((c) => (
                <button key={c} className={"chip" + (h2hCount === c ? " active" : "")} onClick={() => setH2hCount(c)}>
                  {c === "all" ? t("Alle") : c}
                </button>
              ))}
            </div>
          )}
        </div>
        {visibleH2h.map(({ opp, w, l }) => (
          <button key={opp} className="h2h-row as-btn" onClick={() => onOpenProfile(opp)}>
            <Ball color={colorOf(opp)} label={initials(opp)} badge={badgeOf(opp)} photo={photoOf(opp)} size={34} />
            <span className="stat-name">{opp}</span>
            <div className="h2h-bar"><div className="h2h-w" style={{ width: `${(100 * w) / Math.max(1, w + l)}%` }} /></div>
            <span className="h2h-score">{w}:{l}</span>
          </button>
        ))}
        {h2h.length === 0 && <p className="hint">{t("Noch keine Matches.")}</p>}
      </section>

      {isMe && (
        <section className="stat-block">
          <h3><RefreshCw size={17} /> {t("App-Updates")}</h3>
          <label className="field-label" htmlFor="updateInterval">{t("Wie oft auf neue Version pruefen?")}</label>
          <select id="updateInterval" className="settings-select" value={updateInterval}
            onChange={(e) => onSetUpdateInterval(e.target.value)}>
            <option value="open">{t("Bei jedem Aufruf")}</option>
            <option value="30">{t("Alle 30 Minuten")}</option>
            <option value="60">{t("Alle 60 Minuten")}</option>
            <option value="manual">{t("Manuell")}</option>
          </select>
          <button className="btn ghost" onClick={() => { onCheckUpdate(); toast(t("Suche nach Updates …")); }}>
            <RefreshCw size={15} /> {t("Jetzt nach Updates suchen")}
          </button>
        </section>
      )}

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

      {isMe && (
        <section className="stat-block">
          <h3><MessageCircle size={17} /> {t("Feedback")}</h3>
          {!feedbackOpen ? (
            <>
              <p className="hint" style={{ marginTop: 0 }}>{t("Bug gefunden oder eine Idee? Schreib's uns direkt.")}</p>
              <button className="btn ghost" onClick={() => setFeedbackOpen(true)}>
                <MessageCircle size={15} /> {t("Feedback geben")}
              </button>
            </>
          ) : feedbackSent ? (
            <>
              <p className="hint" style={{ marginTop: 0 }}>{t("Danke fürs Feedback! Magst du zusätzlich direkt schreiben?")}</p>
              <div className="sp-controls">
                <a className="btn ghost" href="https://t.me/+vG8sWgH_utJlODRk" target="_blank" rel="noopener noreferrer">
                  {t("Per Telegram")}
                </a>
                <a className="btn ghost" href="mailto:dalaunge@gmx.at">{t("Per E-Mail")}</a>
              </div>
              <button className="btn ghost" style={{ marginTop: 8 }} onClick={closeFeedback}>{t("Fertig")}</button>
            </>
          ) : (
            <div className="challenge-form">
              <div className="chips small" style={{ paddingBottom: 0, marginBottom: 8 }}>
                {[["bug", t("Bug")], ["idea", t("Idee")], ["other", t("Sonstiges")]].map(([v, label]) => (
                  <button key={v} className={"chip" + (feedbackCat === v ? " active" : "")} onClick={() => setFeedbackCat(v)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="search-row" style={{ marginBottom: 8 }}>
                <textarea rows={3} placeholder={t("Was ist los?")} value={feedbackMsg} maxLength={1000}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--ivory)", fontSize: 14, padding: "11px 0", fontFamily: "inherit", resize: "vertical" }}
                  onChange={(e) => setFeedbackMsg(e.target.value)} />
              </div>
              <div className="sp-controls">
                <button className="btn ghost" onClick={closeFeedback}>{t("Abbrechen")}</button>
                <button className="btn primary" disabled={!feedbackMsg.trim() || feedbackBusy} onClick={sendFeedback}>
                  {feedbackBusy ? t("Speichere ...") : t("Absenden")}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {isMe && <MyFeedbackTickets playerId={meRow.id} toast={toast} refreshKey={ticketsRefresh} />}

      {isMe && (
        <section className="stat-block danger-zone">
          <h3><AlertTriangle size={17} /> {t("Konto löschen")}</h3>
          <p className="hint" style={{ marginTop: 0 }}>
            {t("Entfernt unwiderruflich all deine persönlichen Daten (Login, Name, Profilfarbe, Motto, Nachrichten). Reine Ergebniszahlen bereits gespielter Matches bleiben anonymisiert bestehen, damit die Statistik der übrigen Mitglieder korrekt bleibt.")}
          </p>
          <button className="btn ghost warn" onClick={() => setDeleteStep(1)}>
            <AlertTriangle size={15} /> {t("Meine Daten löschen")}
          </button>
        </section>
      )}

      {deleteStep === 1 && (
        <div className="modal-overlay" onClick={() => setDeleteStep(0)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{t("Wirklich alle Daten löschen?")}</h3>
            <p>{t("Das entfernt dein Login und deine persönlichen Daten unwiderruflich. Das kann nicht rückgängig gemacht werden.")}</p>
            <div className="sp-controls">
              <button className="btn primary" onClick={() => setDeleteStep(0)}>{t("Abbrechen")}</button>
              <button className="btn ghost warn" onClick={() => setDeleteStep(2)}>{t("Ja, fortfahren")}</button>
            </div>
          </div>
        </div>
      )}
      {deleteStep === 2 && (
        <div className="modal-overlay" onClick={() => { setDeleteStep(0); setDeleteConfirmText(""); }}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{t("Letzte Bestätigung")}</h3>
            <p>{t("Tippe deinen Namen \"{name}\" ein, um die endgültige Löschung zu bestätigen.", { name: nickname })}</p>
            <div className="mail-row" style={{ marginBottom: 14 }}>
              <User size={18} className="mail-ico" />
              <input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} autoFocus />
            </div>
            <div className="sp-controls">
              <button className="btn primary" onClick={() => { setDeleteStep(0); setDeleteConfirmText(""); }}>{t("Abbrechen")}</button>
              <button className="btn ghost warn" disabled={deleteConfirmText.trim() !== nickname || deleteBusy}
                onClick={confirmDelete}>
                {deleteBusy ? t("Speichere ...") : t("Endgültig löschen")}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="imprint">
        <div className="imprint-title">{t("Impressum")}</div>
        <p>
          Break &amp; Rank · {t("Version")} {APP_VERSION}<br />
          © {new Date().getFullYear()} Break &amp; Rank<br />
          {t("Kontakt")}: <a href="mailto:dalaunge@gmx.at">dalaunge@gmx.at</a><br />
          {t("Diskussion im")} <a href="https://t.me/+vG8sWgH_utJlODRk" target="_blank" rel="noopener noreferrer">Telegram-Kanal</a>
        </p>
        <button className="legal-link" onClick={() => setLegalOpen(true)}>{t("Nutzungsbedingungen & Datenschutzerklärung")}</button>
      </footer>
      {legalOpen && <LegalModal onClose={() => setLegalOpen(false)} />}
      {photoViewerOpen && heroPhoto && (
        <div className="modal-overlay photo-viewer" onClick={() => setPhotoViewerOpen(false)}>
          <img src={heroPhoto} alt={nickname} className="photo-viewer-img" />
        </div>
      )}

      {isMe && installPrompt.canShow && (
        <section className="stat-block install-block">
          {installPrompt.isIos ? (
            <p className="hint center">
              📲 {t("Installiere Break & Rank auf deinem Home-Bildschirm")} — <Share size={13} style={{ verticalAlign: "-2px" }} /> {t("Tippe unten auf Teilen, dann \"Zum Home-Bildschirm\"")}
            </p>
          ) : installPrompt.hasPrompt ? (
            <button className="btn ghost" onClick={installPrompt.install}>
              <Download size={16} /> {t("App installieren")}
            </button>
          ) : (
            <p className="hint center">
              💻 {t("Kein Installations-Dialog verfuegbar. Schon installiert, aber kein Symbol mehr sichtbar? Oeffne chrome://apps oder suche im Startmenue nach \"Break & Rank\". Noch nicht installiert? Browser-Menue (⋮) -> \"App installieren\".")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
