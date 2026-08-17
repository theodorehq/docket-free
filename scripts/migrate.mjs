#!/usr/bin/env node
/* ============================================================
   Brings your data up to the schema this version expects.

     npm run migrate              say what would change, change nothing
     npm run migrate -- --apply   do it

   Most versions of Docket need this never. It exists for the ones that
   do, and it is built around three promises.

   NEVER SILENT. It prints every file it would touch and what it would
   do, and changes nothing until asked twice. An update that quietly
   rewrites two years of a customer's support history is the single
   worst thing this product could do, so the default is to look.

   ALWAYS REVERSIBLE. It writes files and stops. It does not commit, so
   the change sits in the working tree where `git diff` shows it and
   `git checkout` undoes it. Reviewing a migration is reviewing a diff,
   which every buyer already knows how to do.

   ALWAYS OPTIONAL. Migrations are additive housekeeping, never a gate.
   The engine reads unmigrated data correctly because every field has a
   default and unknown fields are left alone (see lib/schema.mjs). A
   migration tidies; it does not rescue. If a buyer never runs this,
   their site still works.

   WRITING ONE

   Add `migrations/<version>-<name>.mjs`:

     export const version = 2;
     export const describe = 'What this does, in one line';
     export function run({ file, frontmatter }) {
       // Return the new frontmatter, or null to leave the file alone.
     }

   It sees one file at a time and returns frontmatter. It cannot delete
   a file, cannot touch anything outside data/, and cannot see the
   network. Those are not restrictions to work around; they are why this
   is safe to run on somebody's only copy.
   ============================================================ */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SCHEMA_VERSION, readStamp, writeStamp, kindForDir } from '../lib/schema.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');

/* Frontmatter in, frontmatter out, body untouched. A migration that
   could rewrite the body could rewrite a customer's own words, and
   nothing needs that. */
function splitFile(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return null;
  const fm = {};
  const order = [];
  for (const line of m[1].split(/\r?\n/)) {
    const lm = line.match(/^([A-Za-z][\w-]*):\s?(.*)$/);
    if (!lm) continue;
    let v = lm[2].trim();
    if (v.startsWith('"')) { try { v = JSON.parse(v); } catch { /* keep raw */ } }
    else if (/^-?\d+$/.test(v)) v = parseInt(v, 10);
    else if (v === 'true' || v === 'false') v = v === 'true';
    fm[lm[1]] = v;
    order.push(lm[1]);
  }
  return { fm, order, body: text.slice(m[0].length) };
}

function render(fm, order, body) {
  // Existing fields keep their position; new ones are appended. A
  // migration should not reshuffle a file it only added one line to,
  // because the diff is what the buyer reviews.
  const keys = order.filter((k) => k in fm).concat(Object.keys(fm).filter((k) => !order.includes(k)));
  const lines = keys.map((k) => {
    const v = fm[k];
    if (typeof v === 'string' && (v.includes(':') || v.includes('#') || v.trim() !== v)) {
      return `${k}: ${JSON.stringify(v)}`;
    }
    return `${k}: ${v}`;
  });
  return `---\n${lines.join('\n')}\n---\n\n${body.replace(/^\n+/, '')}`;
}

async function loadMigrations() {
  const dir = join(ROOT, 'migrations');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.mjs')) continue;
    const mod = await import(pathToFileURL(join(dir, name)).href);
    if (typeof mod.version !== 'number' || typeof mod.run !== 'function') {
      console.error(`Skipping migrations/${name}: it needs a numeric \`version\` and a \`run\` function.`);
      continue;
    }
    out.push({ name, version: mod.version, describe: mod.describe || name, run: mod.run });
  }
  return out.sort((a, b) => a.version - b.version);
}

function dataFiles() {
  const dataDir = join(ROOT, 'data');
  if (!existsSync(dataDir)) return [];
  const out = [];
  for (const product of readdirSync(dataDir)) {
    const pDir = join(dataDir, product);
    if (!statSync(pDir).isDirectory()) continue;
    for (const sub of readdirSync(pDir)) {
      if (!kindForDir(sub)) continue;
      const dir = join(pDir, sub);
      if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
      for (const name of readdirSync(dir)) {
        if (name.endsWith('.md')) out.push(join(dir, name));
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------ */

const from = readStamp();
const all = await loadMigrations();
const pending = all.filter((m) => m.version > from && m.version <= SCHEMA_VERSION);

if (!existsSync(join(ROOT, 'data'))) {
  console.log('No data/ folder yet, so there is nothing to migrate.');
  process.exit(0);
}

if (!pending.length) {
  console.log(from
    ? `Data is at schema v${from} and Docket expects v${SCHEMA_VERSION}. Nothing to do.`
    : `Nothing to migrate. Stamping this data as schema v${SCHEMA_VERSION}.`);
  if (!from && APPLY) writeStamp(SCHEMA_VERSION);
  process.exit(0);
}

console.log(`Data is at schema v${from}; Docket expects v${SCHEMA_VERSION}.\n`);
console.log(`${pending.length} migration${pending.length === 1 ? '' : 's'} to run:`);
for (const m of pending) console.log(`  v${m.version}  ${m.describe}`);
console.log('');

const files = dataFiles();
let changed = 0;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const parsed = splitFile(text);
  if (!parsed) continue;

  let fm = parsed.fm;
  let touched = false;
  for (const m of pending) {
    const next = m.run({ file: relative(ROOT, file), frontmatter: { ...fm } });
    if (next && JSON.stringify(next) !== JSON.stringify(fm)) { fm = next; touched = true; }
  }
  if (!touched) continue;

  changed += 1;
  console.log(`  ${APPLY ? 'updated' : 'would update'}  ${relative(ROOT, file)}`);
  if (APPLY) writeFileSync(file, render(fm, parsed.order, parsed.body));
}

console.log('');
if (!changed) {
  console.log('No file needed changing.');
} else if (APPLY) {
  console.log(`${changed} file${changed === 1 ? '' : 's'} updated. Nothing has been committed:`);
  console.log('  git diff        see exactly what changed');
  console.log('  git checkout .  undo all of it');
}

if (APPLY) {
  writeStamp(SCHEMA_VERSION);
  console.log(`\nStamped as schema v${SCHEMA_VERSION}.`);
} else {
  console.log('Nothing has been written. Run `npm run migrate -- --apply` to do it.');
}
