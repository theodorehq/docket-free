# Docket

**Own Your Support Centre. Don't Rent It.**

A support centre, feedback board, roadmap, changelog, FAQ and
testimonials that lives as Markdown files in your own Git repository.
No database to run, patch or back up. Nothing to renew.

Your customers post bugs, request features and vote. You reply. Every
submission is a commit, so your whole support history is a folder of
text files you own, in a repository your coding agent already has open.

---

## Setting it up


Run this at any point:

```bash
npm run check
```

It says in plain English what is still missing. When it says everything
is set up, it is.


1. `cp config.example.js config.js` and put your details in it.
2. `cp products.example.json products.json` and list your products.
3. `cp .env.example .env`, then add a GitHub token with **Contents:
   Read and write** on this repository, and your repo as `owner/name`.
4. Deploy to Netlify, Cloudflare or Vercel, and set the same values in
   your host's settings. See [docs/hosting.md](docs/hosting.md).
5. `npm run check`.

There is no build step to install and nothing to `npm install`. Docket
has no dependencies. [INSTALL.md](INSTALL.md) walks through the same five
steps with the reasoning.

---

## Running it day to day

**To reply to someone**, open their file under `data/`, add your reply
under `## Replies`, and commit. That is the whole workflow.

**To add a product**, add an entry to `products.json`. There is no limit
on how many, on any tier.

**Your agent can run the board for you.** Triage what came in overnight,
draft replies, write a changelog entry when you ship. It is all files in
a repository, which is what makes that possible at all.

---

## Which files are yours

This is the most important thing to know, because it is what makes
updates painless.

| Yours | Docket's |
|---|---|
| `config.js` | `config.example.js` |
| `products.json` | `products.example.json` |
| `data/` | `scripts/`, `api/`, `lib/`, `site/` |
| `assets/`, `.env` | everything else |

**Docket never writes to anything in the left column.** Updates replace
the right column wholesale, which is only safe because nothing of yours
is in there.

If you edit a file on the right, your change is overwritten the next
time you update. If you need Docket itself to behave differently, say so
on the support board: the change then belongs to everyone and survives
every update.

Full detail in [lib/ownership.mjs](lib/ownership.mjs).


---

## Documentation

| File | What it covers |
|---|---|
| [docs/hosting.md](docs/hosting.md) | Netlify, Cloudflare and Vercel, and moving between them |
| [docs/data-schema.md](docs/data-schema.md) | What a submission file looks like |
| [docs/api.md](docs/api.md) | The two endpoints, and every setting |
| [LEGAL-CHECKLIST.md](LEGAL-CHECKLIST.md) | What running a public board commits you to |

Docket ships no legal templates. The checklist tells you what to cover.

---

## Getting help

Post on the Docket support board, which runs on Docket. If something is
wrong, that is where it gets fixed for everybody.
