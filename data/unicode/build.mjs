// Builds the Unicode symbol catalog in data/unicode/out/ from pinned UCD and CLDR releases.
//
//   node data/unicode/build.mjs
//
// Sources (downloaded once into data/raw/unicode/, which is gitignored):
//   - UCD UnicodeData.txt, Blocks.txt, EastAsianWidth.txt, emoji/emoji-data.txt for UNICODE_VERSION
//   - CLDR annotations + annotationsDerived (ru, en) from unicode-org/cldr-json at CLDR_VERSION
// Downloaded files are treated as untrusted data: they are only parsed, never executed.
//
// Output (format documented in data/README.md):
//   out/blocks.json         every block that has at least one included character
//   out/blocks/<id>.json    per-character records for non-lazy blocks
//   out/stats.json          versions, counts and sizes
//   out/search.json         compact search index for the site (see buildSearchIndex)
//
// Search vocabulary (hand-made, optional while being written):
//   concepts.json   concepts with ru/en search terms and the chars that depict / resemble them
//   words-ru.json   Russian translation of every Unicode name token, used for `desc`
//
// Included characters: every assigned code point except surrogates (Cs), private use (Co),
// C0/C1 controls (Cc), noncharacters (never listed in UnicodeData.txt) and classic emoji:
// code points with Emoji_Presentation=Yes, which render as colour pictures by default
// (😀, 🐱, ⌚), plus every Emoji=Yes code point from U+1F000 up (🕊, 🌡, 🅰): phones draw
// those as colour emoji too. Text-default BMP symbols that can also be emoji (♥ ☺ ★ ✂) stay. Blocks left with no
// characters (surrogate and private use blocks) are omitted from blocks.json.
//
// Large blocks with algorithmic names. CJK Unified Ideographs (+ extensions), Hangul Syllables,
// Tangut, Jurchen, Small Seal, and blocks whose every name is "<PREFIX>-<hex code point>"
// (CJK Compatibility Ideographs, Egyptian Hieroglyphs Extended-A, Khitan Small Script, Nushu)
// carry no information beyond the code point, have no CLDR annotations, and together hold
// ~100k characters. They get no per-character file. Their blocks.json entry is marked
//   "lazy": true, "ranges": [[first, last], ...]   assigned code points (inclusive runs)
//   "nameRule": "hex", "namePrefix": "CJK UNIFIED IDEOGRAPH-"   name = prefix + uppercase hex
//   "nameRule": "hangul"   name = "HANGUL SYLLABLE " + jamo short names (Unicode ch. 3.12)
// so the site can render them from the ranges alone. Every other block gets a full file;
// the largest stays under ~300 KB.
//
// Output JSON is printed in the shape Prettier would produce (printWidth 100), so that
// `prettier --check` passes without reformatting generated files.

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOCK_META } from './blocks-meta.mjs';

const UNICODE_VERSION = '18.0.0';
const CLDR_VERSION = '48.2.3';
const LOCALES = ['ru', 'en'];

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = join(HERE, '..', 'raw', 'unicode');
const OUT = join(HERE, 'out');

const UCD_BASE = `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd`;
const CLDR_BASE = `https://raw.githubusercontent.com/unicode-org/cldr-json/${CLDR_VERSION}/cldr-json`;

const SOURCES = {
  UnicodeData: [`${UCD_BASE}/UnicodeData.txt`, `ucd-${UNICODE_VERSION}/UnicodeData.txt`],
  Blocks: [`${UCD_BASE}/Blocks.txt`, `ucd-${UNICODE_VERSION}/Blocks.txt`],
  EastAsianWidth: [`${UCD_BASE}/EastAsianWidth.txt`, `ucd-${UNICODE_VERSION}/EastAsianWidth.txt`],
  EmojiData: [`${UCD_BASE}/emoji/emoji-data.txt`, `ucd-${UNICODE_VERSION}/emoji/emoji-data.txt`],
};
for (const loc of LOCALES) {
  SOURCES[`annotations-${loc}`] = [
    `${CLDR_BASE}/cldr-annotations-full/annotations/${loc}/annotations.json`,
    `cldr-${CLDR_VERSION}/annotations-${loc}.json`,
  ];
  SOURCES[`annotationsDerived-${loc}`] = [
    `${CLDR_BASE}/cldr-annotations-derived-full/annotationsDerived/${loc}/annotations.json`,
    `cldr-${CLDR_VERSION}/annotationsDerived-${loc}.json`,
  ];
}

// UnicodeData.txt "<X, First>" range labels -> derived name rule.
const RANGE_NAMES = [
  [/^CJK Ideograph/, { nameRule: 'hex', namePrefix: 'CJK UNIFIED IDEOGRAPH-' }],
  [/^Tangut Ideograph/, { nameRule: 'hex', namePrefix: 'TANGUT IDEOGRAPH-' }],
  [/^Jurchen Character/, { nameRule: 'hex', namePrefix: 'JURCHEN CHARACTER-' }],
  [/^Seal Character/, { nameRule: 'hex', namePrefix: 'SMALL SEAL CHARACTER-' }],
  [/^Hangul Syllable/, { nameRule: 'hangul' }],
];
const EXCLUDED_GC = new Set(['Cc', 'Cs', 'Co', 'Cn']);
const MAX_GROUPS = 12;

// ---------------------------------------------------------------- download

async function download(key) {
  const [url, rel] = SOURCES[key];
  const path = join(RAW, rel);
  if (existsSync(path)) return path;
  mkdirSync(dirname(path), { recursive: true });
  console.log(`download ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

const readText = (path) => readFileSync(path, 'utf8');

/** Yields the semicolon-separated fields of each data line, comments stripped. */
function* ucdLines(text) {
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    if (line) yield line.split(';').map((f) => f.trim());
  }
}

const parseRange = (field) => {
  const [a, b = a] = field.split('..');
  return [parseInt(a, 16), parseInt(b, 16)];
};

// ---------------------------------------------------------------- parse

function parseUnicodeData(text) {
  /** @type {Map<number, {name: string, gc: string}>} */
  const chars = new Map();
  /** @type {{first: number, last: number, label: string, gc: string}[]} */
  const ranges = [];
  let pending = null;
  for (const f of ucdLines(text)) {
    const cp = parseInt(f[0], 16);
    const name = f[1];
    const gc = f[2];
    if (!/^[0-9A-F]{4,6}$/.test(f[0]) || name === undefined || gc === undefined) {
      throw new Error(`UnicodeData: bad line ${f.join(';')}`);
    }
    const m = /^<(.+), (First|Last)>$/.exec(name);
    if (m && m[2] === 'First') {
      pending = { first: cp, label: m[1], gc };
    } else if (m) {
      if (!pending || pending.label !== m[1]) throw new Error(`UnicodeData: unpaired ${name}`);
      ranges.push({ ...pending, last: cp });
      pending = null;
    } else {
      chars.set(cp, { name, gc });
    }
  }
  return { chars, ranges };
}

function parseBlocks(text) {
  return [...ucdLines(text)].map(([range, name]) => {
    const [start, end] = parseRange(range);
    return { start, end, name };
  });
}

function parseWide(text) {
  const wide = new Set();
  for (const [range, value] of ucdLines(text)) {
    if (value !== 'W' && value !== 'F') continue;
    const [a, b] = parseRange(range);
    for (let cp = a; cp <= b; cp++) wide.add(cp);
  }
  return wide;
}

/** char -> { name, keywords } for one locale, primary annotations taking precedence. */
function parseCldr(primaryText, derivedText) {
  const result = new Map();
  for (const text of [derivedText, primaryText]) {
    const json = JSON.parse(text);
    const root = json.annotations ?? json.annotationsDerived;
    const entries = root?.annotations;
    if (!entries || typeof entries !== 'object') throw new Error('CLDR: unexpected layout');
    for (const [key, value] of Object.entries(entries)) {
      const clean = (list) =>
        Array.isArray(list)
          ? list.filter((s) => typeof s === 'string' && s && !s.includes('↑↑↑'))
          : [];
      const name = clean(value?.tts)[0] ?? null;
      const keywords = [...new Set(clean(value?.default))];
      const prev = result.get(key);
      result.set(key, {
        name: name ?? prev?.name ?? null,
        keywords: keywords.length ? keywords : (prev?.keywords ?? []),
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------- Prettier-shaped JSON

const PRINT_WIDTH = 100;
let WIDE = new Set();

/** Column width as Prettier measures it (see prettier's getStringWidth). */
function textWidth(text) {
  let width = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp < 0x7f && cp >= 0x20) width += 1;
    else if (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f)) continue;
    else if (cp >= 0x300 && cp <= 0x36f) continue;
    else if (cp >= 0xfe00 && cp <= 0xfe0f) continue;
    else width += WIDE.has(cp) || /\p{Emoji_Presentation}/u.test(ch) ? 2 : 1;
  }
  return width;
}

// Invisible and layout-affecting characters are written as \u escapes so the generated
// files stay readable in editors (no raw bidi overrides, line separators, odd spaces).
const ESCAPE = /[\p{Cf}\p{Zl}\p{Zp}\p{Zs}\p{Cc}]/gu;
function jsonString(s) {
  return JSON.stringify(s).replace(ESCAPE, (c) => {
    if (c === ' ') return c;
    let out = '';
    for (let i = 0; i < c.length; i++) out += `\\u${c.charCodeAt(i).toString(16).padStart(4, '0')}`;
    return out;
  });
}

function flat(v) {
  if (v === null || typeof v !== 'object') return typeof v === 'string' ? jsonString(v) : String(v);
  if (Array.isArray(v)) return v.length ? `[${v.map(flat).join(', ')}]` : '[]';
  const keys = Object.keys(v);
  return keys.length
    ? `{ ${keys.map((k) => `${jsonString(k)}: ${flat(v[k])}`).join(', ')} }`
    : '{}';
}

const isComposite = (v) =>
  v !== null &&
  typeof v === 'object' &&
  (Array.isArray(v) ? v.length > 1 : Object.keys(v).length > 1);

/** Prettier breaks arrays of 2+ elements that are all multi-item objects (or all arrays). */
function forceBreak(arr) {
  if (arr.length < 2) return false;
  const kind = (v) => (Array.isArray(v) ? 'array' : 'object');
  return arr.every((v) => isComposite(v) && kind(v) === kind(arr[0]));
}

/** Prints `v` at nesting `depth`; `lead` = text before it on the line, `tail` = after it. */
function print(v, depth, lead, tail) {
  const one = flat(v);
  if (v === null || typeof v !== 'object') return one;
  const pad = '  '.repeat(depth);
  const isArr = Array.isArray(v);
  const items = isArr ? v : Object.keys(v);
  if (!items.length) return one;
  const fits = textWidth(pad + lead + one + tail) <= PRINT_WIDTH;
  if (fits && !(isArr && forceBreak(v))) return one;
  const inner = '  '.repeat(depth + 1);
  const lines = items.map((item, i) => {
    const comma = i < items.length - 1 ? ',' : '';
    if (isArr) return inner + print(item, depth + 1, '', comma) + comma;
    const key = `${jsonString(item)}: `;
    return inner + key + print(v[item], depth + 1, key, comma) + comma;
  });
  return `${isArr ? '[' : '{'}\n${lines.join('\n')}\n${pad}${isArr ? ']' : '}'}`;
}

const toJson = (value) => `${print(value, 0, '', '')}\n`;

// ---------------------------------------------------------------- build

const hex = (cp) => cp.toString(16).toUpperCase().padStart(4, '0');

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Collapses sorted code points into inclusive [first, last] runs. */
function toRuns(cps) {
  const runs = [];
  for (const cp of cps) {
    const last = runs.at(-1);
    if (last && last[1] === cp - 1) last[1] = cp;
    else runs.push([cp, cp]);
  }
  return runs;
}

/** Code points with the given binary property in emoji-data.txt. */
function parseEmojiProperty(text, property) {
  const cps = new Set();
  for (const [range, prop] of ucdLines(text)) {
    if (prop !== property) continue;
    const [first, last] = parseRange(range);
    for (let cp = first; cp <= last; cp++) cps.add(cp);
  }
  return cps;
}

const readOptionalJson = (file) =>
  existsSync(join(HERE, file)) ? JSON.parse(readFileSync(join(HERE, file), 'utf8')) : null;

/** Russian characteristics of a character from its Unicode name, e.g. ["стрелка", "влево"]. */
function describe(name, wordsRu) {
  const words = [];
  for (const token of name.split(/[ -]/)) {
    const ru = wordsRu[token];
    if (ru && !words.includes(ru)) words.push(ru);
  }
  return words;
}

const searchWords = (texts) => [
  ...new Set(texts.flatMap((t) => (t ? (t.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) : []))),
];

/**
 * out/search.json: { blocks: [id], concepts: [{id, ru, en, chars, like}],
 *   chars: [[char, blockIndex, "extra words", ruLabel, enLabel]] }.
 * The site searches the labels plus the extra words (name, description and CLDR keywords
 * not already in a label).
 * Labels: the CLDR name, else the Russian description / lowercased Unicode name.
 * Words come from the Unicode name, the Russian description and CLDR names and keywords;
 * the site normalizes and stems them when it loads the index.
 */
function buildSearchIndex(entries, concepts) {
  const blocks = [];
  const chars = [];
  for (const { block, records } of entries) {
    const b = blocks.push(block.id) - 1;
    for (const r of records) {
      const ru = r.ru ?? (r.desc.length ? r.desc.join(', ') : r.name.toLowerCase());
      const en = r.en ?? r.name.toLowerCase();
      // Words already in the labels are not repeated; the site searches labels too.
      const inLabels = new Set(searchWords([ru, en]));
      const extra = searchWords([r.name, ...r.desc, ...r.keywords.ru, ...r.keywords.en]).filter(
        (w) => !inLabels.has(w),
      );
      chars.push([r.char, b, extra.join(' '), ru, en]);
    }
  }
  return { blocks, concepts: concepts ?? [], chars };
}

async function main() {
  for (const key of Object.keys(SOURCES)) await download(key);
  const path = (key) => join(RAW, SOURCES[key][1]);

  const { chars, ranges } = parseUnicodeData(readText(path('UnicodeData')));
  const blocks = parseBlocks(readText(path('Blocks')));
  WIDE = parseWide(readText(path('EastAsianWidth')));
  const emojiData = readText(path('EmojiData'));
  const emoji = parseEmojiProperty(emojiData, 'Emoji_Presentation');
  for (const cp of parseEmojiProperty(emojiData, 'Emoji')) if (cp >= 0x1f000) emoji.add(cp);
  const cldr = Object.fromEntries(
    LOCALES.map((loc) => [
      loc,
      parseCldr(readText(path(`annotations-${loc}`)), readText(path(`annotationsDerived-${loc}`))),
    ]),
  );
  const concepts = readOptionalJson('concepts.json');
  const wordsRu = readOptionalJson('words-ru.json') ?? {};
  /** @type {Map<string, string[]>} char -> concept ids */
  const conceptsOf = new Map();
  for (const c of concepts ?? []) {
    for (const ch of [...c.chars, ...c.like]) {
      conceptsOf.set(ch, [...(conceptsOf.get(ch) ?? []), c.id]);
    }
  }
  const searchEntries = [];
  const lookup = (loc, ch) => cldr[loc].get(ch) ?? cldr[loc].get(`${ch}️`) ?? null;

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, 'blocks'), { recursive: true });

  const index = [];
  const groups = new Set();
  const ids = new Set();
  let charCount = 0;

  for (const block of blocks) {
    // Collect included code points with their names (algorithmic ones resolved lazily).
    const cps = [];
    let rule = null;
    for (const r of ranges) {
      if (r.last < block.start || r.first > block.end || EXCLUDED_GC.has(r.gc)) continue;
      const match = RANGE_NAMES.find(([re]) => re.test(r.label));
      if (!match) throw new Error(`No name rule for UnicodeData range <${r.label}>`);
      if (rule && rule.namePrefix !== match[1].namePrefix)
        throw new Error(`Mixed rules in ${block.name}`);
      rule = match[1];
      for (let cp = Math.max(r.first, block.start); cp <= Math.min(r.last, block.end); cp++) {
        cps.push(cp);
      }
    }
    const listed = [];
    for (let cp = block.start; cp <= block.end; cp++) {
      const c = chars.get(cp);
      if (c && !EXCLUDED_GC.has(c.gc) && !emoji.has(cp)) listed.push(cp);
    }
    if (rule && listed.length) throw new Error(`${block.name}: range mixed with listed chars`);
    cps.push(...listed);
    if (!cps.length) continue;
    cps.sort((a, b) => a - b);

    const meta = BLOCK_META[block.name];
    if (!meta) throw new Error(`Missing Russian name/group for block "${block.name}"`);
    const [ru, group] = meta;
    const id = slug(block.name);
    if (ids.has(id)) throw new Error(`Duplicate block id ${id}`);
    ids.add(id);
    groups.add(group);

    // Blocks named "<PREFIX>-<hex>" throughout, with no CLDR data, are lazy as well.
    if (!rule) {
      const prefixes = new Set();
      let derivable = true;
      for (const cp of cps) {
        const name = chars.get(cp).name;
        const ch = String.fromCodePoint(cp);
        if (!name.endsWith(`-${hex(cp)}`) || LOCALES.some((loc) => lookup(loc, ch))) {
          derivable = false;
          break;
        }
        prefixes.add(name.slice(0, -hex(cp).length));
      }
      if (derivable && prefixes.size === 1) {
        rule = { nameRule: 'hex', namePrefix: [...prefixes][0] };
      }
    }

    const entry = {
      id,
      name: block.name,
      ru,
      range: [block.start, block.end],
      count: cps.length,
      group,
    };
    charCount += cps.length;

    if (rule) {
      Object.assign(entry, { lazy: true, ranges: toRuns(cps), ...rule });
    } else {
      const records = cps.map((cp) => {
        const ch = String.fromCodePoint(cp);
        const ann = Object.fromEntries(LOCALES.map((loc) => [loc, lookup(loc, ch)]));
        return {
          cp,
          char: ch,
          name: chars.get(cp).name,
          ru: ann.ru?.name ?? null,
          en: ann.en?.name ?? null,
          keywords: { ru: ann.ru?.keywords ?? [], en: ann.en?.keywords ?? [] },
          desc: describe(chars.get(cp).name, wordsRu),
          concepts: conceptsOf.get(ch) ?? [],
        };
      });
      writeFileSync(join(OUT, 'blocks', `${id}.json`), toJson(records));
      searchEntries.push({ block: entry, records });
    }
    index.push(entry);
  }

  if (groups.size > MAX_GROUPS) throw new Error(`Too many groups: ${[...groups].join(', ')}`);
  for (const name of Object.keys(BLOCK_META)) {
    if (!index.some((b) => b.name === name)) console.warn(`warn: unused BLOCK_META "${name}"`);
  }

  writeFileSync(join(OUT, 'blocks.json'), toJson(index));
  // One line per character keeps the index small; it is generated, not hand-edited.
  const search = buildSearchIndex(searchEntries, concepts);
  writeFileSync(join(OUT, 'search.json'), `${JSON.stringify(search)}\n`);

  // Sizes are measured after writing; stats.json itself is excluded from the total.
  let totalBytes = statSync(join(OUT, 'blocks.json')).size;
  let largest = { file: 'blocks.json', bytes: totalBytes };
  for (const b of index) {
    if (b.lazy) continue;
    const file = `blocks/${b.id}.json`;
    const bytes = statSync(join(OUT, file)).size;
    totalBytes += bytes;
    if (bytes > largest.bytes) largest = { file, bytes };
  }
  const stats = {
    unicodeVersion: UNICODE_VERSION,
    cldrVersion: CLDR_VERSION,
    blockCount: index.length,
    lazyBlockCount: index.filter((b) => b.lazy).length,
    charCount,
    lazyCharCount: index.filter((b) => b.lazy).reduce((n, b) => n + b.count, 0),
    groups: [...groups].sort(),
    totalBytes,
    largestFile: largest,
    searchIndexBytes: statSync(join(OUT, 'search.json')).size,
    conceptCount: concepts?.length ?? 0,
  };
  writeFileSync(join(OUT, 'stats.json'), toJson(stats));
  console.log(stats);
}

await main();
