import { useState } from "react";
import { Radio, MapPin, Pencil, X } from "lucide-react";
import { t } from "../lib/i18n";
import PingCard from "./PingCard";

export default function LiveScreen({ me, pings, colorOf, badgeOf, onCreate, onClose, onReply, onUnreply }) {
  const myPing = pings.find((p) => p.player_id === me.id);
  const others = pings.filter((p) => p.player_id !== me.id);
  const [loc, setLoc] = useState("");
  const [msg, setMsg] = useState("");
  const [hours, setHours] = useState(3);

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>{t("Live")}</h2>
        <span className="head-note">{t("Wer ist gerade am Tisch oder sucht ein Match?")}</span>
      </header>

      {myPing ? (
        <PingCard ping={myPing} me={me} colorOf={colorOf} badgeOf={badgeOf} onReply={onReply} onUnreply={onUnreply} />
      ) : (
        <section className="stat-block">
          <h3><Radio size={17} /> {t("Ich bin bereit!")}</h3>
          <div className="search-row">
            <MapPin size={16} className="mail-ico" />
            <input placeholder={t("Wo bist du? z. B. Schwedenplatz")} value={loc}
              maxLength={60} onChange={(e) => setLoc(e.target.value)} />
          </div>
          <div className="search-row">
            <Pencil size={16} className="mail-ico" />
            <input placeholder={t("Nachricht (optional), z. B. 'Wer hat Lust auf 9 Ball?'")} value={msg}
              maxLength={120} onChange={(e) => setMsg(e.target.value)} />
          </div>
          <div className="chips" style={{ marginBottom: 4 }}>
            {[1, 2, 3, 6].map((h) => (
              <button key={h} className={"chip" + (hours === h ? " active" : "")} onClick={() => setHours(h)}>
                {h} Std
              </button>
            ))}
          </div>
          <button className="btn primary" disabled={loc.trim().length < 2}
            onClick={() => { onCreate(loc, msg, hours); setLoc(""); setMsg(""); }}>
            <Radio size={17} /> {t("Live gehen")}
          </button>
          <p className="hint">{t("Dein Eintrag verschwindet nach der gewaehlten Zeit von selbst.")}</p>
        </section>
      )}

      {myPing && (
        <button className="btn ghost" onClick={onClose}><X size={15} /> {t("Meinen Live-Eintrag beenden")}</button>
      )}

      {others.length > 0 && <p className="q" style={{ marginTop: 18 }}>{t("Gerade aktiv:")}</p>}
      {others.map((p) => (
        <PingCard key={p.id} ping={p} me={me} colorOf={colorOf} badgeOf={badgeOf} onReply={onReply} onUnreply={onUnreply} />
      ))}
      {others.length === 0 && !myPing && (
        <p className="hint center" style={{ marginTop: 24 }}>
          {t("Gerade ist niemand live. Sei du der Erste - dein Eintrag erscheint hier fuer alle sichtbar.")}
        </p>
      )}
    </div>
  );
}
