import { useEffect, useState, Fragment } from "react";
import { emojiKey, EMOJI_RE } from "../lib/emoji/emojiKey";
import { lookup, subscribe } from "../lib/emoji/emojiSprites";

/* Ein Emoji als Vektorgrafik (Twemoji) statt vom Betriebssystem gezeichnet - auf jedem Geraet gleich, auch auf
   aelteren Geraeten und bei Flaggen unter Windows. Groesse = 1em, es folgt also der Schriftgroesse der Umgebung
   (wie das Text-Emoji vorher). Waehrend die Sammlung laedt, steht eine leere Flaeche gleicher Groesse da; fehlt das
   Symbol oder schlaegt das Laden fehl, erscheint das normale Emoji. */
export default function Emoji({ e, title, className }) {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force((n) => n + 1)), []);
  const key = emojiKey(e);
  const { markup, pending } = lookup(key);
  const cls = "emoji" + (className ? " " + className : "");
  if (markup) {
    return (
      <span className={cls} role="img" aria-label={title || e} title={title}>
        <svg viewBox="0 0 36 36" width="100%" height="100%" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: markup }} />
      </span>
    );
  }
  return pending
    ? <span className={cls} aria-hidden="true" />
    : <span className={"emoji-native" + (className ? " " + className : "")} role="img" aria-label={title || e} title={title}>{e}</span>;
}

/* Text mit Emoji: ersetzt jedes Emoji im String durch <Emoji>. Fuer Meldungen, Benachrichtigungen und Texte von
   Nutzern (Motto, Ping, Planung ...). Ohne Emoji kommt der Text unveraendert zurueck. */
export function EmojiText({ children }) {
  const s = typeof children === "string" ? children : null;
  if (s == null) return children ?? null;
  const out = [];
  let last = 0, i = 0;
  for (const m of s.matchAll(EMOJI_RE)) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(<Emoji key={i++} e={m[0]} />);
    last = m.index + m[0].length;
  }
  if (!out.length) return s;
  if (last < s.length) out.push(s.slice(last));
  return <Fragment>{out}</Fragment>;
}
