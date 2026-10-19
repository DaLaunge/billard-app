import { useState } from "react";
import { Check, X, MailPlus } from "lucide-react";
import { supabase } from "../../supabase";
import { t } from "../../lib/i18n";
import { useClubData, reloadClubs, roleIn } from "../../lib/clubStore";
import ClubTag from "./ClubTag";

/* Postfach auf der Profilseite: Einladungen AN MICH (annehmen/ablehnen) und - fuer Club-Leiter - Anfragen an meine Clubs
   (aufnehmen/ablehnen). Erscheint nur, wenn etwas offen ist; ohne Clubs oder ohne offene Zeilen gibt es gar keine Karte. */
export default function ClubInbox({ meRow, players, toast }) {
  const data = useClubData();
  const [busy, setBusy] = useState(false);
  const me = meRow?.id;
  const pending = (data.requests || []).filter((r) => r.status === "pending");
  const invites = pending.filter((r) => r.kind === "invite" && r.player_id === me);
  const requests = pending.filter((r) => r.kind === "request" && ["owner", "admin"].includes(roleIn(data, r.club_id, me)));
  if (!data.loaded || (invites.length === 0 && requests.length === 0)) return null;

  const nickOf = (pid) => players.find((p) => p.id === pid)?.nickname || "?";
  const clubOf = (cid) => data.clubs.find((c) => c.id === cid);
  const answer = async (r, accept) => {
    setBusy(true);
    const { error } = await supabase.rpc("club_respond", { p_request: r.id, p_accept: accept });
    setBusy(false);
    if (error) { toast(error.message); return; }
    await reloadClubs();
    if (accept) toast(r.kind === "invite" ? t("Du bist dem Club beigetreten.") : t("Aufgenommen."));
  };

  const row = (r, text) => {
    const c = clubOf(r.club_id);
    if (!c) return null;
    return (
      <div key={r.id} className="club-row club-inbox-row">
        <ClubTag club={c} />
        <span className="club-row-name">{text}</span>
        <button className="icon-btn small primary" disabled={busy} title={t("Annehmen")} aria-label={t("Annehmen")} onClick={() => answer(r, true)}><Check size={16} /></button>
        <button className="icon-btn small" disabled={busy} title={t("Ablehnen")} aria-label={t("Ablehnen")} onClick={() => answer(r, false)}><X size={16} /></button>
      </div>
    );
  };

  return (
    <section className="stat-block club-inbox">
      <div className="stat-block-head"><h3><MailPlus size={17} /> {t("Club-Post")} ({invites.length + requests.length})</h3></div>
      {invites.map((r) => row(r, t("Einladung in „{name}“", { name: clubOf(r.club_id)?.name || "" })))}
      {requests.map((r) => row(r, t("{name} möchte in „{club}“", { name: nickOf(r.player_id), club: clubOf(r.club_id)?.name || "" })))}
    </section>
  );
}
