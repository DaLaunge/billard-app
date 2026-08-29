import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { RefreshCw, Trophy, Radio, Plus, BarChart3, User } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { supabase } from "./supabase";
import "./App.css";

import { t, setLangGlobal, getLang } from "./lib/i18n";
import { getVs, clearVs } from "./lib/session";
import { fetchAllRows } from "./lib/data";
import { hashColor } from "./lib/format";
import { DEFAULT_DISCIPLINES, BADGE_INFO, badgeInfo } from "./lib/constants";

import LoginScreen from "./components/LoginScreen";
import NicknameScreen from "./components/NicknameScreen";
import RanglisteScreen from "./components/RanglisteScreen";
import LiveScreen from "./components/LiveScreen";
import MatchScreen from "./components/MatchScreen";
import StatistikScreen from "./components/StatistikScreen";
import ProfilScreen from "./components/ProfilScreen";
import AdminScreen from "./components/AdminScreen";
import InviteScreen from "./components/InviteScreen";

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [player, setPlayer] = useState(null);
  const [loadErr, setLoadErr] = useState(false);
  const [playerChecked, setPlayerChecked] = useState(false);
  const [players, setPlayers] = useState([]);
  const [rangliste, setRangliste] = useState([]);
  const [matches, setMatches] = useState([]);
  const [unconfirmed, setUnconfirmed] = useState([]);
  const [confirmations, setConfirmations] = useState([]);
  const [pings, setPings] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [badgesByPlayer, setBadgesByPlayer] = useState({}); // playerId -> Set(badge_key)
  const [catalog, setCatalog] = useState([]);               // badge_catalog Zeilen
  const [snapshots, setSnapshots] = useState([]);           // rating_snapshots (Verlauf)
  const [tab, setTab] = useState("rang");
  const [profileName, setProfileName] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [celebrate, setCelebrate] = useState(null);  // neue Erfolge fürs Popup
  const [lang, setLang] = useState(getLang());
  const changeLang = useCallback((l) => { setLangGlobal(l); setLang(l); }, []);
  const [vsOpp, setVsOpp] = useState(null);

  // --- App-Updates (Service Worker) --------------------------------------
  // "bei jedem Aufruf" = kein Timer, stattdessen bei jedem Sichtbarwerden der
  // App pruefen; sonst alle 30/60 Min per Timer; "manual" = nur per Klick in
  // den Profileinstellungen. Ein gefundenes Update wird sofort angewendet
  // (Reload), ausser waehrend einer laufenden Matcheingabe - dann erst,
  // sobald der Match-Bildschirm verlassen wird (siehe Effekt unten).
  const [updateInterval, setUpdateInterval] = useState(() => {
    try { return localStorage.getItem("updateCheckInterval") || "30"; } catch { return "30"; }
  });
  const swRegistration = useRef(null);
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) { swRegistration.current = reg || null; },
  });
  const checkForUpdate = useCallback(() => { swRegistration.current?.update(); }, []);
  const setUpdateCheckInterval = useCallback((v) => {
    setUpdateInterval(v);
    try { localStorage.setItem("updateCheckInterval", v); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (updateInterval === "manual") return;
    if (updateInterval === "open") {
      checkForUpdate();
      const onVis = () => { if (document.visibilityState === "visible") checkForUpdate(); };
      document.addEventListener("visibilitychange", onVis);
      return () => document.removeEventListener("visibilitychange", onVis);
    }
    const id = setInterval(checkForUpdate, Number(updateInterval) * 60000);
    return () => clearInterval(id);
  }, [updateInterval, checkForUpdate]);
  useEffect(() => {
    // Auch das Erfolgs-Popup nicht durch einen Reload wegreissen - sobald es
    // geschlossen wird, greift dieser Effekt erneut und holt das Update nach.
    if (needRefresh && tab !== "match" && !celebrate) updateServiceWorker(true);
  }, [needRefresh, tab, celebrate, updateServiceWorker]);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Neue Erfolge erkennen -> Popup (gesehene je Spieler in localStorage)
  useEffect(() => {
    if (!player || Object.keys(badgesByPlayer).length === 0) return;
    const earned = Array.from(badgesByPlayer[player.id] || []);
    const key = "seenBadges:" + player.id;
    let raw = null;
    try { raw = localStorage.getItem(key); } catch { return; }
    if (raw == null) {                       // Erststart: alles als gesehen, kein Popup
      try { localStorage.setItem(key, JSON.stringify(earned)); } catch {}
      return;
    }
    let seen;
    try { seen = new Set(JSON.parse(raw)); } catch { seen = new Set(); }
    const fresh = earned.filter((k) => !seen.has(k));
    if (fresh.length > 0) {
      setCelebrate(fresh);
      try { localStorage.setItem(key, JSON.stringify(earned)); } catch {}
    }
  }, [player, badgesByPlayer]);

  useEffect(() => {
    if (!session) { setPlayer(null); setPlayerChecked(false); return; }
    (async () => {
      const { data, error } = await supabase.from("players").select("*")
        .eq("auth_user_id", session.user.id).maybeSingle();
      if (error) { setLoadErr(true); setPlayerChecked(false); return; }  // offline/Fehler: NICHT als neuer Nutzer behandeln
      setLoadErr(false);
      setPlayer(data ?? null);
      setPlayerChecked(true);
      const { data: all } = await supabase.from("players")
        .select("id, nickname, role, auth_user_id, avatar_color, avatar_photo_at, motto, selected_badge, is_ghost, blocked, invited_by");
      setPlayers(all ?? []);
    })();
  }, [session]);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    const [rang, m, pl, pi, bg, ct, mc, ch] = await Promise.all([
      supabase.from("rangliste").select("*"),
      fetchAllRows((from, to) => supabase.from("matches")
        .select("id, played_at, score1, score2, high_run1, high_run2, discipline, confirmed, reported_by, player1_id, player2_id, player1b_id, player2b_id, p1:players!matches_player1_id_fkey(nickname), p2:players!matches_player2_id_fkey(nickname), p1b:players!matches_player1b_id_fkey(nickname), p2b:players!matches_player2b_id_fkey(nickname)")
        .order("played_at", { ascending: false })
        .range(from, to)),
      supabase.from("players").select("id, nickname, role, auth_user_id, avatar_color, avatar_photo_at, motto, selected_badge, is_ghost, blocked, invited_by"),
      supabase.from("pings")
        .select("id, location, message, created_at, expires_at, player_id, player:players!pings_player_id_fkey(nickname), replies:ping_replies(id, message, created_at, player_id, player:players!ping_replies_player_id_fkey(nickname))")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
      supabase.from("player_badges").select("player_id, badge_key"),
      supabase.from("badge_catalog").select("*"),
      supabase.from("match_confirmations").select("match_id, player_id, status"),
      supabase.from("challenges")
        .select("id, challenger_id, challenged_id, status, created_at, expires_at, resolved_match_id, message, message_updated_at, reply, reply_updated_at, challenger:players!challenges_challenger_id_fkey(nickname), challenged:players!challenges_challenged_id_fkey(nickname)")
        .order("created_at", { ascending: false }),
    ]);
    // Snapshots seitenweise laden (können > 1000 Zeilen sein: Wochen x Spieler)
    const snap = await fetchAllRows((from, to) => supabase.from("rating_snapshots")
      .select("player_id, snap_date, iso_week, rating, rank, provisional")
      .eq("discipline", "Gesamt")
      .order("snap_date", { ascending: true })
      .range(from, to));
    const err = rang.error || m.error || pl.error || pi.error || bg.error || ct.error || snap.error;
    if (err) toast(t("Fehler beim Laden: ") + err.message);
    setRangliste(rang.data ?? []);
    setMatches((m.data ?? []).filter((x) => x.confirmed));
    setUnconfirmed((m.data ?? []).filter((x) => !x.confirmed));
    setPlayers(pl.data ?? []);
    setPings(pi.data ?? []);
    setChallenges(ch.data ?? []);
    const byPlayer = {};
    (bg.data ?? []).forEach((r) => {
      (byPlayer[r.player_id] ||= new Set()).add(r.badge_key);
    });
    setBadgesByPlayer(byPlayer);
    const cat = ct.data ?? [];
    setCatalog(cat);
    // modulweite Map füllen, damit auch die Ball-Komponente Emojis kennt
    Object.keys(BADGE_INFO).forEach((k) => delete BADGE_INFO[k]);
    cat.forEach((b) => { BADGE_INFO[b.badge_key] = { emoji: b.emoji, name: b.name, description: b.description }; });
    setConfirmations(mc.data ?? []);
    setSnapshots(snap.data ?? []);
    setLoadingData(false);
  }, [toast]);

  useEffect(() => { if (player) loadData(); }, [player, loadData]);
  useEffect(() => {
    const vs = getVs();
    if (!vs || !player || players.length === 0) return;
    clearVs();
    const o = players.find((p) => p.id === vs && p.id !== player.id && !p.is_ghost && !p.blocked);
    if (o) { setVsOpp(o); setTab("match"); }
    else toast(t("Der gescannte Spieler wurde nicht gefunden."));
  }, [player, players, toast]);

  const disciplines = useMemo(() => {
    const found = new Set(rangliste.map((r) => r.discipline).filter((d) => d !== "Gesamt"));
    DEFAULT_DISCIPLINES.forEach((d) => found.add(d));
    return [...found].sort();
  }, [rangliste]);

  const ratingOf = useCallback((nick, disc = "Gesamt") => {
    const r = rangliste.find((x) => x.nickname === nick && x.discipline === disc);
    return r ? r.rating : 500;
  }, [rangliste]);

  const colorOf = useCallback((nick) => {
    const p = players.find((x) => x.nickname === nick);
    return p?.avatar_color || hashColor(nick);
  }, [players]);

  const badgeOf = useCallback((nick) => {
    const p = players.find((x) => x.nickname === nick);
    return p?.selected_badge || null;
  }, [players]);

  const photoOf = useCallback((nick) => {
    const p = players.find((x) => x.nickname === nick);
    if (!p?.avatar_photo_at || !p?.auth_user_id) return null;
    const { data } = supabase.storage.from("avatars").getPublicUrl(`${p.auth_user_id}/avatar.jpg`);
    return `${data.publicUrl}?v=${encodeURIComponent(p.avatar_photo_at)}`;
  }, [players]);

  const badgesOfId = useCallback((id) => badgesByPlayer[id] || new Set(), [badgesByPlayer]);

  const MATCH_EXPIRY_DAYS = 7;
  const notExpired = (m) => (Date.now() - new Date(m.played_at)) < MATCH_EXPIRY_DAYS * 86400000;
  const myPendingIds = player
    ? new Set(confirmations.filter((c) => c.player_id === player.id && c.status === "pending").map((c) => c.match_id))
    : new Set();
  const pendingForMe = player
    ? unconfirmed.filter((m) => notExpired(m) && (
        m.player1b_id
          ? myPendingIds.has(m.id)                                   // Doppel: nur wenn ich noch bestätigen muss
          : (m.player1_id === player.id || m.player2_id === player.id) && m.reported_by !== player.id))
    : [];
  const myOpenReports = player
    ? unconfirmed.filter((m) => notExpired(m) && m.reported_by === player.id)
    : [];
  const openChallengesToMe = player
    ? challenges.filter((c) => c.challenged_id === player.id && c.status === "open" && new Date(c.expires_at) > new Date())
    : [];

  const confirmMatch = async (id, ok) => {
    const { error } = await supabase.rpc("confirm_match", { p_match_id: id, p_ok: ok });
    if (error) toast(t("Fehler: ") + error.message);
    else toast(t(ok ? "Match bestaetigt - Ranking wird neu berechnet." : "Match zurueckgewiesen."));
    loadData();
  };

  const selectBadge = async (badgeKey) => {
    const { data, error } = await supabase.rpc("select_badge", { p_badge_key: badgeKey });
    if (error) { toast(t("Fehler: ") + error.message); return; }
    setPlayer(data);
    toast(t(badgeKey ? "Erfolg als Avatar gesetzt." : "Wieder deine Kugel."));
    loadData();
  };

  const saveProfile = async (nick, color, motto) => {
    const { data, error } = await supabase.rpc("update_profile", {
      p_nickname: nick, p_avatar_color: color, p_motto: motto || null,
    });
    if (error) { toast(t("Fehler: ") + error.message); return false; }
    setPlayer(data);
    toast(t("Profil gespeichert."));
    loadData();
    return true;
  };

  const createPing = async (loc, msg, hours) => {
    const { error } = await supabase.rpc("create_ping", {
      p_location: loc.trim(), p_message: msg.trim() || null, p_hours: hours,
    });
    if (error) toast(t("Fehler: ") + error.message);
    else toast(t("Du bist jetzt live!"));
    loadData();
  };
  const closePing = async () => {
    const { error } = await supabase.rpc("close_ping");
    if (error) toast(t("Fehler: ") + error.message);
    else toast(t("Live-Eintrag beendet."));
    loadData();
  };
  const replyPing = async (id, msg) => {
    const { error } = await supabase.rpc("reply_ping", { p_ping_id: id, p_message: msg.trim() || null });
    if (error) toast(t("Fehler: ") + error.message);
    else toast(t("Zusage gesendet!"));
    loadData();
  };
  const unreplyPing = async (id) => {
    const { error } = await supabase.rpc("unreply_ping", { p_ping_id: id });
    if (error) toast(t("Fehler: ") + error.message);
    loadData();
  };

  const createChallenge = async (playerId, message) => {
    const { error } = await supabase.rpc("create_challenge", { p_challenged_id: playerId, p_message: message || null });
    if (error) toast(t("Fehler: ") + error.message);
    else toast(t("Herausforderung gesendet!"));
    loadData();
  };
  const editChallengeMessage = async (id, message) => {
    const { error } = await supabase.rpc("edit_challenge_message", { p_challenge_id: id, p_message: message });
    if (error) toast(t("Fehler: ") + error.message);
    loadData();
  };
  const replyToChallenge = async (id, reply) => {
    const { error } = await supabase.rpc("reply_to_challenge", { p_challenge_id: id, p_reply: reply });
    if (error) toast(t("Fehler: ") + error.message);
    loadData();
  };
  const cancelChallenge = async (id) => {
    const { error } = await supabase.rpc("cancel_challenge", { p_challenge_id: id });
    if (error) toast(t("Fehler: ") + error.message);
    loadData();
  };
  const declineChallenge = async (id) => {
    const { error } = await supabase.rpc("decline_challenge", { p_challenge_id: id });
    if (error) toast(t("Fehler: ") + error.message);
    loadData();
  };

  const openProfile = (nick) => { setProfileName(nick); setTab("fremdprofil"); };
  const logout = async () => { await supabase.auth.signOut(); setTab("rang"); };

  const submitFeedback = async (category, message) => {
    const { error } = await supabase.rpc("submit_feedback", { p_category: category, p_message: message });
    if (error) { toast(t("Fehler: ") + error.message); return false; }
    toast(t("Danke für dein Feedback!"));
    return true;
  };
  const deleteAccount = async () => {
    const { error } = await supabase.rpc("self_delete_account");
    if (error) { toast(t("Fehler: ") + error.message); return; }
    await supabase.auth.signOut();
    setTab("rang");
  };

  if (!authReady) {
    return (<div className="stage"><div className="phone"><div className="center-load">{t("Lade ...")}</div></div></div>);
  }

  return (
    <div className="stage">
      <div className="phone">
        {!session && <LoginScreen />}

        {session && !playerChecked && !loadErr && <div className="center-load">{t("Lade Profil ...")}</div>}

        {session && loadErr && !player && (
          <div className="center-load" style={{ flexDirection: "column", gap: 12, textAlign: "center", padding: "0 24px" }}>
            <b>{t("Keine Verbindung")}</b>
            <span className="hint">{t("Dein Profil konnte nicht geladen werden. Prüfe deine Internetverbindung und versuche es erneut.")}</span>
            <button className="btn primary" onClick={() => window.location.reload()}>{t("Erneut versuchen")}</button>
          </div>
        )}

        {session && playerChecked && !player && (
          <NicknameScreen existingPlayers={players}
            onRegistered={(p) => { setPlayer(p); toast(t("Willkommen, {name}!", { name: p.nickname })); }} />
        )}

        {session && player && (
          <>
            {celebrate && (
              <div className="celebrate-overlay" onClick={() => setCelebrate(null)}>
                <div className="celebrate-card" onClick={(e) => e.stopPropagation()}>
                  <div className="celebrate-head">🎉 {t(celebrate.length > 1 ? "Neue Erfolge!" : "Neuer Erfolg!")}</div>
                  <div className="celebrate-list">
                    {celebrate.map((k) => {
                      const info = badgeInfo(k);
                      return (
                        <div key={k} className="celebrate-item">
                          <div className="celebrate-emoji">{info.emoji}</div>
                          <div className="celebrate-txt">
                            <span className="celebrate-name">{t(info.name)}</span>
                            <span className="celebrate-desc">{t(info.description)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button className="btn primary" onClick={() => setCelebrate(null)}>{t("Super!")}</button>
                </div>
              </div>
            )}
            <main className={"content" + (tab === "match" ? " no-tabbar" : "")}>
              {tab === "rang" && (
                <RanglisteScreen rangliste={rangliste} disciplines={disciplines}
                  pending={pendingForMe} me={player} onConfirm={confirmMatch}
                  onOpenProfile={openProfile} myOpenReports={myOpenReports}
                  colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} />
              )}
              {tab === "live" && (
                <LiveScreen me={player} pings={pings} challenges={challenges} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                  onCreate={createPing} onClose={closePing}
                  onReply={replyPing} onUnreply={unreplyPing}
                  onDeclineChallenge={declineChallenge} onCancelChallenge={cancelChallenge}
                  onEditChallengeMessage={editChallengeMessage} onReplyToChallenge={replyToChallenge} />
              )}
              {tab === "match" && (
                <MatchScreen me={player} players={players} matches={matches} disciplines={disciplines}
                  ratingOf={ratingOf} toast={toast} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                  onReload={loadData} initialOpp={vsOpp} onChallenge={createChallenge}
                  catalog={catalog} challenges={challenges}
                  onDone={() => { setVsOpp(null); setTab("rang"); loadData(); }}
                  onCancel={() => { setVsOpp(null); setTab("rang"); }} />
              )}
              {tab === "stats" && <StatistikScreen matches={matches} onOpenProfile={openProfile}
                colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} snapshots={snapshots} players={players}
                rangliste={rangliste} me={player} />}
              {tab === "profil" && (
                <ProfilScreen nickname={player.nickname} matches={matches} rangliste={rangliste}
                  onBack={null} isMe onLogout={logout} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                  players={players} meRow={player} onSaveProfile={saveProfile}
                  earnedBadges={badgesOfId(player.id)} onSelectBadge={selectBadge} catalog={catalog} challenges={challenges}
                  onOpenAdmin={() => setTab("admin")} onInvite={() => setTab("invite")} toast={toast}
                  lang={lang} onLang={changeLang}
                  updateInterval={updateInterval} onSetUpdateInterval={setUpdateCheckInterval} onCheckUpdate={checkForUpdate}
                  onSubmitFeedback={submitFeedback} onDeleteAccount={deleteAccount} onReload={loadData} />
              )}
              {tab === "fremdprofil" && profileName && (
                <ProfilScreen nickname={profileName} matches={matches} rangliste={rangliste}
                  onBack={() => setTab("rang")} isMe={profileName === player.nickname}
                  onLogout={logout} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                  players={players} meRow={player} onSaveProfile={saveProfile}
                  earnedBadges={badgesOfId((players.find((x) => x.nickname === profileName) || {}).id)}
                  onSelectBadge={selectBadge} catalog={catalog} onChallenge={createChallenge} challenges={challenges}
                  onOpenAdmin={() => setTab("admin")} onInvite={() => setTab("invite")} toast={toast}
                  lang={lang} onLang={changeLang}
                  onSubmitFeedback={submitFeedback} onDeleteAccount={deleteAccount} onReload={loadData} />
              )}
              {tab === "admin" && player.role === "admin" && (
                <AdminScreen allPending={unconfirmed} players={players} onConfirm={confirmMatch}
                  me={player} onBack={() => setTab("profil")} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                  toast={toast} onReload={loadData} matches={matches} />
              )}
              {tab === "invite" && (
                <InviteScreen me={player} onBack={() => setTab("profil")} toast={toast} />
              )}
              <button className="refresh-btn" onClick={loadData} aria-label={t("Aktualisieren")}>
                <RefreshCw size={16} className={loadingData ? "spin" : ""} />
              </button>
            </main>

            {tab !== "match" && (
            <nav className="tabbar">
              <button className={"tab" + (tab === "rang" || tab === "fremdprofil" ? " on" : "")} onClick={() => setTab("rang")}>
                <Trophy size={21} /><span>{t("Rangliste")}</span>
                {pendingForMe.length > 0 && <span className="badge">{pendingForMe.length}</span>}
              </button>
              <button className={"tab" + (tab === "live" ? " on" : "")} onClick={() => setTab("live")}>
                <Radio size={21} /><span>{t("Live")}</span>
                {pings.length + openChallengesToMe.length > 0 && (
                  <span className="badge live">{pings.length + openChallengesToMe.length}</span>
                )}
              </button>
              <button className="tab fab" onClick={() => { setVsOpp(null); setTab("match"); }} aria-label={t("Neues Match")}>
                <Plus size={26} />
              </button>
              <button className={"tab" + (tab === "stats" ? " on" : "")} onClick={() => setTab("stats")}>
                <BarChart3 size={21} /><span>{t("Statistik")}</span>
              </button>
              <button className={"tab" + (tab === "profil" || tab === "admin" ? " on" : "")} onClick={() => setTab("profil")}>
                <User size={21} /><span>{t("Profil")}</span>
                {player?.role === "admin" && unconfirmed.length > 0 && <span className="badge">{unconfirmed.length}</span>}
              </button>
            </nav>
            )}
          </>
        )}
        {toastMsg && <div className="toast">{toastMsg}</div>}
      </div>
    </div>
  );
}
