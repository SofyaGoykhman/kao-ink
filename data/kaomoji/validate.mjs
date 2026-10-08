#!/usr/bin/env node
// Validates data/kaomoji/*.json. Plain Node, no dependencies.
//
//   node data/kaomoji/validate.mjs
//
// Exits 1 if any check fails. Always prints a summary (counts per tag, group and source).

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const errors = [];
const fail = (msg) => errors.push(msg);

async function readJson(name) {
  try {
    return JSON.parse(await readFile(join(HERE, name), 'utf8'));
  } catch (e) {
    fail(`${name}: cannot read/parse: ${e.message}`);
    return null;
  }
}

const isStr = (v) => typeof v === 'string';
const isNfc = (s) => s === s.normalize('NFC');
// eslint-disable-next-line no-control-regex -- rejecting control characters is the point
const isClean = (s) => s.isWellFormed() && !/[\u0000-\u001F\u007F-\u009F\uFFFD]/u.test(s);
const SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const GROUPS = new Set(['emotion', 'action', 'character', 'other']);

// --- SOURCES.md: valid ids are the backticked ids in the first column of table rows whose
// "Decision" column (5th) says "used" (rejected sources do not count).
async function sourceIds() {
  let md = '';
  try {
    md = await readFile(join(HERE, 'SOURCES.md'), 'utf8');
  } catch {
    fail('SOURCES.md missing');
  }
  const ids = new Set();
  for (const line of md.split('\n')) {
    const m = line.match(/^\|\s*`([a-z0-9][a-z0-9-]*)`\s*\|/);
    if (!m) continue;
    const decision = (line.split('|')[5] || '').toLowerCase();
    if (/\bused\b/.test(decision) && !/rejected/.test(decision)) ids.add(m[1]);
  }
  return ids;
}

// --- categories.json
function checkCategories(cats) {
  const slugs = new Map();
  if (!Array.isArray(cats)) return (fail('categories.json: must be an array'), slugs);
  cats.forEach((c, i) => {
    const where = `categories[${i}]`;
    if (!c || typeof c !== 'object') return fail(`${where}: not an object`);
    const keys = Object.keys(c).sort().join(',');
    if (keys !== 'en,group,ru,slug') fail(`${where}: expected keys en,group,ru,slug, got ${keys}`);
    if (!isStr(c.slug) || !SLUG.test(c.slug)) fail(`${where}: bad slug ${JSON.stringify(c.slug)}`);
    if (!GROUPS.has(c.group)) fail(`${where}: bad group ${JSON.stringify(c.group)}`);
    for (const l of ['ru', 'en']) {
      if (!isStr(c[l]) || !c[l].trim()) fail(`${where}: empty ${l} label`);
      else if (!isNfc(c[l])) fail(`${where}: ${l} label not NFC`);
    }
    if (isStr(c.ru) && !/[а-яё]/i.test(c.ru)) fail(`${where}: ru label has no Cyrillic`);
    if (slugs.has(c.slug)) fail(`${where}: duplicate slug ${c.slug}`);
    slugs.set(c.slug, c);
  });
  return slugs;
}

// --- kaomoji.json
function checkKaomoji(list, slugs, sources) {
  if (!Array.isArray(list)) return fail('kaomoji.json: must be an array');
  const ids = new Set();
  const texts = new Map();
  const counters = new Map();
  list.forEach((k, i) => {
    const where = `kaomoji[${i}]${k && k.id ? ` (${k.id})` : ''}`;
    if (!k || typeof k !== 'object') return fail(`${where}: not an object`);
    const keys = Object.keys(k).sort().join(',');
    if (keys !== 'id,source,tags,text')
      fail(`${where}: expected keys id,source,tags,text, got ${keys}`);
    // text
    if (!isStr(k.text) || !k.text) fail(`${where}: empty text`);
    else {
      if (k.text !== k.text.trim()) fail(`${where}: untrimmed text`);
      if (!isNfc(k.text)) fail(`${where}: text not NFC`);
      if (!isClean(k.text)) fail(`${where}: lone surrogate / control / U+FFFD in text`);
      if (/\n/.test(k.text)) fail(`${where}: multiline text`);
      if (/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/u.test(k.text))
        fail(`${where}: invisible chars`);
      if (texts.has(k.text)) fail(`${where}: duplicate text (also ${texts.get(k.text)})`);
      texts.set(k.text, k.id);
    }
    // tags
    if (!Array.isArray(k.tags) || k.tags.length < 1 || k.tags.length > 4)
      fail(`${where}: tags must have 1-4 items`);
    else {
      if (new Set(k.tags).size !== k.tags.length) fail(`${where}: repeated tag`);
      for (const t of k.tags) if (!slugs.has(t)) fail(`${where}: unknown tag ${JSON.stringify(t)}`);
    }
    // id
    if (!isStr(k.id)) fail(`${where}: missing id`);
    else {
      if (ids.has(k.id)) fail(`${where}: duplicate id`);
      ids.add(k.id);
      const m = k.id.match(/^(.+)-(\d{3,})$/);
      if (!m) fail(`${where}: id must be <primary-tag>-NNN`);
      else if (Array.isArray(k.tags) && m[1] !== k.tags[0])
        fail(`${where}: id prefix ≠ primary tag ${k.tags[0]}`);
      if (m) counters.set(m[1], (counters.get(m[1]) || 0) + 1);
    }
    // source
    if (!isStr(k.source) || (k.source !== 'original' && !sources.has(k.source)))
      fail(`${where}: source ${JSON.stringify(k.source)} not in SOURCES.md`);
  });

  // Trivial variants: whitespace-insensitive, with Halfwidth/Fullwidth Forms folded (same key as build.mjs).
  const loose = new Map();
  for (const k of list) {
    if (!isStr(k?.text)) continue;
    const key = k.text
      .replace(/[\uFF00-\uFFEF]/gu, (c) => c.normalize('NFKC'))
      .replace(/[\s\u3000]+/gu, '');
    if (loose.has(key)) fail(`kaomoji: trivial variants ${loose.get(key)} / ${k.id}`);
    else loose.set(key, k.id);
  }
}

// --- parts.json
const PART_SHAPES = {
  faces: 'pair',
  eyes: 'pair',
  arms: 'pair',
  cheeks: 'pair',
  mouths: 'text',
  extras: 'extra',
};

function checkParts(parts) {
  if (!parts || typeof parts !== 'object' || Array.isArray(parts))
    return fail('parts.json: must be an object');
  const extraKinds = Object.keys(parts).filter((k) => !(k in PART_SHAPES));
  if (extraKinds.length) fail(`parts.json: unknown kinds ${extraKinds.join(', ')}`);
  for (const [kind, shape] of Object.entries(PART_SHAPES)) {
    const list = parts[kind];
    if (!Array.isArray(list) || list.length === 0) {
      fail(`parts.${kind}: must be a non-empty array`);
      continue;
    }
    if (list.length < 15 || list.length > 40)
      console.warn(`warn: parts.${kind} has ${list.length} items (aim 15-40)`);
    const ids = new Set();
    const values = new Set();
    list.forEach((p, i) => {
      const where = `parts.${kind}[${i}]${p?.id ? ` (${p.id})` : ''}`;
      if (!p || typeof p !== 'object') return fail(`${where}: not an object`);
      if (!isStr(p.id) || !SLUG.test(p.id)) fail(`${where}: bad id`);
      else if (ids.has(p.id)) fail(`${where}: duplicate id`);
      ids.add(p.id);
      const expect = { pair: 'id,left,right', text: 'id,text', extra: 'id,position,text' }[shape];
      const keys = Object.keys(p).sort().join(',');
      if (keys !== expect) return fail(`${where}: expected keys ${expect}, got ${keys}`);
      const strs = shape === 'pair' ? [p.left, p.right] : [p.text];
      for (const s of strs) {
        if (!isStr(s)) fail(`${where}: value must be a string`);
        else if (!isNfc(s) || !isClean(s)) fail(`${where}: value not NFC / has bad chars`);
        else if (s !== s.trim()) fail(`${where}: value has surrounding whitespace`);
      }
      if (shape === 'pair') {
        // Faces may be frameless; other pairs need at least one side.
        if (kind !== 'faces' && !p.left && !p.right) fail(`${where}: both sides empty`);
        if (kind === 'eyes' && (!p.left || !p.right)) fail(`${where}: eyes need both sides`);
      } else if (!p.text) fail(`${where}: empty text`);
      if (shape === 'extra' && !['left', 'right'].includes(p.position))
        fail(`${where}: position must be left|right`);
      const value = JSON.stringify(strs);
      if (values.has(value)) fail(`${where}: duplicate value`);
      values.add(value);
    });
  }
}

// --- main
const [cats, kaomoji, parts, sources] = await Promise.all([
  readJson('categories.json'),
  readJson('kaomoji.json'),
  readJson('parts.json'),
  sourceIds(),
]);
const slugs = checkCategories(cats || []);
checkKaomoji(kaomoji || [], slugs, sources);
checkParts(parts);

// Summary
if (Array.isArray(kaomoji)) {
  const primary = new Map();
  const any = new Map();
  const bySource = new Map();
  const byGroup = new Map();
  for (const k of kaomoji) {
    const p = k.tags?.[0];
    primary.set(p, (primary.get(p) || 0) + 1);
    for (const t of k.tags || []) any.set(t, (any.get(t) || 0) + 1);
    bySource.set(k.source, (bySource.get(k.source) || 0) + 1);
    const g = slugs.get(p)?.group;
    byGroup.set(g, (byGroup.get(g) || 0) + 1);
  }
  console.log(
    `kaomoji: ${kaomoji.length} entries, ${slugs.size} categories, sources in SOURCES.md: ${[...sources].join(', ')}`,
  );
  console.log('\nper tag (primary / any):');
  for (const [slug, c] of slugs) {
    const n = primary.get(slug) || 0;
    if (n === 0) console.warn(`warn: category ${slug} has no primary entries`);
    console.log(
      `  ${c.group.padEnd(9)} ${slug.padEnd(12)} ${String(n).padStart(4)} / ${String(any.get(slug) || 0).padStart(4)}  ${c.en} / ${c.ru}`,
    );
  }
  console.log('\nper group (by primary tag):', Object.fromEntries(byGroup));
  console.log('per source:', Object.fromEntries(bySource));
}
if (parts && typeof parts === 'object') {
  console.log(
    'parts:',
    Object.fromEntries(
      Object.entries(parts).map(([k, v]) => [k, Array.isArray(v) ? v.length : 'invalid']),
    ),
  );
}

if (errors.length) {
  console.error(`\nFAILED: ${errors.length} problem(s)`);
  for (const e of errors.slice(0, 200)) console.error('  - ' + e);
  if (errors.length > 200) console.error(`  ... and ${errors.length - 200} more`);
  process.exit(1);
}
console.log('\nOK');
