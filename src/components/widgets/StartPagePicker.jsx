import { BarChart3, Trophy, Radio, User, Award, Activity, UserPlus, Users, BookOpen, Plus } from "lucide-react";
import { t } from "../../lib/i18n";
import { loadMenuPrefs, pinnedOrder, START_TAB_OF } from "../../lib/menuPrefs";

/* Startseite waehlen (415.19): eine Grafik der eigenen Menueleiste - dieselben Punkte in derselben Reihenfolge wie unten in der App, das runde "+"
   in der Mitte. Der Spieler tippt den Punkt an, der beim Start oeffnen soll. Steht "Zuletzt geoeffnete Seite" an (value === "last"), ist die
   Grafik ausgegraut und nicht antippbar. Punkte, die keine Seite sind (Tutorial, Einstellungen, Verwaltung), sind nicht waehlbar. */
const ICON = { stats: BarChart3, turnier: Trophy, live: Radio, profil: User, achievements: Award, mystats: Activity, invite: UserPlus, clubs: Users, regeln: BookOpen };
const LABEL = { stats: "Statistik", turnier: "Turniere", live: "Live", profil: "Identität", achievements: "Meine Erfolge", mystats: "Meine Zahlen",
  invite: "Spieler einladen", clubs: "Clubs", regeln: "Regelkunde", tutorial: "Tutorial", settings: "Einstellungen", admin: "Verwaltung" };

export default function StartPagePicker({ value, onPick, disabled }) {
  const entries = pinnedOrder(loadMenuPrefs());
  const off = value === "last";
  const split = Math.ceil(entries.length / 2);
  const item = (id) => {
    const tab = START_TAB_OF[id];
    const Icon = ICON[id];
    const label = t(LABEL[id] || id);
    const sel = !off && tab === value;
    return (
      <button key={id} type="button" className={"start-bar-item" + (sel ? " on" : "")} disabled={disabled || off || !tab}
        aria-pressed={sel} aria-label={label} title={label} onClick={() => onPick(tab)}>
        {Icon ? <Icon size={21} /> : null}<span>{label}</span>
      </button>
    );
  };
  return (
    <div className={"start-bar" + (off ? " off" : "")} role="group" aria-label={t("Startseite")} aria-disabled={off}>
      {entries.slice(0, split).map(item)}
      <span className="start-bar-fab" aria-hidden="true"><Plus size={22} /></span>
      {entries.slice(split).map(item)}
    </div>
  );
}
