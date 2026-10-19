import { useState } from "react";
import { getListMode } from "./uiPrefs";
import SegmentBar from "../components/widgets/SegmentBar";

/* EIN Mechanismus fuer "Kapitel" auf jedem Bildschirm (Nutzer-Wunsch 2026-10-20: Tab-Freak / Doomscroller sollen ueberall gleich wirken,
   nicht nur auf Statistik und "Meine Zahlen"):
   - Tab-Freak ("chapters", Standard): oben die Kapitel-Leiste (SegmentBar), darunter nur das gewaehlte Kapitel.
   - Doomscroller ("stacked"): keine Leiste, alle Kapitel untereinander; ihre Kopfzeilen (.stat-block-head) bleiben beim Scrollen oben.
   Die Kapitel sind ganz normale Karten im Bildschirm - jede wird in <Chap id c={chapters}> gehuellt (display: contents, nimmt also keinen
   Platz und stoert kein Flex-Layout); inaktive Kapitel sind im Tab-Modus per CSS ausgeblendet. Gemerkt wird das gewaehlte Kapitel je
   Bildschirm in localStorage ("chap:<key>"). Gibt es nur ein Kapitel, gibt es keine Leiste und nichts wird versteckt. */
export function useChapters(key, items) {
  const ids = items.map((x) => x.id);
  const [pick, setPick] = useState(() => { try { return localStorage.getItem("chap:" + key) || ""; } catch { return ""; } });
  const active = ids.includes(pick) ? pick : ids[0];
  const chaptered = getListMode() === "chapters" && ids.length > 1;
  const choose = (id) => { setPick(id); document.querySelector("main.content")?.scrollTo({ top: 0 }); try { localStorage.setItem("chap:" + key, id); } catch { /* ignore */ } };
  return { key, items, active, chaptered, choose };
}

/* Die Leiste - nur im Tab-Modus. */
export function ChapterBar({ c, label }) {
  if (!c.chaptered) return null;
  return <SegmentBar segments={c.items.map((x) => ({ id: x.id, label: x.label }))} active={c.active} onChange={c.choose} label={label} storageKey={"chap-" + c.key} />;
}

/* Huelle um ein Kapitel. */
export function Chap({ id, c, children }) {
  const off = c.chaptered && c.active !== id;
  return <div className={"chap" + (off ? " off" : "")} data-chap={id}>{children}</div>;
}
