// Validates the hand-made search vocabulary against the built catalog.
//
//   node data/unicode/validate-search.mjs
//
// concepts.json  [{ id, ru: [term], en: [term], chars: [char], like: [char] }]
//   - id: unique kebab-case slug; ru/en: non-empty lists of unique lowercase terms
//   - chars / like: single code points present in a non-lazy out/blocks/<id>.json file,
//     not Emoji_Presentation, no duplicates within a concept (also across chars and like),
//     at least one char in chars + like
// words-ru.json  { "TOKEN": "русский перевод" }
//   - keys: uppercase name tokens; values: strings ("" marks a stop word such as THE)
//   - every token of a name in a non-lazy block outside the `scripts` and `cjk` groups is
//     covered, except bare numbers and single letters (A, B, 1, 23), which map to themselves
//
// Needs data/unicode/out/ (node data/unicode/build.mjs) and the UCD emoji-data.txt that the
// build downloads. Prints a summary; exits 1 on any error.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const EMOJI_DATA = join(HERE, '../raw/unicode/ucd-18.0.0/emoji/emoji-data.txt');
const SCRIPT_GROUPS = new Set(['scripts', 'cjk']);
const SELF_TOKEN = /^(\d+|[A-Z])$/;

const errors = [];
const fail = (msg) => errors.push(msg);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const tokensOf = (name) => name.split(/[ -]+/).filter(Boolean);

// --- Catalog: every listed character, and name tokens by group kind.
const catalog = new Set();
const nonScriptTokens = new Set();
const scriptTokenFreq = new Map();
for (const block of readJson(join(OUT, 'blocks.json'))) {
  if (block.lazy) continue;
  const scripts = SCRIPT_GROUPS.has(block.group);
  for (const rec of readJson(join(OUT, 'blocks', `${block.id}.json`))) {
    catalog.add(rec.char);
    for (const t of tokensOf(rec.name)) {
      if (scripts) scriptTokenFreq.set(t, (scriptTokenFreq.get(t) ?? 0) + 1);
      else nonScriptTokens.add(t);
    }
  }
}

// --- Emoji_Presentation code points (parsed only; the file is untrusted data).
const emojiPresentation = new Set();
if (existsSync(EMOJI_DATA)) {
  for (const line of readFileSync(EMOJI_DATA, 'utf8').split('\n')) {
    const m = line.match(/^([0-9A-F]{4,6})(?:\.\.([0-9A-F]{4,6}))?\s*;\s*Emoji_Presentation\s*(#|$)/);
    if (!m) continue;
    const last = parseInt(m[2] ?? m[1], 16);
    for (let cp = parseInt(m[1], 16); cp <= last; cp++) emojiPresentation.add(cp);
  }
} else {
  fail(`missing ${EMOJI_DATA} (run node data/unicode/build.mjs)`);
}

// --- concepts.json
const concepts = readJson(join(HERE, 'concepts.json'));
const ids = new Set();
const counts = [];
if (!Array.isArray(concepts)) fail('concepts.json: not an array');
for (const [i, c] of (Array.isArray(concepts) ? concepts : []).entries()) {
  const at = `concepts[${i}]${c?.id ? ` (${c.id})` : ''}`;
  const keys = Object.keys(c ?? {}).sort().join(',');
  if (keys !== 'chars,en,id,like,ru') fail(`${at}: keys must be id, ru, en, chars, like (got ${keys})`);
  if (typeof c.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)) fail(`${at}: bad id`);
  else if (ids.has(c.id)) fail(`${at}: duplicate id`);
  ids.add(c.id);

  for (const lang of ['ru', 'en']) {
    const terms = c[lang];
    if (!Array.isArray(terms) || !terms.length) {
      fail(`${at}: ${lang} must be a non-empty array`);
      continue;
    }
    const seen = new Set();
    for (const t of terms) {
      if (typeof t !== 'string' || !t.trim() || t !== t.trim()) fail(`${at}: bad ${lang} term "${t}"`);
      else if (t !== t.toLowerCase()) fail(`${at}: ${lang} term not lowercase "${t}"`);
      else if (seen.has(t)) fail(`${at}: duplicate ${lang} term "${t}"`);
      seen.add(t);
    }
  }

  const seenChars = new Set();
  for (const field of ['chars', 'like']) {
    if (!Array.isArray(c[field])) {
      fail(`${at}: ${field} must be an array`);
      continue;
    }
    for (const ch of c[field]) {
      const cp = typeof ch === 'string' ? ch.codePointAt(0) : NaN;
      const hex = Number.isNaN(cp) ? '?' : `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
      if (typeof ch !== 'string' || [...ch].length !== 1) fail(`${at}: ${field} "${ch}" is not one code point`);
      else if (seenChars.has(ch)) fail(`${at}: duplicate ${ch} ${hex}`);
      else if (emojiPresentation.has(cp)) fail(`${at}: ${ch} ${hex} is Emoji_Presentation`);
      else if (!catalog.has(ch)) fail(`${at}: ${ch} ${hex} is not in out/blocks`);
      seenChars.add(ch);
    }
  }
  if (!seenChars.size) fail(`${at}: chars and like are both empty`);
  counts.push(seenChars.size);
}

// --- words-ru.json
const words = readJson(join(HERE, 'words-ru.json'));
for (const [k, v] of Object.entries(words)) {
  if (!/^[A-Z0-9]+$/.test(k)) fail(`words-ru.json: bad token "${k}"`);
  if (typeof v !== 'string' || v !== v.trim()) fail(`words-ru.json: bad value for ${k}`);
}
const needed = [...nonScriptTokens].filter((t) => !SELF_TOKEN.test(t));
const missing = needed.filter((t) => !(t in words));
for (const t of missing.slice(0, 50)) fail(`words-ru.json: missing non-script token ${t}`);
if (missing.length > 50) fail(`words-ru.json: … and ${missing.length - 50} more missing tokens`);

const scriptTop = [...scriptTokenFreq]
  .filter(([t]) => !SELF_TOKEN.test(t) && !nonScriptTokens.has(t))
  .sort((a, b) => b[1] - a[1])
  .slice(0, 1500)
  .map(([t]) => t);
const scriptCovered = scriptTop.filter((t) => t in words).length;

// --- Summary
const sorted = [...counts].sort((a, b) => a - b);
const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) : '100.0');
const distinct = new Set(concepts.flatMap((c) => [...(c.chars ?? []), ...(c.like ?? [])]));
console.log(`concepts: ${concepts.length}, distinct chars: ${distinct.size}`);
console.log(`chars+like per concept: min ${sorted[0] ?? 0}, median ${median}, max ${sorted.at(-1) ?? 0}`);
console.log(
  `words-ru: ${Object.keys(words).length} tokens; non-script coverage ${needed.length - missing.length}/${needed.length} (${pct(needed.length - missing.length, needed.length)}%); top-1500 script tokens ${scriptCovered}/${scriptTop.length} (${pct(scriptCovered, scriptTop.length)}%)`,
);

if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log('ok');
