/* Suche in den Regelfaellen. Reine Funktionen (keine i18n-, keine Vite-Abhaengigkeit),
   damit scripts/checkSearch.mjs sie ohne Browser testen kann.

   Ziel: wer mitten im Match "Weisse versenkt?" oder "3 fouls" tippt, findet sofort
   die richtige Regel - auch mit Tippfehlern, ohne Umlaute, auf Englisch, mit
   Regelnummer oder in einer ganzen Frage.

   Ablauf
   1. normalize(): klein, ss/ae/oe/ue statt ß/ä/ö/ü, Satzzeichen weg, "9 Ball" -> "9ball",
      "14.1"/"14-1"/"straight pool" -> "14/1".
   2. Die Frage wird in Woerter zerlegt, Fuellwoerter ("wann ist ein ...") fallen weg.
   3. Jeder Fall hat gewichtete Felder: Name (6), Suchbegriffe (5), Regelnummer (5),
      Thema/Disziplin/Etikett (3), Text (1). Ein Wort trifft ein Feld exakt (1.0), als
      Wortanfang (0.8), als Teilwort (0.5) oder mit einem Tippfehler (0.6, ab 5 Zeichen).
      Synonyme zaehlen wie das Wort selbst (0.9).
   4. Alle Woerter muessen treffen (UND). Trifft so nichts, gilt ODER - mit weniger
      Treffern weiter hinten. Sortiert nach Punkten, bei Gleichstand wie im Katalog. */

export const norm = (s) => String(s ?? "")
  .toLowerCase()
  .replace(/ß/g, "ss").replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u")
  .replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u")
  .replace(/straight\s*pool/g, "14/1")
  .replace(/14[\s.-]+1(?![0-9])/g, "14/1")
  .replace(/(\d+)[\s-]*ball/g, "$1ball")
  .replace(/ball[\s-]*in[\s-]*hand/g, "ballinhand")
  .replace(/push[\s-]*out/g, "pushout")
  .replace(/([0-9])\.([0-9])/g, "$1$2") // Regelnummern wie 3.2 schuetzen (kein Lookbehind: aeltere iPhones)
  .replace(/[^a-z0-9/\s]/g, " ")
  .replace(//g, ".")
  .replace(/\s+/g, " ").trim();

const STOP = new Set(norm(`
 wann ich du wir mein meine meinen ist es ein eine einen einer eines der die das den dem des wie was wo wer bei beim und oder mit ohne wenn
 zu zum zur im in am an auf ob man darf muss soll kann sind wird werden hat habe haben gibt gilt
 regel regeln frage fragen welche welcher welches wieso warum wegen fuer von aus um auch noch nur dann
 spielen spiele spielt machen macht gemacht tun the a an is are it its when how what which if do does can must on in of to for and or with without rule rules
 `).split(" "));

/* Synonyme (normalisiert): ein Suchwort trifft auch diese Woerter. Einseitig reicht,
   weil beide Richtungen eingetragen sind, wo es sinnvoll ist. */
const SYN_RAW = {
  foul: ["regelverstoss", "verstoss", "fehler", "strafe", "illegal", "unerlaubt"],
  strafe: ["foul", "abzug"],
  weisse: ["spielball", "cue ball", "queue ball", "cueball"],
  spielball: ["weisse"],
  kugel: ["ball", "objektkugel", "balls"],
  kugeln: ["balls", "objektkugeln"],
  ball: ["kugel"],
  tasche: ["loch", "pocket", "ecke"],
  loch: ["tasche", "pocket"],
  bande: ["rail", "cushion", "band", "rand"],
  rail: ["bande", "cushion"],
  cushion: ["bande", "rail"],
  stoss: ["schuss", "shot", "stoppen"],
  schuss: ["stoss", "shot"],
  shot: ["stoss"],
  anstoss: ["break", "eroffnung", "eroffnungsstoss", "breakstoss"],
  break: ["anstoss", "eroffnungsstoss"],
  eroffnungsstoss: ["anstoss", "break"],
  versenkt: ["pocketed", "gefallen", "gelocht", "eingelocht", "faellt"],
  versenken: ["pocketed", "einlochen", "locht"],
  gefallen: ["versenkt", "gefallen"],
  scratch: ["weisse versenkt", "weisse tasche"],
  gruppe: ["volle", "halbe", "streifen", "solids", "stripes", "group"],
  volle: ["gruppe", "solids"],
  halbe: ["gruppe", "stripes"],
  berührt: ["beruhrt", "touch"],
  beruhrt: ["touch", "beruhrung", "kontakt"],
  beruhrung: ["kontakt", "touch", "beruhrt"],
  kontakt: ["beruhrung", "treffer", "contact"],
  treffer: ["beruhrung", "kontakt", "hit"],
  rack: ["aufbau", "dreieck", "raute", "neuaufbau", "aufbauen"],
  aufbau: ["rack", "neuaufbau"],
  dreieck: ["rack"],
  neuaufbau: ["rack", "wiederaufbau", "aufbauen"],
  drei: ["3", "three"],
  "3": ["drei", "three"],
  dritte: ["3", "drei", "third"],
  tisch: ["table"],
  table: ["tisch"],
  nummer: ["niedrigste"],
  niedrigste: ["kleinste", "lowest", "nummer"],
  lowest: ["niedrigste", "kleinste"],
  push: ["pushout"],
  pushout: ["push", "zweiter stoss"],
  kopffeld: ["kitchen", "kopflinie", "head string"],
  kopflinie: ["head string", "kopffeld", "kitchen"],
  kitchen: ["kopffeld", "kopflinie"],
  ballinhand: ["lageverbesserung", "weisse hand"],
  lageverbesserung: ["ballinhand"],
  sekunden: ["sekunde", "seconds", "5 s"],
  rollt: ["bewegt", "rollt noch", "bewegung", "moving"],
  bewegt: ["rollt", "bewegung", "moving"],
  bewegung: ["rollt", "bewegt"],
  springt: ["gesprungen", "fliegt", "jump", "jumps"],
  gesprungen: ["springt", "fliegt", "jump"],
  fliegt: ["springt", "gesprungen"],
  gleichzeitig: ["simultaneous", "doppel", "zugleich"],
  doppeltreffer: ["gleichzeitig"],
  verloren: ["verlust", "loss", "lost"],
  verlust: ["verloren", "loss"],
  warnung: ["verwarnung", "warn", "warnt"],
  verwarnung: ["warnung", "warn"],
  punkte: ["abzug", "points", "punkt"],
  treffen: ["treffer", "beruhrung", "beruhren", "hit"],
  zuerst: ["erste", "erstkontakt", "first"],
  oft: ["folge", "mehrmals", "wiederholt", "hintereinander", "mehrere"],
  mehrere: ["drei", "folge"],
  "1": ["eins", "one"], "2": ["zwei", "two"], "4": ["vier", "four"], "5": ["funf", "five"], "7": ["sieben"],
  eins: ["1"], zwei: ["2"], vier: ["4"], funf: ["5"],
  abzug: ["punkte", "strafe", "deduction"],
};
const SYN = {};
for (const [k, v] of Object.entries(SYN_RAW)) SYN[norm(k)] = v.map(norm);

// Abstand mit hoechstens `max` Aenderungen (Einfuegen, Loeschen, Ersetzen, Vertauschen)
const near = (a, b, max = 1) => {
  if (Math.abs(a.length - b.length) > max) return false;
  const m = a.length, n = b.length;
  let prev2 = null, prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= n; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return false;
    prev2 = prev; prev = cur;
  }
  return prev[n] <= max;
};

/* Wie gut trifft Wort w ein Feld (Liste normalisierter Tokens)? 0 = gar nicht. */
const quality = (w, tokens, joined) => {
  let best = 0;
  for (const tk of tokens) {
    if (tk === w) return 1;
    if (w.length >= 3 && tk.startsWith(w)) best = Math.max(best, 0.8);
    else if (w.length >= 4 && tk.includes(w)) best = Math.max(best, 0.5);
    else if (w.length >= 5 && tk.length >= 4 && best < 0.6 && near(w, tk, 1)) best = 0.6;
  }
  // Mehrwort-Synonyme ("weisse versenkt") treffen als Phrase
  if (w.includes(" ") && joined.includes(w)) best = Math.max(best, 0.9);
  return best;
};

const tokensOf = (list) => {
  const text = norm(list.filter(Boolean).join(" \n "));
  return { tokens: text.split(" ").filter(Boolean), joined: " " + text + " " };
};

/* Baut den Suchindex eines Falls. tr(s) liefert den Text in der Anzeigesprache. */
export const indexCase = (c, { tr = (s) => s, topics = {}, tagNames = {}, sets = (x) => x.sets || [{ discs: x.discs, variants: x.variants }], discNames = {} } = {}) => {
  const both = (list) => list.filter(Boolean).flatMap((s) => [s, tr(s)]);
  const setList = sets(c);
  const discs = c.discs.flatMap((d) => [d, discNames[d]]);
  // Phrasen (Name und Suchbegriffe, beide Sprachen): eine ganze Wendung wie "falsche Kugel" soll
  // den Fall mit genau dieser Wendung nach vorn bringen, nicht den mit zufaellig beiden Woertern.
  const phrases = [...new Set(both([c.title, ...(c.keywords || [])]))].map((txt) => {
    const text = norm(txt);
    return { text, title: txt === c.title || txt === tr(c.title), content: text.split(" ").filter((w) => w && !STOP.has(w)) };
  });
  return {
    c,
    phrases,
    title: tokensOf(both([c.title])),
    keys: tokensOf(both(c.keywords || [])),
    ref: tokensOf((c.ref || "").split(/[,\s]+/).filter(Boolean).map((r) => "regel " + r)),
    tag: tokensOf([...both([topics[c.topic]]), ...both((c.tags || []).map((k) => tagNames[k])), ...both(discs), ...both(setList.map((s) => s.tag))]),
    text: tokensOf(both([c.rule, ...setList.flatMap((s) => s.variants.flatMap((v) => [v.reason, ...v.steps.map((x) => x.text)]))])),
  };
};
const W = { title: 6, keys: 5, ref: 5, tag: 3, text: 1 };

const wordScore = (w, ix) => {
  let best = 0;
  const forms = [[w, 1], ...((SYN[w] || []).map((s) => [s, 0.9]))];
  for (const [f, mult] of forms) {
    for (const key of Object.keys(W)) {
      const q = quality(f, ix[key].tokens, ix[key].joined);
      if (q) best = Math.max(best, W[key] * q * mult);
    }
  }
  return best;
};

export const queryWords = (q) => {
  const words = norm(q).split(" ").filter(Boolean);
  const kept = words.filter((w) => !STOP.has(w) && (w.length > 1 || /[0-9]/.test(w)));
  return kept.length ? kept : words.filter((w) => w.length > 1);
};

/* Suche: list = Fall-Indizes (indexCase) in Katalogreihenfolge. Liefert Faelle. */
export const searchIndexed = (indexed, q) => {
  const words = queryWords(q);
  if (!words.length) return indexed.map((x) => x.c);
  const qn = norm(q);
  const phraseBonus = (ix) => {
    if (words.length < 2) return 0;
    let best = 0;
    for (const p of ix.phrases) {
      if ((" " + p.text + " ").includes(" " + qn + " ")) best = Math.max(best, 12); // genau diese Wendung
      else if (p.content.length >= 2 && p.content.every((w) => words.includes(w))) best = Math.max(best, p.title ? 10 : 8); // alle Inhaltswoerter der Wendung stehen in der Frage
    }
    return best;
  };
  const rows = indexed.map((ix, order) => {
    const scores = words.map((w) => wordScore(w, ix));
    return { ix, order, scores, all: scores.every((s) => s > 0), sum: scores.reduce((a, b) => a + b, 0) + phraseBonus(ix), hit: scores.filter((s) => s > 0).length };
  });
  let res = rows.filter((r) => r.all);
  // ODER-Auffangnetz nur bei laengeren Fragen und wenn die meisten Woerter treffen - sonst lieber nichts als etwas Irrefuehrendes
  if (!res.length && words.length >= 3) res = rows.filter((r) => r.hit >= Math.max(2, Math.ceil(words.length * 0.6)));
  return res.sort((a, b) => b.sum - a.sum || a.order - b.order).map((r) => r.ix.c);
};
