import { clubLogoUrl } from "../../lib/clubLogo";
import { clubColor, inkFor } from "./ClubTag";

/* Club-Emblem neben der Kugel auf der Identitaetskarte: eine runde Scheibe mit dem Logo (ohne Logo: das Kuerzel in der Clubfarbe)
   und - nur wenn ein Logo da ist - das Kuerzel als kleine Pille darunter. Antippbar (span role=button, weil der Kartenkopf selbst
   ein <button> sein kann) und oeffnet die Vollansicht. */
export default function ClubEmblem({ club, size = 50, onOpen }) {
  const logo = clubLogoUrl(club);
  const bg = clubColor(club);
  const tagFont = Math.round(size * (club.tag.length <= 2 ? 0.34 : club.tag.length === 3 ? 0.28 : 0.22));
  const open = (e) => { e.stopPropagation(); onOpen(club); };
  return (
    <span className="club-emblem" role="button" tabIndex={0} title={club.name} aria-label={club.name} onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(e); } }}>
      <span className="club-emblem-disc" style={{ width: size, height: size, background: logo ? "#fff" : bg, color: inkFor(bg), fontSize: tagFont }}>
        {logo ? <img src={logo} alt="" width={size} height={size} loading="lazy" /> : club.tag}
      </span>
      {logo && <span className="club-emblem-tag" style={{ background: bg, color: inkFor(bg) }}>{club.tag}</span>}
    </span>
  );
}
