import { useClubData, primaryClubOfNick, openClub } from "../../lib/clubStore";
import ClubTag from "./ClubTag";

/* Club-Tag neben einem Spielernamen in Listen (Bestenlisten, Rekorde, Matches, Gegnerliste ...). Ein Tipp oeffnet die Mitgliederliste
   des Clubs (ClubMembersHost). Wer in keinem Club ist, bekommt nichts. Ein span role=button, weil die Listenzeilen selbst Knoepfe sind
   (ein verschachtelter <button> waere ungueltig); stopPropagation, damit die Zeile nicht zusaetzlich das Profil oeffnet. */
export default function NickClubTag({ nickname }) {
  const club = primaryClubOfNick(useClubData(), nickname);
  if (!club) return null;
  const open = (e) => { e.stopPropagation(); e.preventDefault(); openClub(club.id); };
  return (
    <span className="club-tag-link" role="button" tabIndex={0} aria-label={club.name} onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") open(e); }}>
      <ClubTag club={club} compact />
    </span>
  );
}
