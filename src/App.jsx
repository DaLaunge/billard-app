import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabase";
import { QRCodeSVG } from "qrcode.react";
import {
  Trophy, Plus, BarChart3, Shield, User, ChevronLeft, Check, X, Minus,
  Mail, ArrowRight, Swords, Flame, Search, LogOut, RefreshCw, Clock,
  Radio, MapPin, Pencil, Award, Lock, TrendingUp, QrCode, Share2, Copy, RotateCcw,
} from "lucide-react";

/* Einladungs-Code aus der URL (?ref=CODE) einmalig sichern.
   Übersteht den Magic-Link-Umweg über sessionStorage. */
function captureRef() {
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (ref) {
      sessionStorage.setItem("invite_ref", ref.trim());
      // Parameter aus der Adresszeile entfernen (sauberer Look)
      url.searchParams.delete("ref");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  } catch { /* ignore */ }
}
captureRef();
const getRef = () => { try { return sessionStorage.getItem("invite_ref") || null; } catch { return null; } };
const clearRef = () => { try { sessionStorage.removeItem("invite_ref"); } catch { /* */ } };

/* Holt ALLE Zeilen einer Abfrage seitenweise (Supabase liefert je
   Anfrage max. 1000 Zeilen). queryFn(from, to) muss einen Supabase-
   Range-Query zurückgeben. Ergebnis: { data, error }. */
async function fetchAllRows(queryFn, pageSize = 1000) {
  let from = 0;
  const all = [];
  // Sicherheitslimit: max. 50 Seiten (50.000 Zeilen)
  for (let page = 0; page < 50; page++) {
    const { data, error } = await queryFn(from, from + pageSize - 1);
    if (error) return { data: all, error };
    if (data && data.length) all.push(...data);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return { data: all, error: null };
}

/* ============================================================
   HELFER
   ============================================================ */

const BALL_PALETTE = ["#E8B321", "#2B5DA8", "#C0392B", "#6C4AB0", "#E07B2F", "#2E7D4F", "#8B3A2E", "#B0578D"];
const hashColor = (name = "") => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return BALL_PALETTE[h % BALL_PALETTE.length];
};
const initials = (name = "?") => {
  const parts = String(name).trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : String(name).slice(0, 2)).toUpperCase();
};
const winProb = (ra, rb) => 1 / (1 + Math.pow(2, (rb - ra) / 100));
const fmtDate = (d) => {
  if (!d) return "-";
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, "0")}.${String(x.getMonth() + 1).padStart(2, "0")}.${x.getFullYear()}`;
};
const timeAgo = (d) => {
  const m = Math.round((Date.now() - new Date(d)) / 60000);
  if (m < 1) return "gerade eben";
  if (m < 60) return `vor ${m} Min`;
  return `vor ${Math.round(m / 60)} Std`;
};
const timeLeft = (d) => {
  const m = Math.max(0, Math.round((new Date(d) - Date.now()) / 60000));
  if (m < 60) return `noch ${m} Min`;
  return `noch ca. ${Math.round(m / 60)} Std`;
};
const DEFAULT_DISCIPLINES = ["8 Ball", "9 Ball", "10 Ball", "14/1 Endlos"];

/* Erfolgs-Katalog wird zur Laufzeit aus der Datenbank geladen (Tabelle
   badge_catalog). BADGE_INFO ist eine modulweite Map, die die App beim
   Start befüllt – so kennt auch die (zustandslose) Ball-Komponente die
   Emojis. Der kleine Fallback greift nur, falls der Katalog noch lädt. */
const BADGE_INFO = {};
const BADGE_FALLBACK = { emoji: "🏅", name: "Erfolg", description: "" };
const badgeInfo = (key) => BADGE_INFO[key] || BADGE_FALLBACK;

/* Wahrgenommene Helligkeit einer Hex-Farbe (0 = dunkel, 1 = hell).
   Nach WCAG-Luminanz-Näherung. */
function luminance(hex) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return 0.5;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function Ball({ color, label, size = 44, gold = false, badge = null }) {
  const c = gold ? "#D6A425" : color;
  const b = badge && BADGE_INFO[badge] ? BADGE_INFO[badge] : null;
  const light = luminance(c) > 0.6; // helle Kugel -> dunkle Beschriftung
  const numStyle = light
    ? { background: "#1E1E1E", color: "#F2EDE0" }
    : { background: "#F2EDE0", color: "#1E1E1E" };
  return (
    <div className="ball" style={{ width: size, height: size, background: c }}>
      <div className="ball-shine" />
      {b ? (
        <div className={"ball-badge" + (light ? " on-light" : "")}
          style={{ fontSize: size * 0.5 }} title={b.name}>{b.emoji}</div>
      ) : (
        <div className="ball-num"
          style={{ width: size * 0.52, height: size * 0.52, fontSize: size * 0.28, ...numStyle }}>
          {label}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   LOGIN & REGISTRIERUNG
   ============================================================ */

function LoginScreen() {
  const [mode, setMode] = useState("magic"); // Standard: gewohnter Magic-Link; Passwort ist ein Tipp entfernt
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendLink = async () => {
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  const signInPw = async () => {
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError("Anmeldung fehlgeschlagen – Passwort falsch oder noch keins gesetzt. Nutze den Magic-Link.");
  };

  return (
    <div className="screen login-screen">
      <div className="login-hero">
        <div className="login-balls">
          <Ball color="#E8B321" label="1" size={54} />
          <Ball color="#2B5DA8" label="2" size={54} />
          <Ball color="#C0392B" label="3" size={54} />
        </div>
        <h1 className="app-title">Break &amp; Rank</h1>
        <p className="app-sub">Das Ranking eures Vereins.<br />Fargo-Style, fair, immer aktuell.</p>
        {getRef() && (
          <p className="invite-note"><Check size={14} /> Du wurdest eingeladen – melde dich an, um dabei zu sein!</p>
        )}
      </div>

      {sent ? (
        <div className="login-card">
          <div className="sent-check"><Check size={28} /></div>
          <p className="sent-text">Link gesendet an<br /><b>{email}</b></p>
          <p className="hint" style={{ textAlign: "center" }}>
            Oeffne die Mail auf DIESEM Geraet und tippe auf den Link.
            Nichts bekommen? Schau in den Spam-Ordner.
          </p>
          <button className="btn ghost" onClick={() => setSent(false)}>Andere Adresse verwenden</button>
        </div>
      ) : (
        <div className="login-card">
          <div className="auth-tabs">
            <button className={"auth-tab" + (mode === "magic" ? " on" : "")}
              onClick={() => { setMode("magic"); setError(""); }}>Magic-Link</button>
            <button className={"auth-tab" + (mode === "password" ? " on" : "")}
              onClick={() => { setMode("password"); setError(""); }}>Passwort</button>
          </div>

          <label className="field-label" htmlFor="mail">E-Mail-Adresse</label>
          <div className="mail-row">
            <Mail size={18} className="mail-ico" />
            <input id="mail" type="email" placeholder="du@beispiel.at" value={email} autoComplete="email"
              onChange={(e) => setEmail(e.target.value)} />
          </div>

          {mode === "password" ? (
            <>
              <label className="field-label" htmlFor="pw">Passwort</label>
              <div className="mail-row">
                <Lock size={18} className="mail-ico" />
                <input id="pw" type="password" placeholder="Dein Passwort" value={password} autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && email.includes("@") && password && signInPw()} />
              </div>
              {error && <p className="nick-status err"><X size={14} /> {error}</p>}
              <button className="btn primary" disabled={busy || !email.includes("@") || !password} onClick={signInPw}>
                {busy ? "..." : <>Anmelden <ArrowRight size={18} /></>}
              </button>
              <button className="btn ghost" onClick={() => { setMode("magic"); setError(""); }}>
                Passwort vergessen? Per Magic-Link anmelden
              </button>
              <p className="hint">Neu hier? Einmal per Magic-Link anmelden und danach im Profil ein Passwort festlegen.</p>
            </>
          ) : (
            <>
              {error && <p className="nick-status err"><X size={14} /> {error}</p>}
              <button className="btn primary" disabled={busy || !email.includes("@")} onClick={sendLink}>
                {busy ? "Sende ..." : <>Login-Link senden <ArrowRight size={18} /></>}
              </button>
              <p className="hint">Kein Passwort noetig – du bekommst einen Link per Mail und bist drin.
                Ideal beim ersten Mal oder wenn du dein Passwort vergessen hast.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NicknameScreen({ onRegistered, existingPlayers }) {
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const clean = nick.trim();

  const legacyMatch = existingPlayers.find(
    (p) => p.nickname.toLowerCase() === clean.toLowerCase() && !p.auth_user_id
  );
  const taken = existingPlayers.find(
    (p) => p.nickname.toLowerCase() === clean.toLowerCase() && p.auth_user_id
  );
  const tooShort = clean.length > 0 && clean.length < 2;
  const valid = clean.length >= 2 && clean.length <= 30 && !taken;

  const register = async () => {
    setBusy(true); setError("");
    const { data, error } = await supabase.rpc("register_player", { p_nickname: clean, p_ref: getRef() });
    setBusy(false);
    if (error) setError(error.message);
    else { clearRef(); onRegistered(data); }
  };

  return (
    <div className="screen login-screen">
      <div className="login-hero">
        <div className="login-balls"><Ball color="#6C4AB0" label="?" size={54} /></div>
        <h1 className="app-title" style={{ fontSize: 28 }}>Wie sollen wir dich nennen?</h1>
        <p className="app-sub">Dein Nickname erscheint in Rangliste und Statistiken.<br />Er muss im Verein eindeutig sein.</p>
      </div>
      <div className="login-card">
        <label className="field-label" htmlFor="nick">Nickname</label>
        <div className="mail-row">
          <User size={18} className="mail-ico" />
          <input id="nick" value={nick} maxLength={30} placeholder="z. B. Kleiner Stefan"
            autoComplete="off" onChange={(e) => setNick(e.target.value)} />
        </div>
        {clean.length === 0 && <p className="nick-status dim">2 bis 30 Zeichen.</p>}
        {tooShort && <p className="nick-status warn">Noch zu kurz - mindestens 2 Zeichen.</p>}
        {taken && <p className="nick-status err"><X size={14} /> "{taken.nickname}" ist schon vergeben.</p>}
        {legacyMatch && (
          <p className="nick-status ok"><Check size={14} /> "{legacyMatch.nickname}" gefunden! Deine bisherige Match-Historie wird uebernommen.</p>
        )}
        {valid && !legacyMatch && <p className="nick-status ok"><Check size={14} /> "{clean}" ist frei!</p>}
        {error && <p className="nick-status err"><X size={14} /> {error}</p>}
        <button className="btn primary" disabled={!valid || busy} onClick={register}>
          {busy ? "Speichere ..." : <>Los geht's <ArrowRight size={18} /></>}
        </button>
        <p className="hint">Warst du schon im alten Telegram-Ranking dabei? Dann gib genau deinen damaligen Nicknamen ein, um deine Historie zu behalten.</p>
      </div>
    </div>
  );
}

/* ============================================================
   RANGLISTE
   ============================================================ */

function RanglisteScreen({ rangliste, disciplines, pending, me, onConfirm, onOpenProfile, myOpenReports, colorOf, badgeOf }) {
  const [disc, setDisc] = useState("Gesamt");
  const [showAll, setShowAll] = useState(false);

  const rows = rangliste
    .filter((r) => r.discipline === disc)
    .filter((r) => showAll || (r.aktiv && !r.vorlaeufig));
  const hidden = rangliste.filter((r) => r.discipline === disc).length - rows.length;

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>Rangliste</h2>
        <span className="head-note">Fargo-Skala - 100 Punkte = 2:1</span>
      </header>

      {pending.map((m) => {
        const other = m.player1_id === me.id ? m.p2.nickname : m.p1.nickname;
        const myScore = m.player1_id === me.id ? m.score1 : m.score2;
        const otherScore = m.player1_id === me.id ? m.score2 : m.score1;
        return (
          <div className="confirm-banner" key={m.id}>
            <div><b>Match bestaetigen:</b> {other} meldet ein {otherScore}:{myScore} gegen dich ({m.discipline}, {fmtDate(m.played_at)}).</div>
            <div className="confirm-actions">
              <button className="chip-btn ok" onClick={() => onConfirm(m.id, true)}><Check size={15} /> Passt</button>
              <button className="chip-btn no" onClick={() => onConfirm(m.id, false)}><X size={15} /> Falsch</button>
            </div>
          </div>
        );
      })}

      {myOpenReports.length > 0 && (
        <p className="open-note"><Clock size={14} /> {myOpenReports.length === 1
          ? `1 gemeldetes Match wartet noch auf Bestaetigung durch ${myOpenReports[0].p2.nickname}.`
          : `${myOpenReports.length} gemeldete Matches warten noch auf Bestaetigung.`}</p>
      )}

      <div className="chips">
        {["Gesamt", ...disciplines].map((d) => (
          <button key={d} className={"chip" + (disc === d ? " active" : "")} onClick={() => setDisc(d)}>{d}</button>
        ))}
      </div>

      <ol className="ranking">
        {rows.map((r, i) => (
          <li key={r.nickname + r.discipline}>
            <button className="rank-row" onClick={() => onOpenProfile(r.nickname)}>
              <span className={"rank-pos" + (i < 3 && !r.vorlaeufig ? " top" : "")}>{i + 1}</span>
              <Ball color={colorOf(r.nickname)} label={initials(r.nickname)} badge={badgeOf(r.nickname)} gold={i === 0 && !r.vorlaeufig && r.aktiv} />
              <span className="rank-name">
                {r.nickname}
                <span className="rank-meta">
                  {r.spiele} Spiele - zuletzt {fmtDate(r.letzte_partie)}
                  {r.vorlaeufig && <em className="prov"> - vorlaeufig</em>}
                  {!r.aktiv && <em className="inactive"> - inaktiv</em>}
                </span>
              </span>
              <span className="rank-rating">{r.rating}</span>
            </button>
          </li>
        ))}
      </ol>
      {rows.length === 0 && <p className="hint center">Noch keine Ratings in dieser Disziplin.</p>}
      {hidden > 0 && !showAll && (
        <button className="btn ghost" onClick={() => setShowAll(true)}>
          {hidden} inaktive / vorlaeufige Spieler einblenden
        </button>
      )}
      {showAll && (
        <button className="btn ghost" onClick={() => setShowAll(false)}>Nur aktive Rangliste zeigen</button>
      )}
      <p className="footnote">
        Ratings werden nach jedem bestaetigten Match ueber die gesamte Historie neu berechnet.
        Juengere Matches zaehlen staerker. Unter 10 Spielen gilt ein Rating als vorlaeufig,
        ohne Match seit 180 Tagen als inaktiv.
      </p>
    </div>
  );
}

/* ============================================================
   LIVE-TICKER
   ============================================================ */

function PingCard({ ping, me, colorOf, badgeOf, onReply, onUnreply }) {
  const myReply = ping.replies?.find((r) => r.player_id === me.id);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const mine = ping.player_id === me.id;

  return (
    <section className={"stat-block ping-card" + (mine ? " mine" : "")}>
      <div className="ping-head">
        <Ball color={colorOf(ping.player.nickname)} label={initials(ping.player.nickname)} badge={badgeOf(ping.player.nickname)} size={40} />
        <div className="ping-who">
          <b>{ping.player.nickname}</b>
          <span className="rank-meta">{timeAgo(ping.created_at)} - {timeLeft(ping.expires_at)}</span>
        </div>
        <span className="live-pill"><span className="live-dot" /> LIVE</span>
      </div>
      <div className="ping-loc"><MapPin size={16} /> {ping.location}</div>
      {ping.message && <p className="ping-msg">"{ping.message}"</p>}

      {ping.replies?.length > 0 && (
        <div className="otw-count">🚗 {ping.replies.length} {ping.replies.length === 1 ? "Person ist" : "Leute sind"} unterwegs</div>
      )}

      {ping.replies?.length > 0 && (
        <div className="ping-replies">
          {ping.replies.map((r) => (
            <div key={r.id} className="ping-reply">
              <Ball color={colorOf(r.player.nickname)} label={initials(r.player.nickname)} badge={badgeOf(r.player.nickname)} size={26} />
              <span><b>{r.player.nickname}</b>{r.message ? `: ${r.message}` : " ist unterwegs!"}</span>
            </div>
          ))}
        </div>
      )}

      {!mine && !myReply && !open && (
        <div className="sp-controls">
          <button className="btn primary small" onClick={() => onReply(ping.id, "")}>
            <Swords size={16} /> Bin unterwegs
          </button>
          <button className="btn ghost small" onClick={() => setOpen(true)}>mit Nachricht</button>
        </div>
      )}
      {!mine && !myReply && open && (
        <div className="reply-form">
          <div className="search-row" style={{ marginBottom: 8 }}>
            <input placeholder="Nachricht (optional), z. B. 'Bin um 19 Uhr da'" value={msg}
              maxLength={120} onChange={(e) => setMsg(e.target.value)} />
          </div>
          <div className="confirm-actions">
            <button className="chip-btn ok" onClick={() => { onReply(ping.id, msg); setOpen(false); setMsg(""); }}>
              <Check size={15} /> Unterwegs
            </button>
            <button className="chip-btn no" onClick={() => setOpen(false)}><X size={15} /> Abbrechen</button>
          </div>
        </div>
      )}
      {!mine && myReply && (
        <button className="btn ghost" onClick={() => onUnreply(ping.id)}>
          <X size={15} /> Zusage zurueckziehen
        </button>
      )}
    </section>
  );
}

function LiveScreen({ me, pings, colorOf, badgeOf, onCreate, onClose, onReply, onUnreply }) {
  const myPing = pings.find((p) => p.player_id === me.id);
  const others = pings.filter((p) => p.player_id !== me.id);
  const [loc, setLoc] = useState("");
  const [msg, setMsg] = useState("");
  const [hours, setHours] = useState(3);

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>Live</h2>
        <span className="head-note">Wer ist gerade am Tisch oder sucht ein Match?</span>
      </header>

      {myPing ? (
        <PingCard ping={myPing} me={me} colorOf={colorOf} badgeOf={badgeOf} onReply={onReply} onUnreply={onUnreply} />
      ) : (
        <section className="stat-block">
          <h3><Radio size={17} /> Ich bin bereit!</h3>
          <div className="search-row">
            <MapPin size={16} className="mail-ico" />
            <input placeholder="Wo bist du? z. B. Schwedenplatz" value={loc}
              maxLength={60} onChange={(e) => setLoc(e.target.value)} />
          </div>
          <div className="search-row">
            <Pencil size={16} className="mail-ico" />
            <input placeholder="Nachricht (optional), z. B. 'Wer hat Lust auf 9 Ball?'" value={msg}
              maxLength={120} onChange={(e) => setMsg(e.target.value)} />
          </div>
          <div className="chips" style={{ marginBottom: 4 }}>
            {[1, 2, 3, 6].map((h) => (
              <button key={h} className={"chip" + (hours === h ? " active" : "")} onClick={() => setHours(h)}>
                {h} Std
              </button>
            ))}
          </div>
          <button className="btn primary" disabled={loc.trim().length < 2}
            onClick={() => { onCreate(loc, msg, hours); setLoc(""); setMsg(""); }}>
            <Radio size={17} /> Live gehen
          </button>
          <p className="hint">Dein Eintrag verschwindet nach der gewaehlten Zeit von selbst.</p>
        </section>
      )}

      {myPing && (
        <button className="btn ghost" onClick={onClose}><X size={15} /> Meinen Live-Eintrag beenden</button>
      )}

      {others.length > 0 && <p className="q" style={{ marginTop: 18 }}>Gerade aktiv:</p>}
      {others.map((p) => (
        <PingCard key={p.id} ping={p} me={me} colorOf={colorOf} badgeOf={badgeOf} onReply={onReply} onUnreply={onUnreply} />
      ))}
      {others.length === 0 && !myPing && (
        <p className="hint center" style={{ marginTop: 24 }}>
          Gerade ist niemand live. Sei du der Erste - dein Eintrag erscheint hier fuer alle sichtbar.
        </p>
      )}
    </div>
  );
}

/* ============================================================
   MATCH MELDEN
   ============================================================ */

/* ============================================================
   14/1 ENDLOS – Live-Protokoll nach WPA-Regeln
   ============================================================ */
/* Standard-Farben eines Poolbillard-Racks (Gag für die Kugelauswahl) */
const POOL_COLORS = {
  1:"#E6B422",2:"#1F5FBF",3:"#C8102E",4:"#5B2A86",5:"#E8600F",6:"#1B7A43",7:"#7A2233",8:"#161616",
  9:"#E6B422",10:"#1F5FBF",11:"#C8102E",12:"#5B2A86",13:"#E8600F",14:"#1B7A43",15:"#7A2233",
};
function poolBallStyle(n) {
  if (n === 0) return { background: "#E7E0CE" };
  const c = POOL_COLORS[n];
  if (n <= 8) return { background: c };
  return { background: `linear-gradient(180deg, #F2EDE0 0 30%, ${c} 30% 70%, #F2EDE0 70% 100%)` };
}

function StraightPoolScorer({ me, opp, colorOf, badgeOf, onFinish, toast }) {
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

  const names = [me.nickname, opp.nickname];
  const inningNo = missInn[0] + missInn[1] + safeInn[0] + safeInn[1] + 1;
  const offAvg = (p, MI = missInn, PK = pocketed) => (MI[p] > 0 ? PK[p] / MI[p] : 0);
  const allAvg = (p, MI = missInn, SI = safeInn, PK = pocketed) =>
    (MI[p] + SI[p] > 0 ? PK[p] / (MI[p] + SI[p]) : 0);
  const fmt = (x) => x.toFixed(1);

  const snap = () => ({ sc: [...sc], active, breakPhase, hi: [...hi], fouls: [...fouls],
    maxDef: [...maxDef], onTable, inningRun, pocketed: [...pocketed],
    missInn: [...missInn], safeInn: [...safeInn], twoBall: [...twoBall] });
  const pushHist = (x) => setHist((h) => [...h.slice(-80), x]);
  const withDeficit = (scores, md) => {
    const nd = [...md];
    const d0 = scores[1] - scores[0]; if (d0 > nd[0]) nd[0] = d0;
    const d1 = scores[0] - scores[1]; if (d1 > nd[1]) nd[1] = d1;
    return nd;
  };

  // Ergebnis fürs Speichern zusammenbauen (Offensivschnitt nur ab 3 Miss-Aufnahmen für Belohnungen)
  const buildResult = (scores, HI, MD, PK, MI, TB) => ({
    s1: scores[0], s2: scores[1], hr1: HI[0], hr2: HI[1], def1: MD[0], def2: MD[1],
    avg1: MI[0] >= 3 ? Math.round((PK[0] / MI[0]) * 100) / 100 : null,
    avg2: MI[1] >= 3 ? Math.round((PK[1] / MI[1]) * 100) / 100 : null,
    tb1: TB[0], tb2: TB[1],
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
    if (ns[active] >= target) onFinish(buildResult(ns, nhi, nmd, npk, missInn, twoBall));
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
    if (threeFoul && toast) toast(`3 Fouls in Folge – ${names[active]} bekommt −15 Strafpunkte!`);
    if (finished) onFinish(buildResult(ns, nhi, nmd, npk, nMI, ntb));
  };

  // Anstoß regulär gespielt (Safety-Anstoß): zählt als Safe-Aufnahme, Gegner ist dran
  // Anstoß-Foul −2: Safe-Aufnahme, danach Wahl, wer als Nächstes anstößt (mehrere Anstöße möglich)
  const breakFoul = () => {
    pushHist(snap());
    const ns = [...sc]; ns[active] -= 2;
    const nSI = [...safeInn]; nSI[active] += 1;
    const nmd = withDeficit(ns, maxDef);
    setSc(ns); setSafeInn(nSI); setMaxDef(nmd); setOnTable(15); setInningRun(0);
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
      setEntry(null); setBreakChoose(false);
      return h.slice(0, -1);
    });
  };

  // ---- Setup ----
  if (!started) {
    return (
      <div className="sp-setup">
        <p className="q">Zielpunktzahl für 14/1 Endlos</p>
        <div className="disc-grid target-grid">
          {PRESETS.map((t) => (
            <button key={t} className={"disc-card compact" + (target === t && custom === "" ? " sel" : "")}
              onClick={() => { setTarget(t); setCustom(""); }}>{t}</button>
          ))}
        </div>
        <div className="search-row" style={{ marginTop: 4 }}>
          <input type="number" inputMode="numeric" placeholder="oder eigenes Ziel eingeben …"
            value={custom} onChange={(e) => {
              setCustom(e.target.value);
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n) && n > 0) setTarget(n);
            }} />
        </div>
        <p className="q" style={{ marginTop: 8 }}>Wer hat den Anstoß?</p>
        <div className="disc-grid">
          {[0, 1].map((i) => (
            <button key={i} className={"disc-card" + (starter === i ? " sel" : "")}
              onClick={() => setStarter(i)}>{names[i]}</button>
          ))}
        </div>
        <button className="btn primary" disabled={!(target > 0)}
          onClick={() => { setActive(starter); setStarted(true); }}>
          Los geht's – bis {target} <ArrowRight size={18} />
        </button>
        <p className="hint center">Jede versenkte Kugel = 1 Punkt. Aufnahme beenden mit <b>Fehler</b> (zählt
          für den Schnitt) oder <b>Safe</b> (zählt nicht). Rack ausgeschossen tippst du sofort ein.
          Foul = −1, Anstoß −2, drei Fouls in Folge zusätzlich −15.</p>
      </div>
    );
  }

  // ---- Wahl nach Anstoß-Foul ----
  if (breakChoose) {
    return (
      <div className="sp-entry">
        <p className="sp-entry-title">Anstoß-Foul −2 · Wer stößt als Nächstes an?</p>
        <div className="opp-grid">
          {[0, 1].map((i) => (
            <button key={i} className="opp-card" onClick={() => chooseBreaker(i)}>
              <Ball color={colorOf(names[i])} label={initials(names[i])} badge={badgeOf(names[i])} size={48} />
              <span>{names[i]}</span>
            </button>
          ))}
        </div>
        <p className="hint center">So sind mehrere Anstöße hintereinander möglich (Wiederholungs-Anstoß).</p>
      </div>
    );
  }

  // ---- Aufnahme abschließen ----
  if (entry) {
    const lbl = entry === "foul" ? " (Foul −1)" : entry === "safe" ? " (Safe)" : " (Fehler)";
    return (
      <div className="sp-entry">
        <p className="sp-entry-title">{names[active]}: Aufnahme abschließen{lbl}</p>
        <div className="sp-entry-lbl">Kugeln noch am Tisch</div>
        <div className="num-grid">
          {Array.from({ length: onTable + 1 }, (_, n) => n).map((n) => (
            <button key={n} className={"pool-ball" + (remain === n ? " sel" : "")} style={poolBallStyle(n)}
              onClick={() => setRemain(n)}><span className="pb-no">{n}</span></button>
          ))}
        </div>
        <div className="sp-run-preview">Serie dieser Aufnahme: <b>{inningRun + partial}</b></div>
        {remain === 0 && <p className="hint center" style={{ marginTop: 0 }}>Zwei-Kugel-Räumung! Tisch wird neu aufgebaut.</p>}
        {remain === 1 && <p className="hint center" style={{ marginTop: 0 }}>Tisch wird neu aufgebaut (15 Kugeln).</p>}
        {remain <= 1 && entry === "miss" ? (
          <>
            <div className="sp-controls">
              <button className="btn ghost" onClick={() => setEntry(null)}>Abbrechen</button>
              <button className="btn primary" onClick={() => applyEntry(false)}>Gegner ist dran</button>
            </div>
            <button className="btn ghost" onClick={() => applyEntry(true)}>{names[active]} macht weiter</button>
          </>
        ) : (
          <div className="sp-controls">
            <button className="btn ghost" onClick={() => setEntry(null)}>Abbrechen</button>
            <button className="btn primary" onClick={() => applyEntry(false)}>Übernehmen</button>
          </div>
        )}
      </div>
    );
  }

  // ---- Laufendes Spiel ----
  const need = target - sc[active];
  return (
    <div className="sp">
      <div className="sp-board">
        {[0, 1].map((i) => (
          <div key={i} className={"sp-side" + (active === i ? " active" : "")}>
            <Ball color={colorOf(names[i])} label={initials(names[i])} badge={badgeOf(names[i])} size={40} />
            <span className="sp-name">{names[i]}</span>
            <div className="sp-score">{sc[i]}</div>
            <div className="sp-meta">Höchstserie {hi[i]}</div>
            <div className="sp-avg">Ø {fmt(offAvg(i))} <span>Fehler</span> · {fmt(allAvg(i))} <span>ges.</span></div>
            {fouls[i] > 0 && (
              <div className={"sp-foulwarn" + (fouls[i] >= 2 ? " danger" : "")}>
                {fouls[i]} Foul{fouls[i] > 1 ? "s" : ""} in Folge{fouls[i] >= 2 ? " – Vorsicht!" : ""}
              </div>
            )}
            {active === i && <div className="sp-turn">am Tisch{inningRun > 0 ? ` · Serie ${inningRun}` : ""}</div>}
          </div>
        ))}
      </div>

      <div className="sp-actions">
        <div className="sp-target">Ziel {target} · Aufnahme {inningNo} · {onTable} Kugeln am Tisch</div>
        {need > 0 && need <= 14 && (
          <div className="sp-need">Nur noch <b>{need}</b> Kugel{need > 1 ? "n" : ""} bis {names[active]} gewinnt!</div>
        )}

        {breakPhase && (
          <div className="sp-need" style={{ color: "var(--ivory-dim)" }}>Anstoß: {names[active]} ist dran</div>
        )}
        <button className="sp-rack" onClick={bookRack} disabled={onTable <= 1}>
          <Plus size={20} /> Rack ausgeschossen (+{Math.max(0, onTable - 1)})
        </button>
        <div className="sp-controls">
          <button className="sp-pot half" onClick={() => openEntry("miss")}>Fehler</button>
          <button className="sp-pot half safe" onClick={() => openEntry("safe")}>Safe</button>
        </div>
        <div className="sp-controls">
          {breakPhase ? (
            <button className="btn ghost warn" onClick={breakFoul}>Anstoß-Foul −2</button>
          ) : (
            <button className="btn ghost warn" onClick={() => openEntry("foul")}>Foul −1</button>
          )}
        </div>
        <div className="sp-controls">
          <button className="btn ghost" onClick={undo} disabled={hist.length === 0}><RotateCcw size={15} /> Rückgängig</button>
        </div>

        {!confirmEnd ? (
          <button className="btn subtle" onClick={() => setConfirmEnd(true)}>Match vorzeitig beenden</button>
        ) : (
          <div className="sp-endbox">
            <p className="hint center" style={{ marginTop: 0 }}>Aktueller Stand {sc[0]} : {sc[1]} – wirklich beenden?</p>
            <div className="sp-controls">
              <button className="btn ghost" onClick={() => setConfirmEnd(false)}>Weiterspielen</button>
              <button className="btn primary" disabled={sc[0] === sc[1]}
                onClick={() => onFinish(buildResult(sc, hi, maxDef, pocketed, missInn, twoBall))}>
                Beenden
              </button>
            </div>
            {sc[0] === sc[1] && <p className="hint center">Bei Gleichstand kann nicht beendet werden.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function MatchScreen({ me, players, matches, disciplines, ratingOf, onDone, onCancel, onReload, toast, colorOf, badgeOf }) {
  const [step, setStep] = useState(0);
  const [opp, setOpp] = useState(null);
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

  // Wie oft habe ich gegen wen gespielt? (häufigste Gegner zuerst)
  const freqByNick = useMemo(() => {
    const f = {};
    (matches || []).forEach((m) => {
      let o = null;
      if (m.p1?.nickname === me.nickname) o = m.p2?.nickname;
      else if (m.p2?.nickname === me.nickname) o = m.p1?.nickname;
      if (o) f[o] = (f[o] || 0) + 1;
    });
    return f;
  }, [matches, me]);

  const ghost = players.find((p) => p.is_ghost);
  const opponents = players
    .filter((p) => p.id !== me.id && !p.is_ghost)
    .filter((p) => p.nickname.toLowerCase().includes(oppQuery.trim().toLowerCase()))
    .sort((a, b) => (freqByNick[b.nickname] || 0) - (freqByNick[a.nickname] || 0) || a.nickname.localeCompare(b.nickname));

  const myRating = ratingOf(me.nickname);
  const oppRating = opp ? ratingOf(opp.nickname) : 500;
  const prob = winProb(myRating, oppRating);
  const total = s1 + s2;
  const steps = ["Gegner", "Disziplin", "Ergebnis", "Pruefen"];

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
    if (isGhost) { setStep(4); return; }   // Trainingsmatch: nicht speichern, nur anzeigen
    setBusy(true);
    const { error } = await supabase.rpc("report_match", {
      p_opponent_id: opp.id, p_my_score: s1, p_opp_score: s2, p_discipline: disc,
      p_high_run_me: is141 ? hr[0] : null, p_high_run_opp: is141 ? hr[1] : null,
      p_deficit_me: is141 ? def[0] : null, p_deficit_opp: is141 ? def[1] : null,
      p_avg_me: is141 ? avg[0] : null, p_avg_opp: is141 ? avg[1] : null,
      p_twoball_me: is141 ? tb[0] : null, p_twoball_opp: is141 ? tb[1] : null,
    });
    setBusy(false);
    if (error) { toast("Fehler: " + error.message); return; }
    setStep(4);
  };

  const DiscChip = () => (
    <button className="disc-chip" onClick={() => { if (is141) setLeaveWarn(true); else setStep(1); }}>
      <span>{disc}</span><Pencil size={13} />
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
        <h2>Neues Match</h2>
      </header>

      {abortAsk && (
        <div className="modal-overlay" onClick={() => setAbortAsk(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Match abbrechen?</h3>
            <p>Alle Eingaben gehen verloren{is141 ? " – ein 14/1-Protokoll lässt sich nicht wiederherstellen" : ""}.</p>
            <div className="sp-controls">
              <button className="btn ghost warn" onClick={() => { setAbortAsk(false); onCancel(); }}>Ja – beenden</button>
              <button className="btn primary" onClick={() => setAbortAsk(false)}>Match fortführen</button>
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
          <p className="q">Gegen wen trittst du an?</p>
          <div className="search-row">
            <Search size={16} className="mail-ico" />
            <input placeholder="Spieler suchen ..." value={oppQuery} onChange={(e) => setOppQuery(e.target.value)} />
            {oppQuery && <button className="clear-btn" onClick={() => setOppQuery("")} aria-label="Suche loeschen"><X size={15} /></button>}
          </div>
          {opponents.length === 0 && <p className="hint">Kein Spieler namens "{oppQuery}" gefunden.</p>}
          {ghost && !oppQuery && (
            <button className="ghost-card" onClick={() => { setOpp(ghost); setStep(1); }}>
              <div className="ghost-ball">👻</div>
              <div className="ghost-info">
                <span className="ghost-name">Training gegen Ghost</span>
                <span className="ghost-sub">Übungsmatch – zählt nicht fürs Rating</span>
              </div>
              <ArrowRight size={18} />
            </button>
          )}
          <div className="opp-grid">
            {opponents.map((p) => (
              <button key={p.id} className={"opp-card" + (opp?.id === p.id ? " sel" : "")}
                onClick={() => { setOpp(p); setStep(1); }}>
                <Ball color={colorOf(p.nickname)} label={initials(p.nickname)} badge={badgeOf(p.nickname)} size={48} />
                <span>{p.nickname}</span>
              </button>
            ))}
          </div>
          <button className="btn ghost" onClick={() => setShowInvite(true)}>
            <QrCode size={16} /> Neues Mitglied? Jetzt einladen
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <p className="q">Welche Disziplin?</p>
          <div className="disc-grid">
            {disciplines.map((d) => (
              <button key={d} className={"disc-card" + (disc === d ? " sel" : "")}
                onClick={() => chooseDisc(d)}>
                {d}
              </button>
            ))}
          </div>
          {pendingDisc ? (
            <div className="confirm-box">
              <p>Wechsel zu bzw. von <b>14/1 Endlos</b> ändert das Punkteschema – das bisherige
                Ergebnis ({s1} : {s2}) geht dabei verloren. Fortfahren?</p>
              <div className="sp-controls">
                <button className="btn ghost" onClick={() => setPendingDisc(null)}>Abbrechen</button>
                <button className="btn primary" onClick={confirmDiscChange}>Wechseln &amp; zurücksetzen</button>
              </div>
            </div>
          ) : (
            <p className="hint center">Zwischen 8/9/10 Ball bleibt dein Ergebnis beim Wechsel erhalten.</p>
          )}
        </>
      )}

      {step === 2 && opp && disc && (
        <>
          <div className="score-head">
            <span className="sh-players">{me.nickname} vs {opp.nickname}</span>
            <DiscChip />
          </div>
          {leaveWarn && (
            <div className="confirm-box">
              <p>Ein <b>14/1-Spiel</b> läuft. Beim Disziplinwechsel geht der aktuelle Spielstand verloren. Fortfahren?</p>
              <div className="sp-controls">
                <button className="btn ghost" onClick={() => setLeaveWarn(false)}>Weiterspielen</button>
                <button className="btn primary" onClick={() => { setLeaveWarn(false); resetScores(); setDisc(null); setStep(1); }}>
                  Disziplin wechseln
                </button>
              </div>
            </div>
          )}
          {is141 ? (
            <StraightPoolScorer me={me} opp={opp} colorOf={colorOf} badgeOf={badgeOf} toast={toast}
              onFinish={({ s1: a, s2: b, hr1, hr2, def1, def2, avg1, avg2, tb1, tb2 }) => {
                setS1(a); setS2(b); setHr([hr1, hr2]); setDef([def1, def2]);
                setAvg([avg1, avg2]); setTb([tb1, tb2]); setStep(3);
              }} />
          ) : (
            <>
              <p className="q">Wie steht's? <span className="q-sub">(gewonnene Spiele)</span></p>
              <div className="score-row">
                {[{ p: me.nickname, v: s1, set: setS1 }, { p: opp.nickname, v: s2, set: setS2 }].map(({ p, v, set }) => (
                  <div key={p} className="score-col">
                    <Ball color={colorOf(p)} label={initials(p)} badge={badgeOf(p)} size={46} />
                    <span className="score-name">{p}</span>
                    <div className="score-num">{v}</div>
                    <div className="score-btns">
                      <button className="round-btn" onClick={() => set(Math.max(0, v - 1))} aria-label="minus"><Minus size={20} /></button>
                      <button className="round-btn plus" onClick={() => set(v + 1)} aria-label="plus"><Plus size={20} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn primary" disabled={total === 0 || s1 === s2} onClick={() => setStep(3)}>
                Weiter <ArrowRight size={18} />
              </button>
              {s1 === s2 && total > 0 && <p className="hint center">Unentschieden gibt's beim Billard nicht ;-)</p>}
            </>
          )}
        </>
      )}

      {step === 3 && opp && (
        <>
          <div className="summary">
            <div className="sum-vs">
              <div className="sum-side">
                <Ball color={colorOf(me.nickname)} label={initials(me.nickname)} badge={badgeOf(me.nickname)} size={52} />
                <span>{me.nickname}</span>
              </div>
              <div className="sum-score">{s1}<i>:</i>{s2}</div>
              <div className="sum-side">
                <Ball color={colorOf(opp.nickname)} label={initials(opp.nickname)} badge={badgeOf(opp.nickname)} size={52} />
                <span>{opp.nickname}</span>
              </div>
            </div>
            <div className="sum-disc">{disc}{isGhost ? " · Training" : ""}</div>
            {is141 && (hr[0] != null || hr[1] != null) && (
              <div className="sum-141">
                Höchstserie: {me.nickname} {hr[0]} · {opp.nickname} {hr[1]}
                {(avg[0] != null || avg[1] != null) && (
                  <><br />Ø pro Fehler-Aufnahme: {me.nickname} {avg[0] ?? "–"} · {opp.nickname} {avg[1] ?? "–"}</>
                )}
              </div>
            )}
            {isGhost ? (
              <p className="hint center" style={{ marginBottom: 0 }}>Trainingsmatch – wird nicht gespeichert und zählt nicht fürs Rating.</p>
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
            {busy ? "Speichere ..." : isGhost ? <>Training abschließen <Check size={18} /></> : <>Match speichern <Check size={18} /></>}
          </button>
          {!isGhost && <p className="hint center">Das Match fliesst erst ins Rating ein, wenn {opp.nickname} es bestaetigt.</p>}
        </>
      )}

      {step === 4 && opp && (
        <div className="saved">
          <div className="sent-check big"><Check size={34} /></div>
          {isGhost ? (
            <>
              <h3>Training beendet!</h3>
              <p>Ergebnis gegen den Ghost: <b>{s1} : {s2}</b>.<br />
                Trainingsmatches werden nicht gespeichert und beeinflussen dein Rating nicht.</p>
            </>
          ) : (
            <>
              <h3>Gespeichert!</h3>
              <p>Wartet auf Bestaetigung von <b>{opp.nickname}</b>.<br />
                Sobald {opp.nickname} die App oeffnet und auf "Passt" tippt, wird das Ranking neu berechnet.</p>
            </>
          )}
          <button className="btn primary" onClick={onDone}>Zur Rangliste</button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STATISTIK
   ============================================================ */

function computeStats(matches) {
  const s = {};
  const get = (n) => (s[n] ||= { name: n, spiele: 0, siege: 0, racksW: 0, racksT: 0, results: [] });
  const sorted = [...matches].sort((a, b) => new Date(a.played_at) - new Date(b.played_at));
  sorted.forEach((m) => {
    const a = get(m.p1.nickname), b = get(m.p2.nickname);
    a.spiele++; b.spiele++;
    a.racksW += m.score1; a.racksT += m.score1 + m.score2;
    b.racksW += m.score2; b.racksT += m.score1 + m.score2;
    const aWon = m.score1 > m.score2;
    if (aWon) a.siege++; else b.siege++;
    a.results.push(aWon); b.results.push(!aWon);
  });
  Object.values(s).forEach((p) => {
    p.quote = p.spiele ? Math.round((100 * p.siege) / p.spiele) : 0;
    let st = 0;
    for (let i = p.results.length - 1; i >= 0; i--) {
      if (st === 0) st = p.results[i] ? 1 : -1;
      else if (p.results[i] === (st > 0)) st += st > 0 ? 1 : -1;
      else break;
    }
    p.streak = st;
  });
  return s;
}

/* ISO-Wochen-String ("2026-W05") -> Date des Wochen-Montags */
function isoWeekToDate(wk) {
  if (!wk || wk.length < 7) return null;
  const y = parseInt(wk.slice(0, 4), 10);
  const w = parseInt(wk.slice(6), 10);
  const simple = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
  const dow = simple.getUTCDay();
  const monday = new Date(simple);
  if (dow <= 4) monday.setUTCDate(simple.getUTCDate() - dow + 1);
  else monday.setUTCDate(simple.getUTCDate() + 8 - dow);
  return monday;
}

// Aktuelle ISO-Woche im DB-Format 'YYYY-Wnn' (wie to_char(now(),'IYYY-"W"IW'))
function currentIsoWeek(dd = new Date()) {
  const d = new Date(Date.UTC(dd.getFullYear(), dd.getMonth(), dd.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);              // Donnerstag dieser Woche
  const isoYear = d.getUTCFullYear();
  const firstThu = new Date(Date.UTC(isoYear, 0, 4));
  const ftDay = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - ftDay + 3); // Donnerstag der Woche 1
  const week = 1 + Math.round((d - firstThu) / (7 * 86400000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

// Lokales Datum als 'YYYY-MM-DD'
function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateMinusDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return todayStr(d);
}

/* Selbst gezeichnetes Mehrlinien-Diagramm mit Scrubbing (SVG, ohne Bibliothek). */
function DevChart({ dates, lines }) {
  const [active, setActive] = useState(null);
  const W = 340, H = 210, padL = 34, padR = 12, padT = 12, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const all = lines.flatMap((l) => l.points.map((p) => p.rating));
  if (all.length === 0) return <p className="hint center">Keine Daten im gewählten Zeitraum.</p>;

  let yMin = Math.min(...all), yMax = Math.max(...all);
  const pad = Math.max(10, (yMax - yMin) * 0.12);
  yMin = Math.floor((yMin - pad) / 10) * 10;
  yMax = Math.ceil((yMax + pad) / 10) * 10;
  const nD = dates.length;
  const times = dates.map((ds) => new Date(ds + "T00:00:00").getTime());
  const minT = times[0], maxT = times[nD - 1];
  const spanT = (maxT - minT) || 1;
  const xFor = (i) => (nD <= 1 ? padL + plotW / 2 : padL + ((times[i] - minT) / spanT) * plotW);
  const yFor = (r) => padT + (1 - (r - yMin) / ((yMax - yMin) || 1)) * plotH;
  const yticks = [0, 1, 2, 3].map((i) => Math.round(yMin + ((yMax - yMin) * i) / 3));

  // Zeitachse: gleichmäßig verteilte Beschriftungen nach ECHTER Zeit
  const mmYY = (t) => { const d = new Date(t); return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`; };
  const nTicks = nD === 1 ? 1 : 5;
  const seenX = new Set();
  const xTicks = Array.from({ length: nTicks }, (_, k) => {
    const frac = nTicks === 1 ? 0 : k / (nTicks - 1);
    return { x: padL + frac * plotW, label: mmYY(minT + frac * spanT) };
  }).filter((t) => (seenX.has(t.label) ? false : (seenX.add(t.label), true)));

  const valAt = (l, i) => { const p = l.points.find((pp) => pp.i === i); return p ? p.rating : null; };

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vbX = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0, bd = Infinity;
    for (let i = 0; i < nD; i++) { const dx = Math.abs(xFor(i) - vbX); if (dx < bd) { bd = dx; best = i; } }
    setActive(best);
  };
  const down = (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); onMove(e); };
  const up = (e) => { e.currentTarget.releasePointerCapture?.(e.pointerId); setActive(null); };

  return (
    <div className="dev-wrap">
      <div className="dev-readout">
        {active == null ? (
          <span className="dev-hint">Zum Ablesen über den Graphen ziehen</span>
        ) : (
          <>
            <b>{fmtDate(new Date(dates[active] + "T00:00:00"))}</b>
            {lines.map((l) => {
              const v = valAt(l, active);
              return v == null ? null : (
                <span key={l.nickname} className="ro">
                  <span className="legend-dot" style={{ background: l.color }} />{Math.round(v)}
                </span>
              );
            })}
          </>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="dev-chart" role="img" aria-label="Rating-Verlauf"
        onPointerDown={down} onPointerMove={onMove} onPointerUp={up} onPointerLeave={() => setActive(null)} onPointerCancel={up}>
        {yticks.map((val) => (
          <g key={val}>
            <line x1={padL} y1={yFor(val)} x2={W - padR} y2={yFor(val)} className="grid" />
            <text x={padL - 5} y={yFor(val) + 3} className="ylabel">{val}</text>
          </g>
        ))}
        {xTicks.map((t, k) => (
          <text key={k} x={t.x} y={H - 8} className="xlabel">{t.label}</text>
        ))}
        {active != null && (
          <line x1={xFor(active)} y1={padT} x2={xFor(active)} y2={padT + plotH} className="crosshair" />
        )}
        {lines.map((l) => {
          const pts = l.points.map((p) => `${xFor(p.i)},${yFor(p.rating)}`).join(" ");
          const av = active != null ? valAt(l, active) : null;
          return (
            <g key={l.nickname}>
              <polyline points={pts} fill="none" stroke={l.color} strokeWidth="2.2"
                strokeLinejoin="round" strokeLinecap="round" />
              {l.points.length > 0 && (
                <circle cx={xFor(l.points.at(-1).i)} cy={yFor(l.points.at(-1).rating)} r="3" fill={l.color} />
              )}
              {av != null && (
                <circle cx={xFor(active)} cy={yFor(av)} r="4" fill={l.color} stroke="#0A2B21" strokeWidth="1.5" />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const RANGES = [
  { key: "1M", label: "1M", days: 31 },
  { key: "3M", label: "3M", days: 92 },
  { key: "6M", label: "6M", days: 183 },
  { key: "1J", label: "1J", days: 366 },
  { key: "ALL", label: "Alles", days: null },
];

function EntwicklungBlock({ snapshots, players, rangliste, me, colorOf, matches }) {
  const nickById = useMemo(() => {
    const m = {}; players.forEach((p) => { m[p.id] = p.nickname; }); return m;
  }, [players]);

  const gesamt = useMemo(() => rangliste.filter((r) => r.discipline === "Gesamt"), [rangliste]);
  const today = useMemo(() => todayStr(), []);

  const seriesByNick = useMemo(() => {
    const s = {};
    snapshots.forEach((r) => {
      const nick = nickById[r.player_id];
      if (!nick || !r.snap_date) return;
      (s[nick] ||= {})[r.snap_date] = r.rating;
    });
    // Live-Punkt heute aus aktuellen Ratings -> sofort sichtbar nach jedem Match
    gesamt.forEach((r) => { (s[r.nickname] ||= {})[today] = r.rating; });
    return s;
  }, [snapshots, nickById, gesamt, today]);

  const allDates = useMemo(() => {
    const set = new Set(snapshots.map((r) => r.snap_date).filter(Boolean));
    set.add(today);
    return [...set].sort();
  }, [snapshots, today]);
  const defaultSel = useMemo(() => {
    const names = gesamt.map((r) => r.nickname);
    const idx = names.indexOf(me.nickname);
    if (idx === -1) return names.slice(0, 5);
    const from = Math.max(0, idx - 2);
    return names.slice(from, from + 5);
  }, [gesamt, me]);

  // Wie oft habe ich gegen wen gespielt? (für Vorschläge)
  const freqByNick = useMemo(() => {
    const f = {};
    matches.forEach((m) => {
      let opp = null;
      if (m.p1.nickname === me.nickname) opp = m.p2.nickname;
      else if (m.p2.nickname === me.nickname) opp = m.p1.nickname;
      if (opp) f[opp] = (f[opp] || 0) + 1;
    });
    return f;
  }, [matches, me]);

  const [sel, setSel] = useState(defaultSel);
  const [rangeKey, setRangeKey] = useState("1J");
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => { setSel(defaultSel); }, [defaultSel]);

  const toggle = (nick) => {
    setSel((cur) => cur.includes(nick)
      ? cur.filter((x) => x !== nick)
      : (cur.length < 6 ? [...cur, nick] : cur));
  };

  const range = RANGES.find((r) => r.key === rangeKey) || RANGES.at(-1);
  const cutoff = range.days ? dateMinusDays(today, range.days) : null;
  const visibleDates = cutoff ? allDates.filter((d) => d >= cutoff) : allDates;

  const lines = sel
    .filter((nick) => seriesByNick[nick])
    .map((nick) => ({
      nickname: nick,
      color: colorOf(nick),
      points: visibleDates
        .map((dt, i) => (seriesByNick[nick][dt] != null ? { i, rating: seriesByNick[nick][dt] } : null))
        .filter(Boolean),
    }));

  // Vorschläge: erst häufigste Gegner, dann Rest – jeweils mit Verlaufsdaten & nicht gewählt
  const suggestions = useMemo(() => {
    const withData = players.map((p) => p.nickname).filter((n) => seriesByNick[n] && !sel.includes(n));
    const q = query.trim().toLowerCase();
    const filtered = q ? withData.filter((n) => n.toLowerCase().includes(q)) : withData;
    return filtered.sort((a, b) => (freqByNick[b] || 0) - (freqByNick[a] || 0) || a.localeCompare(b));
  }, [players, seriesByNick, sel, query, freqByNick]);

  const latest = (nick) => {
    const pts = seriesByNick[nick];
    if (!pts) return null;
    const dt = allDates.filter((w) => pts[w] != null).at(-1);
    return dt ? Math.round(pts[dt]) : null;
  };

  return (
    <section className="stat-block">
      <h3><TrendingUp size={17} /> Entwicklung über die Zeit</h3>
      {allDates.length === 0 ? (
        <p className="hint">Sobald Verlaufsdaten vorliegen, erscheinen hier die Kurven.</p>
      ) : (
        <>
          <div className="range-row">
            {RANGES.map((r) => (
              <button key={r.key} className={"range-btn" + (rangeKey === r.key ? " active" : "")}
                onClick={() => setRangeKey(r.key)}>{r.label}</button>
            ))}
          </div>
          <DevChart dates={visibleDates} lines={lines} />
          <div className="legend">
            {sel.map((nick) => (
              <button key={nick} className="legend-item" onClick={() => toggle(nick)} title="Entfernen">
                <span className="legend-dot" style={{ background: colorOf(nick) }} />
                {nick}{latest(nick) != null ? ` · ${latest(nick)}` : ""}
                <X size={12} />
              </button>
            ))}
          </div>

          {!addOpen ? (
            <button className="btn ghost" onClick={() => setAddOpen(true)}>
              <Plus size={16} /> Spieler hinzufügen
            </button>
          ) : (
            <div className="add-panel">
              <div className="search-row">
                <Search size={16} className="mail-ico" />
                <input placeholder="Spieler suchen …" value={query} autoFocus
                  onChange={(e) => setQuery(e.target.value)} />
                {query && <button className="clear-btn" onClick={() => setQuery("")}><X size={15} /></button>}
              </div>
              {!query && suggestions.length > 0 && (
                <p className="hint" style={{ marginTop: 0, marginBottom: 6 }}>
                  Deine häufigsten Mitspieler zuerst:
                </p>
              )}
              <div className="cand-row">
                {suggestions.slice(0, 12).map((n) => (
                  <button key={n} className="cand-chip" onClick={() => toggle(n)}>
                    <Plus size={13} /> {n}{freqByNick[n] ? ` (${freqByNick[n]})` : ""}
                  </button>
                ))}
                {suggestions.length === 0 && <p className="hint">Keine weiteren Spieler.</p>}
              </div>
              <button className="btn ghost" onClick={() => { setAddOpen(false); setQuery(""); }}>Fertig</button>
            </div>
          )}
          <p className="hint">Standardmäßig siehst du dich und deine direkten Nachbarn. Bis zu 6 Spieler, Zeitraum oben umschaltbar, zum Ablesen über den Graphen ziehen.</p>
        </>
      )}
    </section>
  );
}

function StatistikScreen({ matches, onOpenProfile, colorOf, badgeOf, snapshots, players, rangliste, me }) {
  const stats = useMemo(() => computeStats(matches), [matches]);
  const list = Object.values(stats);
  const medals = ["1.", "2.", "3."];
  const topWins = [...list].sort((a, b) => b.siege - a.siege).slice(0, 3);
  const topQuote = [...list].filter((p) => p.spiele >= 10).sort((a, b) => b.quote - a.quote).slice(0, 3);
  const topStreak = [...list].filter((p) => p.streak > 0).sort((a, b) => b.streak - a.streak).slice(0, 3);
  const lastMatches = [...matches].sort((a, b) => new Date(b.played_at) - new Date(a.played_at)).slice(0, 10);

  const Block = ({ icon, title, rows, fmt }) => (
    <section className="stat-block">
      <h3>{icon} {title}</h3>
      {rows.length === 0 && <p className="hint">Noch keine Daten.</p>}
      {rows.map((p, i) => (
        <button key={p.name} className="stat-row as-btn" onClick={() => onOpenProfile(p.name)}>
          <span className="medal">{medals[i]}</span>
          <Ball color={colorOf(p.name)} label={initials(p.name)} badge={badgeOf(p.name)} size={34} />
          <span className="stat-name">{p.name}</span>
          <span className="stat-val">{fmt(p)}</span>
        </button>
      ))}
    </section>
  );

  return (
    <div className="screen">
      <header className="screen-head"><h2>Statistik</h2><span className="head-note">Bestenlisten (bestaetigte Matches)</span></header>
      <EntwicklungBlock snapshots={snapshots} players={players} rangliste={rangliste} me={me} colorOf={colorOf} matches={matches} />
      <Block icon={<Trophy size={17} />} title="Meiste Siege" rows={topWins} fmt={(p) => `${p.siege} Siege`} />
      <Block icon={<BarChart3 size={17} />} title="Beste Siegquote (ab 10 Spielen)" rows={topQuote} fmt={(p) => `${p.quote} %`} />
      <Block icon={<Flame size={17} />} title="Aktuelle Serien" rows={topStreak} fmt={(p) => `${p.streak} in Folge`} />
      <section className="stat-block">
        <h3><Swords size={17} /> Letzte Matches</h3>
        {lastMatches.map((m) => (
          <div key={m.id} className="match-row">
            <span className="m-date">{fmtDate(m.played_at).slice(0, 6)}</span>
            <span className="m-txt">{m.p1.nickname} <b>{m.score1}:{m.score2}</b> {m.p2.nickname}</span>
            <span className="m-disc">{m.discipline}</span>
          </div>
        ))}
        {lastMatches.length === 0 && <p className="hint">Noch keine bestaetigten Matches.</p>}
      </section>
    </div>
  );
}

/* ============================================================
   PROFIL (inkl. Bearbeitung des eigenen Profils)
   ============================================================ */

function ProfilScreen({ nickname, matches, rangliste, onBack, isMe, onLogout, colorOf, badgeOf,
  players, meRow, onSaveProfile, onOpenAdmin, earnedBadges, onSelectBadge, catalog, onInvite, toast }) {
  const catalogByCategory = useMemo(() => {
    const groups = {};
    [...catalog].sort((a, b) => a.sort - b.sort).forEach((b) => {
      (groups[b.category] ||= []).push(b);
    });
    return Object.entries(groups);
  }, [catalog]);
  const [edit, setEdit] = useState(false);
  const [nick, setNick] = useState(nickname);
  const [color, setColor] = useState(meRow?.avatar_color || null);
  const [motto, setMotto] = useState(meRow?.motto || "");
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => computeStats(matches)[nickname], [matches, nickname]);
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
          <h2>Profil bearbeiten</h2>
        </header>

        <section className="stat-block">
          <label className="field-label" htmlFor="pnick">Nickname</label>
          <div className="mail-row">
            <User size={18} className="mail-ico" />
            <input id="pnick" value={nick} maxLength={30} onChange={(e) => setNick(e.target.value)} />
          </div>
          {taken && <p className="nick-status err"><X size={14} /> Dieser Name ist schon vergeben.</p>}
          {!taken && cleanNick !== nickname && nickValid && (
            <p className="nick-status ok"><Check size={14} /> "{cleanNick}" ist frei.</p>
          )}

          <label className="field-label">Deine Kugel</label>
          <div className="swatch-row">
            <button className={"swatch auto" + (color === null ? " sel" : "")}
              onClick={() => setColor(null)} aria-label="Automatische Farbe">Auto</button>
            {BALL_PALETTE.map((c) => (
              <button key={c} className={"swatch" + (color === c ? " sel" : "")}
                style={{ background: c }} onClick={() => setColor(c)} aria-label={`Farbe ${c}`}>
                {color === c && <Check size={16} />}
              </button>
            ))}
            {/* Eigene Wunschfarbe per Farb-Picker */}
            <label className={"swatch picker" + (color && !BALL_PALETTE.includes(color) ? " sel" : "")}
              style={color && !BALL_PALETTE.includes(color) ? { background: color } : undefined}
              title="Eigene Farbe wählen">
              {color && !BALL_PALETTE.includes(color)
                ? <Check size={16} />
                : <Pencil size={15} />}
              <input type="color" className="color-input"
                value={color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : hashColor(cleanNick || nickname)}
                onChange={(e) => setColor(e.target.value)}
                aria-label="Eigene Kugelfarbe wählen" />
            </label>
          </div>
          <div className="swatch-preview">
            <Ball color={color || hashColor(cleanNick || nickname)} label={initials(cleanNick || nickname)} size={56} />
            <span className="hint" style={{ marginTop: 0 }}>
              So sehen dich die anderen.{color && !BALL_PALETTE.includes(color) ? ` Deine Farbe: ${color.toUpperCase()}` : ""}
            </span>
          </div>

          <label className="field-label" htmlFor="pmotto">Motto (optional)</label>
          <div className="mail-row">
            <Pencil size={18} className="mail-ico" />
            <input id="pmotto" value={motto} maxLength={80}
              placeholder="z. B. 'Die 9 faellt immer'" onChange={(e) => setMotto(e.target.value)} />
          </div>

          <button className="btn primary" disabled={!nickValid || busy} onClick={save}>
            {busy ? "Speichere ..." : <>Speichern <Check size={18} /></>}
          </button>
          {cleanNick !== nickname && (
            <p className="hint">Hinweis: Dein Name aendert sich ueberall - auch in alten Matches und der Rangliste.</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="screen-head with-back">
        {onBack && <button className="back-btn" onClick={onBack} aria-label="Zurueck"><ChevronLeft size={22} /></button>}
        <h2>{isMe ? "Mein Profil" : "Spielerprofil"}</h2>
      </header>

      <div className="profile-hero">
        <Ball color={colorOf(nickname)} label={initials(nickname)} badge={badgeOf(nickname)} size={72} />
        <div style={{ minWidth: 0 }}>
          <h3 className="p-name">{nickname}</h3>
          <div className="p-rating">
            {gesamt ? gesamt.rating : "-"}
            {gesamt?.vorlaeufig && <span className="prov-badge">vorlaeufig</span>}
          </div>
          {playerObj?.motto && <p className="p-motto">"{playerObj.motto}"</p>}
        </div>
      </div>

      {isMe && (
        <button className="btn ghost" style={{ marginBottom: 14 }} onClick={() => {
          setNick(nickname); setColor(meRow?.avatar_color || null); setMotto(meRow?.motto || ""); setEdit(true);
        }}>
          <Pencil size={15} /> Profil bearbeiten
        </button>
      )}

      <div className="kpis">
        <div className="kpi"><b>{stats?.spiele ?? 0}</b><span>Spiele</span></div>
        <div className="kpi"><b>{stats?.siege ?? 0}</b><span>Siege</span></div>
        <div className="kpi"><b>{stats?.quote ?? 0} %</b><span>Quote</span></div>
        <div className="kpi"><b>{stats ? (stats.streak > 0 ? `+${stats.streak}` : stats.streak) : 0}</b><span>Serie</span></div>
      </div>

      <section className="stat-block">
        <h3><Trophy size={17} /> Ratings nach Disziplin</h3>
        {myRows.map((r) => (
          <div key={r.discipline} className="stat-row">
            <span className="stat-name">{r.discipline}</span>
            <span className="rank-meta" style={{ marginRight: 10 }}>{r.spiele} Spiele</span>
            <span className="stat-val">{r.rating}</span>
          </div>
        ))}
        {myRows.length === 0 && <p className="hint">Noch kein Rating - erst ein Match spielen!</p>}
      </section>

      <section className="stat-block">
        <h3><Award size={17} /> Erfolge ({earnedBadges.size} / {catalog.length})</h3>
        {isMe && (
          <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
            Tippe einen freigeschalteten Erfolg an, um ihn als Avatar zu zeigen.
          </p>
        )}
        {catalogByCategory.map(([cat, items]) => {
          // im eigenen Profil: versteckte, noch nicht erreichte Badges ausblenden.
          // in fremden Profilen: nur erreichte zeigen.
          const visible = items.filter((b) => {
            const earned = earnedBadges.has(b.badge_key);
            if (!isMe) return earned;
            if (b.secret && !earned) return false;
            return true;
          });
          if (visible.length === 0) return null;
          return (
            <div key={cat} className="badge-cat">
              <div className="badge-cat-title">{cat}</div>
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
                      title={b.description}>
                      <span className="badge-emoji">{earned ? b.emoji : <Lock size={18} />}</span>
                      <span className="badge-name">{b.name}</span>
                      <span className="badge-desc">{b.description}</span>
                      {selected && <span className="badge-active">Als Avatar aktiv</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {isMe && meRow?.selected_badge && (
          <button className="btn ghost" onClick={() => onSelectBadge(null)}>
            Wieder meine Kugel zeigen
          </button>
        )}
        {!isMe && earnedBadges.size === 0 && <p className="hint">Noch keine Erfolge freigeschaltet.</p>}
      </section>

      <section className="stat-block">
        <h3><Swords size={17} /> Head-to-Head (Match-Siege)</h3>
        {h2h.map(({ opp, w, l }) => (
          <div key={opp} className="h2h-row">
            <Ball color={colorOf(opp)} label={initials(opp)} badge={badgeOf(opp)} size={34} />
            <span className="stat-name">{opp}</span>
            <div className="h2h-bar"><div className="h2h-w" style={{ width: `${(100 * w) / Math.max(1, w + l)}%` }} /></div>
            <span className="h2h-score">{w}:{l}</span>
          </div>
        ))}
        {h2h.length === 0 && <p className="hint">Noch keine Matches.</p>}
      </section>

      {isMe && <PasswordSection toast={toast} />}

      {isMe && (
        <button className="btn ghost" onClick={onInvite}><QrCode size={16} /> Freund einladen</button>
      )}
      {isMe && meRow?.role === "admin" && (
        <button className="btn ghost" onClick={onOpenAdmin}><Shield size={16} /> Verwaltung oeffnen</button>
      )}
      {isMe && (
        <button className="btn ghost" onClick={onLogout}><LogOut size={16} /> Abmelden</button>
      )}
    </div>
  );
}

/* ============================================================
   PASSWORT SETZEN / ÄNDERN
   ============================================================ */

function PasswordSection({ toast }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email || ""));
  }, []);

  const save = async () => {
    setMsg("");
    if (pw.length < 6) { setMsg("Mindestens 6 Zeichen."); return; }
    if (pw !== pw2) { setMsg("Die Passwörter stimmen nicht überein."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg("Fehler: " + error.message); return; }
    setPw(""); setPw2(""); setOpen(false);
    toast("Passwort gespeichert – du kannst dich künftig damit anmelden.");
  };

  return (
    <section className="stat-block">
      <h3><Lock size={17} /> Anmeldung &amp; Sicherheit</h3>
      {email && <p className="hint" style={{ marginTop: 0 }}>Angemeldet als <b>{email}</b></p>}
      {!open ? (
        <button className="btn ghost" onClick={() => setOpen(true)}>Passwort festlegen / ändern</button>
      ) : (
        <div className="pw-box">
          <input type="password" placeholder="Neues Passwort (min. 6 Zeichen)" value={pw}
            autoComplete="new-password" onChange={(e) => setPw(e.target.value)} />
          <input type="password" placeholder="Passwort wiederholen" value={pw2}
            autoComplete="new-password" onChange={(e) => setPw2(e.target.value)} />
          {msg && <p className="nick-status err"><X size={14} /> {msg}</p>}
          <div className="sp-controls">
            <button className="btn ghost" onClick={() => { setOpen(false); setPw(""); setPw2(""); setMsg(""); }}>Abbrechen</button>
            <button className="btn primary" disabled={busy || !pw || !pw2} onClick={save}>
              {busy ? "..." : "Speichern"}
            </button>
          </div>
          <p className="hint">Damit meldest du dich künftig mit E-Mail + Passwort an. Passwort vergessen?
            Der Magic-Link bringt dich immer rein.</p>
        </div>
      )}
    </section>
  );
}

/* ============================================================
   FREUND EINLADEN (QR + Link)
   ============================================================ */

function InviteScreen({ me, onBack, toast }) {
  const [code, setCode] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("my_invite_code");
      if (error) setError(error.message);
      else setCode(data);
    })();
  }, []);

  const link = code ? `${window.location.origin}/?ref=${code}` : "";

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Break & Rank",
          text: `${me.nickname} lädt dich zum Billard-Ranking ein! Tippe auf den Link, um mitzumachen:`,
          url: link,
        });
      } catch { /* abgebrochen */ }
    } else {
      copy();
    }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast("Link kopiert!"); }
    catch { toast("Kopieren nicht möglich – Link markieren und kopieren."); }
  };

  return (
    <div className="screen">
      <header className="screen-head with-back">
        <button className="back-btn" onClick={onBack} aria-label="Zurück"><ChevronLeft size={22} /></button>
        <h2>Freund einladen</h2>
      </header>

      {error && <p className="nick-status err"><X size={14} /> {error}</p>}

      <section className="stat-block invite-card">
        <p className="invite-lead">Neuer Spieler? Einfach diesen Code mit der Handykamera scannen –
          das öffnet die App und führt direkt zur Anmeldung.</p>
        <div className="qr-box">
          {code ? (
            <QRCodeSVG value={link} size={210} level="M"
              bgColor="#F2EDE0" fgColor="#0A2B21" includeMargin />
          ) : (
            <div className="qr-loading">Code wird erstellt …</div>
          )}
        </div>
        {code && <div className="invite-code">Code: <b>{code}</b></div>}
      </section>

      <button className="btn primary" onClick={share} disabled={!code}>
        <Share2 size={18} /> Einladung teilen
      </button>
      <button className="btn ghost" onClick={copy} disabled={!code}>
        <Copy size={16} /> Link kopieren
      </button>
      <p className="hint">Wer über deinen Code beitritt, wird dir als geworbener Spieler gutgeschrieben –
        dafür gibt es später eigene Erfolge.</p>
    </div>
  );
}

/* ============================================================
   ADMIN
   ============================================================ */

function AdminScreen({ allPending, players, onConfirm, me, onBack, colorOf, badgeOf, toast, onReload }) {
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_refresh_stats");
    setBusy(false);
    if (error) { toast("Fehler: " + error.message); return; }
    if (onReload) await onReload();
    toast("Statistik neu berechnet.");
  };
  return (
    <div className="screen">
      <header className="screen-head with-back">
        <button className="back-btn" onClick={onBack} aria-label="Zurueck"><ChevronLeft size={22} /></button>
        <h2>Verwaltung</h2>
      </header>

      <section className="stat-block">
        <h3><RotateCcw size={17} /> Statistik</h3>
        <p className="hint" style={{ marginTop: 0 }}>Rechnet Ratings, Verlauf und Erfolge sofort neu –
          nützlich nach nachträglich eingetragenen Matches. Kann ein paar Sekunden dauern.</p>
        <button className="btn primary" disabled={busy} onClick={refresh}>
          {busy ? "Rechne neu …" : <><RotateCcw size={16} /> Statistik jetzt aktualisieren</>}
        </button>
      </section>

      <section className="stat-block">
        <h3><Check size={17} /> Offene Matches ({allPending.length})</h3>
        {allPending.length === 0 && <p className="hint">Alles erledigt - keine offenen Matches.</p>}
        {allPending.map((m) => (
          <div key={m.id} className="pending-row">
            <span className="m-date">{fmtDate(m.played_at).slice(0, 6)}</span>
            <span className="m-txt">{m.p1.nickname} <b>{m.score1}:{m.score2}</b> {m.p2.nickname} - {m.discipline}</span>
            <div className="confirm-actions">
              <button className="chip-btn ok" onClick={() => onConfirm(m.id, true)} aria-label="freigeben"><Check size={15} /></button>
              <button className="chip-btn no" onClick={() => onConfirm(m.id, false)} aria-label="verwerfen"><X size={15} /></button>
            </div>
          </div>
        ))}
      </section>

      <section className="stat-block">
        <h3><User size={17} /> Mitglieder ({players.length})</h3>
        {players.map((p) => (
          <div key={p.id} className="user-row">
            <Ball color={colorOf(p.nickname)} label={initials(p.nickname)} badge={badgeOf(p.nickname)} size={34} />
            <span className="stat-name">{p.nickname}{p.id === me.id ? " (du)" : ""}</span>
            {!p.auth_user_id && <span className="role-chip">ohne Login</span>}
            {p.role === "admin" && <span className="role-chip admin">admin</span>}
          </div>
        ))}
        <p className="hint">Neue Mitglieder registrieren sich selbst: einfach den App-Link teilen.
          Rollen und Korrekturen verwaltest du vorerst im Supabase Table Editor.</p>
      </section>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [player, setPlayer] = useState(null);
  const [playerChecked, setPlayerChecked] = useState(false);
  const [players, setPlayers] = useState([]);
  const [rangliste, setRangliste] = useState([]);
  const [matches, setMatches] = useState([]);
  const [unconfirmed, setUnconfirmed] = useState([]);
  const [pings, setPings] = useState([]);
  const [badgesByPlayer, setBadgesByPlayer] = useState({}); // playerId -> Set(badge_key)
  const [catalog, setCatalog] = useState([]);               // badge_catalog Zeilen
  const [snapshots, setSnapshots] = useState([]);           // rating_snapshots (Verlauf)
  const [tab, setTab] = useState("rang");
  const [profileName, setProfileName] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setPlayer(null); setPlayerChecked(false); return; }
    (async () => {
      const { data } = await supabase.from("players").select("*")
        .eq("auth_user_id", session.user.id).maybeSingle();
      setPlayer(data ?? null);
      setPlayerChecked(true);
      const { data: all } = await supabase.from("players")
        .select("id, nickname, role, auth_user_id, avatar_color, motto, selected_badge, is_ghost");
      setPlayers(all ?? []);
    })();
  }, [session]);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    const [rang, m, pl, pi, bg, ct] = await Promise.all([
      supabase.from("rangliste").select("*"),
      fetchAllRows((from, to) => supabase.from("matches")
        .select("id, played_at, score1, score2, discipline, confirmed, reported_by, player1_id, player2_id, p1:players!matches_player1_id_fkey(nickname), p2:players!matches_player2_id_fkey(nickname)")
        .order("played_at", { ascending: false })
        .range(from, to)),
      supabase.from("players").select("id, nickname, role, auth_user_id, avatar_color, motto, selected_badge, is_ghost"),
      supabase.from("pings")
        .select("id, location, message, created_at, expires_at, player_id, player:players!pings_player_id_fkey(nickname), replies:ping_replies(id, message, created_at, player_id, player:players!ping_replies_player_id_fkey(nickname))")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
      supabase.from("player_badges").select("player_id, badge_key"),
      supabase.from("badge_catalog").select("*"),
    ]);
    // Snapshots seitenweise laden (können > 1000 Zeilen sein: Wochen x Spieler)
    const snap = await fetchAllRows((from, to) => supabase.from("rating_snapshots")
      .select("player_id, snap_date, iso_week, rating, rank, provisional")
      .eq("discipline", "Gesamt")
      .order("snap_date", { ascending: true })
      .range(from, to));
    const err = rang.error || m.error || pl.error || pi.error || bg.error || ct.error || snap.error;
    if (err) toast("Fehler beim Laden: " + err.message);
    setRangliste(rang.data ?? []);
    setMatches((m.data ?? []).filter((x) => x.confirmed));
    setUnconfirmed((m.data ?? []).filter((x) => !x.confirmed));
    setPlayers(pl.data ?? []);
    setPings(pi.data ?? []);
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
    setSnapshots(snap.data ?? []);
    setLoadingData(false);
  }, [toast]);

  useEffect(() => { if (player) loadData(); }, [player, loadData]);

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

  const badgesOfId = useCallback((id) => badgesByPlayer[id] || new Set(), [badgesByPlayer]);

  const pendingForMe = player
    ? unconfirmed.filter((m) => (m.player1_id === player.id || m.player2_id === player.id) && m.reported_by !== player.id)
    : [];
  const myOpenReports = player
    ? unconfirmed.filter((m) => m.reported_by === player.id)
    : [];

  const confirmMatch = async (id, ok) => {
    const { error } = await supabase.rpc("confirm_match", { p_match_id: id, p_ok: ok });
    if (error) toast("Fehler: " + error.message);
    else toast(ok ? "Match bestaetigt - Ranking wird neu berechnet." : "Match zurueckgewiesen.");
    loadData();
  };

  const selectBadge = async (badgeKey) => {
    const { data, error } = await supabase.rpc("select_badge", { p_badge_key: badgeKey });
    if (error) { toast("Fehler: " + error.message); return; }
    setPlayer(data);
    toast(badgeKey ? "Erfolg als Avatar gesetzt." : "Wieder deine Kugel.");
    loadData();
  };

  const saveProfile = async (nick, color, motto) => {
    const { data, error } = await supabase.rpc("update_profile", {
      p_nickname: nick, p_avatar_color: color, p_motto: motto || null,
    });
    if (error) { toast("Fehler: " + error.message); return false; }
    setPlayer(data);
    toast("Profil gespeichert.");
    loadData();
    return true;
  };

  const createPing = async (loc, msg, hours) => {
    const { error } = await supabase.rpc("create_ping", {
      p_location: loc.trim(), p_message: msg.trim() || null, p_hours: hours,
    });
    if (error) toast("Fehler: " + error.message);
    else toast("Du bist jetzt live!");
    loadData();
  };
  const closePing = async () => {
    const { error } = await supabase.rpc("close_ping");
    if (error) toast("Fehler: " + error.message);
    else toast("Live-Eintrag beendet.");
    loadData();
  };
  const replyPing = async (id, msg) => {
    const { error } = await supabase.rpc("reply_ping", { p_ping_id: id, p_message: msg.trim() || null });
    if (error) toast("Fehler: " + error.message);
    else toast("Zusage gesendet!");
    loadData();
  };
  const unreplyPing = async (id) => {
    const { error } = await supabase.rpc("unreply_ping", { p_ping_id: id });
    if (error) toast("Fehler: " + error.message);
    loadData();
  };

  const openProfile = (nick) => { setProfileName(nick); setTab("fremdprofil"); };
  const logout = async () => { await supabase.auth.signOut(); setTab("rang"); };

  if (!authReady) {
    return (<div className="stage"><style>{CSS}</style><div className="phone"><div className="center-load">Lade ...</div></div></div>);
  }

  return (
    <div className="stage">
      <style>{CSS}</style>
      <div className="phone">
        {!session && <LoginScreen />}

        {session && !playerChecked && <div className="center-load">Lade Profil ...</div>}

        {session && playerChecked && !player && (
          <NicknameScreen existingPlayers={players}
            onRegistered={(p) => { setPlayer(p); toast(`Willkommen, ${p.nickname}!`); }} />
        )}

        {session && player && (
          <>
            <main className={"content" + (tab === "match" ? " no-tabbar" : "")}>
              {tab === "rang" && (
                <RanglisteScreen rangliste={rangliste} disciplines={disciplines}
                  pending={pendingForMe} me={player} onConfirm={confirmMatch}
                  onOpenProfile={openProfile} myOpenReports={myOpenReports}
                  colorOf={colorOf} badgeOf={badgeOf} />
              )}
              {tab === "live" && (
                <LiveScreen me={player} pings={pings} colorOf={colorOf} badgeOf={badgeOf}
                  onCreate={createPing} onClose={closePing}
                  onReply={replyPing} onUnreply={unreplyPing} />
              )}
              {tab === "match" && (
                <MatchScreen me={player} players={players} matches={matches} disciplines={disciplines}
                  ratingOf={ratingOf} toast={toast} colorOf={colorOf} badgeOf={badgeOf}
                  onReload={loadData}
                  onDone={() => { setTab("rang"); loadData(); }}
                  onCancel={() => setTab("rang")} />
              )}
              {tab === "stats" && <StatistikScreen matches={matches} onOpenProfile={openProfile}
                colorOf={colorOf} badgeOf={badgeOf} snapshots={snapshots} players={players}
                rangliste={rangliste} me={player} />}
              {tab === "profil" && (
                <ProfilScreen nickname={player.nickname} matches={matches} rangliste={rangliste}
                  onBack={null} isMe onLogout={logout} colorOf={colorOf} badgeOf={badgeOf}
                  players={players} meRow={player} onSaveProfile={saveProfile}
                  earnedBadges={badgesOfId(player.id)} onSelectBadge={selectBadge} catalog={catalog}
                  onOpenAdmin={() => setTab("admin")} onInvite={() => setTab("invite")} toast={toast} />
              )}
              {tab === "fremdprofil" && profileName && (
                <ProfilScreen nickname={profileName} matches={matches} rangliste={rangliste}
                  onBack={() => setTab("rang")} isMe={profileName === player.nickname}
                  onLogout={logout} colorOf={colorOf} badgeOf={badgeOf}
                  players={players} meRow={player} onSaveProfile={saveProfile}
                  earnedBadges={badgesOfId((players.find((x) => x.nickname === profileName) || {}).id)}
                  onSelectBadge={selectBadge} catalog={catalog}
                  onOpenAdmin={() => setTab("admin")} onInvite={() => setTab("invite")} toast={toast} />
              )}
              {tab === "admin" && player.role === "admin" && (
                <AdminScreen allPending={unconfirmed} players={players} onConfirm={confirmMatch}
                  me={player} onBack={() => setTab("profil")} colorOf={colorOf} badgeOf={badgeOf}
                  toast={toast} onReload={loadData} />
              )}
              {tab === "invite" && (
                <InviteScreen me={player} onBack={() => setTab("profil")} toast={toast} />
              )}
              <button className="refresh-btn" onClick={loadData} aria-label="Aktualisieren">
                <RefreshCw size={16} className={loadingData ? "spin" : ""} />
              </button>
            </main>

            {tab !== "match" && (
            <nav className="tabbar">
              <button className={"tab" + (tab === "rang" || tab === "fremdprofil" ? " on" : "")} onClick={() => setTab("rang")}>
                <Trophy size={21} /><span>Rangliste</span>
                {pendingForMe.length > 0 && <span className="badge">{pendingForMe.length}</span>}
              </button>
              <button className={"tab" + (tab === "live" ? " on" : "")} onClick={() => setTab("live")}>
                <Radio size={21} /><span>Live</span>
                {pings.length > 0 && <span className="badge live">{pings.length}</span>}
              </button>
              <button className="tab fab" onClick={() => setTab("match")} aria-label="Neues Match">
                <Plus size={26} />
              </button>
              <button className={"tab" + (tab === "stats" ? " on" : "")} onClick={() => setTab("stats")}>
                <BarChart3 size={21} /><span>Statistik</span>
              </button>
              <button className={"tab" + (tab === "profil" || tab === "admin" ? " on" : "")} onClick={() => setTab("profil")}>
                <User size={21} /><span>Profil</span>
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

/* ============================================================
   STYLES
   ============================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;800&family=Archivo:wght@400;500;600;700&display=swap');

:root {
  --felt: #0A2B21; --felt-2: #10382C; --felt-3: #17493A;
  --line: #24564660; --chalk: #7CC1E8; --chalk-deep: #3E82B4;
  --ivory: #F2EDE0; --ivory-dim: #9DBAAE; --gold: #D6A425;
  --win: #4CAF6E; --loss: #D9614C;
}
* { box-sizing: border-box; margin: 0; }
html, body { background: #071E17; }
.stage { min-height: 100vh; display: flex; justify-content: center;
  background: radial-gradient(120% 90% at 50% 0%, #123829 0%, #071E17 70%);
  font-family: 'Archivo', system-ui, sans-serif; color: var(--ivory); }
.phone { width: 100%; max-width: 430px; min-height: 100vh; position: relative;
  background: radial-gradient(140% 100% at 50% -10%, var(--felt-2) 0%, var(--felt) 60%);
  display: flex; flex-direction: column; box-shadow: 0 0 60px #00000070; }
.content { flex: 1; overflow-y: auto; padding-bottom: 92px; }
.content.no-tabbar { padding-bottom: 24px; }
.screen { padding: 22px 18px 28px; }
.center-load { flex: 1; display: grid; place-items: center; color: var(--ivory-dim); min-height: 60vh; }

h1, h2, h3 { font-family: 'Bricolage Grotesque', 'Archivo', sans-serif; }
.screen-head { margin-bottom: 16px; }
.screen-head h2 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
.screen-head.with-back { display: flex; align-items: center; gap: 10px; }
.head-note { font-size: 12.5px; color: var(--ivory-dim); }
.back-btn { background: var(--felt-3); border: none; color: var(--ivory); border-radius: 12px;
  width: 38px; height: 38px; display: grid; place-items: center; cursor: pointer; }

.ball { position: relative; border-radius: 50%; flex-shrink: 0;
  box-shadow: inset -4px -6px 10px #00000055, 0 2px 5px #00000060; }
.ball-shine { position: absolute; top: 12%; left: 16%; width: 34%; height: 26%;
  background: radial-gradient(closest-side, #FFFFFFCC, transparent); border-radius: 50%; }
.ball-num { position: absolute; inset: 0; margin: auto; background: var(--ivory);
  border-radius: 50%; display: grid; place-items: center; color: #1E1E1E;
  font-weight: 700; font-family: 'Bricolage Grotesque', sans-serif;
  box-shadow: inset 0 -2px 4px #00000025; }
.ball-badge { position: absolute; inset: 0; display: grid; place-items: center;
  line-height: 1; filter: drop-shadow(0 1px 2px #00000060); }
.ball-badge.on-light { filter: drop-shadow(0 1px 2px #ffffff80) drop-shadow(0 0 1px #00000070); }

.badge-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 4px; }
.badge-cat { margin-bottom: 14px; }
.badge-cat-title { font-size: 12px; font-weight: 700; color: var(--ivory-dim);
  text-transform: uppercase; letter-spacing: 0.06em; margin: 4px 0 8px; }

.dev-chart { width: 100%; height: auto; display: block; margin-bottom: 10px; touch-action: none; }
.dev-chart .grid { stroke: var(--line); stroke-width: 1; }
.dev-chart .ylabel { fill: var(--ivory-dim); font-size: 9px; text-anchor: end; }
.dev-chart .xlabel { fill: var(--ivory-dim); font-size: 9px; text-anchor: middle; }
.dev-chart .crosshair { stroke: var(--ivory-dim); stroke-width: 1; stroke-dasharray: 3 3; }
.dev-wrap { }
.dev-readout { display: flex; align-items: center; gap: 10px; min-height: 22px; margin-bottom: 4px;
  font-size: 13px; flex-wrap: wrap; }
.dev-readout b { font-family: 'Bricolage Grotesque', sans-serif; font-size: 13px; }
.dev-readout .ro { display: inline-flex; align-items: center; gap: 5px; font-weight: 700;
  font-family: 'Bricolage Grotesque', sans-serif; }
.dev-hint { color: var(--ivory-dim); font-size: 12px; }
.range-row { display: flex; gap: 6px; margin-bottom: 8px; }
.range-btn { flex: 1; border: 1px solid var(--line); background: transparent; color: var(--ivory-dim);
  border-radius: 10px; padding: 6px 0; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
.range-btn.active { background: var(--chalk); color: #08251C; border-color: var(--chalk); }
.invite-card { text-align: center; }
.invite-lead { font-size: 13.5px; color: var(--ivory-dim); line-height: 1.5; margin-bottom: 14px; }
.qr-box { display: grid; place-items: center; background: #F2EDE0; border-radius: 16px;
  padding: 16px; width: fit-content; margin: 0 auto; }
.qr-loading { width: 210px; height: 210px; display: grid; place-items: center; color: #0A2B21; font-size: 13px; }
.invite-code { margin-top: 12px; font-size: 14px; color: var(--ivory-dim); letter-spacing: 0.04em; }
.invite-code b { color: var(--ivory); font-family: 'Bricolage Grotesque', sans-serif; font-size: 18px; letter-spacing: 0.12em; }
.invite-note { display: inline-flex; align-items: center; gap: 6px; margin-top: 14px;
  font-size: 13px; color: var(--win); font-weight: 600; }
.auth-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
.auth-tab { flex: 1; padding: 9px 0; border: 1px solid var(--line); background: transparent;
  color: var(--ivory-dim); border-radius: 10px; font-size: 13.5px; font-weight: 700;
  cursor: pointer; font-family: inherit; }
.auth-tab.on { background: var(--chalk); color: #08251C; border-color: var(--chalk); }
.pw-box { display: flex; flex-direction: column; gap: 8px; }
.pw-box input { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line);
  background: var(--felt-2); color: var(--ivory); font-size: 15px; font-family: inherit; }
.add-panel { margin-top: 8px; }
.legend { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.legend-item { display: inline-flex; align-items: center; gap: 6px; background: var(--felt);
  border: 1px solid var(--line); border-radius: 999px; padding: 5px 10px; font-size: 12.5px;
  font-weight: 600; color: var(--ivory); cursor: pointer; font-family: inherit; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.cand-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.cand-chip { display: inline-flex; align-items: center; gap: 4px; background: var(--felt-3);
  border: 1px solid var(--line); border-radius: 999px; padding: 6px 11px; font-size: 12.5px;
  font-weight: 600; color: var(--ivory); cursor: pointer; font-family: inherit; }
.badge-chip { display: flex; flex-direction: column; align-items: center; gap: 3px;
  background: var(--felt); border: 1px solid var(--line); border-radius: 14px;
  padding: 12px 6px 10px; cursor: pointer; font-family: inherit; color: var(--ivory);
  text-align: center; }
.badge-chip.locked { opacity: 0.42; cursor: default; }
.badge-chip.earned { border-color: #2C5547; }
.badge-chip.selected { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold); background: #17493A; }
.badge-emoji { font-size: 26px; line-height: 1; height: 30px; display: grid; place-items: center;
  color: var(--ivory-dim); }
.badge-name { font-size: 12px; font-weight: 700; }
.badge-desc { font-size: 10px; color: var(--ivory-dim); line-height: 1.3; }
.badge-active { font-size: 9.5px; font-weight: 700; color: var(--gold); margin-top: 2px; }

.chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 10px; }
.chip { border: 1px solid var(--line); background: transparent; color: var(--ivory-dim);
  border-radius: 999px; padding: 7px 14px; font-size: 13.5px; cursor: pointer;
  white-space: nowrap; font-family: inherit; }
.chip.active { background: var(--chalk); color: #08251C; border-color: var(--chalk); font-weight: 600; }

.ranking { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.rank-row { width: 100%; display: flex; align-items: center; gap: 12px; text-align: left;
  background: var(--felt-2); border: 1px solid var(--line); border-radius: 16px;
  padding: 11px 14px; color: inherit; cursor: pointer; font-family: inherit; }
.rank-row:active { background: var(--felt-3); }
.rank-pos { width: 22px; font-weight: 700; color: var(--ivory-dim); font-size: 15px; }
.rank-pos.top { color: var(--gold); }
.rank-name { flex: 1; font-weight: 600; font-size: 15.5px; display: flex; flex-direction: column; min-width: 0; }
.rank-meta { font-weight: 400; font-size: 12px; color: var(--ivory-dim); }
.prov { color: var(--gold); font-style: normal; }
.inactive { color: var(--loss); font-style: normal; }
.rank-rating { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 21px;
  min-width: 46px; text-align: right; }
.footnote { margin-top: 14px; font-size: 12px; color: var(--ivory-dim); line-height: 1.5; }
.open-note { display: flex; align-items: center; gap: 6px; font-size: 12.5px;
  color: var(--ivory-dim); margin-bottom: 12px; }

.confirm-banner { background: #3E82B422; border: 1px solid var(--chalk-deep);
  border-radius: 14px; padding: 12px 14px; font-size: 13.5px; margin-bottom: 14px;
  display: flex; flex-direction: column; gap: 10px; line-height: 1.45; }
.confirm-actions { display: flex; gap: 8px; }
.chip-btn { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px;
  padding: 6px 13px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; }
.chip-btn.ok { background: var(--win); color: #06231A; }
.chip-btn.no { background: transparent; border: 1px solid var(--loss); color: var(--loss); }

.steps { display: flex; gap: 6px; margin-bottom: 20px; }
.step-dot { flex: 1; text-align: center; font-size: 11px; color: var(--ivory-dim);
  display: flex; flex-direction: column; align-items: center; gap: 5px; }
.step-dot span { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center;
  background: var(--felt-3); font-weight: 700; font-size: 12px; }
.step-dot.cur span { background: var(--chalk); color: #08251C; }
.step-dot.done span { background: var(--win); color: #06231A; }
.q { font-size: 17px; font-weight: 600; margin-bottom: 14px; }
.q-sub { font-weight: 400; font-size: 13px; color: var(--ivory-dim); }
.opp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.opp-card { background: var(--felt-2); border: 1px solid var(--line); border-radius: 16px;
  padding: 14px 6px 12px; display: flex; flex-direction: column; align-items: center; gap: 8px;
  color: var(--ivory); font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit;
  word-break: break-word; }
.opp-card.sel, .opp-card:active { border-color: var(--chalk); background: var(--felt-3); }
.score-row { display: flex; gap: 12px; margin-bottom: 20px; }
.score-col { flex: 1; background: var(--felt-2); border: 1px solid var(--line); border-radius: 18px;
  padding: 16px 10px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.score-name { font-size: 13px; font-weight: 600; text-align: center; }
.score-num { font-family: 'Bricolage Grotesque', sans-serif; font-size: 52px; font-weight: 800; line-height: 1; }
.score-btns { display: flex; gap: 10px; }
.round-btn { width: 46px; height: 46px; border-radius: 50%; border: 1px solid var(--line);
  background: var(--felt-3); color: var(--ivory); display: grid; place-items: center; cursor: pointer; }
.round-btn.plus { background: var(--chalk); color: #08251C; border-color: var(--chalk); }
.disc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.disc-card { background: var(--felt-2); border: 1px solid var(--line); border-radius: 16px;
  padding: 22px 10px; color: var(--ivory); font-size: 16px; font-weight: 700; cursor: pointer;
  font-family: 'Bricolage Grotesque', sans-serif; }
.disc-card.sel, .disc-card:active { border-color: var(--chalk); background: var(--felt-3); }
.target-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
.disc-card.compact { padding: 13px 4px; font-size: 15px; border-radius: 12px; }

/* Disziplin-Chip + Kopf im Ergebnis-Schritt */
.score-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.sh-players { font-size: 13px; color: var(--ivory-dim); }
.disc-chip { display: inline-flex; align-items: center; gap: 7px; background: var(--felt-3);
  border: 1px solid var(--gold); color: var(--gold); border-radius: 999px; padding: 6px 12px;
  font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }

/* 14/1 Live-Zähler */
.sp-setup { display: flex; flex-direction: column; gap: 12px; }
.sp { display: flex; flex-direction: column; gap: 12px; }
.sp-board { display: flex; gap: 12px; }
.sp-side { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;
  background: var(--felt-2); border: 2px solid var(--line); border-radius: 18px; padding: 14px 8px; }
.sp-side.active { border-color: var(--gold); background: var(--felt-3); }
.sp-name { font-size: 13px; font-weight: 700; }
.sp-score { font-size: 44px; font-weight: 800; font-family: 'Bricolage Grotesque', sans-serif; line-height: 1; }
.sp-meta { font-size: 11px; color: var(--ivory-dim); }
.sp-avg { font-size: 10.5px; color: var(--gold); margin-top: 1px; }
.sp-avg span { color: var(--ivory-dim); }
.sp-pot.half { flex: 1; margin: 0; padding: 16px; font-size: 16px; }
.sp-pot.half.safe { background: #3E6B8A; color: #F2EDE0; }
.otw-count { margin-top: 8px; font-size: 13px; font-weight: 700; color: var(--gold); }
.btn.small { padding: 9px 12px; font-size: 13px; }
.sp-foulwarn { font-size: 11px; font-weight: 700; color: #E8B923; margin-top: 2px; }
.sp-foulwarn.danger { color: #E8703A; }

/* ===== Querformat / große Bildschirme ===== */
@media (orientation: landscape) and (min-width: 720px) {
  .phone { max-width: 900px; }
  .content { padding-bottom: 20px; }
  .tabbar { max-width: 900px; }
  /* 14/1-Zähler zweispaltig: Anzeigetafel links, Bedienung rechts */
  .sp { display: grid; grid-template-columns: 1fr 1.1fr; gap: 20px; align-items: start; }
  .sp-board { grid-column: 1; }
  .sp-side { padding: 22px 10px; }
  .sp-score { font-size: 60px; }
  .sp-actions { grid-column: 2; display: flex; flex-direction: column; gap: 10px; }
  /* Ergebnis-/Statistik-Inhalte etwas luftiger nutzen die Breite */
  .opp-grid { grid-template-columns: repeat(4, 1fr); }
}
@media (orientation: landscape) and (max-height: 500px) {
  /* Handy im Querformat: kompakter, damit alles ohne Scrollen sichtbar bleibt */
  .content { padding-bottom: 76px; }
  .sp-score { font-size: 40px; }
  .sp-side { padding: 10px 8px; gap: 2px; }
  .sp { display: grid; grid-template-columns: 1fr 1.2fr; gap: 14px; align-items: start; }
  .sp-board { grid-column: 1; }
  .sp-actions { grid-column: 2; display: flex; flex-direction: column; gap: 8px; }
}
.sp-turn { font-size: 11.5px; font-weight: 700; color: var(--gold); }
.sp-target { text-align: center; font-size: 12.5px; color: var(--ivory-dim); }
.sp-pot { display: flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--chalk); color: #08251C; border: none; border-radius: 16px; padding: 20px;
  font-size: 19px; font-weight: 800; cursor: pointer; font-family: inherit; }
.sp-pot:active { filter: brightness(0.94); }
.sp-controls { display: flex; gap: 8px; }
.sp-controls .btn { flex: 1; margin: 0; }
.btn.warn { color: #E8A0A0; border-color: #6E3535; }
.btn.subtle { background: transparent; border: none; color: var(--ivory-dim); font-size: 12.5px;
  padding: 6px; cursor: pointer; font-family: inherit; }
.sp-endbox { background: var(--felt-2); border: 1px solid var(--line); border-radius: 14px; padding: 12px; }
.sum-141 { text-align: center; font-size: 12.5px; color: var(--gold); margin-top: 4px; }

/* 14/1 Aufnahme-Eingabe */
.sp-entry { display: flex; flex-direction: column; gap: 12px; background: var(--felt-2);
  border: 1px solid var(--line); border-radius: 18px; padding: 16px; }
.sp-entry-title { font-weight: 700; font-size: 14px; text-align: center; }
.sp-entry-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
.mini-stepper { display: flex; align-items: center; gap: 12px; }
.mini-stepper button { width: 34px; height: 34px; border-radius: 10px; border: 1px solid var(--line);
  background: var(--felt-3); color: var(--ivory); display: grid; place-items: center; cursor: pointer; }
.mini-stepper b { min-width: 20px; text-align: center; font-size: 17px; font-family: 'Bricolage Grotesque', sans-serif; }
.sp-entry-lbl { font-size: 13px; color: var(--ivory-dim); }
.num-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
@media (orientation: landscape) { .num-grid { grid-template-columns: repeat(8, 1fr); gap: 8px; } }
.pool-ball { aspect-ratio: 1; border-radius: 50%; border: none; cursor: pointer; position: relative;
  padding: 0; box-shadow: inset -2px -3px 5px #00000055, inset 2px 2px 4px #ffffff35; }
.pool-ball .pb-no { position: absolute; inset: 0; margin: auto; width: 56%; height: 56%;
  background: #F7F3E8; border-radius: 50%; display: grid; place-items: center;
  font-size: 12px; font-weight: 800; color: #1A1A1A; font-family: 'Bricolage Grotesque', sans-serif; }
.pool-ball.sel { outline: 3px solid var(--chalk); outline-offset: 2px; }
.sp-run-preview { text-align: center; font-size: 14px; }
.sp-run-preview b { font-size: 20px; color: var(--gold); font-family: 'Bricolage Grotesque', sans-serif; }
.sp-rack { display: flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--gold); color: #2A2100; border: none; border-radius: 16px; padding: 15px;
  font-size: 16px; font-weight: 800; cursor: pointer; font-family: inherit; }
.sp-rack:active { filter: brightness(0.94); }
.sp-rack:disabled { opacity: 0.45; cursor: default; }
.sp-need { text-align: center; font-size: 13.5px; color: var(--gold); font-weight: 700; }
.sp-need b { font-size: 17px; font-family: 'Bricolage Grotesque', sans-serif; }
.modal-overlay { position: fixed; inset: 0; background: #00000088; display: grid; place-items: center;
  z-index: 100; padding: 24px; }
.modal-box { background: var(--felt); border: 1px solid var(--gold); border-radius: 18px;
  padding: 20px; max-width: 340px; width: 100%; }
.modal-box h3 { margin: 0 0 8px; font-family: 'Bricolage Grotesque', sans-serif; }
.modal-box p { font-size: 13.5px; color: var(--ivory-dim); line-height: 1.5; margin: 0 0 16px; }
.btn.warn-solid { background: #B8402F; color: #fff; }
.confirm-box { background: var(--felt-2); border: 1px solid var(--gold); border-radius: 14px;
  padding: 14px; margin-top: 12px; margin-bottom: 12px; font-size: 13.5px; line-height: 1.5; }


.summary { background: var(--felt-2); border: 1px solid var(--line); border-radius: 20px;
  padding: 20px 16px; margin-bottom: 16px; }
.sum-vs { display: flex; align-items: center; justify-content: space-between; }
.sum-side { display: flex; flex-direction: column; align-items: center; gap: 6px;
  font-size: 12.5px; font-weight: 600; width: 100px; text-align: center; }
.sum-score { font-family: 'Bricolage Grotesque', sans-serif; font-size: 40px; font-weight: 800; }
.sum-score i { font-style: normal; color: var(--ivory-dim); padding: 0 4px; }
.sum-disc { text-align: center; margin: 10px 0 16px; color: var(--chalk); font-weight: 600; font-size: 14px; }
.prob-wrap { margin-bottom: 4px; }
.ghost-card { display: flex; align-items: center; gap: 12px; width: 100%; margin-bottom: 12px;
  background: var(--felt-2); border: 1px dashed #5B7B70; border-radius: 16px; padding: 12px 14px;
  cursor: pointer; font-family: inherit; color: var(--ivory); }
.ghost-ball { width: 44px; height: 44px; border-radius: 50%; background: #29453B; display: grid;
  place-items: center; font-size: 24px; flex-shrink: 0; }
.ghost-info { display: flex; flex-direction: column; text-align: left; flex: 1; min-width: 0; }
.ghost-name { font-weight: 700; font-size: 14px; }
.ghost-sub { font-size: 11.5px; color: var(--ivory-dim); }
.prob-label { display: flex; justify-content: space-between; font-size: 12px; color: var(--ivory-dim); margin-bottom: 6px; gap: 10px; }
.prob-bar { height: 8px; border-radius: 99px; background: var(--felt-3); overflow: hidden; }
.prob-bar div { height: 100%; background: var(--chalk); border-radius: 99px; }

.saved { text-align: center; padding-top: 34px; }
.saved h3 { font-size: 24px; margin: 14px 0 8px; }
.saved p { color: var(--ivory-dim); font-size: 14px; line-height: 1.55; margin-bottom: 22px; }

.stat-block { background: var(--felt-2); border: 1px solid var(--line); border-radius: 18px;
  padding: 16px 14px; margin-bottom: 14px; }
.stat-block h3 { font-size: 15px; display: flex; align-items: center; gap: 7px; margin-bottom: 12px; color: var(--chalk); }
.stat-row, .h2h-row, .user-row, .match-row, .pending-row { display: flex; align-items: center; gap: 10px; padding: 7px 0; font-size: 14px; }
.stat-row.as-btn { width: 100%; background: none; border: none; color: inherit; cursor: pointer;
  font-family: inherit; text-align: left; }
.medal { width: 24px; font-weight: 700; color: var(--gold); }
.stat-name { flex: 1; font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
.stat-val { font-weight: 700; font-family: 'Bricolage Grotesque', sans-serif; white-space: nowrap; }
.m-date { color: var(--ivory-dim); font-size: 12.5px; width: 44px; flex-shrink: 0; }
.m-txt { flex: 1; min-width: 0; } .m-disc { color: var(--ivory-dim); font-size: 12.5px; }
.h2h-bar { flex: 1; height: 8px; border-radius: 99px; background: #D9614C55; overflow: hidden; }
.h2h-w { height: 100%; background: var(--win); }
.h2h-score { font-weight: 700; width: 42px; text-align: right; font-family: 'Bricolage Grotesque', sans-serif; }
.profile-hero { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.p-name { font-size: 22px; overflow-wrap: anywhere; }
.p-rating { font-family: 'Bricolage Grotesque', sans-serif; font-size: 30px; font-weight: 800;
  display: flex; align-items: center; gap: 10px; }
.p-motto { color: var(--ivory-dim); font-size: 13px; font-style: italic; margin-top: 4px; }
.prov-badge { font-family: 'Archivo', sans-serif; font-size: 11px; font-weight: 600; color: var(--gold);
  border: 1px solid var(--gold); border-radius: 999px; padding: 3px 9px; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
.kpi { background: var(--felt-2); border: 1px solid var(--line); border-radius: 14px;
  padding: 10px 4px; text-align: center; display: flex; flex-direction: column; gap: 2px; }
.kpi b { font-family: 'Bricolage Grotesque', sans-serif; font-size: 18px; }
.kpi span { font-size: 11px; color: var(--ivory-dim); }

.role-chip { border-radius: 999px; border: 1px solid var(--line); background: transparent;
  color: var(--ivory-dim); font-size: 12px; padding: 4px 12px; }
.role-chip.admin { border-color: var(--gold); color: var(--gold); font-weight: 700; }

.swatch-row { display: flex; gap: 9px; flex-wrap: wrap; margin-bottom: 12px; }
.swatch { width: 40px; height: 40px; border-radius: 50%; border: 2px solid transparent;
  cursor: pointer; display: grid; place-items: center; color: #fff; }
.swatch.sel { border-color: var(--ivory); box-shadow: 0 0 0 2px var(--chalk); }
.swatch.picker { position: relative; overflow: hidden; cursor: pointer;
  background: conic-gradient(from 0deg, #E8B321, #2E7D4F, #2B5DA8, #6C4AB0, #C0392B, #E8B321);
  color: #fff; }
.swatch.picker .color-input { position: absolute; inset: 0; opacity: 0; width: 100%;
  height: 100%; border: none; padding: 0; cursor: pointer; }
.swatch.auto { background: var(--felt-3); color: var(--ivory-dim); font-size: 10px;
  font-weight: 700; font-family: inherit; }
.swatch-preview { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }

.ping-card.mine { border-color: var(--chalk-deep); }
.ping-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.ping-who { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.live-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px;
  font-weight: 800; letter-spacing: 0.08em; color: var(--loss);
  border: 1px solid var(--loss); border-radius: 999px; padding: 3px 9px; }
.live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--loss);
  animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
.ping-loc { display: flex; align-items: center; gap: 7px; font-size: 16px; font-weight: 700;
  font-family: 'Bricolage Grotesque', sans-serif; margin-bottom: 6px; }
.ping-msg { color: var(--ivory-dim); font-size: 13.5px; font-style: italic; margin-bottom: 10px; }
.ping-replies { border-top: 1px solid var(--line); padding-top: 10px; margin-bottom: 10px;
  display: flex; flex-direction: column; gap: 8px; }
.ping-reply { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.btn.small { padding: 11px; font-size: 14px; }
.reply-form { margin-top: 4px; }

.btn { width: 100%; border: none; border-radius: 16px; padding: 15px; font-size: 16px;
  font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;
  cursor: pointer; font-family: 'Bricolage Grotesque', sans-serif; }
.btn.primary { background: var(--chalk); color: #08251C; }
.btn.primary:disabled { opacity: 0.4; cursor: default; }
.btn.ghost { background: transparent; border: 1px dashed var(--line); color: var(--ivory-dim);
  font-size: 14px; margin-top: 8px; padding: 12px; }
.hint { font-size: 12.5px; color: var(--ivory-dim); margin-top: 10px; line-height: 1.5; }
.hint.center { text-align: center; }

.search-row { display: flex; align-items: center; gap: 10px; background: var(--felt);
  border: 1px solid var(--line); border-radius: 14px; padding: 0 12px; margin-bottom: 12px; }
.search-row input { flex: 1; background: transparent; border: none; outline: none;
  color: var(--ivory); font-size: 14px; padding: 11px 0; font-family: inherit; min-width: 0; }
.clear-btn { background: none; border: none; color: var(--ivory-dim); cursor: pointer;
  display: grid; place-items: center; padding: 4px; }
.nick-status { font-size: 13px; display: flex; align-items: flex-start; gap: 6px; margin: -4px 0 14px; line-height: 1.4; }
.nick-status.dim { color: var(--ivory-dim); }
.nick-status.warn { color: var(--gold); }
.nick-status.err { color: var(--loss); }
.nick-status.ok { color: var(--win); }
.field-label { font-size: 13px; color: var(--ivory-dim); display: block; margin-bottom: 8px; }

.login-screen { display: flex; flex-direction: column; justify-content: center; min-height: 100vh; }
.login-hero { text-align: center; margin-bottom: 34px; }
.login-balls { display: flex; justify-content: center; gap: 10px; margin-bottom: 22px; }
.app-title { font-size: 40px; font-weight: 800; letter-spacing: -0.03em; }
.app-sub { color: var(--ivory-dim); margin-top: 8px; line-height: 1.5; font-size: 15px; }
.login-card { background: var(--felt-2); border: 1px solid var(--line); border-radius: 22px; padding: 22px 18px; }
.mail-row { display: flex; align-items: center; gap: 10px; background: var(--felt);
  border: 1px solid var(--line); border-radius: 14px; padding: 0 14px; margin-bottom: 14px; }
.mail-ico { color: var(--ivory-dim); flex-shrink: 0; }
.mail-row input { flex: 1; background: transparent; border: none; outline: none;
  color: var(--ivory); font-size: 15px; padding: 14px 0; font-family: inherit; min-width: 0; }
.sent-check { width: 56px; height: 56px; border-radius: 50%; background: var(--win);
  color: #06231A; display: grid; place-items: center; margin: 0 auto 14px; }
.sent-check.big { width: 68px; height: 68px; }
.sent-text { text-align: center; margin-bottom: 12px; line-height: 1.5; overflow-wrap: anywhere; }

.tabbar { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 430px; display: flex; align-items: center;
  background: #082017F2; border-top: 1px solid var(--line);
  padding: 8px 6px calc(10px + env(safe-area-inset-bottom)); backdrop-filter: blur(8px); z-index: 30; }
.tab { flex: 1; background: none; border: none; color: var(--ivory-dim);
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  font-size: 10.5px; cursor: pointer; font-family: inherit; padding: 4px 0; position: relative; }
.tab.on { color: var(--chalk); font-weight: 700; }
.tab.fab { flex: 0 0 62px; background: var(--chalk); color: #08251C; width: 54px; height: 54px;
  border-radius: 50%; margin-top: -22px; box-shadow: 0 6px 16px #00000060; justify-content: center; }
.badge { position: absolute; top: -2px; right: 18%; background: var(--loss); color: #fff;
  font-size: 10px; font-weight: 700; border-radius: 999px; min-width: 16px; height: 16px;
  display: grid; place-items: center; padding: 0 4px; }
.badge.live { background: var(--win); color: #06231A; }

.refresh-btn { position: fixed; top: 14px; right: calc(50% - 215px + 14px);
  background: var(--felt-3); border: 1px solid var(--line); color: var(--ivory-dim);
  border-radius: 12px; width: 36px; height: 36px; display: grid; place-items: center;
  cursor: pointer; z-index: 20; }
@media (max-width: 430px) { .refresh-btn { right: 14px; } }
.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.toast { position: fixed; bottom: 96px; left: 50%; transform: translateX(-50%);
  background: var(--ivory); color: #08251C; font-weight: 600; font-size: 14px;
  border-radius: 999px; padding: 10px 20px; box-shadow: 0 8px 24px #00000070;
  white-space: nowrap; z-index: 50; max-width: 92vw; overflow: hidden; text-overflow: ellipsis; }

button:focus-visible, input:focus-visible { outline: 2px solid var(--chalk); outline-offset: 2px; }
@media (prefers-reduced-motion: no-preference) {
  .rank-row, .opp-card, .btn, .tab, .chip-btn { transition: background .15s, border-color .15s, opacity .15s; }
}
@media (prefers-reduced-motion: reduce) {
  .live-dot { animation: none; } .spin { animation: none; }
}
`;
