// Selects FIGlet fonts whose redistribution is explicitly allowed, copies them into
// data/figlet/fonts/ and writes data/figlet/fonts.json for the site.
//
//   node data/figlet/build.mjs
//
// Fonts come from the `figlet` npm package (figlet.js, MIT). The font files have their own
// terms; a font is included only if one of these holds:
//   - it is part of the official FIGlet 2.2.5 distribution (BSD 3-Clause, see LICENSE-figlet.txt);
//   - it ships with TOIlet (WTFPL), recognisable by the caca2tlf / WTFPL header;
//   - its header grants permission itself (the classic "Permission is hereby given to modify
//     this font…" notice, WTFPL, MIT, or "free to use and distribute").
// Fonts whose header carries only a copyright notice, or nothing at all, are left out; they
// are listed in the report so the decision can be revisited.
//
// Copies are written as UTF-8. Code-tagged characters outside Latin-1, Cyrillic and general punctuation are dropped from
// the copies: TOIlet fonts carry most of Unicode and would otherwise weigh up to 1 MB each.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import figlet from 'figlet';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, '../../node_modules/figlet/fonts');
const OUT = join(HERE, 'fonts');

// figlet.js names of the fonts in the official FIGlet 2.2.5 distribution.
const OFFICIAL = new Set([
  'Banner',
  'Big',
  'Block',
  'Bubble',
  'Digital',
  'Ivrit',
  'Lean',
  'Mini',
  'Mnemonic',
  'Script',
  'Shadow',
  'Slant',
  'Small',
  'Small Script',
  'Small Shadow',
  'Small Slant',
  'Standard',
  'Term',
]);

const PERMISSIONS = [
  ['permission', /Permission is hereby given/i],
  ['wtfpl', /Do What The Fuck You Want To Public License|caca2tlf/i],
  ['mit', /MIT License/i],
  ['free', /free to use and distribute/i],
];

// Fonts that are hard to read as text or only encode other alphabets.
const SKIP = new Set(['Ivrit', 'Mnemonic', 'Term', 'Morse', 'Morse2', 'Moscow', 'Wavy']);

/** Reads a font as UTF-8, falling back to Latin-1 for older fonts with 8-bit characters. */
function readFont(file) {
  const bytes = readFileSync(file);
  const text = bytes.toString('utf8');
  return text.includes('\uFFFD') ? bytes.toString('latin1') : text;
}

function headerComments(file) {
  const lines = readFont(file).split(/\r?\n/);
  const count = Number(lines[0]?.split(' ')[5] ?? 0);
  return lines
    .slice(1, 1 + count)
    .join(' ')
    .replace(/\s+/g, ' ');
}

function license(name, comments) {
  if (OFFICIAL.has(name)) return 'figlet-bsd';
  return PERMISSIONS.find(([, re]) => re.test(comments))?.[0] ?? null;
}

const KEEP_RANGES = [
  [0xa0, 0xff], // Latin-1 Supplement
  [0x400, 0x4ff], // Cyrillic
  [0x2010, 0x206f], // General Punctuation
];

/** Parses a FIGlet code tag: decimal, 0x hex or leading-zero octal, possibly negative. */
function parseCode(token) {
  const negative = token.startsWith('-');
  const t = negative ? token.slice(1) : token;
  const value = /^0x/i.test(t)
    ? parseInt(t, 16)
    : /^0\d/.test(t)
      ? parseInt(t, 8)
      : parseInt(t, 10);
  return negative ? -value : value;
}

/** Keeps the header, the 102 required characters and code-tagged characters in KEEP_RANGES. */
function trimFont(text) {
  const lines = text.split(/\r?\n/);
  const header = lines[0].split(' ');
  const height = Number(header[1]);
  const start = 1 + Number(header[5]);
  const requiredEnd = start + 102 * height;
  const out = lines.slice(0, requiredEnd);
  for (let i = requiredEnd; i + height < lines.length + 1 && lines[i]?.trim(); i += height + 1) {
    const code = parseCode(lines[i].trim().split(/\s+/)[0]);
    if (KEEP_RANGES.some(([a, b]) => code >= a && code <= b)) {
      out.push(...lines.slice(i, i + height + 1));
    }
  }
  return `${out.join('\n')}\n`;
}

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const fonts = [];
  const excluded = [];
  for (const file of readdirSync(SOURCE)
    .filter((f) => f.endsWith('.flf'))
    .sort()) {
    const name = file.slice(0, -4);
    const comments = headerComments(join(SOURCE, file));
    const terms = license(name, comments);
    if (!terms || SKIP.has(name)) {
      excluded.push(name);
      continue;
    }
    const sample = figlet.textSync('Ab', { font: name });
    // A font without Cyrillic renders it like any other missing character.
    const missing = figlet.textSync('\u0378\u0379', { font: name });
    const cyrillic = figlet.textSync('Жя', { font: name }) !== missing;
    const id = slug(name);
    writeFileSync(join(OUT, `${id}.flf`), trimFont(readFont(join(SOURCE, file))));
    fonts.push({ id, name, license: terms, cyrillic, height: sample.split('\n').length });
  }
  writeFileSync(join(HERE, 'fonts.json'), `${JSON.stringify(fonts, null, 2)}\n`);
  console.log(`included ${fonts.length}, cyrillic ${fonts.filter((f) => f.cyrillic).length}`);
  console.log(`excluded ${excluded.length}: ${excluded.join(', ')}`);
}

main();
