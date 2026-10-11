/* Emoji erkennen und auf den Dateinamen der Twemoji-Grafik abbilden. Reine Funktionen (node-tauglich, auch fuer
   scripts/buildEmojiSprite.mjs). Kein Lookbehind (aeltere iPhones). */

// Ein Emoji: Flagge, Tastenfolge (1️⃣), oder Piktogramm mit optionalem Variantenzeichen/Hautton, durch ZWJ verbunden.
// (c), (r), TM sind nur mit Variantenzeichen ein Emoji - sonst bleiben sie normaler Text (Impressum "©").
export const EMOJI_RE = /\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|(?:[\u00A9\u00AE\u2122]\uFE0F|(?![\u00A9\u00AE\u2122])\p{Extended_Pictographic})(?:\p{Emoji_Modifier}|\uFE0F)?(?:\u200D(?:\p{Extended_Pictographic})(?:\p{Emoji_Modifier}|\uFE0F)?)*/gu;

/* "1f3c6", "1f1e9-1f1ea" ... - Variantenzeichen (fe0f) fallen weg, nur in ZWJ-Folgen bleiben sie, wie bei Twemoji. */
export function emojiKey(e) {
  const cps = [...e].map((c) => c.codePointAt(0));
  const zwj = cps.includes(0x200d);
  return cps.filter((c) => zwj || c !== 0xfe0f).map((c) => c.toString(16)).join("-");
}
