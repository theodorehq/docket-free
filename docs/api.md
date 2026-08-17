# The Docket API

Two serverless functions (Node runtime, plain ESM, zero npm dependencies). They are the only dynamic parts of the site: every write becomes a commit to your repo via the GitHub Contents API, and your host's auto-deploy republishes the static site about a minute later.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/submit` | POST | New bug report / feature request, comment on an item, or testimonial |
| `/api/vote` | POST | Upvote a bug or feature request |

Both accept JSON, respond with JSON, and return `405` for anything that is not a POST. There are no CORS headers: the API is same-origin only, called from the site's own pages.

Both run unchanged on Vercel, Netlify and Cloudflare. See [hosting.md](hosting.md).

## POST /api/submit

Shared behaviour:

- **Honeypot:** the hidden `website` field must be empty. If a bot fills it, the API returns `{ "ok": true }` and writes nothing.
- **Origin check:** a POST whose `Origin` header names a different host than `brand.siteUrl` gets a `403`. A missing header is allowed, because some privacy tools strip it. Skipped while `siteUrl` is still the example value.
- **Rate limit:** 5 submissions per IP per 10 minutes, then `429`. In-memory per warm instance, so it is a speed bump rather than a wall. See Notes and limits.
- **Sanitising:** HTML tags stripped from all inputs; caps of 200 (title), 5000 (body), 80 (name).
- **Notifications** (after a successful commit; failures never fail the request): an instant branded receipt email to the submitter if they left an email (see "Submitter email flow" below), and the full submission JSON POSTed to `N8N_WEBHOOK_URL` (skipped silently if unset).
- **Response:** `{ "ok": true, "id": "<item-id>", "url": "<page it will appear at>" }`.

### Submitter email flow

A submitter who leaves an email address hears from us up to three times, in order:


### kind: "post" - new bug or feature request

```json
{
  "kind": "post",
  "product": "aurora",
  "type": "bug",
  "title": "Threads reorder while I am reading one",
  "body": "Steps to reproduce...",
  "name": "Ben",
  "email": "ben@example.com",
  "website": ""
}
```

`product` must exist in `products.json`; `type` is `bug` or `feature`; `email` is optional (kept private in frontmatter, used only for reply notifications). Creates `data/<product>/<bugs|features>/<product>-<type>-NNNN.md` with `status: under-review`, `votes: 0`, and `roadmap: none` on features. Commit message: `New bug report: <title> (<product>)`.

It also stamps a `submittedAt: <ISO>` frontmatter line (exact submission time, e.g. `2026-07-03T08:30:00.000Z`). `created` is only a date, so anything that needs an item's age in minutes reads this instead. The build never renders it, and items written before the field existed simply have none, which every reader treats as "unknown" rather than an error.

```bash
curl -X POST https://support.example.com/api/submit \
  -H "Content-Type: application/json" \
  -d '{"kind":"post","product":"aurora","type":"bug","title":"Threads reorder while I am reading one","body":"Close the lid, wait, reopen. The icon is gone.","name":"Ben","email":"ben@example.com","website":""}'
```

### kind: "comment" - reply on an existing item

```json
{
  "kind": "comment",
  "itemId": "aurora-feature-0001",
  "body": "Same here, remapping fixed it.",
  "name": "Carl",
  "email": "carl@example.com",
  "website": ""
}
```

Appends a `### <Name> - <date>` block under `## Replies` (adding the heading if the item has no replies yet) and bumps `updated:`.

```bash
curl -X POST https://support.example.com/api/submit \
  -H "Content-Type: application/json" \
  -d '{"kind":"comment","itemId":"aurora-feature-0001","body":"Same here, remapping fixed it.","name":"Carl","website":""}'
```

### kind: "testimonial"

```json
{
  "kind": "testimonial",
  "product": "aurora",
  "stars": 5,
  "body": "Worth every penny.",
  "name": "Happy Customer",
  "email": "happy@example.com",
  "country": "GB",
  "website": ""
}
```

`stars` is an integer 1-5; `country` is an optional ISO-2 code. Creates `data/<product>/testimonials/<product>-testimonial-NNNN.md` with `approved: false` (held until approved, so the returned `url` is the testimonials section it will appear in).

```bash
curl -X POST https://support.example.com/api/submit \
  -H "Content-Type: application/json" \
  -d '{"kind":"testimonial","product":"aurora","stars":5,"body":"Worth every penny.","name":"Happy Customer","country":"GB","website":""}'
```

## POST /api/vote

```json
{ "id": "aurora-feature-0001" }
```

Increments `votes:` in the item's frontmatter (read-modify-write with the file SHA, one retry on a 409/412 conflict). Rate limit: 20 votes per IP per 10 minutes. No notifications. Commit message: `Upvote: <id>`.

Response: `{ "ok": true, "votes": 5 }`.

```bash
curl -X POST https://support.example.com/api/vote \
  -H "Content-Type: application/json" \
  -d '{"id":"aurora-feature-0001"}'
```


## Environment variables

Where these go depends on your host. See [hosting.md](hosting.md).

| Variable | Required | Purpose |
|----------|----------|---------|
| `GITHUB_TOKEN` | Yes | Fine-grained personal access token used to read and commit data files |
| `GITHUB_REPO` | Yes | `owner/name` of this repo, e.g. `acme/support` |
| `GITHUB_BRANCH` | No | Branch to commit to (default `main`) |
| `EMAIL_ENCRYPTION_KEY` | Strongly recommended | Encrypts submitter addresses before they are written to your repo. Without it no address is stored at all. See [email-crypto](../lib/email-crypto.mjs) |

Set them in your host's dashboard for the site, and in the repository's Actions
secrets for anything that runs on a schedule.

### GitHub token scopes

Create a **fine-grained** personal access token at github.com -> Settings -> Developer settings -> Fine-grained tokens:

- **Repository access:** Only select repositories -> this repo only.
- **Permissions:** Contents -> **Read and write**. Nothing else.
- Set a sensible expiry and put a renewal reminder in the calendar; when it expires the submit and vote functions start returning errors.

## Local testing

```bash
node scripts/test-api-local.mjs
```

Sets `SUPPORT_API_DRYRUN=1`, which makes the shared library write to a local `.dryrun/` directory instead of GitHub and print emails/webhooks instead of sending them. Covers all four submit kinds, voting, the honeypot, rate limits, sanitising, a comment append round-trip, email encryption, the platform adapters, and the email builders.


## Notes and limits

- **Spam has three layers, and they are not equally strong.** The honeypot and
  the origin check are cheap and catch most of it. The rate limit is in-memory,
  so it resets when an instance is recycled and is per-instance under load: a
  speed bump, not a wall. It cannot be more than that without shared storage,
  and a database purely to hold a spam counter would cost more than the problem.
- **What IS a wall is `ai.maxRepliesPerDay`.** Spam files are free; spam replies
  are not, so the damage is capped where it costs money. That job runs one at a
  time with your repository as its memory, so it counts properly. Anything held
  back is answered the next day rather than dropped.
- Each successful write triggers a deploy. That is by design (the site is static), and well within every host's free-tier limits at support-site volume.
- Submissions appear on the site after the auto-deploy finishes, typically about a minute.
