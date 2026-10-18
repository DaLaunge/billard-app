import { clubLogoUrl } from "../../lib/clubLogo";
import { clubColor, inkFor } from "./ClubTag";

/* Club-Kachel der Identitaetskarte: Logo-Scheibe (ohne Logo das Kuerzel in der Clubfarbe), daneben Clubname und Kuerzel; bei mehr
   als einem Club ein "+n". Antippbar und oeffnet die Vollansicht - als span role=button, weil der Kartenkopf selbst ein <button>
   sein kann. Gleicher Aufbau wie die Disziplin-Kachel daneben (.id-tile). */
export default function ClubEmblem({ club, more = 0, onOpen }) {
  const logo = clubLogoUrl(club);
  const bg = clubColor(club);
  const open = (e) => { e.stopPropagation(); onOpen(club); };
  return (
    <span className="id-tile id-tile-club" role="button" tabIndex={0} title={club.name} aria-label={club.name} onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(e); } }}>
      <span className="id-tile-disc" style={{ background: logo ? "#fff" : bg, color: inkFor(bg), boxShadow: `0 0 0 2px ${bg}` }}>
        {logo ? <img src={logo} alt="" width="36" height="36" loading="lazy" /> : <b>{club.tag}</b>}
      </span>
      <span className="id-tile-text">
        <strong>{club.name}</strong>
        <small>{club.tag}{more > 0 ? ` · +${more}` : ""}</small>
      </span>
    </span>
  );
}
