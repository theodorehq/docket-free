/* ============================================================
   The shape of your data, treated as a public interface.

   WHY THIS FILE IS NOT OPTIONAL RIGOUR

   Your data outlives every version of Docket that reads it. Somebody
   who has run a board for two years has thousands of files written by a
   dozen different releases, and they cannot be asked to migrate them
   because they are also the record of every promise made to a customer.

   So the schema is versioned and governed, and the rules below are
   deliberately strict. They are what makes it possible to change Docket
   without ever breaking a repository that already exists.

   THE THREE RULES

   1. ADDITIVE ONLY. A new field arrives optional, with a default that
      makes files written before it existed correct rather than merely
      tolerated. Nothing is ever renamed, removed or repurposed. If a
      field turns out to be wrongly named, it keeps its name.

   2. TOLERANT READING, EVERYWHERE. A missing field falls back to its
      default. An unrecognised field is left alone and written back
      untouched, because it may belong to a newer version than the one
      reading it, and a reader that discards what it does not understand
      destroys data on save.

   3. A CHANGE OF MEANING IS A NEW FIELD. Widening what a value can be is
      additive. Changing what an existing value MEANS is not, however
      tempting, because every historic file silently becomes a lie.

   WHAT THE VERSION IS FOR

   SCHEMA_VERSION goes up only when a migration exists to go with it.
   `data/.docket-schema` records the version the data was last written
   by, so `npm run migrate` can tell what, if anything, is owed. Neither
   is used to refuse to read anything: an older engine reads newer data
   by ignoring fields it does not know, which rule 2 guarantees.
   ============================================================ */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Raised only alongside a migration in `migrations/`. */
export const SCHEMA_VERSION = 1;

const STAMP = join(ROOT, 'data', '.docket-schema');

export function readStamp() {
  try { return Number(readFileSync(STAMP, 'utf8').trim()) || 0; } catch { return 0; }
}
export function writeStamp(v) {
  mkdirSync(dirname(STAMP), { recursive: true });
  writeFileSync(STAMP, String(v) + '\n');
}

/* ------------------------------------------------------------
   The fields.

   `required` is genuinely required: without it the file cannot be
   rendered at all. Everything else has a default, and that default is
   what a file written before the field existed means.
   ------------------------------------------------------------ */

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const KINDS = {
  post: {
    dir: ['bugs', 'features'],
    required: ['id', 'product', 'type', 'title', 'status'],
    fields: {
      id:              { check: (v) => ID.test(v), why: 'lowercase letters, numbers and hyphens' },
      product:         { check: (v) => ID.test(v), why: 'a product id from products.json' },
      type:            { one: ['bug', 'feature'] },
      title:           { check: (v) => typeof v === 'string' && v.trim().length > 0, why: 'some text' },
      status:          { one: ['under-review', 'planned', 'in-progress', 'completed', 'declined'] },
      votes:           { default: 0, check: (v) => Number.isInteger(v) && v >= 0, why: 'a whole number, zero or more' },
      author:          { default: 'Anonymous' },
      email:           { default: '' },
      created:         { default: '', check: (v) => !v || DATE.test(v), why: 'a date like 2026-08-12' },
      updated:         { default: '', check: (v) => !v || DATE.test(v), why: 'a date like 2026-08-12' },
      roadmap:         { default: 'none', one: ['none', 'consideration', 'planned', 'in-progress', 'shipped'] },
      pinned:          { default: false },
      notifiedReplies: { default: 0, check: (v) => Number.isInteger(v) && v >= 0, why: 'a whole number, and not one to edit by hand' },
      submittedAt:     { default: '' },
      voters:          { default: '' },
      votersNotified:  { default: '' },
      source:          { default: '' },
      sourceUrl:       { default: '' },
    },
  },
  testimonial: {
    dir: ['testimonials'],
    required: ['id', 'product', 'stars'],
    fields: {
      id:       { check: (v) => ID.test(v), why: 'lowercase letters, numbers and hyphens' },
      product:  { check: (v) => ID.test(v), why: 'a product id from products.json' },
      stars:    { check: (v) => Number.isInteger(v) && v >= 1 && v <= 5, why: 'a whole number from 1 to 5' },
      author:   { default: 'Anonymous' },
      email:    { default: '' },
      country:  { default: '', check: (v) => !v || /^[A-Z]{2}$/.test(v), why: 'a two-letter country code like GB' },
      created:  { default: '', check: (v) => !v || DATE.test(v), why: 'a date like 2026-08-12' },
      approved: { default: false, check: (v) => typeof v === 'boolean', why: 'true or false' },
    },
  },
  changelog: {
    dir: ['changelog'],
    required: ['product', 'version', 'date'],
    fields: {
      product: { check: (v) => ID.test(v), why: 'a product id from products.json' },
      version: { check: (v) => typeof v === 'string' && String(v).trim().length > 0, why: 'a version like 1.4.2' },
      date:    { check: (v) => DATE.test(v), why: 'a date like 2026-08-12' },
      title:   { default: '' },
      // Ids of the bugs and features this release closed, comma separated.
      // Optional, and an id that does not resolve is simply not linked.
      shipped: { default: '' },
    },
  },
  faq: {
    dir: ['faq'],
    required: ['id', 'product', 'question'],
    fields: {
      id:       { check: (v) => ID.test(v), why: 'lowercase letters, numbers and hyphens' },
      product:  { check: (v) => ID.test(v), why: 'a product id from products.json' },
      question: { check: (v) => typeof v === 'string' && v.trim().length > 0, why: 'some text' },
      category: { default: 'General' },
      subtitle: { default: '' },
      order:    { default: 999, check: (v) => Number.isInteger(v), why: 'a whole number' },
      updated:  { default: '', check: (v) => !v || DATE.test(v), why: 'a date like 2026-08-12' },
    },
  },
};

/** Which kind of file a data path holds, or null if it is not one. */
export function kindForDir(dirName) {
  for (const [kind, spec] of Object.entries(KINDS)) {
    if (spec.dir.includes(dirName)) return kind;
  }
  return null;
}

/**
 * Applies defaults for anything absent, and leaves anything unrecognised
 * exactly as it is. This is rule 2, in one function, so that no reader
 * has to remember to be tolerant on its own.
 */
export function withDefaults(kind, fm) {
  const spec = KINDS[kind];
  if (!spec) return { ...fm };
  const out = { ...fm };                       // unknown fields survive
  for (const [name, def] of Object.entries(spec.fields)) {
    if (out[name] === undefined && 'default' in def) out[name] = def.default;
  }
  return out;
}

/**
 * Problems with one file, in plain English, aimed at whoever has to fix
 * it rather than at whoever wrote the parser.
 *
 * @returns {string[]} empty when the file is fine
 */
export function problemsWith(kind, fm, { productIds = null } = {}) {
  const spec = KINDS[kind];
  if (!spec) return [];
  const out = [];

  for (const name of spec.required) {
    if (fm[name] === undefined || fm[name] === '') {
      out.push(`is missing "${name}", which it cannot be shown without`);
    }
  }

  for (const [name, def] of Object.entries(spec.fields)) {
    const v = fm[name];
    if (v === undefined) continue;                       // absent is fine; defaults cover it
    if (def.one && !def.one.includes(v)) {
      out.push(`has ${name}: ${JSON.stringify(v)}, which is not one of ${def.one.join(', ')}`);
      continue;
    }
    if (def.check && !def.check(v)) {
      out.push(`has ${name}: ${JSON.stringify(v)}, and it needs ${def.why}`);
    }
  }

  if (productIds && fm.product && !productIds.includes(fm.product)) {
    out.push(`is filed under product "${fm.product}", which is not in products.json`);
  }

  return out;
}
