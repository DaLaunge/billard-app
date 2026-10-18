import { useState } from "react";
import { Image as ImageIcon, Users, Plus, Star, Copy, RefreshCw, Trash2, LogOut, Crown, ShieldCheck, UserMinus, ChevronDown, KeyRound, Check, X, UserPlus, Search } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../../supabase";
import { t } from "../../lib/i18n";
import { appConfirm } from "../../lib/confirmDialog";
import { useClubData, reloadClubs, roleIn, openClub } from "../../lib/clubStore";
import ClubTag from "./ClubTag";
import ClubLogoModal from "./ClubLogoModal";
import { compressClubLogo, clubLogoPath, clubLogoUrl } from "../../lib/clubLogo";

/* "Clubs" unter Profil bearbeiten: eigene Clubs (Tag im Profil), Club gruenden, per Code beitreten und - fuer die Leitung -
   Mitglieder, Rollen, Einladungs-Code/-Link, Name/Kuerzel/Farbe. Alles laeuft ueber RPCs (supabase/2026-10-19b_clubs.sql),
   die selbst pruefen, wer was darf; die Knoepfe hier blenden nur aus, was ohnehin abgelehnt wuerde. */
const ROLE_LABEL = { owner: "Gründer", admin: "Admin", member: "Mitglied" };

export default function ClubsCard({ meRow, players, toast }) {
  const data = useClubData();
  const me = meRow?.id;
  const mine = data.clubs.filter((c) => roleIn(data, c.id, me));
  const home = data.home[me];
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [create, setCreate] = useState(null);       // { name, tag, color }
  const [joinCode, setJoinCode] = useState("");
  const [codes, setCodes] = useState({});           // club id -> Code (nur Leitung)
  const [edit, setEdit] = useState({});             // club id -> { name, tag, color }
  const [invQ, setInvQ] = useState("");             // Suche: Spieler einladen
  const [viewLogo, setViewLogo] = useState(null);   // Club, dessen Logo gross gezeigt wird
  const [disc, setDisc] = useState(false);          // "Clubs entdecken" offen?
  const [discQ, setDiscQ] = useState("");

  if (!data.loaded) return null;   // Migration fehlt: Karte erscheint gar nicht

  const run = async (rpc, args, okMsg) => {
    setBusy(true);
    const { data: res, error } = await supabase.rpc(rpc, args);
    setBusy(false);
    if (error) { toast(error.message); return null; }
    await reloadClubs();
    if (okMsg) toast(okMsg);
    return res ?? true;
  };
  const nickOf = (pid) => players.find((p) => p.id === pid)?.nickname || "?";
  const pendingOf = (cid) => (data.requests || []).filter((r) => r.club_id === cid && r.status === "pending");
  const myReq = (cid) => (data.requests || []).find((r) => r.club_id === cid && r.player_id === me);
  // Einladen: echte Spieler (auch ohne Login - die Einladung wartet dann bis zur Registrierung), die weder Mitglied sind noch schon
  // eine offene/abgelehnte Zeile haben
  const candidates = (cid) => {
    const q = invQ.trim().toLowerCase();
    if (!q) return [];
    const taken = new Set([...data.members.filter((m) => m.club_id === cid).map((m) => m.player_id),
      ...(data.requests || []).filter((r) => r.club_id === cid).map((r) => r.player_id)]);
    return players.filter((p) => !p.is_guest && !p.is_ghost && !p.blocked && p.id !== me && !taken.has(p.id)
      && p.nickname.toLowerCase().includes(q)).slice(0, 5);
  };
  const doInvite = async (c, p) => {
    const r = await run("club_invite_player", { p_club: c.id, p_player: p.id });
    if (r) {
      toast(r === "joined" ? t("{name} ist jetzt Mitglied.", { name: p.nickname })
        : p.auth_user_id ? t("Einladung an {name} gesendet.", { name: p.nickname })
        : t("Einladung für {name} vorgemerkt – sie wartet, bis {name} sich anmeldet.", { name: p.nickname }));
      setInvQ("");
    }
  };
  const discoverList = () => {
    const q = discQ.trim().toLowerCase();
    return data.clubs.filter((c) => !roleIn(data, c.id, me) && (!q || c.name.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q))).slice(0, 12);
  };
  const recent = (r) => r?.status === "declined" && r.decided_at && Date.now() - new Date(r.decided_at) < 30 * 86400000;

  const doCreate = async () => {
    const r = await run("create_club", { p_name: create.name, p_tag: create.tag, p_color: create.color || null }, t("Club gegründet."));
    if (r) setCreate(null);
  };
  // Logo: auf 128 px verkleinert, Datei im Storage (nicht in der Datenbank), nur der Zeitstempel kommt in die Tabelle
  const uploadLogo = async (c, file) => {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressClubLogo(file);
      const { error } = await supabase.storage.from("club-logos")
        .upload(clubLogoPath(c.id), blob, { upsert: true, contentType: blob.type, cacheControl: "31536000" });
      if (error) throw error;
      const { error: e2 } = await supabase.rpc("set_club_logo", { p_club: c.id, p_has_logo: true });
      if (e2) throw e2;
      await reloadClubs();
      toast(t("Logo gespeichert."));
    } catch (e) { toast(t("Fehler: ") + e.message); }
    setBusy(false);
  };
  const removeLogo = async (c) => {
    setBusy(true);
    try {
      await supabase.storage.from("club-logos").remove([clubLogoPath(c.id)]);
      const { error } = await supabase.rpc("set_club_logo", { p_club: c.id, p_has_logo: false });
      if (error) throw error;
      await reloadClubs();
      toast(t("Logo entfernt."));
    } catch (e) { toast(t("Fehler: ") + e.message); }
    setBusy(false);
  };
  // Die Datei muss ueber die Storage-API raus (direktes SQL-Loeschen auf storage.objects ist gesperrt), dann der Club
  const removeClub = async (c) => {
    if (c.logo_at) { try { await supabase.storage.from("club-logos").remove([clubLogoPath(c.id)]); } catch { /* egal */ } }
    return run("delete_club", { p_club: c.id }, t("Club gelöscht."));
  };
  const doJoin = async () => {
    const r = await run("join_club", { p_code: joinCode }, t("Du bist dem Club beigetreten."));
    if (r) setJoinCode("");
  };
  const showCode = async (c, rotate = false) => {
    if (rotate && !(await appConfirm(t("Neuen Code erzeugen? Der alte Code und alle alten Links funktionieren dann nicht mehr.")))) return;
    const { data: code, error } = await supabase.rpc("club_join_code", { p_club: c.id, p_rotate: rotate });
    if (error) { toast(error.message); return; }
    setCodes((x) => ({ ...x, [c.id]: code }));
  };
  const linkOf = (code) => `${window.location.origin}/?club=${code}`;
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast(t("Link kopiert!")); } catch { toast(text); }
  };

  const clubBlock = (c) => {
    const members = data.members.filter((m) => m.club_id === c.id)
      .sort((a, b) => ["owner", "admin", "member"].indexOf(a.role) - ["owner", "admin", "member"].indexOf(b.role) || nickOf(a.player_id).localeCompare(nickOf(b.player_id)));
    const myRole = roleIn(data, c.id, me);
    const canManage = myRole === "owner" || myRole === "admin";
    const isOwner = myRole === "owner";
    const isOpen = open === c.id;
    const ed = edit[c.id] || { name: c.name, tag: c.tag, color: c.color || "", motto: c.motto || "" };
    return (
      <div key={c.id} className="club-block">
        <button className="club-row" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen}>
          <ClubTag club={c} />
          <span className="club-row-name">{c.name}</span>
          <span className="club-row-meta">{t(ROLE_LABEL[myRole])} · {members.length}</span>
          {home === c.id && <Star size={14} className="club-home" aria-label={t("Hauptclub")} />}
          <ChevronDown size={16} className={"club-chev" + (isOpen ? " open" : "")} />
        </button>
        <div className={"collapsible" + (isOpen ? " open" : "")} inert={isOpen ? undefined : ""}>
          <div className="collapsible-inner">
            <div className="club-detail">
              {home !== c.id && (
                <button className="btn ghost small" disabled={busy} onClick={() => run("set_home_club", { p_club: c.id }, t("Hauptclub gesetzt."))}>
                  <Star size={14} /> {t("Als Hauptclub im Profil zeigen")}
                </button>
              )}

              <p className="club-sub">{t("Mitglieder")}</p>
              <ul className="club-members">
                {members.map((m) => (
                  <li key={m.player_id}>
                    <span className="club-member-name">
                      {m.role === "owner" ? <Crown size={13} /> : m.role === "admin" ? <ShieldCheck size={13} /> : null}
                      {nickOf(m.player_id)}
                    </span>
                    <span className="club-member-actions">
                      {m.role !== "owner" && canManage && m.role === "member" && (
                        <button className="icon-btn small" disabled={busy} title={t("Zum Admin machen")} aria-label={t("Zum Admin machen")}
                          onClick={() => run("club_set_role", { p_club: c.id, p_player: m.player_id, p_role: "admin" })}><ShieldCheck size={15} /></button>
                      )}
                      {m.role === "admin" && isOwner && (
                        <button className="icon-btn small" disabled={busy} title={t("Admin absetzen")} aria-label={t("Admin absetzen")}
                          onClick={() => run("club_set_role", { p_club: c.id, p_player: m.player_id, p_role: "member" })}><ShieldCheck size={15} style={{ opacity: .45 }} /></button>
                      )}
                      {isOwner && m.role !== "owner" && (
                        <button className="icon-btn small" disabled={busy} title={t("Leitung übergeben")} aria-label={t("Leitung übergeben")}
                          onClick={async () => { if (await appConfirm(t("Leitung des Clubs an {name} übergeben? Du wirst Admin.", { name: nickOf(m.player_id) }))) run("club_transfer_owner", { p_club: c.id, p_player: m.player_id }, t("Leitung übergeben.")); }}><Crown size={15} /></button>
                      )}
                      {m.role !== "owner" && canManage && (isOwner || m.role === "member") && (
                        <button className="icon-btn small warn" disabled={busy} title={t("Entfernen")} aria-label={t("Entfernen")}
                          onClick={async () => { if (await appConfirm(t("{name} aus dem Club entfernen?", { name: nickOf(m.player_id) }))) run("club_remove_member", { p_club: c.id, p_player: m.player_id }); }}><UserMinus size={15} /></button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              {canManage && (
                <>
                  <p className="club-sub">{t("Einladen")}</p>
                  {codes[c.id] ? (
                    <div className="club-code">
                      <code>{codes[c.id]}</code>
                      <button className="icon-btn small" title={t("Link kopieren")} aria-label={t("Link kopieren")} onClick={() => copy(linkOf(codes[c.id]))}><Copy size={15} /></button>
                      <button className="icon-btn small" title={t("Neuen Code erzeugen")} aria-label={t("Neuen Code erzeugen")} onClick={() => showCode(c, true)}><RefreshCw size={15} /></button>
                    </div>
                  ) : (
                    <button className="btn ghost small" onClick={() => showCode(c)}><KeyRound size={14} /> {t("Einladungs-Code zeigen")}</button>
                  )}
                  {codes[c.id] && (
                    <div className="club-qr" title={t("QR-Code zum Beitreten")}>
                      <QRCodeSVG value={linkOf(codes[c.id])} size={132} marginSize={2} />
                    </div>
                  )}

                  <p className="club-sub">{t("Spieler einladen")}</p>
                  <div className="mail-row club-search">
                    <Search size={16} className="mail-ico" />
                    <input value={invQ} placeholder={t("Name suchen")} onChange={(e) => setInvQ(e.target.value)} />
                  </div>
                  {candidates(c.id).map((p) => (
                    <div key={p.id} className="club-cand">
                      <span>{p.nickname}{!p.auth_user_id && <small className="club-row-meta"> · {t("noch ohne Login")}</small>}</span>
                      <button className="icon-btn small primary" disabled={busy} title={t("Einladen")} aria-label={t("Einladen")} onClick={() => doInvite(c, p)}><UserPlus size={15} /></button>
                    </div>
                  ))}
                  {pendingOf(c.id).length > 0 && (
                    <>
                      <p className="club-sub">{t("Offen")}</p>
                      <ul className="club-members">
                        {pendingOf(c.id).map((r) => (
                          <li key={r.id}>
                            <span className="club-member-name">{nickOf(r.player_id)} <small className="club-row-meta">{r.kind === "request" ? t("fragt an") : t("eingeladen")}</small></span>
                            <span className="club-member-actions">
                              {r.kind === "request" && (
                                <button className="icon-btn small primary" disabled={busy} title={t("Aufnehmen")} aria-label={t("Aufnehmen")}
                                  onClick={() => run("club_respond", { p_request: r.id, p_accept: true }, t("Aufgenommen."))}><Check size={15} /></button>
                              )}
                              <button className="icon-btn small" disabled={busy} title={r.kind === "request" ? t("Ablehnen") : t("Zurückziehen")} aria-label={r.kind === "request" ? t("Ablehnen") : t("Zurückziehen")}
                                onClick={() => (r.kind === "request" ? run("club_respond", { p_request: r.id, p_accept: false }) : run("club_cancel_request", { p_request: r.id }))}><X size={15} /></button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  <p className="club-sub">{t("Logo")}</p>
                  <div className="club-logo-row">
                    {clubLogoUrl(c)
                      ? <button type="button" className="club-logo-prev" title={t("Club-Logo ansehen")} aria-label={t("Club-Logo ansehen")} onClick={() => setViewLogo(c)}><img src={clubLogoUrl(c)} alt="" width="44" height="44" /></button>
                      : <span className="club-logo-prev"><ImageIcon size={20} /></span>}
                    <label className={"icon-btn small" + (busy ? " disabled" : "")} title={t("Logo wählen")} aria-label={t("Logo wählen")}>
                      <ImageIcon size={15} />
                      <input type="file" accept="image/*" style={{ display: "none" }} disabled={busy}
                        onChange={(e) => { uploadLogo(c, e.target.files[0]); e.target.value = ""; }} />
                    </label>
                    {c.logo_at && (
                      <button className="icon-btn small warn" disabled={busy} title={t("Logo entfernen")} aria-label={t("Logo entfernen")} onClick={() => removeLogo(c)}><Trash2 size={15} /></button>
                    )}
                  </div>

                  <p className="club-sub">{t("Name, Kürzel, Motto und Farbe")}</p>
                  <div className="club-form-col">
                  <div className="club-form">
                    <input value={ed.name} maxLength={40} placeholder={t("Clubname")} onChange={(e) => setEdit((x) => ({ ...x, [c.id]: { ...ed, name: e.target.value } }))} />
                    <input value={ed.tag} maxLength={5} placeholder={t("Kürzel")} className="club-tag-input"
                      onChange={(e) => setEdit((x) => ({ ...x, [c.id]: { ...ed, tag: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") } }))} />
                    <input type="color" className="color-input" value={ed.color || "#3a7bd5"} aria-label={t("Farbe")}
                      onChange={(e) => setEdit((x) => ({ ...x, [c.id]: { ...ed, color: e.target.value } }))} />
                  </div>
                  <div className="club-form">
                    <input value={ed.motto} maxLength={80} placeholder={t("Motto des Clubs (optional)")}
                      onChange={(e) => setEdit((x) => ({ ...x, [c.id]: { ...ed, motto: e.target.value } }))} />
                    <button className="icon-btn small primary" disabled={busy} title={t("Speichern")} aria-label={t("Speichern")}
                      onClick={() => run("update_club", { p_club: c.id, p_name: ed.name, p_tag: ed.tag, p_color: ed.color || null, p_motto: ed.motto }, t("Gespeichert."))}><Check size={15} /></button>
                  </div>
                  </div>
                </>
              )}

              <div className="club-danger">
                {!isOwner && (
                  <button className="btn ghost small" disabled={busy}
                    onClick={async () => { if (await appConfirm(t("Den Club „{name}“ verlassen?", { name: c.name }))) run("leave_club", { p_club: c.id }, t("Club verlassen.")); }}>
                    <LogOut size={14} /> {t("Club verlassen")}
                  </button>
                )}
                {isOwner && (
                  <button className="btn ghost small warn" disabled={busy}
                    onClick={async () => { if (await appConfirm(t("Den Club „{name}“ endgültig löschen? Alle Mitglieder verlieren den Tag.", { name: c.name }))) removeClub(c); }}>
                    <Trash2 size={14} /> {t("Club löschen")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="stat-block clubs-card" id="pf-clubs">
      {viewLogo && <ClubLogoModal club={viewLogo} onClose={() => setViewLogo(null)} />}
      <h3><Users size={17} /> {t("Clubs")}</h3>
      {mine.length === 0 && <p className="hint">{t("Du bist noch in keinem Club. Gründe einen oder tritt mit einem Code bei.")}</p>}
      {mine.map(clubBlock)}

      <p className="club-sub">{t("Club beitreten")}</p>
      <div className="club-form">
        <input value={joinCode} maxLength={12} placeholder={t("Einladungs-Code")} className="club-code-input"
          onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
        <button className="icon-btn small primary" disabled={busy || joinCode.length < 4} title={t("Beitreten")} aria-label={t("Beitreten")} onClick={doJoin}><Check size={15} /></button>
      </div>

      <button className="btn ghost small club-create-btn" onClick={() => setDisc((v) => !v)} aria-expanded={disc}><Search size={14} /> {t("Clubs entdecken")}</button>
      <div className={"collapsible" + (disc ? " open" : "")} inert={disc ? undefined : ""}>
        <div className="collapsible-inner">
          <div className="club-detail">
            <div className="mail-row club-search">
              <Search size={16} className="mail-ico" />
              <input value={discQ} placeholder={t("Club oder Kürzel suchen")} onChange={(e) => setDiscQ(e.target.value)} />
            </div>
            {discoverList().length === 0 && <p className="hint">{t("Keine Clubs gefunden.")}</p>}
            {discoverList().map((c) => {
              const r = myReq(c.id);
              return (
                <div key={c.id} className="club-row club-inbox-row club-discover-row">
                  <button type="button" className="club-row-main" onClick={() => openClub(c.id)} title={t("Club ansehen")}>
                    <ClubTag club={c} />
                    <span className="club-row-textcol">
                      <span className="club-row-name">{c.name}</span>
                      {c.motto && <span className="club-row-motto">{c.motto}</span>}
                    </span>
                  </button>
                  {r?.status === "pending" && r.kind === "invite" ? (
                    <button className="btn small" disabled={busy} onClick={() => run("club_respond", { p_request: r.id, p_accept: true }, t("Du bist dem Club beigetreten."))}>{t("Einladung annehmen")}</button>
                  ) : r?.status === "pending" ? (
                    <>
                      <span className="club-row-meta">{t("Angefragt")}</span>
                      <button className="icon-btn small" disabled={busy} title={t("Zurückziehen")} aria-label={t("Zurückziehen")} onClick={() => run("club_cancel_request", { p_request: r.id })}><X size={15} /></button>
                    </>
                  ) : (
                    <button className="btn ghost small" disabled={busy || recent(r)} title={recent(r) ? t("Abgelehnt – erneut möglich nach 30 Tagen") : undefined}
                      onClick={async () => { const res = await run("club_request_join", { p_club: c.id }); if (res) toast(res === "joined" ? t("Du bist dem Club beigetreten.") : t("Anfrage gesendet.")); }}>{t("Anfragen")}</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {create ? (
        <>
          <p className="club-sub">{t("Club gründen")}</p>
          <div className="club-form">
            <input value={create.name} maxLength={40} placeholder={t("Clubname")} onChange={(e) => setCreate({ ...create, name: e.target.value })} />
            <input value={create.tag} maxLength={5} placeholder={t("Kürzel")} className="club-tag-input"
              onChange={(e) => setCreate({ ...create, tag: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} />
            <input type="color" className="color-input" value={create.color || "#3a7bd5"} aria-label={t("Farbe")} onChange={(e) => setCreate({ ...create, color: e.target.value })} />
            <button className="icon-btn small primary" disabled={busy || create.name.trim().length < 2 || create.tag.length < 2} title={t("Gründen")} aria-label={t("Gründen")} onClick={doCreate}><Check size={15} /></button>
          </div>
          <p className="hint">{t("Das Kürzel (2 bis 5 Zeichen) erscheint als Tag in deinem Profil und bei allen Mitgliedern. Du wirst Gründer und kannst die Leitung später erweitern oder übergeben.")}</p>
        </>
      ) : (
        <button className="btn ghost small club-create-btn" onClick={() => setCreate({ name: "", tag: "", color: "" })}><Plus size={14} /> {t("Club gründen")}</button>
      )}
    </section>
  );
}
