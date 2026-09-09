import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { RefreshCw, Trophy, Radio, Plus, BarChart3, User } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { supabase } from "./supabase";
import "./App.css";

import { t, setLangGlobal, getLang } from "./lib/i18n";
import { getVs, clearVs } from "./lib/session";
import { fetchAllRows } from "./lib/data";
import { hashColor, initials } from "./lib/format";
import { getPendingReport, sendPendingReport, isNetworkError } from "./lib/offlineReport";
import { DEFAULT_DISCIPLINES, BADGE_INFO, badgeInfo } from "./lib/constants";
import { applyTheme } from "./lib/themes";

import LoginScreen from "./components/LoginScreen";
import ForcePasswordScreen from "./components/ForcePasswordScreen";
import NicknameScreen from "./components/NicknameScreen";
import LiveScreen from "./components/LiveScreen";
import MatchScreen from "./components/MatchScreen";
import StatistikScreen from "./components/StatistikScreen";
import ProfilScreen from "./components/ProfilScreen";
import AdminScreen from "./components/AdminScreen";
import InviteScreen from "./components/InviteScreen";
import MatchProtokollScreen from "./components/MatchProtokollScreen";
import TurniereScreen from "./components/TurniereScreen";
import TurnierRasterScreen from "./components/TurnierRasterScreen";
import Ball from "./components/Ball";

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
  const [plannings, setPlannings] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [badgesByPlayer, setBadgesByPlayer] = useState({}); // playerId -> Set(badge_key)
  const [catalog, setCatalog] = useState([]);               // badge_catalog Zeilen
  const [snapshots, setSnapshots] = useState([]);           // rating_snapshots (Verlauf)
  const [tab, setTab] = useState("stats");
  const [profileName, setProfileName] = useState(null);
  const [protokollMatch, setProtokollMatch] = useState(null);
  const [protokollBackTab, setProtokollBackTab] = useState("stats");
  const [tournamentId, setTournamentId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  // Wird einmalig true, sobald der allererste loadData()-Durchlauf steht -
  // haelt den Tab-Inhalt bis dahin auf einem einheitlichen "Lade ..." statt
  // Screens mit noch leeren Arrays (z.B. Rangliste) kurz aufblitzen zu lassen.
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [celebrate, setCelebrate] = useState(null);  // neue Erfolge fürs Popup
  const [tourneyReady, setTourneyReady] = useState(null); // bereite Turnierpaarung fürs Popup
  const [tourneyReadyList, setTourneyReadyList] = useState([]); // ALLE bereiten Turnierpaarungen fuer mich - speist den Turniere-Badge (siehe checkTourneyReady unten)
  const [lang, setLang] = useState(getLang());
  const changeLang = useCallback((l) => { setLangGlobal(l); setLang(l); }, []);
  const [vsOpp, setVsOpp] = useState(null);
  const [matchTournamentCtx, setMatchTournamentCtx] = useState(null); // Turnier-Kontext fuers Melden ueber MatchScreen (siehe TurnierRasterScreen)
  // Fuer Startseite "Zuletzt geoeffnet": den zuletzt gespeicherten Tab EINMAL
  // beim allerersten Rendern sichern, bevor der Persistenz-Effekt weiter
  // unten den initialen "stats"-Default hineinschreibt und den echten Wert
  // ueberschreiben wuerde.
  const [lastMainTabAtStart] = useState(() => {
    try { return localStorage.getItem("lastMainTab"); } catch { return null; }
  });

  // --- Browser-Verlauf ("Zurueck"/"Vor" nicht die App verlassen lassen) --
  // Bisher war "tab" reiner React-State ohne History-Eintrag - jeder Klick
  // auf Zurueck/Vor im Browser hatte daher nichts zum Zurueckgehen und
  // verliess die App komplett. navPush() legt fuer JEDE Navigation (auch
  // simple Tab-Wechsel in der unteren Leiste) einen neuen Verlaufseintrag
  // an - die erste Version hatte Tab-Wechsel bewusst per replaceState OHNE
  // eigenen Schritt gemacht (wie bei manchen Tab-Leisten-Apps), das fuehlte
  // sich aber genau wie das urspruengliche Problem an ("Klicks werden nicht
  // gespeichert"), also jetzt: wirklich jeder Klick zaehlt. navReplace()
  // bleibt nur fuer echte Session-Resets (Logout, Konto loeschen) - da soll
  // "Zurueck" nicht in den abgemeldeten Zustand zurueckfuehren koennen.
  // Sowohl der Browser-Zurueck-Button als auch die eigenen "Zurueck"-Pfeile
  // in der App (per window.history.back(), siehe onBack-Props unten)
  // bringen zur vorherigen Ansicht zurueck.
  const applyNavState = useCallback((s) => {
    setTab(s.tab);
    setProfileName(s.profileName ?? null);
    setProtokollMatch(s.protokollMatch ?? null);
    setProtokollBackTab(s.protokollBackTab ?? "stats");
    setVsOpp(s.vsOpp ?? null);
    setTournamentId(s.tournamentId ?? null);
    setMatchTournamentCtx(s.matchTournamentCtx ?? null);
  }, []);
  const navPush = useCallback((s) => {
    applyNavState(s);
    try { window.history.pushState(s, ""); } catch { /* ignore */ }
  }, [applyNavState]);
  const navReplace = useCallback((s) => {
    applyNavState(s);
    try { window.history.replaceState(s, ""); } catch { /* ignore */ }
  }, [applyNavState]);
  // Match-Eingabe ist heikel (Ergebnis, Aufnahme-Protokoll, ...) - ein
  // Fehlklick auf Zurueck/Vor darf sie nicht wegreissen. tabRef/vsOppRef
  // halten den JEWEILS aktuellen Wert fuer den Popstate-Handler bereit
  // (ohne dass der Listener bei jedem Tab-Wechsel neu angehaengt werden
  // muss - reine Lesehilfe, kein Trigger fuer irgendwelche Effekte).
  // allowLeaveMatchRef wird NUR von "Beenden"/"Abbrechen" (siehe
  // onDone/onCancel unten) kurz vor ihrem eigenen window.history.back()
  // gesetzt - so unterscheidet der Handler "gewollt verlassen" von einem
  // Zurueck/Vor-Klick mitten in der Eingabe (dann: einfach den Match-
  // Stand erneut pushen, tab bleibt "match", nichts geht verloren).
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const vsOppRef = useRef(vsOpp);
  vsOppRef.current = vsOpp;
  const matchTournamentCtxRef = useRef(matchTournamentCtx);
  matchTournamentCtxRef.current = matchTournamentCtx;
  const allowLeaveMatchRef = useRef(false);
  // Startseite: beim allerersten Player-Laden nach App-Start (nicht bei
  // jedem Session-Refresh, siehe unten) auf die in den Profileinstellungen
  // gespeicherte Startseite springen. Der Ref sorgt dafuer, dass spaetere
  // Token-Refreshs (die denselben useEffect erneut auslösen) die laufende
  // Navigation nicht zurueck auf die Startseite reissen.
  const startTabAppliedRef = useRef(false);
  useEffect(() => {
    try { window.history.replaceState({ tab: "stats" }, ""); } catch { /* ignore */ }
    const onPop = (e) => {
      if (tabRef.current === "match" && !allowLeaveMatchRef.current) {
        try { window.history.pushState({ tab: "match", vsOpp: vsOppRef.current, matchTournamentCtx: matchTournamentCtxRef.current }, ""); } catch { /* ignore */ }
        return;
      }
      allowLeaveMatchRef.current = false;
      applyNavState(e.state || { tab: "stats" });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [applyNavState]);

  // --- App-Updates (Service Worker) --------------------------------------
  // "bei jedem Aufruf" = kein Timer, stattdessen bei jedem Sichtbarwerden der
  // App pruefen; sonst alle 30/60 Min per Timer; "manual" = nur per Klick in
  // den Profileinstellungen. Ein gefundenes Update wird per Reload angewendet,
  // aber erst NACHDEM die Uebersicht einmal fertig geladen hat (initialLoadDone)
  // und nie waehrend einer laufenden Matcheingabe oder des Erfolgs-Popups
  // (siehe Effekt unten). Wichtig: registerType "autoUpdate" (vite.config.js)
  // ruft bei gefundenem Update intern SOFORT window.location.reload() auf,
  // sobald keine eigene onNeedReload-Callback uebergeben wird - darum hier
  // NICHT ohne onNeedReload arbeiten, sonst reisst ein Update-Check die gerade
  // ladende Seite ungebremst weg.
  const [updateInterval, setUpdateInterval] = useState(() => {
    try { return localStorage.getItem("updateCheckInterval") || "30"; } catch { return "30"; }
  });
  const [needReload, setNeedReload] = useState(false);
  const swRegistration = useRef(null);
  useRegisterSW({
    onRegisteredSW(_url, reg) { swRegistration.current = reg || null; },
    onNeedReload() { setNeedReload(true); },
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
    if (needReload && initialLoadDone && tab !== "match" && !celebrate) window.location.reload();
  }, [needReload, initialLoadDone, tab, celebrate]);

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

  // Turnier "du bist dran"-Popup: pollt (kein Realtime, siehe CLAUDE.md),
  // ob fuer mich irgendwo eine Turnierpaarung bereitsteht - beide Spieler
  // UND der Tisch feststehen, noch kein Ergebnis gemeldet (Nutzer-Feedback:
  // ohne die table_number-Pruefung feuerte der Hinweis bei Jeder-gegen-jeden
  // sofort bei Turnierstart, weil dort ALLE Paarungen von Anfang an beide
  // Spieler kennen, aber Tische erst nach und nach frei werden - das zeigte
  // dann eine beliebige spaetere Paarung statt der tatsaechlich anstehenden
  // mit zugeteiltem Tisch) - damit die Turnierleitung Spielpartien nicht
  // manuell zuteilen/ankuendigen muss. Einmal gezeigte Paarungen merkt sich
  // der Client geraeteweise in localStorage (wie seenBadges oben), damit das
  // Popup nicht bei jedem Poll erneut aufploppt, solange noch kein Ergebnis
  // gemeldet wurde - das vollstaendige tourneyReadyList (siehe unten) ist
  // davon unabhaengig und speist stattdessen den Turniere-Badge in
  // ProfilScreen, der erst verschwindet, wenn tatsaechlich gespielt wurde.
  const checkTourneyReady = useCallback(async () => {
    if (!player) return;
    const { data } = await supabase.from("tournament_matches")
      .select("id, tournament_id, table_number, player1_id, player2_id, tournament:tournaments!tournament_matches_tournament_id_fkey(name, status, discipline), player1:players!tournament_matches_player1_id_fkey(nickname), player2:players!tournament_matches_player2_id_fkey(nickname)")
      .eq("is_bye", false)
      .is("match_id", null)
      .not("table_number", "is", null)
      .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`);
    const candidates = (data ?? []).filter((tm) => tm.player1_id && tm.player2_id && tm.tournament?.status === "running");
    setTourneyReadyList(candidates);
    if (candidates.length === 0) return;
    let dismissed = [];
    try { dismissed = JSON.parse(localStorage.getItem("dismissedTourneyMatches:" + player.id) || "[]"); } catch { /* ignore */ }
    const next = candidates.find((tm) => !dismissed.includes(tm.id));
    if (!next) return;
    setTourneyReady((prev) => prev || next);
  }, [player]);

  useEffect(() => {
    if (!player) return;
    checkTourneyReady();
    const id = setInterval(checkTourneyReady, 20000);
    const onVis = () => { if (document.visibilityState === "visible") checkTourneyReady(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [player, checkTourneyReady]);

  const dismissTourneyReady = useCallback(() => {
    if (!tourneyReady || !player) return;
    try {
      const key = "dismissedTourneyMatches:" + player.id;
      const cur = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(key, JSON.stringify([...cur, tourneyReady.id]));
    } catch { /* ignore */ }
    setTourneyReady(null);
  }, [tourneyReady, player]);

  const goToTourneyReady = useCallback(() => {
    if (!tourneyReady) return;
    navPush({ tab: "turnierdetail", tournamentId: tourneyReady.tournament_id });
    dismissTourneyReady();
  }, [tourneyReady, dismissTourneyReady, navPush]);

  // Turniere-Menuepunkt (Tabbar + Profil-Button): springt bei einer
  // bereiten Paarung direkt ins BETROFFENE Turnier statt in die allgemeine
  // Liste - sonst sieht man zwar das Badge ("hier ist etwas zu tun"), muss
  // aber selbst raten, in welchem der ggf. vielen Turniere (Nutzer-
  // Feedback: "weiß ich nicht, in welches Turnier ich einsteigen muss").
  // Bei mehreren gleichzeitig bereiten Paarungen (moeglich, wenn man in
  // mehreren Turnieren gleichzeitig mitspielt) fuehrt das zur ERSTEN -
  // realistischerweise ein seltener Randfall in einem kleinen Verein.
  // Bewusst NUR beim Wechsel AUS einem anderen Tab (Profil/Statistik/Live)
  // - ist man BEREITS im Turnierbereich (tab "turnier"/"turnierdetail"),
  // heisst ein Klick hier "zurueck zur Uebersicht", nicht "wieder zur
  // bereiten Paarung springen" (Bug-Report: bei bereiter Paarung liess sich
  // aus einem Turnier heraus gar nicht mehr zur Liste navigieren, weil
  // dieser Klick einen immer wieder ins selbe/ein Turnier zurueckwarf).
  const openTurniereMenu = useCallback(() => {
    const alreadyInTurnierBereich = tab === "turnier" || tab === "turnierdetail";
    if (!alreadyInTurnierBereich && tourneyReadyList.length > 0) {
      navPush({ tab: "turnierdetail", tournamentId: tourneyReadyList[0].tournament_id });
    } else {
      navPush({ tab: "turnier" });
    }
  }, [tab, tourneyReadyList, navPush]);

  // Fuer die Startseiten-Option "Zuletzt geoeffnet": merkt sich den zuletzt
  // besuchten Hauptmenuepunkt geraeteweise (nicht Unterseiten wie Match/
  // Protokoll/Admin/Einladen - die sollen beim Neustart nicht "Startseite" sein).
  useEffect(() => {
    if (["stats", "turnier", "live", "profil"].includes(tab)) {
      try { localStorage.setItem("lastMainTab", tab); } catch { /* ignore */ }
    }
  }, [tab]);

  useEffect(() => {
    if (!session) { setPlayer(null); setPlayerChecked(false); return; }
    (async () => {
      const { data, error } = await supabase.from("players").select("*")
        .eq("auth_user_id", session.user.id).maybeSingle();
      if (error) { setLoadErr(true); setPlayerChecked(false); return; }  // offline/Fehler: NICHT als neuer Nutzer behandeln
      setLoadErr(false);
      setPlayer(data ?? null);
      setPlayerChecked(true);
      if (data && !startTabAppliedRef.current) {
        startTabAppliedRef.current = true;
        let target = data.start_tab;
        if (target === "last") target = lastMainTabAtStart || "stats";
        // Faengt veraltete gespeicherte Werte ab (z.B. "rang" von vor dem
        // Uebersicht/Statistik-Menue-Umbau) - sonst landet man auf einem
        // tab-Wert, den kein Screen mehr rendert (leere Seite mit Tabbar).
        if (!["stats", "turnier", "live", "profil"].includes(target)) target = null;
        if (target && target !== "stats") navReplace({ tab: target });
      }
      const { data: all } = await supabase.from("players")
        .select("id, nickname, role, auth_user_id, avatar_color, avatar_photo_at, motto, selected_badge, is_ghost, blocked, invited_by, created_at");
      setPlayers(all ?? []);
    })();
  }, [session]);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    // Snapshots (koennen >1000 Zeilen sein: Wochen x Spieler) parallel zum
    // Rest anstossen statt hinterher - sonst wartet die ganze Uebersicht auf
    // die langsamste Abfrage, obwohl sie fuer die Rangliste selbst gar nicht
    // gebraucht wird (nur fuer die Rang/Rating-Pfeile und die Statistik-Seite).
    const snapPromise = fetchAllRows((from, to) => supabase.from("rating_snapshots")
      .select("player_id, snap_date, iso_week, discipline, rating, rank, provisional")
      .order("snap_date", { ascending: true })
      .range(from, to));
    const [rang, m, pl, pi, bg, ct, mc, ch, pn] = await Promise.all([
      supabase.from("rangliste").select("*"),
      fetchAllRows((from, to) => supabase.from("matches")
        .select("id, played_at, score1, score2, high_run1, high_run2, discipline, confirmed, reported_by, player1_id, player2_id, player1b_id, player2b_id, run_log, tournament_id, p1:players!matches_player1_id_fkey(nickname), p2:players!matches_player2_id_fkey(nickname), p1b:players!matches_player1b_id_fkey(nickname), p2b:players!matches_player2b_id_fkey(nickname)")
        .order("played_at", { ascending: false })
        .range(from, to)),
      supabase.from("players").select("id, nickname, role, auth_user_id, avatar_color, avatar_photo_at, motto, selected_badge, is_ghost, blocked, invited_by, created_at"),
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
      supabase.from("plannings")
        .select("id, planned_date, message, created_at, expires_at, player_id, player:players!plannings_player_id_fkey(nickname), replies:planning_replies(id, message, created_at, player_id, player:players!planning_replies_player_id_fkey(nickname))")
        .gt("expires_at", new Date().toISOString())
        .order("planned_date", { ascending: true }),
    ]);
    const err = rang.error || m.error || pl.error || pi.error || bg.error || ct.error || pn.error;
    if (err) toast(isNetworkError(err) ? t("Keine Verbindung – zeige die zuletzt geladenen Daten.") : t("Fehler beim Laden: ") + err.message);
    setRangliste(rang.data ?? []);
    setMatches((m.data ?? []).filter((x) => x.confirmed));
    setUnconfirmed((m.data ?? []).filter((x) => !x.confirmed));
    setPlayers(pl.data ?? []);
    setPings(pi.data ?? []);
    setPlannings(pn.data ?? []);
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
    setLoadingData(false);
    setInitialLoadDone(true);
    const snap = await snapPromise;
    if (snap.error && !err) toast(isNetworkError(snap.error) ? t("Keine Verbindung – zeige die zuletzt geladenen Daten.") : t("Fehler beim Laden: ") + snap.error.message);
    setSnapshots(snap.data ?? []);
  }, [toast]);

  useEffect(() => { if (player) loadData(); }, [player, loadData]);

  // Ausfallsicherheit: ein Match, das mangels Internetverbindung nicht gemeldet
  // werden konnte (siehe lib/offlineReport.js), wird hier automatisch nachgesendet -
  // beim App-Start, sobald die Verbindung zurückkommt, oder wenn die App wieder
  // in den Vordergrund kommt (Mobile-PWAs verpassen das "online"-Event oft im Hintergrund).
  useEffect(() => {
    if (!player) return;
    const retry = async () => {
      if (!getPendingReport()) return;
      const res = await sendPendingReport();
      if (res?.ok) { toast(t("Nachgemeldetes Match uebertragen.")); loadData(); }
    };
    retry();
    const onVisible = () => { if (document.visibilityState === "visible") retry(); };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [player, loadData, toast]);
  useEffect(() => { if (player) applyTheme(player.theme_key || "green", player.theme_custom); }, [player]);
  useEffect(() => {
    const vs = getVs();
    if (!vs || !player || players.length === 0) return;
    clearVs();
    const o = players.find((p) => p.id === vs && p.id !== player.id && !p.is_ghost && !p.blocked);
    if (o) { navPush({ tab: "match", vsOpp: o }); }
    else toast(t("Der gescannte Spieler wurde nicht gefunden."));
  }, [player, players, toast, navPush]);

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

  const setTheme = async (themeKey, themeCustom) => {
    const { data, error } = await supabase.rpc("set_theme", { p_theme_key: themeKey, p_theme_custom: themeCustom ?? null });
    if (error) { toast(t("Fehler: ") + error.message); return; }
    setPlayer(data);
  };

  const setStartTab = async (startTab) => {
    const { data, error } = await supabase.rpc("set_start_tab", { p_start_tab: startTab });
    if (error) { toast(t("Fehler: ") + error.message); return; }
    setPlayer(data);
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

  const createPlanning = async (date, msg) => {
    const { error } = await supabase.rpc("create_planning", { p_planned_date: date, p_message: msg.trim() || null });
    if (error) toast(t("Fehler: ") + error.message);
    else toast(t("Planung eingetragen!"));
    loadData();
  };
  const deletePlanning = async (id) => {
    const { error } = await supabase.rpc("close_planning", { p_planning_id: id });
    if (error) toast(t("Fehler: ") + error.message);
    else toast(t("Planung geloescht."));
    loadData();
  };
  const replyPlanning = async (id, msg) => {
    const { error } = await supabase.rpc("reply_planning", { p_planning_id: id, p_message: msg.trim() || null });
    if (error) toast(t("Fehler: ") + error.message);
    else toast(t("Zusage gesendet!"));
    loadData();
  };
  const unreplyPlanning = async (id) => {
    const { error } = await supabase.rpc("unreply_planning", { p_planning_id: id });
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

  const openProfile = (nick) => navPush({ tab: "fremdprofil", profileName: nick });
  const openProtokoll = (m) => navPush({ tab: "protokoll", protokollMatch: m, protokollBackTab: tab });
  const startMatchVs = (opponent) => navPush({ tab: "match", vsOpp: opponent });
  const logout = async () => { await supabase.auth.signOut(); navReplace({ tab: "stats" }); };

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
    navReplace({ tab: "stats" });
  };

  if (!authReady) {
    return (<div className="stage"><div className="phone"><div className="center-load">{t("Lade ...")}</div></div></div>);
  }

  return (
    <div className="stage">
      <div className={"phone" + (session && player && !player.must_change_password ? " app" : "")}>
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

        {session && player && player.must_change_password && (
          <ForcePasswordScreen
            onDone={() => setPlayer({ ...player, must_change_password: false })}
            onLogout={logout}
          />
        )}

        {session && player && !player.must_change_password && !initialLoadDone && <div className="center-load">{t("Lade ...")}</div>}

        {session && player && !player.must_change_password && initialLoadDone && (
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
            {tourneyReady && tab !== "match" && !celebrate && (() => {
              const iAmP1 = tourneyReady.player1_id === player.id;
              const oppName = (iAmP1 ? tourneyReady.player2 : tourneyReady.player1)?.nickname;
              return (
                <div className="celebrate-overlay" onClick={dismissTourneyReady}>
                  <div className="celebrate-card" onClick={(e) => e.stopPropagation()}>
                    <div className="celebrate-head">🎱 {t("Du bist dran!")}</div>
                    <p className="hint" style={{ marginTop: -6, marginBottom: 14 }}>{tourneyReady.tournament?.name}</p>
                    <div className="celebrate-item">
                      <Ball color={colorOf(oppName)} label={initials(oppName)} badge={badgeOf(oppName)} photo={photoOf(oppName)} size={40} />
                      <div className="celebrate-txt">
                        <span className="celebrate-name">{t("gegen {name}", { name: oppName || "?" })}</span>
                        <span className="celebrate-desc">
                          {tourneyReady.table_number != null ? `${t("Tisch")} ${tourneyReady.table_number}` : t("Tisch wird noch zugeteilt")}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                      <button className="btn ghost" style={{ width: "auto", flex: 1, marginTop: 0 }} onClick={dismissTourneyReady}>{t("Später")}</button>
                      <button className="btn primary" style={{ width: "auto", flex: 1 }} onClick={goToTourneyReady}>{t("Zum Turnier")}</button>
                    </div>
                  </div>
                </div>
              );
            })()}
            <main className={"content" + (tab === "match" ? " no-tabbar" : "") + (tourneyReadyList.length > 0 && tab !== "match" ? " has-table-banner" : "")}>
              {tab === "live" && (
                <LiveScreen me={player} pings={pings} plannings={plannings} challenges={challenges} matches={matches} rangliste={rangliste}
                  players={players} catalog={catalog} earnedBadges={badgesOfId(player.id)}
                  colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                  onCreate={createPing} onClose={closePing} onOpenProfile={openProfile} onOpenProtokoll={openProtokoll}
                  onReply={replyPing} onUnreply={unreplyPing}
                  onCreatePlanning={createPlanning} onDeletePlanning={deletePlanning}
                  onReplyPlanning={replyPlanning} onUnreplyPlanning={unreplyPlanning}
                  onDeclineChallenge={declineChallenge} onCancelChallenge={cancelChallenge}
                  onEditChallengeMessage={editChallengeMessage} onReplyToChallenge={replyToChallenge}
                  onInvite={() => navPush({ tab: "invite" })} />
              )}
              {tab === "match" && (() => {
                // Turnier-Kontext (Selbst-Meldung eines Spielers über den normalen
                // MatchScreen-Flow) - Gegner ist der jeweils andere Turnierspieler.
                // Die Turnierleitung meldet/korrigiert dagegen direkt inline im
                // Turnierraster (schnelle Zähler statt vollem Match-Flow, siehe
                // TurnierMatchActions.jsx) und landet nie hier.
                const tourOpp = matchTournamentCtx
                  ? players.find((p) => p.id === (matchTournamentCtx.player1Id === player.id ? matchTournamentCtx.player2Id : matchTournamentCtx.player1Id))
                  : null;
                return (
                <MatchScreen me={player} players={players} matches={matches} disciplines={disciplines}
                  ratingOf={ratingOf} toast={toast} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                  onReload={loadData} initialOpp={matchTournamentCtx ? tourOpp : vsOpp} onChallenge={createChallenge}
                  catalog={catalog} challenges={challenges} earnedBadges={badgesOfId(player.id)}
                  onOpenProtokoll={openProtokoll} tournamentCtx={matchTournamentCtx}
                  onDone={() => { loadData(); allowLeaveMatchRef.current = true; window.history.back(); }}
                  onCancel={() => { allowLeaveMatchRef.current = true; window.history.back(); }} />
                );
              })()}
              {tab === "stats" && <StatistikScreen matches={matches} onOpenProfile={openProfile}
                onOpenProtokoll={openProtokoll}
                colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} snapshots={snapshots} players={players}
                rangliste={rangliste} me={player} challenges={challenges}
                catalog={catalog} earnedBadges={badgesOfId(player.id)}
                onInvite={() => navPush({ tab: "invite" })} disciplines={disciplines}
                pending={pendingForMe} onConfirm={confirmMatch} myOpenReports={myOpenReports}
                pings={pings} openChallengesToMe={openChallengesToMe} onGoToLive={() => navPush({ tab: "live" })} />}
              {tab === "protokoll" && protokollMatch && (
                <MatchProtokollScreen match={protokollMatch} onBack={() => window.history.back()} />
              )}
              {tab === "profil" && (
                <ProfilScreen nickname={player.nickname} matches={matches} rangliste={rangliste}
                  onBack={null} isMe onLogout={logout} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                  players={players} meRow={player} onSaveProfile={saveProfile}
                  earnedBadges={badgesOfId(player.id)} onSelectBadge={selectBadge} catalog={catalog} challenges={challenges}
                  onOpenAdmin={() => navPush({ tab: "admin" })} onInvite={() => navPush({ tab: "invite" })} toast={toast}
                  onOpenTurniere={openTurniereMenu} tourneyReadyCount={tourneyReadyList.length}
                  lang={lang} onLang={changeLang}
                  updateInterval={updateInterval} onSetUpdateInterval={setUpdateCheckInterval} onCheckUpdate={checkForUpdate}
                  onSubmitFeedback={submitFeedback} onDeleteAccount={deleteAccount} onReload={loadData}
                  onSetTheme={setTheme}
                  onSetStartTab={setStartTab}
                  onOpenProfile={openProfile} />
              )}
              {tab === "fremdprofil" && profileName && (
                <ProfilScreen nickname={profileName} matches={matches} rangliste={rangliste}
                  onBack={() => window.history.back()} isMe={profileName === player.nickname}
                  onLogout={logout} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                  players={players} meRow={player} onSaveProfile={saveProfile}
                  earnedBadges={badgesOfId((players.find((x) => x.nickname === profileName) || {}).id)}
                  onSelectBadge={selectBadge} catalog={catalog} onChallenge={createChallenge} onStartMatch={startMatchVs} challenges={challenges}
                  onOpenAdmin={() => navPush({ tab: "admin" })} onInvite={() => navPush({ tab: "invite" })} toast={toast}
                  lang={lang} onLang={changeLang} onSetTheme={setTheme}
                  onSubmitFeedback={submitFeedback} onDeleteAccount={deleteAccount} onReload={loadData}
                  onOpenProfile={openProfile} />
              )}
              {tab === "admin" && player.role === "admin" && (
                <AdminScreen allPending={unconfirmed} players={players} onConfirm={confirmMatch}
                  me={player} onBack={() => window.history.back()} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf}
                  toast={toast} onReload={loadData} matches={matches} />
              )}
              {tab === "invite" && (
                <InviteScreen me={player} onBack={() => window.history.back()} toast={toast} />
              )}
              {tab === "turnier" && (
                <TurniereScreen toast={toast}
                  onOpenTournament={(id) => navPush({ tab: "turnierdetail", tournamentId: id })}
                  onBack={() => window.history.back()} />
              )}
              {tab === "turnierdetail" && tournamentId && (
                <TurnierRasterScreen tournamentId={tournamentId} me={player} players={players} matches={matches} toast={toast}
                  colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onReload={loadData} onBack={() => window.history.back()}
                  onReportTournamentMatch={(ctx) => navPush({ tab: "match", matchTournamentCtx: ctx })} />
              )}
              <button className="refresh-btn" onClick={() => { loadData(); checkForUpdate(); }} aria-label={t("Aktualisieren")}>
                <RefreshCw size={16} className={loadingData ? "spin" : ""} />
              </button>
            </main>

            {/* Permanenter Tisch-Hinweis (Nutzer-Feedback: "jedem Spieler muss
                zu jeder Zeit klar sein, auf welchem Tisch gespielt wird") -
                anders als das einmalige "Du bist dran!"-Popup oben (das sich
                pro Partie dauerhaft wegklicken laesst, siehe dismissTourneyReady)
                bleibt dieser Banner sichtbar, solange tourneyReadyList etwas
                enthaelt - verschwindet von selbst, sobald das Ergebnis gemeldet
                wurde (dieselbe Quelle wie der Turniere-Tabbar-Badge). */}
            {tourneyReadyList.length > 0 && tab !== "match" && (() => {
              const next = tourneyReadyList[0];
              const iAmP1 = next.player1_id === player.id;
              const oppName = (iAmP1 ? next.player2 : next.player1)?.nickname;
              return (
                <button className="tourney-table-banner"
                  onClick={() => navPush({
                    tab: "match",
                    matchTournamentCtx: {
                      tournamentMatchId: next.id, discipline: next.tournament?.discipline,
                      player1Id: next.player1_id, player2Id: next.player2_id,
                    },
                  })}>
                  🎱 {t("Tisch")} {next.table_number} · {t("gegen {name}", { name: oppName || "?" })}
                  {tourneyReadyList.length > 1 && ` · ${t("+{n} weitere", { n: tourneyReadyList.length - 1 })}`}
                </button>
              );
            })()}

            {tab !== "match" && (
            <nav className="tabbar">
              <button className={"tab" + (tab === "stats" || tab === "fremdprofil" ? " on" : "")} onClick={() => navPush({ tab: "stats" })}>
                <BarChart3 size={21} /><span>{t("Statistik")}</span>
                {pendingForMe.length > 0 && <span className="badge">{pendingForMe.length}</span>}
              </button>
              <button className={"tab" + (tab === "turnier" || tab === "turnierdetail" ? " on" : "")} onClick={openTurniereMenu}>
                <Trophy size={21} /><span>{t("Turniere")}</span>
                {tourneyReadyList.length > 0 && <span className="badge">{tourneyReadyList.length}</span>}
              </button>
              <button className="tab fab" onClick={() => navPush({ tab: "match" })} aria-label={t("Neues Match")}>
                <span className="fab-shine" />
                <Plus size={26} className="fab-plus" />
              </button>
              <button className={"tab" + (tab === "live" ? " on" : "")} onClick={() => navPush({ tab: "live" })}>
                <Radio size={21} /><span>{t("Live")}</span>
                {pings.length + openChallengesToMe.length + plannings.length > 0 && (
                  <span className="badge live">{pings.length + openChallengesToMe.length + plannings.length}</span>
                )}
              </button>
              <button className={"tab" + (tab === "profil" || tab === "admin" ? " on" : "")} onClick={() => navPush({ tab: "profil" })}>
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
