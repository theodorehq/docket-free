// Shared helpers for the Support Centre serverless functions.
// Zero npm dependencies: fetch + node:crypto/fs only.
// Underscore prefix keeps Vercel from exposing this file as an endpoint.

import { env } from '../lib/env.mjs';
// Both editions read data the same way, so this import must sit OUTSIDE the
// paid region above. Inside it, the free edition strips the import and keeps
// the call, which is a crash on the first submission rather than a missing
// feature. scripts/verify-editions.mjs is what catches that.
import { resolveForRead } from '../lib/data-root.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

import config from '../lib/config.mjs';

export const SITE_BASE = config.brand.siteUrl;

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export { products, productIds } from '../lib/products.mjs';
import { products, productIds } from '../lib/products.mjs';

export function productById(id) {
  return products.find((p) => p.id === id) || null;
}

export function isDryRun() {
  return env('SUPPORT_API_DRYRUN') === '1';
}

export function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}


// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

export function clientIp(req) {
  const h = req.headers || {};
  // Trust ONLY platform-set headers. `x-forwarded-for` is client-spoofable
  // (a request can prepend forged leftmost entries), so trusting its first
  // hop lets an attacker rotate the key and bypass rate limits. Vercel sets
  // `x-real-ip` / `x-vercel-forwarded-for` to the true client IP and strips
  // incoming copies. XFF is a dev/test fallback only, and there we take the
  // RIGHTMOST (closest, platform-appended) entry.
  const trusted = h['x-real-ip'] || h['x-vercel-forwarded-for'];
  if (trusted) return String(trusted).split(',')[0].trim();
  const xff = h['x-forwarded-for'];
  if (xff) {
    const parts = String(xff).split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.socket?.remoteAddress || 'unknown';
}

export async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return null; }
    }
    if (typeof req.body === 'object') return req.body;
  }
  // Fall back to reading the stream (local tests, raw Node servers). Reject
  // oversized bodies before buffering them all into memory (the platform caps
  // at a few MB; this is a tighter belt-and-braces guard for the raw path).
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 65536) return null;
      chunks.push(chunk);
    }
    if (!chunks.length) return null;
    return JSON.parse(Buffer.concat(chunks.map((c) => Buffer.isBuffer(c) ? c : Buffer.from(c))).toString('utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sanitising and validation
// ---------------------------------------------------------------------------

export const LIMITS = { title: 200, body: 5000, name: 80 };

// Single-line fields (title, author name, product). Strips HTML tags and ALL
// control characters including tabs and newlines (collapsed to spaces), then
// collapses whitespace runs, trims and caps. Removing newlines is a security
// control, not just tidiness: the author name is written into a
// "### <name> - <date>" reply header, so a newline could otherwise forge an
// extra (official-looking) reply, and a newline in a title would muddy commit
// messages and email subjects.
export function sanitize(input, max) {
  let s = String(input ?? '');
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (max) s = s.slice(0, max);
  return s;
}

// Multi-line fields (bug/feature descriptions, comment text). Keeps paragraph
// breaks but strips HTML tags and other control characters, normalises line
// endings, and NEUTRALISES any line the site would parse as reply structure.
// The build splits a body on "## Replies" and "### <Author> - <date>" headings,
// so raw user text could otherwise inject a forged, badged official
// official reply. Blunting every ATX heading marker (a hash run then a space at
// line start) removes both the replies delimiter and any reply header while
// leaving ordinary prose untouched.
export function sanitizeMultiline(input, max) {
  let s = String(input ?? '');
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  s = s.replace(/^[ \t]*#{1,6}[ \t]+/gm, '');
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  if (max) s = s.slice(0, max);
  return s;
}


// The build renders any reply whose author exactly matches the configured
// official author as an
// official, badged response. A user must never be able to claim that identity,
// so a submitted name that resolves to it (any casing/spacing) is dropped to
// "Anonymous". This is the last reply-forgery vector after heading and newline
// neutralisation.
const OFFICIAL_AUTHOR = config.brand.officialAuthor;
export function safeName(input) {
  const n = sanitize(input, LIMITS.name) || 'Anonymous';
  if (n.toLowerCase().replace(/\s+/g, ' ').trim() === OFFICIAL_AUTHOR.toLowerCase()) {
    return 'Anonymous';
  }
  return n;
}

export function validEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

export function validCountry(s) {
  return typeof s === 'string' && /^[A-Za-z]{2}$/.test(s);
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Keeping spam out
// ---------------------------------------------------------------------------
//
// There are three layers, and it is worth being straight about what each one
// actually does, because the honest answer shapes the design.
//
// 1. The honeypot, in submit.js. Catches bots that fill every field they find.
// 2. The origin check, below. Catches scripts that POST straight at the API
//    without ever loading the page.
// 3. The rate limit, below. Catches bursts.
//
// THE RATE LIMIT IS A SPEED BUMP, NOT A WALL, and it cannot be anything else
// here. Docket runs on serverless hosts, where your site is many short-lived
// copies rather than one server. A counter in one copy's memory is invisible
// to the others, so a determined attacker spreading requests across copies
// gets more through than the number below suggests.
//
// The fix for that is shared storage, and adding a database to hold a spam
// counter would cost more than the problem: it is the one thing Docket
// promises you do not need. So instead the DAMAGE is capped where it can be
// capped properly. The expensive part of spam is not the files, it is the AI
// replies, and that job runs once at a time with your repository as its
// memory, so it CAN count properly. See ai.maxRepliesPerDay in config.js.
//
// Cheap to hold off, capped where it costs money, honest about the middle.

/**
 * True when the request did not come from your own site.
 *
 * Browsers set Origin on cross-site POSTs and same-site ones alike, and a
 * page on your site always sends yours. A script written to hammer the API
 * usually sets nothing at all.
 *
 * Deliberately lenient in two ways. A missing origin is ALLOWED, because
 * some privacy tools strip it and refusing those people would be worse than
 * the spam. And it is skipped entirely when siteUrl is still the example
 * value, so a half-configured install does not silently reject everything
 * while somebody is testing it.
 */
export function wrongOrigin(req) {
  // Built as a list rather than calling the helper directly, because that
  // helper only exists in the paid editions and this function ships in both.
  const allowed = [];
  return originMismatch((req.headers || {})['origin'], SITE_BASE, allowed);
}


/** The comparison itself, separated so it can be tested against every shape
 *  of header without standing up a request.
 *
 *  NOTE for whoever builds the embeddable feedback widget: that widget posts
 *  from the customer's OWN site, so its origin will not match and this would
 *  refuse it. It will need an allowlist of permitted origins in config.js.
 *  Better to read this now than to debug it later. */
export function originMismatch(origin, siteUrl, allowed = []) {
  if (!siteUrl || /example\.com/.test(siteUrl)) return false;
  if (!origin) return false;
  try {
    const from = new URL(origin);
    if (from.host === new URL(siteUrl).host) return false;
    // A site the owner has explicitly allowed to embed the widget.
    return !allowed.includes(from.origin);
  } catch {
    return true; // not a URL at all
  }
}

// ---------------------------------------------------------------------------
// Rate limiter (in-memory, per warm function instance: see the note above)
// ---------------------------------------------------------------------------

const buckets = new Map();

export function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const kept = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (kept.length >= max) {
    buckets.set(key, kept);
    return true;
  }
  kept.push(now);
  buckets.set(key, kept);
  // Opportunistic prune so the map never grows unbounded.
  if (buckets.size > 5000) {
    for (const [k, arr] of buckets) {
      if (!arr.some((t) => now - t < windowMs)) buckets.delete(k);
    }
  }
  return false;
}

// Exposed for tests.
export function resetRateLimiter() {
  buckets.clear();
}

// ---------------------------------------------------------------------------
// GitHub Contents API (or local .dryrun/ mirror when SUPPORT_API_DRYRUN=1)
// ---------------------------------------------------------------------------

function ghEnv() {
  const token = env('GITHUB_TOKEN');
  const repo = env('GITHUB_REPO');
  const branch = env('GITHUB_BRANCH', 'main');
  if (!token || !repo) {
    const err = new Error('GITHUB_TOKEN and GITHUB_REPO must be set');
    err.status = 500;
    throw err;
  }
  return { token, repo, branch };
}

async function ghFetch(url, options = {}) {
  const { token } = ghEnv();
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'docket-support-centre',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`GitHub API ${res.status} for ${url}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/* Local mode: read and write the working tree directly instead of the
   GitHub Contents API. Used when a job runs inside GitHub Actions, where
   the repo is already checked out. One commit at the end
   beats one API call per file, and it needs no token. */
export function isLocalRepo() {
  return env('DOCKET_LOCAL_REPO') === '1';
}

function dryPath(repoPath) {
  return path.join(repoRoot, '.dryrun', repoPath);
}

/* Dry-run reads fall back to the working tree. An untouched template has no
   data/ yet, so data/... resolves against data.example/. lib/data-root.mjs
   owns exactly when that applies. This only ever affects local dry runs;
   live reads go to GitHub. */
function localPath(repoPath) {
  const direct = path.join(repoRoot, repoPath);
  if (fs.existsSync(direct)) return direct;
  return resolveForRead(repoPath, repoRoot);
}

// Returns { text, sha } or null if the file does not exist.
export async function readRepoFile(repoPath) {
  if (isLocalRepo()) {
    const p = localPath(repoPath);
    return fs.existsSync(p) ? { text: fs.readFileSync(p, 'utf8'), sha: 'local' } : null;
  }
  if (isDryRun()) {
    for (const p of [dryPath(repoPath), localPath(repoPath)]) {
      if (fs.existsSync(p)) return { text: fs.readFileSync(p, 'utf8'), sha: 'dryrun-sha' };
    }
    return null;
  }
  const { repo, branch } = ghEnv();
  try {
    const data = await ghFetch(
      `https://api.github.com/repos/${repo}/contents/${encodeURI(repoPath)}?ref=${encodeURIComponent(branch)}`
    );
    return { text: Buffer.from(data.content, 'base64').toString('utf8'), sha: data.sha };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// Creates or updates a file. Pass sha when updating an existing file.
export async function writeRepoFile(repoPath, text, message, sha) {
  if (isLocalRepo()) {
    // Written to the working tree; the workflow makes one commit at the end.
    // Always the direct path, never the data.example/ read fallback: writes
    // belong in the buyer's own data/, never in the shipped examples.
    const p = path.join(repoRoot, repoPath);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text, 'utf8');
    return { path: repoPath, sha: 'local' };
  }
  if (isDryRun()) {
    const p = dryPath(repoPath);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text, 'utf8');
    console.log(`[dryrun] commit "${message}" -> ${path.relative(repoRoot, p)}`);
    return { path: repoPath, sha: 'dryrun-sha' };
  }
  const { repo, branch } = ghEnv();
  const body = {
    message,
    content: Buffer.from(text, 'utf8').toString('base64'),
    branch,
    /* Commits must be attributed to a Vercel team member or the
       auto-deploy is refused ("not a member of the team"). */
    committer: { name: config.contact.commitAuthorName, email: config.contact.commitAuthorEmail },
    author: { name: config.contact.commitAuthorName, email: config.contact.commitAuthorEmail },
  };
  if (sha) body.sha = sha;
  const data = await ghFetch(`https://api.github.com/repos/${repo}/contents/${encodeURI(repoPath)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return { path: repoPath, sha: data.content?.sha };
}

// Returns an array of file names in a repo directory ([] if it does not exist).
export async function listRepoDir(repoPath) {
  if (isLocalRepo()) {
    const p = localPath(repoPath);
    return fs.existsSync(p) ? fs.readdirSync(p) : [];
  }
  if (isDryRun()) {
    const names = new Set();
    for (const p of [localPath(repoPath), dryPath(repoPath)]) {
      if (fs.existsSync(p)) for (const n of fs.readdirSync(p)) names.add(n);
    }
    return [...names];
  }
  const { repo, branch } = ghEnv();
  try {
    const data = await ghFetch(
      `https://api.github.com/repos/${repo}/contents/${encodeURI(repoPath)}?ref=${encodeURIComponent(branch)}`
    );
    return Array.isArray(data) ? data.map((entry) => entry.name) : [];
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
}

// Next sequential id for data/<product>/<folder>/ with ids <product>-<type>-NNNN.
export async function nextId(product, folder, type) {
  const names = await listRepoDir(`data/${product}/${folder}`);
  const re = new RegExp(`^${product}-${type}-(\\d{4,})\\.md$`);
  let max = 0;
  for (const name of names) {
    const m = name.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${product}-${type}-${String(max + 1).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// Frontmatter (round-trip safe: reads parse, updates are line-level edits)
// ---------------------------------------------------------------------------

// Parses the frontmatter block. Returns { fm, body } or null if malformed.
export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const lm = line.match(/^([A-Za-z][\w-]*):\s?(.*)$/);
    if (!lm) continue;
    let value = lm[2].trim();
    if (value.startsWith('"')) {
      try { value = JSON.parse(value); } catch { /* keep raw */ }
    } else if (/^-?\d+$/.test(value)) {
      value = parseInt(value, 10);
    } else if (value === 'true' || value === 'false') {
      value = value === 'true';
    }
    fm[lm[1]] = value;
  }
  return { fm, body: text.slice(m[0].length) };
}

// Sets (or inserts) a single frontmatter field without touching anything else.
export function setFrontmatterField(text, key, value) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error('No frontmatter block found');
  const block = m[1];
  const re = new RegExp(`^${key}:.*$`, 'm');
  const newBlock = re.test(block)
    ? block.replace(re, `${key}: ${value}`)
    : `${block}\n${key}: ${value}`;
  return `---\n${newBlock}\n---` + text.slice(m[0].length);
}

// YAML scalar for strings that may contain anything: JSON string quoting is
// valid YAML double-quote style, matching the importer's convention.
export function fmString(value) {
  return JSON.stringify(String(value ?? ''));
}

// Appends a reply block, adding the "## Replies" heading if absent.
export function appendReply(text, author, date, replyBody) {
  let t = text.replace(/\s*$/, '\n');
  if (!/^## Replies\s*$/m.test(t)) t += '\n## Replies\n';
  t += `\n### ${author} - ${date}\n\n${replyBody}\n`;
  return t;
}

// Every official reply in an item, oldest first, as
// { date, text }. The reply-notification robot counts these to decide what
// still needs emailing, so this is the single definition of "a reply" shared
// by the cron, the backfill and the manual fallback script.
export function officialReplies(text) {
  const src = String(text || '');
  const idx = src.search(/^## Replies\s*$/m);
  if (idx === -1) return [];
  const thread = src.slice(idx);
  const heads = [...thread.matchAll(/^### (.+?) - (\d{4}-\d{2}-\d{2})\s*$/gm)];
  const out = [];
  for (let i = 0; i < heads.length; i++) {
    if (heads[i][1].trim() !== OFFICIAL_AUTHOR) continue;
    const start = heads[i].index + heads[i][0].length;
    const end = i + 1 < heads.length ? heads[i + 1].index : thread.length;
    out.push({ date: heads[i][2], text: thread.slice(start, end).trim() });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Item lookup (id -> repo path)
// ---------------------------------------------------------------------------

// Parses "<product>-<bug|feature>-NNNN". Returns { product, type, folder } or null.
export function parseItemId(id) {
  const m = String(id ?? '').match(/^([a-z0-9]+)-(bug|feature)-(\d{4,})$/);
  if (!m) return null;
  if (!productIds.includes(m[1])) return null;
  return { product: m[1], type: m[2], folder: m[2] === 'bug' ? 'bugs' : 'features' };
}

// Finds the item file for an id, checking the folder encoded in the id first,
// then the sibling folder as a fallback. Returns { path, file } or null.
export async function findItemFile(id) {
  const parsed = parseItemId(id);
  if (!parsed) return null;
  const folders = parsed.folder === 'bugs' ? ['bugs', 'features'] : ['features', 'bugs'];
  for (const folder of folders) {
    const repoPath = `data/${parsed.product}/${folder}/${id}.md`;
    const file = await readRepoFile(repoPath);
    if (file) return { path: repoPath, file, ...parsed, folder };
  }
  return null;
}

export function itemUrl(product, folder, id) {
  return `${SITE_BASE}/${product}/${folder}/${id}/`;
}

