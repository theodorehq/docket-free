// POST /api/vote - increments the vote count on a bug or feature request.
// Read-modify-write against the GitHub Contents API with one retry on a
// SHA conflict.
//
// An optional email can come with the vote, and is stored encrypted so the
// voter can be told when the thing they wanted actually ships. Voting stays
// entirely anonymous without one: the address is never required, never
// displayed, and never written in readable form.

import {
  clientIp,
  findItemFile,
  parseFrontmatter,
  rateLimited,
  wrongOrigin,
  readJsonBody,
  setFrontmatterField,
  validEmail,
  writeRepoFile,
} from './_lib.mjs';

const RATE_MAX = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const payload = await readJsonBody(req);
  if (!payload || typeof payload !== 'object' || typeof payload.id !== 'string') {
    return res.status(400).json({ ok: false, error: 'Expected {"id": "<item-id>"}' });
  }

  // Not from your site. Almost always a script, so say as little as
  // possible about why it was refused.
  if (wrongOrigin(req)) {
    return res.status(403).json({ ok: false, error: 'Request refused.' });
  }

  const ip = clientIp(req);
  if (rateLimited(`vote:${ip}`, RATE_MAX, RATE_WINDOW_MS)) {
    return res.status(429).json({ ok: false, error: 'Too many votes. Please try again in a few minutes.' });
  }

  try {
    // One retry on a SHA conflict (someone else voted between our read and write).
    for (let attempt = 0; attempt < 2; attempt++) {
      const found = await findItemFile(payload.id);
      if (!found) {
        return res.status(400).json({ ok: false, error: 'Item not found' });
      }

      const parsed = parseFrontmatter(found.file.text);
      const current = Number.isInteger(parsed?.fm?.votes) ? parsed.fm.votes : 0;
      const votes = current + 1;
      let text = setFrontmatterField(found.file.text, 'votes', votes);


      // Carry the title + product in the message, matching the other write
      // the daily digest can describe the upvote instead of a bare count.
      const label = parsed?.fm?.title ? `${parsed.fm.title} (${payload.id})` : payload.id;

      try {
        await writeRepoFile(found.path, text, `Upvote: ${label}`, found.file.sha);
        return res.status(200).json({ ok: true, votes });
      } catch (err) {
        const conflict = err.status === 409 || err.status === 412;
        if (!conflict || attempt === 1) throw err;
        // Loop once more: re-read for a fresh SHA and count.
      }
    }
  } catch (err) {
    console.error('vote error:', err);
    return res.status(502).json({ ok: false, error: 'Something went wrong recording your vote. Please try again shortly.' });
  }
}
