import { clubLogoUrl } from "../../lib/clubLogo";

/* Club-Tag ("Clan-Tag"): Kuerzel des Clubs als kleine farbige Pille, z. B. [HOME]. Die Farbe stammt vom Club; hat er keine,
   wird sie stabil aus dem Kuerzel abgeleitet, damit zwei Clubs ohne Farbwahl trotzdem unterscheidbar sind. Die Schriftfarbe
   (hell/dunkel) richtet sich nach der Helligkeit des Hintergrunds. Voller Name steht in title/aria-label. */
const hashHue = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; };

export const clubColor = (c) => c?.color || `hsl(${hashHue(c?.tag || "")} 55% 38%)`;

const inkFor = (color) => {
  const m = /^#([0-9a-f]{6})$/i.exec(color || "");
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#111" : "#fff";
};

export default function ClubTag({ club, withName = false, title }) {
  if (!club) return null;
  const bg = clubColor(club);
  const logo = clubLogoUrl(club);
  return (
    <span className="club-tag" style={{ background: bg, color: inkFor(bg) }} title={title || club.name} aria-label={club.name}>
      {logo && <img className="club-tag-logo" src={logo} alt="" width="18" height="18" loading="lazy" />}
      {club.tag}{withName && <span className="club-tag-name"> · {club.name}</span>}
    </span>
  );
}
