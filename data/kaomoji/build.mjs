#!/usr/bin/env node
// Builds data/kaomoji/kaomoji.json from pinned permissive sources + original compositions.
//
//   node data/kaomoji/build.mjs            # uses cached raw files, downloads missing ones
//   node data/kaomoji/build.mjs --report   # also prints rejected entries with reasons
//
// Raw downloads go to data/raw/kaomoji/<source-id>/ (gitignored). They are treated as
// untrusted data: only parsed as JSON, never executed.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = join(HERE, '..', 'raw', 'kaomoji');
const REPORT = process.argv.includes('--report');
// Max entries per primary tag; original compositions are never dropped by the cap.
const CAP_PER_TAG = 45;

// Pinned upstream files (commit SHAs recorded in SOURCES.md).
const DOWNLOADS = {
  'w33ble-emoticon-data': {
    file: 'emoticons.json',
    url: 'https://raw.githubusercontent.com/w33ble/emoticon-data/92b6211ec2a93e14052e0e572d697d4d06c71868/emoticons.json',
  },
  asciilib: {
    file: 'lib.json',
    url: 'https://raw.githubusercontent.com/iansinnott/asciilib/52b034b55a684251b4f0c4974d707b9de4d198f4/lib.json',
  },
  'fontvibe-originals': {
    file: 'originals.json',
    url: 'https://raw.githubusercontent.com/Funovate/fontvibe-kaomoji/7c5967824ddd3be6d1b28ce69ca01c99b124322b/data/originals.json',
  },
};

async function loadRaw(id) {
  const { file, url } = DOWNLOADS[id];
  const path = join(RAW, id, file);
  try {
    await access(path);
  } catch {
    await mkdir(join(RAW, id), { recursive: true });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
    await writeFile(path, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(await readFile(path, 'utf8'));
}

// ---------------------------------------------------------------------------
// Tag mapping for w33ble/emoticon-data (asciilib's tagged entries are the same set).
const W33BLE_TAGS = {
  happy: 'joy',
  fun: 'joy',
  love: 'love',
  excited: 'excited',
  laugh: 'laugh',
  sad: 'sad',
  angry: 'angry',
  surprised: 'surprise',
  scared: 'fear',
  worried: 'worried',
  embarassed: 'embarrassed',
  smug: 'smug',
  confused: 'confused',
  sleep: 'sleepy',
  surrender: 'give-up',
  hurt: 'hurt',
  dead: 'dead',
  evil: 'evil',
  crazy: 'crazy',
  hug: 'hug',
  kiss: 'kiss',
  wave: 'wave',
  dance: 'dance',
  run: 'run',
  whatever: 'shrug',
  'table flip': 'table-flip',
  wink: 'wink',
  cry: 'cry',
  sorry: 'sorry',
  hide: 'hide',
  write: 'write',
  think: 'think',
  stare: 'stare',
  cat: 'cat',
  dog: 'dog',
  bear: 'bear',
  rabbit: 'bunny',
  bird: 'bird',
  pig: 'pig',
  monkey: 'monkey',
  'sea creature': 'sea',
  animal: 'animal',
  music: 'music',
  troll: 'troll',
};
// Generic tags are demoted behind any more specific tag on the same entry.
const GENERIC = new Set(['joy', 'animal']);

// Hand-picked asciilib entries that are NOT in w33ble (asciilib key -> tags).
const ASCIILIB_PICKS = {
  chu: ['kiss'],
  joy: ['joy'],
  angry_flipped_table: ['table-flip', 'angry'],
  'pancakes?': ['eat'],
  sleepy_coffee: ['sleepy', 'eat'],
  wizard: ['magic', 'troll'],
  polar_bear: ['bear'],
  neo: ['weapons'],
  rage_face: ['angry'],
  rock_on: ['music'],
  shoot: ['weapons'],
  ffuuu: ['angry'],
  wtf_why: ['confused'],
  hail_satan: ['evil'],
  bomb: ['weapons'],
  gun: ['weapons'],
  sniper_rifle: ['weapons'],
  kita: ['excited'],
  kilroy: ['hide'],
  cheers: ['celebrate'],
  bear_with_outstretched_arms: ['hug', 'bear'],
  high_five: ['celebrate', 'joy'],
  pup: ['dog'],
  bear_with_glasses: ['bear', 'smug'],
  bear_putting_on_glasses: ['bear', 'smug'],
  bear_replacing_table: ['table-flip', 'bear'],
  bear_with_doubting_eyes: ['bear', 'stare'],
  council_of_doubt: ['stare', 'bear'],
  creep_bear_with_outstretched_arms: ['bear', 'hug', 'troll'],
  hugme: ['hug'],
  stick_up_your_dukes: ['fight'],
  angry_hug: ['hug', 'angry'],
  koala: ['animal'],
  council_of_disapproval: ['stare', 'bear'],
  disapproving_bear_with_outstretched_arms_flipping_table: ['table-flip', 'bear', 'angry'],
  "it's_cool_bro": ['smug', 'troll'],
  council_of_approval: ['joy'],
  mega_rage: ['angry'],
  bow: ['sorry'],
  dongers: ['troll', 'crazy'],
  'wat-wat': ['surprise'],
  dead_eyes: ['dead'],
  almost_cared: ['shrug'],
  fix_table: ['table-flip'],
  omg_yes: ['excited'],
  epic_win: ['celebrate', 'excited'],
  squee: ['excited'],
  round_cat: ['cat'],
  round_bird: ['bird'],
  fish: ['sea'],
  angry_shrug: ['shrug', 'angry'],
  spell_cast: ['magic'],
  gimme: ['troll'],
  kyle: ['bear', 'love'],
  crab: ['sea'],
  playing_in_snow: ['joy'],
  sunglasses: ['smug'],
  deal_with_it: ['smug'],
  'victory!': ['celebrate'],
  sad_donger: ['troll', 'sad'],
  sad_lenny: ['sad', 'troll'],
  riot: ['troll', 'angry'],
  point: ['surprise'],
  hadouken: ['fight', 'troll'],
  afraid: ['fear'],
  nathan: ['dance', 'music'],
  flip_all_tables: ['table-flip'],
  angry_face: ['angry'],
  this_guy: ['smug'],
  zombie: ['dead'],
  face_palm: ['give-up'],
  crying: ['cry', 'sad'],
  hugs: ['hug'],
  fight_me: ['fight'],
  sparkle: ['magic', 'joy'],
  'why?!': ['angry'],
  punch: ['fight'],
  spider: ['animal'],
  put_table_back: ['table-flip'],
  metal: ['music'],
  kitty: ['cat'],
  sword: ['weapons'],
  emo: ['sad'],
  singing: ['music', 'dance'],
  shocked: ['surprise'],
  monocle: ['stare'],
  shark_attack: ['sea'],
  piggy: ['pig'],
  'oh_hi!': ['hide', 'wave'],
  kisses: ['kiss', 'hug'],
  octoshrug: ['shrug'],
  delicious: ['eat'],
  tears: ['cry'],
  cat_star: ['cat', 'cute'],
  smile_with_heart: ['love', 'joy'],
  kiss_star: ['kiss'],
  shy_blush: ['embarrassed', 'cute'],
  sympathy: ['hug', 'cry'],
  square_mouth_afraid: ['fear'],
  hands_up_indifference: ['shrug'],
  'confusion_@eyes': ['confused'],
  surprise_round_eyes: ['surprise'],
  hands_up_greeting: ['wave'],
  winking_star: ['wink'],
  apologize: ['sorry'],
  writing_quietly: ['write'],
  running_fast: ['run'],
  sleepy: ['sleepy'],
  nya_cat: ['cat'],
  cute_polar_bear: ['bear', 'cute'],
  friends_together: ['hug', 'joy'],
  friends_hand_in_hand: ['joy', 'celebrate'],
  fight_enemies: ['fight'],
  shot_you: ['weapons'],
  magic_flower: ['magic', 'cute'],
  majic_star: ['magic'],
  food: ['eat'],
  cheering: ['celebrate'],
  poking: ['troll'],
  simple_dog: ['dog'],
  simple_cat: ['cat'],
  flower_cat: ['cat', 'cute'],
  table_flip_angry: ['table-flip', 'angry'],
  thumbs_down: ['angry'],
  blushing_flower_girl: ['embarrassed', 'cute'],
  cute_flower_bear: ['bear', 'cute'],
  awkward_cross_eyes: ['crazy'],
  singing_2: ['music'],
  punch_2: ['fight'],
  hungry: ['eat'],
  hungry_2: ['eat'],
  hungry_3: ['eat'],
  food_2: ['eat'],
  food_4: ['eat'],
  dance_excited_sing: ['dance', 'music'],
  dance_excited_sing_2: ['dance', 'music'],
  dance_excited_sing_3: ['dance', 'music'],
  dance_excited_sing_4: ['dance', 'music'],
  run: ['run'],
  run_2: ['run'],
  run_3: ['run'],
  exercise: ['excited'],
  cheer: ['celebrate'],
  cheer_2: ['celebrate'],
  cheer_3: ['celebrate'],
  sleep_6: ['sleepy'],
  sleep_7: ['sleepy'],
  sleep_8: ['sleepy'],
  sleep_9: ['sleepy'],
  sleep_10: ['sleepy'],
  sleep_11: ['sleepy'],
};

// Hand-picked FontVibe original kaomoji (CC0 per upstream NOTICE): text -> tags.
const FONTVIBE_PICKS = {
  'ㅡ(￣ー￣)ㅡ✧': ['smug'],
  '(⊃///ω///⊂)': ['embarrassed'],
  '(๑╯︵╰๑)': ['sad'],
  '(ﾉ╯︵╰,)ﾉ彡┻━┻': ['table-flip', 'sad'],
  '(//ω//)ﾉ⌒♡': ['embarrassed', 'love'],
  '(ﾉ>ω<)ﾉ♡♡': ['love', 'excited'],
  '(•̀ω•́)ง': ['fight'],
  '(っ◡‿◡)っ人(◡‿◡c)': ['hug'],
  '(｡•́ ‸ •̀｡)': ['sad'],
  '(๑ºДº๑)!': ['surprise'],
  '(っ˘ω˘)っ旦': ['eat'],
  '(๑>ω<๑)⊃口': ['eat', 'excited'],
  '▁▁(－ω－)▁▁zZ': ['sleepy'],
  '(・ω・)ﾉ⌒∪・ω・∪': ['dog'],
  '≡≡(・_・)≡≡': ['run'],
  '( ⁰ ⌓ ⁰ )': ['confused'],
  '|ω・)…ﾉ': ['hide'],
  'φ(・ω・｀)…⌇': ['write'],
  '(||ω||)': ['fear'],
};

// Entries rejected after manual review (texts as they appear after cleanup).
const BLOCKLIST = new Set([
  '( c//”-}{-*\\x)', // garbled
  '( ;,;)', // not a face
  ':(¦)',
  '＠ノ"',
  '>=<',
  '~~……ヾლ∩з…….~~',
  '( ख़ืིڞ◟྄ख़ืི)',
  '๐छ ੂछ๐',
  '(•᷉ुε ू•᷈,)',
  '(*σᴗσ)(ㅎᴗㅎ )\u3000｜‸눈;)',
  '애❣⃛ღсμтёღ♡(˘ᵋ ˘ )', // embedded text
  '<ब₍₍( ˃̗εू˂ )₎₎<ब',
  '(っ˘зʕ•̫͡•ʔcнϋෆ*',
  't(ツ)_/¯', // obscene gesture variant
  '3:*)',
]);

// Manual retagging after review, where upstream tags are clearly off (text -> tags).
const OVERRIDES = {
  '( ͡° ͜ʖ ͡°)': ['smug', 'troll'],
  '(¬‿¬)': ['smug'],
  ಠ_ಠ: ['stare', 'angry'],
  'ლ(ಠ_ಠლ)': ['angry', 'stare'],
  "(╯'□')╯︵ ┻━┻": ['table-flip', 'angry'],
  '❣◕ ‿ ◕❣': ['love', 'cute'],
  '(`･ω･´)': ['smug'],
  '( ́・ω・`)': ['sad'],
  '(｀◔ ω ◔´)': ['crazy'],
  '(・∀・)': ['joy'],
  '(๑′ᴗ‵๑)': ['cute'],
  '(⊙ω⊙)': ['surprise'],
  'O(∩_∩)O': ['joy'],
  '∑(￣□￣)': ['surprise'],
  'ヾ(。￣□￣)ﾂ': ['surprise'],
  'ヾ(￣□￣;)ﾉ': ['surprise', 'worried'],
  'ヾ(￣0￣； )ノ': ['surprise'],
  'Σ(￣。￣ノ)ノ': ['surprise'],
  '٩(ˊᗜˋ*)و': ['celebrate', 'joy'],
  '(°◇°;)': ['surprise'],
  '≖‿≖': ['smug', 'evil'],
  '＼(^o^)／': ['celebrate', 'joy'],
  '♡(•ི̛ᴗ•̛)ྀ': ['love', 'cute'],
  '♡*(ू•‧̫•ू⑅)♡⋆*ೃ:.✧': ['love', 'cute'],
  '◔̯︵◔': ['sad'],
};

// Secondary tags inferred from glyphs.
const GLYPH_TAGS = [
  [/[♪♫♬♩]/u, 'music'],
  [/[♡♥❤]/u, 'love'],
  [/┻━┻/u, 'table-flip'],
  [/ᴥ|\([エｴ工]\)|㉨/u, 'bear'],
  [/zz|ᶻ/iu, 'sleepy'],
];

// ---------------------------------------------------------------------------
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/gu;
// eslint-disable-next-line no-control-regex -- rejecting control characters is the point
const CONTROL = /[\u0000-\u001F\u007F-\u009F\uFFFD]/u;
const MOJIBAKE = /Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|â€|ï¼|ã€|ãƒ|ã‚/u;
const COMBINING = /\p{M}/u;

export function clean(text) {
  return text.replace(INVISIBLE, '').normalize('NFC').trim();
}

// Key used for dedupe: ignores all whitespace (incl. ideographic space).
// Also folds the Halfwidth and Fullwidth Forms block, e.g. （＾_＾） vs (＾_＾), ･ vs ・.
// (Full NFKC would be too aggressive: it maps ﹏ to _ and ³ to 3.)
export function dedupeKey(text) {
  return text.replace(/[\uFF00-\uFFEF]/gu, (c) => c.normalize('NFKC')).replace(/[\s\u3000]+/gu, '');
}

function bracketImbalance(t) {
  const count = (re) => (t.match(re) || []).length;
  return Math.abs(count(/[(（]/gu) - count(/[)）]/gu));
}

// Returns a rejection reason, or null if the text is acceptable.
function qualityProblem(text, { allowWords = false } = {}) {
  if (!text) return 'empty';
  if (!text.isWellFormed()) return 'lone surrogate';
  if (CONTROL.test(text)) return 'control/replacement char';
  if (MOJIBAKE.test(text)) return 'mojibake';
  if (text.includes('\n')) return 'multiline';
  const cps = [...text];
  let run = 0;
  let maxRun = 0;
  let marks = 0;
  for (const c of cps) {
    if (COMBINING.test(c)) {
      marks++;
      run++;
      maxRun = Math.max(maxRun, run);
    } else run = 0;
  }
  if (maxRun > 2 || marks > 6) return 'combining-mark stacking';
  const visible = cps.length - marks;
  if (visible < 2) return 'too short';
  if (visible > 28) return 'too long';
  if (bracketImbalance(text) >= 5) return 'unbalanced brackets';
  if (!allowWords) {
    const words = text.match(/[A-Za-z]{4,}/gu) || [];
    if (words.some((w) => !/^z+$/iu.test(w))) return 'contains words';
  }
  return null;
}

// Lower is better. Used only to choose which sourced entries survive the per-tag cap.
const RARE_SCRIPT =
  /[\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Tibetan}\p{Script=Thai}\p{Script=Lao}\p{Script=Myanmar}\p{Script=Ethiopic}\p{Script=Hangul}]/u;
function qualityScore(text) {
  let score = 0;
  let visible = 0;
  for (const c of text) {
    if (COMBINING.test(c)) score += 2;
    else {
      visible++;
      if (RARE_SCRIPT.test(c) && !/[๑ಠㅅㅂㅡ]/u.test(c)) score += 3;
    }
  }
  return score + Math.max(0, visible - 10);
}

function orderTags(tags) {
  const uniq = [...new Set(tags)];
  const specific = uniq.filter((t) => !GENERIC.has(t));
  const generic = uniq.filter((t) => GENERIC.has(t));
  return [...specific, ...generic];
}

function addGlyphTags(text, tags) {
  const out = [...tags];
  for (const [re, tag] of GLYPH_TAGS) {
    if (out.length >= 4) break;
    if (re.test(text) && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, 4);
}

// ---------------------------------------------------------------------------
async function main() {
  const categories = JSON.parse(await readFile(join(HERE, 'categories.json'), 'utf8'));
  const tagOrder = new Map(categories.map((c, i) => [c.slug, i]));
  const rejected = [];
  const candidates = []; // { text, tags, source }

  const push = (rawText, tags, source, opts = {}) => {
    const text = clean(rawText);
    const problem = BLOCKLIST.has(text) ? 'blocklist' : qualityProblem(text, opts);
    if (problem) {
      rejected.push({ source, text: rawText, problem });
      return;
    }
    for (const t of tags) if (!tagOrder.has(t)) throw new Error(`unknown tag ${t} (${source})`);
    candidates.push({ text, tags: orderTags(tags), source });
  };

  // 1. w33ble/emoticon-data
  const w33ble = await loadRaw('w33ble-emoticon-data');
  for (const e of w33ble.emoticons) {
    const tags = e.tags.map((t) => {
      if (!(t in W33BLE_TAGS)) throw new Error(`unmapped w33ble tag: ${t}`);
      return W33BLE_TAGS[t];
    });
    push(e.string, tags, 'w33ble-emoticon-data');
  }

  // 2. asciilib (only hand-picked entries outside the w33ble subset)
  const asciilib = await loadRaw('asciilib');
  for (const [key, tags] of Object.entries(ASCIILIB_PICKS)) {
    if (!asciilib[key]) throw new Error(`asciilib pick missing upstream: ${key}`);
    push(asciilib[key].entry, tags, 'asciilib', { allowWords: true });
  }

  // 3. FontVibe originals
  const fontvibe = await loadRaw('fontvibe-originals');
  const fvTexts = new Set(fontvibe.map((x) => clean(x.text)));
  for (const [text, tags] of Object.entries(FONTVIBE_PICKS)) {
    if (!fvTexts.has(clean(text))) throw new Error(`fontvibe pick missing upstream: ${text}`);
    push(text, tags, 'fontvibe-originals');
  }

  // 4. Our own compositions
  const originals = JSON.parse(await readFile(join(HERE, 'originals.json'), 'utf8'));
  for (const [primary, list] of Object.entries(originals)) {
    if (primary.startsWith('_')) continue;
    for (const item of list) {
      const [text, ...extra] = Array.isArray(item) ? item : [item];
      push(text, [primary, ...extra], 'original', { allowWords: true });
    }
  }

  // Dedupe (first occurrence wins; tags are merged, primary kept).
  const byKey = new Map();
  const dupes = [];
  for (const c of candidates) {
    const key = dedupeKey(c.text);
    const prev = byKey.get(key);
    if (prev) {
      prev.tags = orderTags([...prev.tags, ...c.tags]);
      dupes.push({ kept: prev.text, keptSource: prev.source, dropped: c.text, source: c.source });
    } else byKey.set(key, { ...c });
  }

  for (const [text, tags] of Object.entries(OVERRIDES)) {
    const e = byKey.get(dedupeKey(clean(text)));
    if (!e) throw new Error(`override target missing: ${text}`);
    for (const t of tags) if (!tagOrder.has(t)) throw new Error(`unknown tag ${t} (override)`);
    e.tags = orderTags(tags);
  }

  // Per-primary-tag cap: keep originals, then the best-scoring sourced entries.
  const groups = new Map();
  for (const e of byKey.values()) {
    if (!groups.has(e.tags[0])) groups.set(e.tags[0], []);
    groups.get(e.tags[0]).push(e);
  }
  const keep = new Set();
  let capped = 0;
  for (const list of groups.values()) {
    const own = list.filter((e) => e.source === 'original');
    const sourced = list
      .filter((e) => e.source !== 'original')
      .map((e, i) => ({ e, i, s: qualityScore(e.text) }))
      .sort((a, b) => a.s - b.s || a.i - b.i);
    const room = Math.max(0, CAP_PER_TAG - own.length);
    own.forEach((e) => keep.add(e));
    sourced.slice(0, room).forEach(({ e }) => keep.add(e));
    capped += Math.max(0, sourced.length - room);
    if (REPORT)
      for (const { e } of sourced.slice(room)) console.log(`CAP [${e.tags[0]}] ${e.text}`);
  }

  const entries = [...byKey.values()]
    .filter((e) => keep.has(e))
    .map((e) => ({ ...e, tags: addGlyphTags(e.text, e.tags).slice(0, 4) }));

  // Stable order: by primary tag (category order), then source order as encountered.
  const sorted = entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => tagOrder.get(a.e.tags[0]) - tagOrder.get(b.e.tags[0]) || a.i - b.i)
    .map(({ e }) => e);

  const counters = new Map();
  const out = sorted.map((e) => {
    const n = (counters.get(e.tags[0]) || 0) + 1;
    counters.set(e.tags[0], n);
    return {
      id: `${e.tags[0]}-${String(n).padStart(3, '0')}`,
      text: e.text,
      tags: e.tags,
      source: e.source,
    };
  });

  const json = '[\n' + out.map((e) => '  ' + JSON.stringify(e)).join(',\n') + '\n]\n';
  await writeFile(join(HERE, 'kaomoji.json'), json);

  const bySource = {};
  for (const e of out) bySource[e.source] = (bySource[e.source] || 0) + 1;
  const reasons = {};
  for (const r of rejected) reasons[r.problem] = (reasons[r.problem] || 0) + 1;
  console.log(`kaomoji.json: ${out.length} entries`, bySource);
  console.log(
    `rejected: ${rejected.length}`,
    reasons,
    `| duplicates merged: ${dupes.length} | over per-tag cap: ${capped}`,
  );
  if (REPORT) {
    for (const r of rejected) console.log(`REJECT [${r.problem}] ${r.source}: ${r.text}`);
    for (const d of dupes)
      if (d.source === 'original')
        console.log(`DUP original "${d.dropped}" = ${d.keptSource} "${d.kept}"`);
  }
}

await main();
