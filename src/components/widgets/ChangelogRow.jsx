import { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { t } from "../../lib/i18n";
import { RELEASE_NOTES } from "../../lib/releaseNotes";
import Emoji from "../Emoji";

/* Ausfuehrliches Changelog (Profil bearbeiten -> Konto & Hilfe): alle Neuerungen aus
   RELEASE_NOTES, neueste zuerst, nach Version gruppiert. Nur Features, keine Bugfixes. */
export default function ChangelogRow() {
  const [open, setOpen] = useState(false);
  return (
    <div className="acct-sub">
      <div className="acct-row">
        <Sparkles size={16} className="acct-ico" />
        <span className="acct-text">{t("Was ist neu?")}</span>
        <button type="button" className="icon-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          aria-label={t("Neuerungen anzeigen")} title={t("Neuerungen anzeigen")}>
          <ChevronDown size={18} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </button>
      </div>
      <div className={"collapsible" + (open ? " open" : "")} inert={open ? undefined : ""}>
        <div className="collapsible-inner">
          <div className="changelog-list">
            {RELEASE_NOTES.map((n) => (
              <div key={n.version} className="changelog-ver">
                <div className="changelog-v">{t("Version")} {n.version}</div>
                <ul className="news-list" style={{ maxHeight: "none", overflow: "visible", margin: 0 }}>
                  {n.items.map((text, i) => (
                    <li key={i}><Emoji e={n.icon || "✨"} /> <span>{t(text)}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
