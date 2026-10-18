import { useState } from "react";
import { Crown, ShieldCheck, UserPlus, X } from "lucide-react";
import { supabase } from "../../supabase";
import { t } from "../../lib/i18n";
import { initials } from "../../lib/format";
import { useClubData, useViewingClub, closeClub, reloadClubs, roleIn } from "../../lib/clubStore";
import Ball from "../Ball";
import ClubTag, { clubColor, inkFor } from "./ClubTag";
import ClubLogoModal from "./ClubLogoModal";
import { clubLogoUrl } from "../../lib/clubLogo";

/* Mitgliederliste eines Clubs als Fenster: einmal in App.jsx eingehaengt, geoeffnet per openClub(id) (Klick auf einen Club-Tag in einer
   Liste). Kopf mit Logo, Name, Tag und Anzahl, darunter alle Mitglieder (Gruender, Admins, dann alphabetisch); ein Tipp auf ein
   Mitglied oeffnet dessen Profil. Wer noch kein Mitglied ist, kann hier direkt Beitritt anfragen. */
const ORDER = { owner: 0, admin: 1, member: 2 };

export default function ClubMembersHost({ me, colorOf, badgeOf, photoOf, onOpenProfile, toast }) {
  const id = useViewingClub();
  const d = useClubData();
  const [busy, setBusy] = useState(false);
  const [logoOpen, setLogoOpen] = useState(false);
  const club = id ? d.clubs.find((c) => c.id === id) : null;
  if (!club) return null;

  const members = d.members.filter((m) => m.club_id === club.id)
    .map((m) => ({ ...m, nick: d.nickById[m.player_id] || "?" }))
    .sort((a, b) => ORDER[a.role] - ORDER[b.role] || a.nick.localeCompare(b.nick));
  const mine = roleIn(d, club.id, me?.id);
  const req = (d.requests || []).find((r) => r.club_id === club.id && r.player_id === me?.id && r.status === "pending");
  const logo = clubLogoUrl(club);
  const bg = clubColor(club);

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
            {logo ? <img src={logo} alt="" width="56" height="56" /> : <b>{club.tag}</b>}
          </button>
          <div className="cm-title">
            <h3>{club.name}</h3>
            <div className="cm-sub"><ClubTag club={club} compact /> <span>{t("{n} Mitglieder", { n: members.length })}</span></div>
          </div>
        </div>
        <div className="cm-list">
          {members.map((m) => (
            <button key={m.player_id} type="button" className="cm-row" onClick={() => openMember(m.nick)}>
              <Ball nick={m.nick} color={colorOf(m.nick)} label={initials(m.nick)} badge={badgeOf(m.nick)} photo={photoOf(m.nick)} size={34} />
              <span className="cm-name">{m.nick}</span>
              {m.role === "owner" && <Crown size={14} aria-label={t("Gründer")} />}
              {m.role === "admin" && <ShieldCheck size={14} aria-label={t("Admin")} />}
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
