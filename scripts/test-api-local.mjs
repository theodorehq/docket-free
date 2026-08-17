#!/usr/bin/env node
// Local verification for the Docket API, with no deploy and no
// network. SUPPORT_API_DRYRUN=1 makes api/_lib.mjs write to .dryrun/
// instead of GitHub and print emails/webhooks instead of sending them.
//
//   node scripts/test-api-local.mjs

process.env.SUPPORT_API_DRYRUN = '1';
/* Pin the whole suite to the shipped examples: the example config and the
   example board, whatever this install happens to be configured as.

   This suite tests the ENGINE, so its assertions name the example board's
   items and the example address. Read through the ordinary rules it passed
   207 of 207 on an untouched template and failed 7 the moment products.json
   existed, which is step 2 of SETUP.md. Since UPDATE.md asks the buyer's
   agent to run it after every update, every buyer would have seen failures
   about products called Aurora and Pico they had never heard of, on an
   install that was working perfectly.

   Pinned, it means the same thing on every install: does this engine still
   work. Set before any dynamic import, because lib/config.mjs decides which
   file to read once, when it is first loaded. */
process.env.DOCKET_FIXTURES = '1';
process.env.N8N_WEBHOOK_URL = 'https://n8n.example/webhook/support-test';
// A fresh random key per run, so the suite exercises real encryption
// rather than the no-key degradation path, and no key material is ever
// committed to the repo.
process.env.EMAIL_ENCRYPTION_KEY = (await import('node:crypto')).randomBytes(32).toString('base64');

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveForRead } from '../lib/data-root.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const dryRoot = path.join(repoRoot, '.dryrun');

/* Where to read a fixture from. lib/data-root.mjs owns the rule and, in
   fixtures mode, points at data.example/ regardless of what this install
   has. Ask it rather than deciding again here, so the suite reads exactly
   what the API under test reads.

   Writes are unaffected: they go to .dryrun/, so the examples are never
   edited and neither is anyone's real content. */
function sourcePath(repoPath) {
  return resolveForRead(repoPath, repoRoot);
}

// Clean slate.
fs.rmSync(dryRoot, { recursive: true, force: true });

const { default: submit } = await import('../api/submit.js');
const { default: vote } = await import('../api/vote.js');
const lib = await import('../api/_lib.mjs');
const crypto = await import('../lib/email-crypto.mjs');

// Writes an item fixture straight into the dry-run store so the code under
// test picks it up via listRepoDir/readRepoFile.
function writeFixture(repoPath, frontmatter, body) {
  const fm = ['---', ...Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`), '---'].join('\n');
  const full = `${fm}\n\n${body}\n`;
  const p = path.join(dryRoot, repoPath);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, full, 'utf8');
}

function minsAgoISO(mins) {
  return new Date(Date.now() - mins * 60 * 1000).toISOString();
}

// --- Mock req/res -------------------------------------------------------------

function mockReq(body, { method = 'POST', ip = '203.0.113.1' } = {}) {
  return {
    method,
    // x-real-ip is what Vercel sets to the true client IP (and what the rate
    // limiter trusts). x-forwarded-for is included with a spoofed leftmost
    // entry to confirm it is NOT trusted over x-real-ip.
    headers: {
      'x-real-ip': ip,
      'x-forwarded-for': `1.1.1.1, ${ip}, 10.0.0.1`,
      'content-type': 'application/json',
    },
    body,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    payload: undefined,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.payload = obj; return this; },
    end() { return this; },
  };
  return res;
}

// --- Tiny test runner -----------------------------------------------------------

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` -> ${detail}` : ''}`);
  }
}

function dryRead(repoPath) {
  const p = path.join(dryRoot, repoPath);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

// Captures console.log lines emitted while fn runs (still forwarding them),
// so dry-run email/webhook prints from _lib.mjs can be asserted on.
async function withCapturedLogs(fn) {
  const lines = [];
  const orig = console.log;
  console.log = (...args) => { lines.push(args.join(' ')); orig(...args); };
  try { await fn(); } finally { console.log = orig; }
  return lines;
}

// ================================================================================
console.log('\n1. kind:"post" - new bug report (aurora)');
{
  // Expected id is derived BEFORE the write, not hardcoded: real submissions
  // keep landing in data/, so any fixed number goes stale and reds the suite.
  const expectedId = await lib.nextId('aurora', 'bugs', 'bug');

  const res = mockRes();
  await submit(mockReq({
    kind: 'post', product: 'aurora', type: 'bug',
    title: 'Menu bar icon vanishes <script>alert(1)</script> after sleep',
    body: 'Steps: close the lid, wait, reopen. The <b>icon</b> is gone.',
    name: 'Test User', email: 'test.user@example.com', website: '',
  }, { ip: '203.0.113.1' }), res);

  check('returns 200 ok', res.statusCode === 200 && res.payload?.ok === true, JSON.stringify(res.payload));
  check(`id is the next free aurora bug id (${expectedId})`, res.payload?.id === expectedId, res.payload?.id);
  check('url points at the item page', res.payload?.url === `https://support.example.com/aurora/bugs/${expectedId}/`, res.payload?.url);

  const text = dryRead(`data/aurora/bugs/${expectedId}.md`);
  check('file written to .dryrun', !!text);
  const parsed = text && lib.parseFrontmatter(text);
  check('frontmatter parses', !!parsed);
  check('status under-review, votes 0', parsed?.fm.status === 'under-review' && parsed?.fm.votes === 0);
  check('email stored ENCRYPTED, never in the clear',
    crypto.isEncryptedEmail(parsed?.fm.email) && !String(parsed?.fm.email).includes('@'), parsed?.fm.email);
  check('stored email decrypts back to the submitter', crypto.decryptEmail(parsed?.fm.email) === 'test.user@example.com');
  check('HTML stripped from title', !String(parsed?.fm.title).includes('<') && String(parsed?.fm.title).includes('after sleep'), parsed?.fm.title);
  check('HTML stripped from body', !parsed?.body.includes('<b>'), parsed?.body.trim());
  check('no roadmap field on a bug', !('roadmap' in (parsed?.fm || {})));
  check('created/updated are today UTC', parsed?.fm.created === lib.todayUTC() && parsed?.fm.updated === lib.todayUTC());
}


// ================================================================================
console.log('\n1c. The platform pill');
{
  const { platformOf } = await import('../lib/platform.mjs');
  const T = await import('./templates.mjs');

  check('no platform set renders nothing at all', T.platformPill({}) === '');
  check('and neither does whitespace', T.platformPill({ platform: '   ' }) === '');

  check('macOS is recognised', platformOf({ platform: 'macOS' }).key === 'mac');
  check('an editor extension is recognised', platformOf({ platform: 'VS Code extension' }).key === 'plugin');
  check('so is a Figma plugin', platformOf({ platform: 'Figma plugin' }).key === 'plugin');
  check('"web app" is web, not caught by the bare "app" rule',
    platformOf({ platform: 'Web app' }).key === 'web');

  /* The field is the buyer's, so anything they type must still render. An
     unrecognised platform gets the neutral dot and its own words back, which
     is the graceful half: unfamiliar looks plain, never broken. */
  const odd = platformOf({ platform: 'Steam Deck' });
  check('an unknown platform still renders, with a neutral shape',
    odd.key === 'other' && odd.label === 'Steam Deck');

  // Long values must not be able to push the product name around.
  const long = platformOf({ platform: 'A very long platform name that runs on and on' });
  check('a very long value is truncated', long.label.length <= 24 && long.label.endsWith('\u2026'), long.label);

  const html = T.platformPill({ platform: '<img src=x onerror=alert(1)>' });
  check('the label is escaped', !html.includes('<img'), html.slice(0, 60));
}

// ================================================================================
console.log('\n2. kind:"post" - new feature request (aurora)');
{
  const expectedId = await lib.nextId('aurora', 'features', 'feature');

  const res = mockRes();
  await submit(mockReq({
    kind: 'post', product: 'aurora', type: 'feature',
    title: 'Per-app appearance overrides',
    body: 'Let me keep certain apps light while the system goes dark.',
    name: 'Feature Fan', website: '',
  }, { ip: '203.0.113.2' }), res);

  check('returns 200 ok', res.statusCode === 200 && res.payload?.ok === true, JSON.stringify(res.payload));
  check(`id is the next free aurora feature id (${expectedId})`, res.payload?.id === expectedId, res.payload?.id);

  const text = dryRead(`data/aurora/features/${expectedId}.md`);
  const parsed = text && lib.parseFrontmatter(text);
  check('roadmap: none on features', parsed?.fm.roadmap === 'none');
  check('empty email stored as ""', parsed?.fm.email === '');
  check('new items start at notifiedReplies: 0 so their first reply is emailed',
    Number(parsed?.fm.notifiedReplies) === 0, String(parsed?.fm.notifiedReplies));
}

// ================================================================================
console.log('\n3. kind:"comment" - append reply round-trip (aurora-feature-0001)');
{
  const res = mockRes();
  await submit(mockReq({
    kind: 'comment', itemId: 'aurora-feature-0001',
    body: 'Same here, we would use this every single day.',
    name: 'Commenter Carl', email: 'carl@example.com', website: '',
  }, { ip: '203.0.113.3' }), res);

  check('returns 200 ok', res.statusCode === 200 && res.payload?.ok === true, JSON.stringify(res.payload));
  check('url is the item page', res.payload?.url === 'https://support.example.com/aurora/features/aurora-feature-0001/', res.payload?.url);

  const text = dryRead('data/aurora/features/aurora-feature-0001.md');
  check('modified file written to .dryrun', !!text);
  const parsed = text && lib.parseFrontmatter(text);
  check('frontmatter still parses after edit', !!parsed);
  check('original fields untouched (id, title, votes, roadmap)',
    parsed?.fm.id === 'aurora-feature-0001' &&
    parsed?.fm.title === 'Rules - Auto-assign by sender domain' &&
    parsed?.fm.votes === 34 && parsed?.fm.roadmap === 'planned');
  check('updated bumped to today', parsed?.fm.updated === lib.todayUTC(), String(parsed?.fm.updated));
  check('reply appended under ## Replies',
    new RegExp(`### Commenter Carl - ${lib.todayUTC()}\\n\\nSame here, we would use this every single day\\.`).test(text));
  check('existing replies preserved', text.includes('### Example Co - 2026-04-11'));
  const headingCount = (text.match(/^## Replies$/gm) || []).length;
  check('exactly one ## Replies heading', headingCount === 1, `found ${headingCount}`);
}

// ================================================================================
console.log('\n4. kind:"comment" - adds ## Replies heading when absent (aurora-bug-0001)');
{
  const res = mockRes();
  await submit(mockReq({
    kind: 'comment', itemId: 'aurora-bug-0001',
    body: 'Also seeing this on macOS 26.5.',
    name: 'Second Reporter', website: '',
  }, { ip: '203.0.113.4' }), res);

  check('returns 200 ok', res.statusCode === 200 && res.payload?.ok === true, JSON.stringify(res.payload));
  const text = dryRead('data/aurora/bugs/aurora-bug-0001.md');
  check('## Replies heading added', /^## Replies$/m.test(text || ''));
  check('reply present', (text || '').includes('### Second Reporter'));
}

// ================================================================================
console.log('\n5. kind:"testimonial" (aurora)');
{
  const res = mockRes();
  await submit(mockReq({
    kind: 'testimonial', product: 'aurora', stars: 5,
    body: 'Aurora made our shared inbox painless. Worth every penny.',
    name: 'Happy Customer', email: 'happy@example.com', country: 'gb', website: '',
  }, { ip: '203.0.113.5' }), res);

  check('returns 200 ok', res.statusCode === 200 && res.payload?.ok === true, JSON.stringify(res.payload));
  // Next id follows the existing aurora testimonials (migrated set), so assert
  // the shape rather than a fixed number the data can drift past.
  check('id is a sequential aurora-testimonial', /^aurora-testimonial-\d{4}$/.test(res.payload?.id || ''), res.payload?.id);

  const text = res.payload?.id && dryRead(`data/aurora/testimonials/${res.payload.id}.md`);
  const parsed = text && lib.parseFrontmatter(text);
  check('approved: false', parsed?.fm.approved === false);
  check('stars: 5', parsed?.fm.stars === 5);
  check('country uppercased to GB', parsed?.fm.country === 'GB');
}

// ================================================================================
console.log('\n6. Honeypot - filled "website" field returns ok silently, writes nothing');
{
  const before = fs.existsSync(path.join(dryRoot, 'data/pico')) ? fs.readdirSync(path.join(dryRoot, 'data/pico')) : [];
  const res = mockRes();
  await submit(mockReq({
    kind: 'post', product: 'pico', type: 'bug',
    title: 'BUY CHEAP WATCHES', body: 'spam spam spam', name: 'Bot',
    website: 'https://spam.example',
  }, { ip: '203.0.113.66' }), res);

  check('returns 200 {ok:true} (no tip-off)', res.statusCode === 200 && res.payload?.ok === true && !res.payload.id, JSON.stringify(res.payload));
  check('no file written', !fs.existsSync(path.join(dryRoot, 'data/pico')) || fs.readdirSync(path.join(dryRoot, 'data/pico')).length === before.length);
}

// ================================================================================
console.log('\n7. Rate limit - 6th submission from the same IP gets 429');
{
  const ip = '198.51.100.99';
  let last;
  for (let i = 1; i <= 6; i++) {
    last = mockRes();
    await submit(mockReq({
      kind: 'post', product: 'pico', type: 'feature',
      title: `Rate limit probe ${i}`, body: 'Testing the limiter.', name: 'Limiter', website: '',
    }, { ip }), last);
    if (i <= 5) check(`submission ${i} accepted`, last.statusCode === 200 && last.payload?.ok === true, `status ${last.statusCode}`);
  }
  check('6th submission rejected with 429', last.statusCode === 429 && last.payload?.ok === false, `status ${last.statusCode}`);
}

// ================================================================================
console.log('\n8. Validation - unknown product and bad kind rejected');
{
  const res1 = mockRes();
  await submit(mockReq({ kind: 'post', product: 'notaproduct', type: 'bug', title: 'x', body: 'y', name: 'z', website: '' }, { ip: '203.0.113.7' }), res1);
  check('unknown product -> 400', res1.statusCode === 400, `status ${res1.statusCode}`);

  const res2 = mockRes();
  await submit(mockReq({ kind: 'wat', website: '' }, { ip: '203.0.113.8' }), res2);
  check('unknown kind -> 400', res2.statusCode === 400, `status ${res2.statusCode}`);

  const res3 = mockRes();
  await submit(mockReq({ kind: 'post' }, { method: 'GET', ip: '203.0.113.9' }), res3);
  check('GET -> 405', res3.statusCode === 405, `status ${res3.statusCode}`);
}

// ================================================================================
console.log('\n9. /api/vote - increments votes (aurora-feature-0002)');
{
  const res = mockRes();
  await vote(mockReq({ id: 'aurora-feature-0002' }, { ip: '203.0.113.10' }), res);

  const source = fs.readFileSync(sourcePath('data/aurora/features/aurora-feature-0002.md'), 'utf8');
  const before = lib.parseFrontmatter(source).fm.votes;

  check('returns 200 ok', res.statusCode === 200 && res.payload?.ok === true, JSON.stringify(res.payload));
  check(`votes incremented (${before} -> ${before + 1})`, res.payload?.votes === before + 1, `got ${res.payload?.votes}`);

  const text = dryRead('data/aurora/features/aurora-feature-0002.md');
  const parsed = text && lib.parseFrontmatter(text);
  check('file on disk reflects new count', parsed?.fm.votes === before + 1);
  check('rest of frontmatter untouched', parsed?.fm.id === 'aurora-feature-0002' && parsed?.fm.status && parsed?.fm.title === lib.parseFrontmatter(source).fm.title);

  // Second vote reads the .dryrun copy and increments again.
  const res2 = mockRes();
  await vote(mockReq({ id: 'aurora-feature-0002' }, { ip: '203.0.113.10' }), res2);
  check('second vote increments again', res2.payload?.votes === before + 2, `got ${res2.payload?.votes}`);

  const res3 = mockRes();
  await vote(mockReq({ id: 'aurora-bug-9999' }, { ip: '203.0.113.10' }), res3);
  check('unknown item -> 400', res3.statusCode === 400, `status ${res3.statusCode}`);

  const res4 = mockRes();
  await vote(mockReq({}, { method: 'GET', ip: '203.0.113.10' }), res4);
  check('GET -> 405', res4.statusCode === 405, `status ${res4.statusCode}`);
}

// ================================================================================
console.log('\n10. Vote rate limit - 21st vote from one IP gets 429');
{
  const ip = '198.51.100.42';
  let last;
  for (let i = 1; i <= 21; i++) {
    last = mockRes();
    await vote(mockReq({ id: 'aurora-feature-0001' }, { ip }), last);
  }
  check('21st vote rejected with 429', last.statusCode === 429, `status ${last.statusCode}`);
}

// ================================================================================
console.log('\n11. submit "post" now stamps submittedAt (ISO, unquoted, not rendered)');
{
  const res = mockRes();
  await submit(mockReq({
    kind: 'post', product: 'pico', type: 'bug',
    title: 'Timestamp probe', body: 'Checking submittedAt is written.', name: 'Stamp', website: '',
  }, { ip: '203.0.113.111' }), res);
  const text = dryRead(`data/pico/bugs/${res.payload?.id}.md`);
  const parsed = text && lib.parseFrontmatter(text);
  const raw = parsed?.fm?.submittedAt;
  check('submittedAt present and a raw ISO string', typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(raw), String(raw));
  check('submittedAt written unquoted in the file', /\nsubmittedAt: \d{4}-\d{2}-\d{2}T/.test(text || ''));
}

// ================================================================================

// ================================================================================
// --- 18. Email encryption ----------------------------------------------------
console.log('\n18. Email encryption - no readable address ever reaches the repo');
{
  const enc = crypto.encryptEmail('someone@example.com');
  check('stored form is prefixed and opaque', enc.startsWith('enc.v1.') && !enc.includes('@'), enc);
  check('round-trips', crypto.decryptEmail(enc) === 'someone@example.com');
  check('same address encrypts differently each time (random IV)',
    crypto.encryptEmail('someone@example.com') !== crypto.encryptEmail('someone@example.com'));
  check('tampered ciphertext yields nothing, never garbage',
    crypto.decryptEmail(enc.slice(0, -6) + 'AAAAAA') === '');
  check('empty in, empty out', crypto.encryptEmail('') === '' && crypto.decryptEmail('') === '');
  check('already-encrypted value is not double-encrypted', crypto.encryptEmail(enc) === enc);
  check('legacy plaintext still readable, so an existing archive keeps working',
    crypto.decryptEmail('old@example.com') === 'old@example.com');

  // With no key, storage must fail closed: no address at all, never plaintext.
  const key = process.env.EMAIL_ENCRYPTION_KEY;
  delete process.env.EMAIL_ENCRYPTION_KEY;
  check('no key: encryption reports unavailable', crypto.emailEncryptionAvailable() === false);
  check('no key: stores NOTHING rather than plaintext', crypto.encryptEmail('a@b.com') === '');
  check('no key: cannot read an encrypted value', crypto.decryptEmail(enc) === '');
  process.env.EMAIL_ENCRYPTION_KEY = key;
  check('key restored', crypto.emailEncryptionAvailable() === true);
}

// ================================================================================
console.log('\n19. Origin check - requests that did not come from your site');
{
  const site = 'https://support.acme.com';
  const M = lib.originMismatch;

  check('a page on your own site is allowed', M('https://support.acme.com', site) === false);
  check('a different host is refused', M('https://evil.example.net', site) === true);
  check('a different port is refused', M('https://support.acme.com:8443', site) === true);
  check('http vs https on the same host is allowed', M('http://support.acme.com', site) === false);
  check('nonsense in the header is refused', M('not-a-url', site) === true);

  // Two deliberate leniencies. Getting either wrong would refuse real people,
  // which is a worse outcome than letting some spam through.
  check('a missing header is allowed, because privacy tools strip it', M('', site) === false);
  check('undefined is allowed too', M(undefined, site) === false);
  check('skipped entirely while siteUrl is still the example',
    M('https://evil.example.net', 'https://support.example.com') === false);
  check('skipped when siteUrl is not set at all', M('https://evil.example.net', '') === false);
}

// ================================================================================

// ================================================================================

// ================================================================================

// ================================================================================

// ================================================================================
console.log('\n24. The data schema, treated as a public interface');
{
  const S = await import('../lib/schema.mjs');

  // Rule 2, which is what lets an old engine read new data and a new
  // engine read old data. Get this wrong and every future change is a
  // breaking change for everybody who already has a year of history.
  const old = { id: 'x-bug-0001', product: 'x', type: 'bug', title: 'T', status: 'under-review' };
  const filled = S.withDefaults('post', old);
  check('a file written before a field existed gets its default',
    filled.votes === 0 && filled.roadmap === 'none' && filled.notifiedReplies === 0);
  check('and is not otherwise altered', filled.title === 'T' && filled.status === 'under-review');

  const future = S.withDefaults('post', { ...old, somethingNewer: 'keep me' });
  check('a field from a NEWER version survives being read',
    future.somethingNewer === 'keep me');

  // Every problem has to name what to do, because these files are edited
  // by hand and a mistyped status renders nowhere at all rather than failing.
  const bad = S.problemsWith('post', { ...old, status: 'compelted', votes: -2 });
  check('a mistyped status is caught', bad.some((p) => /not one of/.test(p)));
  check('and lists what is valid', bad.some((p) => /under-review/.test(p)));
  check('a negative vote count is caught', bad.some((p) => /votes/.test(p) && /whole number/.test(p)));
  check('a clean file has no problems', S.problemsWith('post', old).length === 0);
  check('a missing required field says it cannot be shown',
    S.problemsWith('post', { id: 'a', product: 'b', type: 'bug', title: 'T' })
      .some((p) => /missing "status"/.test(p)));
  check('an item filed under an unknown product is caught',
    S.problemsWith('post', old, { productIds: ['other'] }).some((p) => /not in products.json/.test(p)));

  check('testimonials are rated one to five',
    S.problemsWith('testimonial', { id: 'a', product: 'b', stars: 9 }).some((p) => /1 to 5/.test(p)));
  check('each folder maps to a kind',
    S.kindForDir('bugs') === 'post' && S.kindForDir('faq') === 'faq' && S.kindForDir('nonsense') === null);
}

console.log('\n25. Status pages - the layer between the board and an item');
{
  const T = await import('./templates.mjs');

  const post = (id, st, extra = {}) => ({
    post: {
      id, st, type: 'bug', title: `Item ${id}`, author: 'Sam', votes: 3,
      created: '2026-08-01', dateLabel: 'Aug 1', excerpt: 'short version, cut off',
      descText: 'the whole report, which is the entire reason this page exists',
      replies: [], ...extra,
    },
    productRef: { id: 'aurora', name: 'Aurora' },
  });

  const entries = [post('a', 'review'), post('b', 'review'), post('c', 'done')];
  const cols = T.boardCols(entries);

  /* The slugs are addresses. A rename here silently 404s every link anyone
     has ever pasted into a support reply, so they are pinned. */
  check('the status slugs are the ones we published',
    T.STATUS_SLUG.review === 'under-review' && T.STATUS_SLUG.progress === 'in-progress' &&
    T.STATUS_SLUG.done === 'completed' && T.STATUS_SLUG.planned === 'planned');

  const chooser = T.statusChooserHtml(cols, entries, 'review', '/aurora/bugs/', 'Bugs');
  check('every chip is a real link, not a filter',
    (chooser.match(/<a class="stc/g) || []).length === cols.length + 1);
  check('the chip points at the status page', chooser.includes('href="/aurora/bugs/under-review/"'));
  /* The board page IS All: the columns became these chips, so there is no
     separate page showing the same items in a different shape. */
  check('All is the board page itself', chooser.includes('href="/aurora/bugs/"'));
  check('and there is no second all page', !chooser.includes('/aurora/bugs/all/'));
  check('All is selected when no status is chosen',
    /class="stc stc-all is-active"/.test(
      T.statusChooserHtml(cols, entries, null, '/aurora/bugs/', 'Bugs')));

  /* Every row in the mixed view says which status it is in; on a
     single-status page the pill would be the same on every row. */
  const mixed = T.statusListHtml(entries, { badge: false, showStatus: true, emptyCopy: 'x' });
  check('the all view puts a status pill on each row',
    (mixed.match(/class="pill pill-/g) || []).length === entries.length);
  check('and names the status', mixed.includes('>Under Review<') && mixed.includes('>Completed<'));
  check('a single-status page shows no pills',
    !T.statusListHtml(entries, { badge: false, emptyCopy: 'x' }).includes('class="pill pill-'));
  check('the current status is marked for a screen reader too',
    /class="stc st-review s-review is-active" href="\/aurora\/bugs\/under-review\/" aria-current="page"/.test(chooser));
  check('the counts are per status, not the total',
    chooser.includes('>2</span>') && chooser.includes('>3</span>'));

  const list = T.statusListHtml(entries.filter((e) => e.post.st === 'review'), { badge: false, emptyCopy: 'x' });
  check('the list shows the full report, not the card excerpt',
    list.includes('the whole report, which is the entire reason this page exists') &&
    !list.includes('short version, cut off'));
  check('each row links to the item', (list.match(/class="sl-row"/g) || []).length === 2);

  const withReply = T.statusListHtml(
    [post('d', 'review', { replies: [{ official: true, officialName: 'Support Team', text: 'We are on it.' }] })],
    { badge: false, emptyCopy: 'x' });
  check('an official reply comes with the row', /class="sl-reply"><b>Support Team<\/b> We are on it\./.test(withReply));
  check('and a customer reply does not', !T.statusListHtml(
    [post('e', 'review', { replies: [{ official: false, officialName: 'Sam', text: 'me too' }] })],
    { badge: false, emptyCopy: 'x' }).includes('sl-reply'));

  /* An empty status is a page somebody CHOSE to open, so "nothing here yet"
     reads as broken. It has to say something true about this status. */
  const empty = T.statusListHtml([], { badge: false, emptyCopy: 'Nothing is waiting to be read.' });
  check('an empty status says something specific', empty.includes('Nothing is waiting to be read.'));
  check('and offers no rows to click', !empty.includes('sl-row'));

  /* The board heading is a link only where there is somewhere to go. */
  const board = T.kanbanHtml(entries, { cols, badge: false, typeTag: false, statusBase: '/aurora/bugs/', statusNoun: 'Bugs' });
  check('the board column heading links to its status page',
    board.includes('class="kcol-head is-link" href="/aurora/bugs/under-review/"'));
  check('and names where it goes, for anyone not looking at it',
    board.includes('aria-label="See All Under Review Bugs"'));
  const roadmap = T.kanbanHtml(entries, { cols: T.COLS_ROADMAP, badge: false, typeTag: true, by: 'roadmap' });
  check('the roadmap headings stay plain, having nowhere to go',
    !roadmap.includes('kcol-head is-link'));

  /* The way out of a status page is the section name, and it is the same
     control as the one above an item so there is only one thing to learn. */
  const back = T.boardHeadHtml(
    { id: 'aurora', name: 'Aurora', tagline: 'x', icon: '', url: '' },
    '<span>tools</span>',
    { toolbar: { back: { href: '/aurora/bugs/', label: 'Bugs' } } });
  check('the section name is the way back', back.includes('href="/aurora/bugs/"'));
  check('and wears the same control as an item page', back.includes('class="detail-back toolbar-back"'));
  check('a board still gets a plain caption, not a back link',
    !T.boardHeadHtml({ id: 'aurora', name: 'Aurora', tagline: 'x', icon: '', url: '' },
      '<span>tools</span>', { toolbar: { label: 'Bugs', count: 4 } }).includes('detail-back'));
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
