import { useState, useEffect } from "react";
import { ChevronLeft, Check, X, Plus, RotateCcw, Award, User, Download, Pencil, Shield } from "lucide-react";
import { supabase, DB_REF } from "../supabase";
import { t } from "../lib/i18n";
import { fmtDate, fmtAgo, mSide, initials } from "../lib/format";
import { DEFAULT_DISCIPLINES } from "../lib/constants";
import Ball from "./Ball";

export default function AdminScreen({ allPending, players, onConfirm, me, onBack, colorOf, badgeOf, toast, onReload }) {
  const [busy, setBusy] = useState(false);
  const [busyBadges, setBusyBadges] = useState(false);
  const [nu, setNu] = useState({ email: "", password: "", nickname: "" });
  const [busyUser, setBusyUser] = useState(false);
  const [am, setAm] = useState({ p1: "", p2: "", s1: "", s2: "", disc: "9 Ball", date: "" });
  const [busyAdd, setBusyAdd] = useState(false);
  const [logins, setLogins] = useState(null);
  const loadLogins = async () => {
    const { data, error } = await supabase.rpc("admin_player_logins");
    if (!error) setLogins(data || []);
  };
  useEffect(() => { loadLogins(); }, []);

  const setRole = async (p, role) => {
    const msg = role === "admin"
      ? t("{name} zum Admin machen?", { name: p.nickname })
      : t("{name} die Admin-Rolle entziehen?", { name: p.nickname });
    if (!window.confirm(msg)) return;
    const { error } = await supabase.rpc("admin_set_role", { p_player: p.player_id, p_role: role });
    if (error) { toast(t("Fehler: ") + error.message); return; }
    await loadLogins();
    if (onReload) await onReload();
    toast(role === "admin" ? t("Zum Admin gemacht.") : t("Admin-Rolle entfernt."));
  };
  const [editId, setEditId] = useState(null);
  const setBlocked = async (p, blocked) => {
    const msg = blocked ? t("{name} blockieren?", { name: p.nickname }) : t("{name} entsperren?", { name: p.nickname });
    if (!window.confirm(msg)) return;
    const { error } = await supabase.rpc("admin_set_blocked", { p_player: p.player_id, p_blocked: blocked });
    if (error) { toast(t("Fehler: ") + error.message); return; }
    await loadLogins();
    if (onReload) await onReload();
    toast(blocked ? t("Blockiert.") : t("Entsperrt."));
  };
  const downloadCsv = () => {
    if (!logins) return;
    const sep = ";";
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = [t("Name"), t("Rolle"), t("Blockiert"), t("Letzte Aktivität"), t("Registriert am")].map(esc).join(sep);
    const rows = logins.map((p) => {
      const role = p.is_ghost ? "Special" : p.blocked ? "Blocked" : p.role === "admin" ? "Admin" : "User";
      return [p.nickname, role, p.blocked ? t("ja") : t("nein"),
        p.last_seen ? fmtDate(p.last_seen) : "", p.created_at ? fmtDate(p.created_at) : ""].map(esc).join(sep);
    });
    const csv = "\uFEFF" + [head, ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mitglieder.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const addMatch = async () => {
    const s1 = parseInt(am.s1, 10) || 0, s2 = parseInt(am.s2, 10) || 0;
    if (!am.p1 || !am.p2 || am.p1 === am.p2) { toast(t("Zwei verschiedene Spieler wählen.")); return; }
    if (s1 < 0 || s2 < 0 || s1 + s2 === 0 || s1 === s2) { toast(t("Ungültiges Ergebnis.")); return; }
    setBusyAdd(true);
    const played = am.date ? new Date(am.date + "T12:00:00").toISOString() : null;
    const { error } = await supabase.rpc("admin_add_match", {
      p_player1: am.p1, p_player2: am.p2, p_score1: s1, p_score2: s2,
      p_discipline: am.disc, p_played_at: played,
    });
    setBusyAdd(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    toast(t("Match nachgetragen."));
    setAm({ p1: "", p2: "", s1: "", s2: "", disc: am.disc, date: "" });
    if (onReload) await onReload();
  };

  const refresh = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_refresh_stats");
    setBusy(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    if (onReload) await onReload();
    toast(t("Statistik neu berechnet."));
  };
  const recomputeBadges = async () => {
    setBusyBadges(true);
    const { error } = await supabase.rpc("admin_recompute_badges");
    setBusyBadges(false);
    if (error) { toast(t("Fehler: ") + error.message); return; }
    if (onReload) await onReload();
    toast(t("Erfolge neu berechnet."));
  };
  const createUser = async () => {
    if (!nu.email.includes("@") || nu.password.length < 6) {
      toast(t("E-Mail und Passwort (min. 6 Zeichen) nötig.")); return;
    }
    setBusyUser(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { email: nu.email.trim(), password: nu.password, nickname: nu.nickname.trim() },
    });
    setBusyUser(false);
    if (error) { toast(t("Fehler: ") + (error.message || "Anlage fehlgeschlagen")); return; }
    if (data?.error) { toast(t("Fehler: ") + data.error); return; }
    if (data?.warning) { toast(data.warning); } else { toast(t("Nutzer angelegt.")); }
    setNu({ email: "", password: "", nickname: "" });
    if (onReload) await onReload();
  };

  return (
    <div className="screen">
      <header className="screen-head with-back">
        <button className="back-btn" onClick={onBack} aria-label={t("Zurueck")}><ChevronLeft size={22} /></button>
        <h2>{t("Verwaltung")}</h2>
      </header>

      <section className="stat-block">
        <h3><Check size={17} /> {t("Offene Matches")} ({allPending.length})</h3>
        {allPending.length === 0 && <p className="hint">{t("Alles erledigt - keine offenen Matches.")}</p>}
        {allPending.map((m) => (
          <div key={m.id} className="pending-row">
            <span className="m-date">{fmtDate(m.played_at).slice(0, 6)}</span>
            <span className="m-txt">{mSide(m, 1)} <b>{m.score1}:{m.score2}</b> {mSide(m, 2)} - {t(m.discipline)}</span>
            <div className="confirm-actions">
              <button className="chip-btn ok" onClick={() => onConfirm(m.id, true)} aria-label={t("freigeben")}><Check size={15} /></button>
              <button className="chip-btn no" onClick={() => onConfirm(m.id, false)} aria-label={t("verwerfen")}><X size={15} /></button>
            </div>
          </div>
        ))}
      </section>

      <section className="stat-block">
        <h3><Plus size={17} /> {t("Match nachtragen")}</h3>
        <p className="hint" style={{ marginTop: 0 }}>{t("Als Admin ein bereits gespieltes Match eintragen – gilt sofort als bestätigt.")}</p>
        <div className="add-match">
          <select value={am.p1} onChange={(e) => setAm({ ...am, p1: e.target.value })}>
            <option value="">{t("Spieler 1")}</option>
            {players.filter((p) => !p.is_ghost).map((p) => <option key={p.id} value={p.id}>{p.nickname}</option>)}
          </select>
          <div className="am-scores">
            <input type="number" inputMode="numeric" min="0" placeholder="0" value={am.s1} onChange={(e) => setAm({ ...am, s1: e.target.value })} />
            <span>:</span>
            <input type="number" inputMode="numeric" min="0" placeholder="0" value={am.s2} onChange={(e) => setAm({ ...am, s2: e.target.value })} />
          </div>
          <select value={am.p2} onChange={(e) => setAm({ ...am, p2: e.target.value })}>
            <option value="">{t("Spieler 2")}</option>
            {players.filter((p) => !p.is_ghost).map((p) => <option key={p.id} value={p.id}>{p.nickname}</option>)}
          </select>
          <div className="am-row">
            <select value={am.disc} onChange={(e) => setAm({ ...am, disc: e.target.value })}>
              {DEFAULT_DISCIPLINES.map((d) => <option key={d} value={d}>{t(d)}</option>)}
            </select>
            <input type="date" value={am.date} onChange={(e) => setAm({ ...am, date: e.target.value })} />
          </div>
          <button className="btn primary" disabled={busyAdd} onClick={addMatch}>
            {busyAdd ? t("Speichere ...") : <>{t("Match nachtragen")} <Check size={16} /></>}
          </button>
        </div>
      </section>

      <section className="stat-block">
        <h3><RotateCcw size={17} /> {t("Statistik & Erfolge")}</h3>
        <p className="hint" style={{ marginTop: 0 }}>{t("Rechnet Ratings, Verlauf und Erfolge sofort neu – nützlich nach nachträglich eingetragenen Matches. Kann ein paar Sekunden dauern.")}</p>
        <button className="btn primary" disabled={busy} onClick={refresh}>
          {busy ? "Rechne neu …" : <><RotateCcw size={16} /> {t("Statistik jetzt aktualisieren")}</>}
        </button>
        <button className="btn ghost" disabled={busyBadges} onClick={recomputeBadges}>
          {busyBadges ? "Rechne neu …" : <><Award size={16} /> {t("Nur Erfolge neu berechnen")}</>}
        </button>
      </section>

      <section className="stat-block">
        <h3><User size={17} /> {t("Neuen Nutzer anlegen")}</h3>
        <p className="hint" style={{ marginTop: 0 }}>{t("Legt einen Login mit E-Mail + Passwort an (sofort nutzbar). Spielername optional – sonst wählt ihn die Person beim ersten Login selbst.")}</p>
        <div className="pw-box">
          <input type="email" placeholder="E-Mail" value={nu.email} autoComplete="off"
            onChange={(e) => setNu({ ...nu, email: e.target.value })} />
          <input type="text" placeholder={t("Passwort (min. 6 Zeichen)")} value={nu.password} autoComplete="off"
            onChange={(e) => setNu({ ...nu, password: e.target.value })} />
          <input type="text" placeholder={t("Spielername (optional)")} value={nu.nickname} autoComplete="off"
            onChange={(e) => setNu({ ...nu, nickname: e.target.value })} />
          <button className="btn primary" disabled={busyUser} onClick={createUser}>
            {busyUser ? t("Lege an …") : t("Nutzer anlegen")}
          </button>
        </div>
      </section>

      <section className="stat-block">
        <div className="mem-head-row">
          <h3><User size={17} /> {t("Mitglieder")} ({logins ? logins.length : players.length})</h3>
          {logins && logins.length > 0 && (
            <button className="csv-btn" onClick={downloadCsv}><Download size={14} /> CSV</button>
          )}
        </div>
        {logins == null ? (
          <p className="hint">{t("Lade ...")}</p>
        ) : logins.length === 0 ? (
          <p className="hint">{t("Noch keine Daten.")}</p>
        ) : (
          <div className="mem-list">
            {logins.map((p) => {
              const isGhost = p.is_ghost;
              const isSelf = p.player_id === me.id;
              const pr = players.find((x) => x.id === p.player_id);
              const noLogin = pr && !pr.auth_user_id && !isGhost;
              const letter = p.blocked ? "B" : isGhost ? "S" : p.role === "admin" ? "A" : "U";
              const lclass = p.blocked ? "blocked" : isGhost ? "special" : p.role === "admin" ? "admin" : "user";
              const open = editId === p.player_id;
              return (
                <div key={p.player_id} className={"mem-row" + (p.blocked ? " is-blocked" : "")}>
                  <div className="mem-line">
                    <Ball color={colorOf(p.nickname)} label={initials(p.nickname)} badge={badgeOf(p.nickname)} size={28} />
                    <span className={"role-letter role-" + lclass}>{letter}</span>
                    <span className="mem-nick">{p.nickname}{isSelf ? " " + t("(du)") : ""}</span>
                    <span className="mem-when">{isGhost ? "—" : fmtAgo(p.last_seen)}</span>
                    <button className={"mem-edit" + (open ? " on" : "")} aria-label={t("Bearbeiten")}
                      onClick={() => setEditId(open ? null : p.player_id)}><Pencil size={14} /></button>
                  </div>
                  {open && (
                    <div className="mem-panel">
                      <div className="mem-info">
                        {p.last_seen ? fmtDate(p.last_seen) : t("nie")}{noLogin ? " · " + t("ohne Login") : ""}
                      </div>
                      {isSelf ? (
                        <span className="hint">{t("Das bist du.")}</span>
                      ) : isGhost ? (
                        <span className="hint">{t("Ghost-Spieler – keine Aktionen.")}</span>
                      ) : (
                        <>
                          {p.role !== "admin"
                            ? <button className="user-act" onClick={() => setRole(p, "admin")}>{t("Zum Admin machen")}</button>
                            : <button className="user-act danger" onClick={() => setRole(p, "user")}>{t("Admin entfernen")}</button>}
                          {!p.blocked
                            ? <button className="user-act danger" onClick={() => setBlocked(p, true)}>{t("Blockieren")}</button>
                            : <button className="user-act" onClick={() => setBlocked(p, false)}>{t("Entsperren")}</button>}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="hint">{t("Neue Mitglieder registrieren sich selbst: einfach den App-Link teilen.")}</p>
      </section>

      <section className="stat-block">
        <h3><Shield size={17} /> {t("Diagnose")}</h3>
        <div className="diag-row"><span>{t("Datenbank")}</span><code>{DB_REF}</code></div>
        <p className="hint" style={{ marginTop: 6 }}>{t("Diese Kennung muss sich zwischen Test und Produktion unterscheiden. Ist sie gleich, greifen beide auf dieselbe Datenbank zu.")}</p>
      </section>

    </div>
  );
}
