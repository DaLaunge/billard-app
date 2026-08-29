import { t } from "../lib/i18n";
import { luminance } from "../lib/format";
import { BADGE_INFO } from "../lib/constants";

export default function Ball({ color, label, size = 44, badge = null, photo = null }) {
  const b = badge && BADGE_INFO[badge] ? BADGE_INFO[badge] : null;
  const light = luminance(color) > 0.6; // helle Kugel -> dunkle Beschriftung
  const numStyle = light
    ? { background: "#1E1E1E", color: "#F2EDE0" }
    : { background: "#F2EDE0", color: "#1E1E1E" };
  const ballStyle = photo
    ? { width: size, height: size, backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { width: size, height: size, background: color };
  return (
    <div className="ball" style={ballStyle}>
      {!photo && <div className="ball-shine" />}
      {!photo && !b && (
        <div className="ball-num"
          style={{ width: size * 0.52, height: size * 0.52, fontSize: size * 0.28, ...numStyle }}>
          {label}
        </div>
      )}
      {b && (
        <div className="ball-badge-chip" style={{ width: size * 0.46, height: size * 0.46, fontSize: size * 0.26 }} title={t(b.name)}>
          {b.emoji}
        </div>
      )}
    </div>
  );
}
