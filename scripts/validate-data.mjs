#!/usr/bin/env node
/* ============================================================
   Checks every data file against the schema.

     npm run validate

   Also run automatically by the build, because a malformed file is
   otherwise discovered by a visitor rather than by you.

   WHAT IT IS FOR

   These files are edited by hand and by agents, both of which make
   typos, and the failure mode is bad: a status of "compelted" does not
   crash anything, it just quietly puts an item in no column at all. The
   item is still there, still committed, and simply never appears. A
   customer who reported it sees nothing happen forever.

   So every problem is reported as a sentence naming the file and what to
   do, not a stack trace and not a line number in a parser.
   ============================================================ */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KINDS, kindForDir, problemsWith, SCHEMA_VERSION, readStamp } from '../lib/schema.mjs';
import { dataRoot } from '../lib/data-root.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* The same tolerant parser the rest of the engine uses. Deliberately not
   a stricter one: validating with a parser the build does not use would
   report problems the site never has, and miss the ones it does. */
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const lm = line.match(/^([A-Za-z][\w-]*):\s?(.*)$/);
    if (!lm) continue;
    let value = lm[2].trim();
    if (value.startsWith('"')) { try { value = JSON.parse(value); } catch { /* keep raw */ } }
    else if (/^-?\d+$/.test(value)) value = parseInt(value, 10);
    else if (value === 'true' || value === 'false') value = value === 'true';
    fm[lm[1]] = value;
  }
  return fm;
}

export function validateData({ root = ROOT, quiet = false } = {}) {
  const dataDir = dataRoot(root).dir;
  // A board with no data/ at all is a brand new install, not a broken one.
  // Every field the full return has must be here too, or a caller reading
  // one of them crashes on exactly the day the board is emptiest.
  if (!existsSync(dataDir)) return { files: 0, problems: [], badFiles: [] };

  let productIds = null;
  try {
    const reg = existsSync(join(root, 'products.json')) ? 'products.json' : 'products.example.json';
    productIds = JSON.parse(readFileSync(join(root, reg), 'utf8')).products.map((p) => p.id);
  } catch { /* the registry has its own errors; do not double-report them */ }

  const problems = [];
  /* One file can be wrong in several ways, so a problem count and a file
     count are different numbers. Both are returned, because reporting
     "3 files" for one file with three problems is the kind of arithmetic
     that makes a tool feel untrustworthy at exactly the moment it is
     telling you something is wrong. */
  const badFiles = new Set();
  let files = 0;

  for (const product of readdirSync(dataDir)) {
    const pDir = join(dataDir, product);
    if (!statSync(pDir).isDirectory()) continue;

    for (const sub of readdirSync(pDir)) {
      const kind = kindForDir(sub);
      if (!kind) continue;
      const dir = join(pDir, sub);
      if (!statSync(dir).isDirectory()) continue;

      for (const name of readdirSync(dir)) {
        if (!name.endsWith('.md')) continue;
        files += 1;
        const rel = relative(root, join(dir, name));
        const text = readFileSync(join(dir, name), 'utf8');
        const fm = parseFrontmatter(text);

        if (!fm) {
          badFiles.add(rel);
          problems.push(`${rel}\n    has no frontmatter block. Every data file starts with --- on its own line, some fields, then --- again.`);
          continue;
        }
        for (const p of problemsWith(kind, fm, { productIds })) {
          badFiles.add(rel);
          problems.push(`${rel}\n    ${p}`);
        }
      }
    }
  }

  if (!quiet) {
    const stamp = readStamp();
    if (stamp && stamp !== SCHEMA_VERSION) {
      console.log(`Data was last written for schema v${stamp}; this version is v${SCHEMA_VERSION}. Run: npm run migrate\n`);
    }
    if (problems.length) {
      const n = badFiles.size;
      console.error(
        `${problems.length} problem${problems.length === 1 ? '' : 's'} in ` +
        `${n} data file${n === 1 ? '' : 's'}:\n`
      );
      for (const p of problems) console.error(`  ${p}\n`);
      console.error('Nothing has been changed. Fix these and run it again.');
    } else {
      console.log(`${files} data file${files === 1 ? '' : 's'}, all valid.`);
    }
  }
  return { files, problems, badFiles: [...badFiles] };
}

// Run directly, rather than imported by the build.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { problems } = validateData();
  process.exit(problems.length ? 1 : 0);
}
