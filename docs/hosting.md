# Hosting

Docket is a static site plus two small API endpoints. It runs on Vercel,
Netlify or Cloudflare Pages, and moving between them is a redeploy rather
than a rewrite.

**Docket needs its own subdomain**, for example `support.yourapp.com`. It
cannot run in a folder of an existing site: every internal link is
absolute from the domain root.

## What runs where

| | Where it runs | Why |
|---|---|---|
| The site | Your host, as static files | Built once per deploy by `scripts/build.mjs` |
| `/api/submit/` and `/api/vote/` | Your host, as small functions | They must respond to a visitor immediately |
instead, since it does not run on your host.

## Moving hosts later

Rebuild and repoint the DNS. Your content is Markdown in your repo and
never lived with the host, so there is nothing to export.
