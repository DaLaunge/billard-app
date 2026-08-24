import { t } from "../lib/i18n";
import { luminance } from "../lib/format";
import { BADGE_INFO } from "../lib/constants";

export default function Ball({ color, label, size = 44, badge = null }) {
  const b = badge && BADGE_INFO[badge] ? BADGE_INFO[badge] : null;
  const light = luminance(color) > 0.6; // helle Kugel -> dunkle Beschriftung
  const numStyle = light
    ? { background: "#1E1E1E", color: "#F2EDE0" }
    : { background: "#F2EDE0", color: "#1E1E1E" };
  return (
    <div className="ball" style={{ width: size, height: size, background: color }}>
      <div className="ball-shine" />
      {b ? (
        <div className={"ball-badge" + (light ? " on-light" : "")}
          style={{ fontSize: size * 0.5 }} title={t(b.name)}>{b.emoji}</div>
      ) : (
        <div className="ball-num"
          style={{ width: size * 0.52, height: size * 0.52, fontSize: size * 0.28, ...numStyle }}>
          {label}
        </div>
      )}
    </div>
  );
}
