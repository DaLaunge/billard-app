import { useMemo, useState } from "react";
import { Crown, ShieldCheck, UserPlus, X, Trophy } from "lucide-react";
import { supabase } from "../../supabase";
import { t } from "../../lib/i18n";
import { initials, fmtDate } from "../../lib/format";
import { useClubData, useViewingClub, closeClub, reloadClubs, roleIn } from "../../lib/clubStore";
import Ball from "../Ball";
import ClubTag, { clubColor, inkFor } from "./ClubTag";
import ClubLogoModal from "./ClubLogoModal";
import { clubLogoUrl } from "../../lib/clubLogo";

/* Club-Profil als Fenster: einmal in App.jsx eingehaengt, geoeffnet per openClub(id) (Klick auf einen Club-Tag in einer Liste oder auf einen
   Club unter "Clubs entdecken"). Oben Logo (Tipp = in voller Aufloesung), Name, Tag und Motto; darunter die Club-Statistik (Mitglieder,
   Durchschnitts-Rating, Matches, Siegquote gegen Nicht-Mitglieder, staerkstes Mitglied, gegruendet am), der Gruender und die Mitglieder als
   Club-Rangliste nach Gesamt-Rating (Krone = Gruender, Schild = Admin); ein Tipp auf ein Mitglied oeffnet dessen Profil. Wer noch kein
   Mitglied ist, kann hier direkt Beitritt anfragen. Alles wird aus den schon geladenen Matches und Ratings gerechnet, es gibt keine eigene Abfrage. */
export default function ClubMembersHost({ me, rangliste, matches, colorOf, badgeOf, photoOf, onOpenProfile, toast }) {
  const id = useViewingClub();
  const d = useClubData();
  const [busy, setBusy] = useState(false);
  const [logoOpen, setLogoOpen] = useState(false);
  const club = id ? d.clubs.find((c) => c.id === id) : null;

  const members = useMemo(() => (club ? d.members.filter((m) => m.club_id === club.id).map((m) => ({ ...m, nick: d.nickById[m.player_id] || "?" })) : []), [club, d]);
  const nicks = useMemo(() => new Set(members.map((m) => m.nick)), [members]);
  // Gesamt-Rating je Mitglied; gefestigte zuerst fuer den Durchschnitt (ein einzelnes vorlaeufiges Rating verfaelscht ihn sonst)
  const ratingOf = useMemo(() => {
    const map = {};
    (rangliste || []).forEach((r) => { if (r.discipline === "Gesamt" && nicks.has(r.nickname) && r.rating != null) map[r.nickname] = r; });
    return map;
  }, [rangliste, nicks]);
  const stats = useMemo(() => {
    const rows = Object.values(ratingOf);
    const settled = rows.filter((r) => !r.vorlaeufig);
    const pool = settled.length ? settled : rows;
    const avg = pool.length ? Math.round(pool.reduce((a, r) => a + r.rating, 0) / pool.length) : null;
    const best = rows.length ? rows.reduce((a, r) => (r.rating > a.rating ? r : a)) : null;
    // Matches mit mindestens einem Mitglied (Einzel, ohne Gaeste); gegen Nicht-Mitglieder zaehlt die Siegquote
    let n = 0, outW = 0, outL = 0;
    (matches || []).forEach((m) => {
      if (m.player1b_id || m.p1.is_guest || m.p2.is_guest) return;
      const a = nicks.has(m.p1.nickname), b = nicks.has(m.p2.nickname);
      if (!a && !b) return;
      n++;
      if (a && b) return;
      const won = a ? m.score1 > m.score2 : m.score2 > m.score1;
      const lost = a ? m.score1 < m.score2 : m.score2 < m.score1;
      if (won) outW++; else if (lost) outL++;
    });
    return { avg, best, n, rate: outW + outL > 0 ? Math.round((100 * outW) / (outW + outL)) : null, outN: outW + outL };
  }, [ratingOf, matches, nicks]);

  if (!club) return null;
  const sorted = [...members].sort((a, b) => (ratingOf[b.nick]?.rating ?? -1) - (ratingOf[a.nick]?.rating ?? -1) || a.nick.localeCompare(b.nick));
  const mine = roleIn(d, club.id, me?.id);
  const req = (d.requests || []).find((r) => r.club_id === club.id && r.player_id === me?.id && r.status === "pending");
  const logo = clubLogoUrl(club);
  const bg = clubColor(club);
  const owner = members.find((m) => m.role === "owner");

  const ask = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("club_request_join", { p_club: club.id });
    setBusy(false);
    if (error) { toast(error.message); return; }
    await reloadClubs();
    toast(data === "joined" ? t("Du bist dem Club beigetreten.") : t("Anfrage gesendet."));
  };
  const openMember = (nick) => { closeClub(); onOpenProfile(nick); };

  return (
    <div className="modal-overlay" onClick={closeClub}>
      <div className="modal-box club-members-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={club.name}>
        <div className="cm-head">
          <button type="button" className="cm-logo" style={{ background: logo ? "#fff" : bg, color: inkFor(bg) }}
            onClick={() => logo && setLogoOpen(true)} aria-label={t("Club-Logo ansehen")} disabled={!logo}>
            {logo ? <img src={logo} alt="" width="76" height="76" /> : <b>{club.tag}</b>}
          </button>
          <div className="cm-title">
            <h3>{club.name}</h3>
            <div className="cm-sub"><ClubTag club={club} compact /></div>
            {club.motto && <p className="cm-motto">"{club.motto}"</p>}
          </div>
        </div>
        <div className="cm-kpis">
          <div><b>{members.length}</b><span>{t("Mitglieder")}</span></div>
          <div><b>{stats.avg ?? "–"}</b><span>{t("Ø Rating")}</span></div>
          <div><b>{stats.n}</b><span>{t("Matches")}</span></div>
          <div title={stats.outN ? t("{n} Matches gegen Nicht-Mitglieder", { n: stats.outN }) : undefined}><b>{stats.rate != null ? `${stats.rate} %` : "–"}</b><span>{t("Quote vs. andere")}</span></div>
          <div title={t("Stärkstes Mitglied")}><b>{stats.best ? <><Trophy size={12} /> {stats.best.rating}</> : "–"}</b><span className="cm-ellip">{stats.best?.nickname || t("Stärkstes Mitglied")}</span></div>
          <div><b>{fmtDate(club.created_at)}</b><span>{t("gegründet")}</span></div>
        </div>
        {owner && <p className="cm-owner">{t("Gründer")}: <button type="button" className="name-link" onClick={() => openMember(owner.nick)}>{owner.nick}</button></p>}
        <div className="cm-list">
          {sorted.map((m, i) => (
            <button key={m.player_id} type="button" className="cm-row" onClick={() => openMember(m.nick)}>
              <span className="cm-rank">{i + 1}.</span>
              <Ball nick={m.nick} color={colorOf(m.nick)} label={initials(m.nick)} badge={badgeOf(m.nick)} photo={photoOf(m.nick)} size={34} />
              <span className="cm-name">{m.nick}</span>
              {m.role === "owner" && <Crown size={14} aria-label={t("Gründer")} />}
              {m.role === "admin" && <ShieldCheck size={14} aria-label={t("Admin")} />}
              <span className="cm-rating">{ratingOf[m.nick]?.rating ?? "–"}</span>
            </button>
          ))}
        </div>
        <div className="sp-controls">
          {!mine && (req
            ? <span className="hint">{t("Angefragt")}</span>
            : <button className="btn ghost" disabled={busy} onClick={ask}><UserPlus size={16} /> {t("Beitritt anfragen")}</button>)}
          <button className="btn primary" onClick={closeClub}><X size={16} /> {t("Schließen")}</button>
        </div>
      </div>
      {logoOpen && <ClubLogoModal club={club} onClose={() => setLogoOpen(false)} />}
    </div>
  );
}
