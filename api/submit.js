// POST /api/submit - creates bug reports, feature requests, comments and
// testimonials by committing Markdown files to the private GitHub repo.
// Vercel auto-deploys on commit, so the site updates itself.

import {
  LIMITS,
  appendReply,
  clientIp,
  findItemFile,
  fmString,
  itemUrl,
  nextId,
  parseFrontmatter,
  productById,
  productIds,
  rateLimited,
  wrongOrigin,
  readJsonBody,
  sanitize,
  sanitizeMultiline,
  safeName,
  setFrontmatterField,
  todayUTC,
  validCountry,
  validEmail,
  writeRepoFile,
  SITE_BASE,
} from './_lib.mjs';
import { encryptEmail } from '../lib/email-crypto.mjs';

const RATE_MAX = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function bad(res, message) {
  return res.status(400).json({ ok: false, error: message });
}

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const payload = await readJsonBody(req);
  if (!payload || typeof payload !== 'object') {
    return bad(res, 'Invalid JSON body');
  }

  // Honeypot: bots fill the hidden "website" field. Pretend success so they
  // learn nothing, and write nothing.
  if (typeof payload.website === 'string' && payload.website.trim() !== '') {
    return res.status(200).json({ ok: true });
  }

  // Not from your site. Almost always a script, so say as little as
  // possible about why it was refused.
  if (wrongOrigin(req)) {
    return res.status(403).json({ ok: false, error: 'Request refused.' });
  }

  const ip = clientIp(req);
  if (rateLimited(`submit:${ip}`, RATE_MAX, RATE_WINDOW_MS)) {
    return res.status(429).json({ ok: false, error: 'Too many submissions. Please try again in a few minutes.' });
  }

  try {
    switch (payload.kind) {
      case 'post':
        return await handlePost(payload, res);
      case 'comment':
        return await handleComment(payload, res);
      case 'testimonial':
        return await handleTestimonial(payload, res);
      default:
        return bad(res, 'Unknown kind. Expected "post", "comment" or "testimonial".');
    }
  } catch (err) {
    console.error('submit error:', err);
    return res.status(502).json({ ok: false, error: 'Something went wrong saving your submission. Please try again shortly.' });
  }
}

// --- kind: "post" (new bug report or feature request) -----------------------

async function handlePost(payload, res) {
  const product = sanitize(payload.product, 40).toLowerCase();
  const type = payload.type === 'bug' ? 'bug' : payload.type === 'feature' ? 'feature' : null;
  const title = sanitize(payload.title, LIMITS.title);
  const body = sanitizeMultiline(payload.body, LIMITS.body);
  const name = safeName(payload.name);
  const email = validEmail(payload.email) ? payload.email.trim() : '';

  if (!productIds.includes(product)) return bad(res, 'Unknown product');
  if (!type) return bad(res, 'type must be "bug" or "feature"');
  if (!title) return bad(res, 'Please add a title');
  if (!body) return bad(res, 'Please add a description');

  const folder = type === 'bug' ? 'bugs' : 'features';
  const today = todayUTC();

  // Create the file; on the rare id collision (concurrent submits), retry once
  // with a freshly computed id.
  let id;
  let written = false;
  for (let attempt = 0; attempt < 2 && !written; attempt++) {
    id = await nextId(product, folder, type);
    const lines = [
      '---',
      `id: ${id}`,
      `product: ${product}`,
      `type: ${type}`,
      `title: ${fmString(title)}`,
      'status: under-review',
      'votes: 0',
      `author: ${fmString(name)}`,
      `email: ${fmString(encryptEmail(email))}`,
      `created: ${today}`,
      `updated: ${today}`,
      // Exact submission time, to the second. `created` is only a date, and
      // anything that needs to know how old an item is needs better than
      // that. Plain unquoted ISO string; both frontmatter parsers read it
      // back as a raw string and the build never renders it. Items written
      // before this field existed simply have no submittedAt, and every
      // reader treats a missing value as "unknown" rather than failing.
      `submittedAt: ${new Date().toISOString()}`,
      // How many official replies on this item have already been sent on to
      // the person who raised it. Starts at 0, so the first reply always
      // counts as new. Part of the stored schema in every edition, so that
      // an item written today stays correct if the site gains the ability
      // to send those on later.
      'notifiedReplies: 0',
      ...(type === 'feature' ? ['roadmap: none'] : []),
      'pinned: false',
      '---',
      '',
      body,
      '',
    ];
    const label = type === 'bug' ? 'bug report' : 'feature request';
    try {
      await writeRepoFile(`data/${product}/${folder}/${id}.md`, lines.join('\n'), `New ${label}: ${title} (${id})`);
      written = true;
    } catch (err) {
      // 422 = file already exists (someone grabbed this id in parallel)
      if (err.status !== 422 || attempt === 1) throw err;
    }
  }

  const url = itemUrl(product, folder, id);

  return res.status(200).json({ ok: true, id, url });
}

// --- kind: "comment" (reply on an existing bug/feature) ---------------------

async function handleComment(payload, res) {
  const body = sanitizeMultiline(payload.body, LIMITS.body);
  const name = safeName(payload.name);
  const email = validEmail(payload.email) ? payload.email.trim() : '';

  if (!body) return bad(res, 'Please write a comment');

  const found = await findItemFile(payload.itemId);
  if (!found) return bad(res, 'Item not found');

  const { path: repoPath, file, product, folder } = found;
  const id = sanitize(payload.itemId, 80);
  const today = todayUTC();

  let text = appendReply(file.text, name, today, body);
  text = setFrontmatterField(text, 'updated', today);

  const parsed = parseFrontmatter(file.text);
  const title = parsed?.fm?.title || id;

  await writeRepoFile(repoPath, text, `New comment: ${title} (${id})`, file.sha);

  const url = itemUrl(product, folder, id);

  return res.status(200).json({ ok: true, id, url });
}

// --- kind: "testimonial" ----------------------------------------------------

async function handleTestimonial(payload, res) {
  const product = sanitize(payload.product, 40).toLowerCase();
  const body = sanitizeMultiline(payload.body, LIMITS.body);
  const name = safeName(payload.name);
  const email = validEmail(payload.email) ? payload.email.trim() : '';
  const stars = Number.parseInt(payload.stars, 10);
  const country = validCountry(payload.country) ? payload.country.toUpperCase() : '';

  if (!productIds.includes(product)) return bad(res, 'Unknown product');
  if (!body) return bad(res, 'Please write a few words');
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return bad(res, 'stars must be 1 to 5');

  const today = todayUTC();
  let id;
  let written = false;
  for (let attempt = 0; attempt < 2 && !written; attempt++) {
    id = await nextId(product, 'testimonials', 'testimonial');
    const lines = [
      '---',
      `id: ${id}`,
      `product: ${product}`,
      `stars: ${stars}`,
      `author: ${fmString(name)}`,
      `email: ${fmString(encryptEmail(email))}`,
      ...(country ? [`country: ${country}`] : []),
      `created: ${today}`,
      'approved: false',
      '---',
      '',
      body,
      '',
    ];
    try {
      await writeRepoFile(`data/${product}/testimonials/${id}.md`, lines.join('\n'), `New testimonial: ${name} (${id})`);
      written = true;
    } catch (err) {
      if (err.status !== 422 || attempt === 1) throw err;
    }
  }

  // Testimonials are held until approved; the URL is the section it will
  // appear in once published.
  const url = `${SITE_BASE}/${product}/testimonials/`;

  return res.status(200).json({ ok: true, id, url });
}

