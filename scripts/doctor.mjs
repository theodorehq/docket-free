#!/usr/bin/env node
/* ============================================================
   Checks this install and says what is still missing.

     npm run check

   WHY THIS EXISTS

   Setting up Docket means getting a handful of separate things right:
   a config file, a product list, a token, some environment variables,
   a host. Any one of them missing produces a different symptom, and
   some produce no symptom at all until a real customer hits them. A
   support board that looks perfect but silently drops submissions is
   the worst possible outcome, because the first person to notice is a
   customer who thinks they were ignored.

   So the question "is it set up correctly?" gets an answer you can run
   rather than a checklist you can misread. Every line is either a tick
   or a plain sentence saying what to do next.

   Safe to run any time. It reads; it never writes and never sends.
   ============================================================ */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../lib/env.mjs';
import { validateData } from './validate-data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Load a .env file if there is one, so this reports what a local run
   would actually see. Deliberately hand-rolled: Docket has no
   dependencies, and this is 8 lines. */
if (existsSync(join(ROOT, '.env'))) {
  for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
}

const config = (await import('../lib/config.mjs')).default;
const { usingExampleConfig } = await import('../lib/config.mjs');
const { usingExampleRegistry, products } = await import('../lib/products.mjs');

let blocking = 0;
let optional = 0;

function ok(what) {
  console.log(`  ✓  ${what}`);
}
function missing(what, fix) {
  blocking += 1;
  console.log(`  ✗  ${what}`);
  console.log(`     ${fix}`);
}
function note(what, fix) {
  optional += 1;
  console.log(`  ·  ${what}`);
  console.log(`     ${fix}`);
}

console.log('\nChecking your Docket install.\n');

/* ---------- your settings ---------- */

console.log('Your settings');

if (usingExampleConfig) {
  missing(
    'You have no config.js yet, so the site is running on the example.',
    'Copy config.example.js to config.js and put your own details in it.'
  );
} else {
  ok('config.js exists');

  const placeholders = [];
  if (/example\.com/.test(config.brand.homeUrl)) placeholders.push('brand.homeUrl');
  if (/example\.com/.test(config.brand.siteUrl)) placeholders.push('brand.siteUrl');
  if (/example\.com/.test(config.contact.supportEmail)) placeholders.push('contact.supportEmail');
  if (config.brand.name === 'Example Co') placeholders.push('brand.name');

  if (placeholders.length) {
    missing(
      `Still on the example values: ${placeholders.join(', ')}.`,
      'Edit config.js. These appear on your live site and in emails to customers.'
    );
  } else {
    ok('your own name, addresses and email are set');
  }

  if (!/^https:\/\//.test(config.brand.siteUrl)) {
    missing(
      `brand.siteUrl is "${config.brand.siteUrl}", which is not an https address.`,
      'It must be the full address this support centre will live at, like https://support.yourcompany.com'
    );
  } else if (config.brand.siteUrl.split('/').length > 3) {
    missing(
      `brand.siteUrl points at a folder: ${config.brand.siteUrl}`,
      'Docket needs its own subdomain, not a folder of an existing site. Use something like https://support.yourcompany.com'
    );
  } else {
    ok('the address it will live at looks right');
  }
}

/* ---------- your products ---------- */

console.log('\nYour products');

if (usingExampleRegistry) {
  missing(
    'You have no products.json yet, so the board is showing the example products.',
    'Copy products.example.json to products.json and list your own. There is no limit on how many.'
  );
} else {
  ok(`${products.length} product${products.length === 1 ? '' : 's'}: ${products.map((p) => p.name).join(', ')}`);
}

/* ---------- writing submissions ---------- */

console.log('\nAccepting submissions');

if (!env('GITHUB_TOKEN')) {
  missing(
    'GITHUB_TOKEN is not set, so nothing anyone submits can be saved.',
    'Create a fine-grained GitHub token with Contents: Read and write on this repo only, then set it here and in your host\'s settings.'
  );
} else {
  ok('GITHUB_TOKEN is set');
}

if (!env('GITHUB_REPO')) {
  missing(
    'GITHUB_REPO is not set, so the site does not know where to save submissions.',
    'Set it to your repo, in the form owner/name.'
  );
} else if (!/^[\w.-]+\/[\w.-]+$/.test(env('GITHUB_REPO'))) {
  missing(
    `GITHUB_REPO is "${env('GITHUB_REPO')}", which is not in the form owner/name.`,
    'It should look like acme/support, with no https:// and no .git.'
  );
} else {
  ok(`submissions save to ${env('GITHUB_REPO')}`);
}

/* ---------- customer privacy ---------- */

console.log('\nCustomer privacy');

if (!env('EMAIL_ENCRYPTION_KEY')) {
  note(
    'EMAIL_ENCRYPTION_KEY is not set, so no customer email addresses are stored at all.',
    'Everything still works, but you will have no way to reply to anyone by email. ' +
    'Generate one with: openssl rand -base64 32'
  );
} else {
  const { emailEncryptionAvailable } = await import('../lib/email-crypto.mjs');
  if (emailEncryptionAvailable()) ok('customer email addresses are encrypted before they are saved');
  else missing('EMAIL_ENCRYPTION_KEY is set but unusable.', 'Generate a fresh one with: openssl rand -base64 32');
}


/* ---------- does it actually build ---------- */

console.log('\nThe site itself');

try {
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync('node', [join(ROOT, 'scripts', 'build.mjs')], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  const pages = out.match(/Built (\d+) pages/);
  if (pages) ok(`builds: ${pages[1]} pages`);
  else missing('The build produced nothing.', out.trim().split('\n').slice(-3).join(' '));

  /* The build deliberately publishes even when a data file is malformed, so
     that one typo cannot stop every other report appearing. That makes this
     the place the problem has to surface: otherwise a bad file is mentioned
     once in a deploy log nobody reads, and the item stays invisible. */
  const { badFiles } = validateData({ quiet: true });
  if (badFiles.length) {
    note(
      `${badFiles.length} data file${badFiles.length === 1 ? '' : 's'} may not appear correctly.`,
      badFiles.slice(0, 3).join('\n     ') +
        (badFiles.length > 3 ? `\n     and ${badFiles.length - 3} more.` : '') +
        `\n     Run npm run validate to see what is wrong with ${badFiles.length === 1 ? 'it' : 'them'}.`
    );
  }
} catch (err) {
  const detail = ((err.stdout || '') + (err.stderr || '')).trim().split('\n').filter((l) => !l.startsWith('    at ')).slice(0, 4).join('\n     ');
  missing('The site does not build.', detail || err.message);
}

/* ---------- the verdict ---------- */

console.log('');
if (blocking) {
  console.log(`${blocking} thing${blocking === 1 ? '' : 's'} to fix before this is ready for customers.`);
  if (optional) console.log(`${optional} optional thing${optional === 1 ? '' : 's'} you can leave for later.`);
  console.log('');
  process.exit(1);
}

if (optional) {
  console.log(`Ready for customers. ${optional} optional thing${optional === 1 ? '' : 's'} you could turn on later.\n`);
} else {
  console.log('Everything is set up.\n');
}
