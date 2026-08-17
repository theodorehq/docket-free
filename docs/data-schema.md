# Data Schema

Every support item is one Markdown file with YAML frontmatter. The site is generated from these files at deploy time. Your coding agent operates the whole system by reading and editing these files.

## Layout

```
products.json                     # product registry - drives nav, boards, accents
data/
  <product>/
    bugs/<id>.md                  # bug reports
    features/<id>.md              # feature requests (roadmap stage lives here too)
    changelog/<version>.md        # one file per release
    testimonials/<id>.md          # held until approved
```

IDs: `<product>-<type>-<NNNN>` zero-padded, e.g. `aurora-bug-0003`. Filenames are the ID.

## Bug / feature request file

```markdown
---
id: aurora-bug-0003
product: aurora
type: bug            # bug | feature
title: Threads reorder while I am reading one
status: under-review # under-review | planned | in-progress | completed | declined
votes: 4
author: Ben
email: ben@example.com   # PRIVATE - never rendered to the site
created: 2026-07-02
updated: 2026-07-02
roadmap: none        # features only: none | consideration | planned | in-progress | shipped
pinned: false
notifiedReplies: 2   # official replies already emailed to the submitter - robot-maintained
source: userjot      # only on migrated items
sourceUrl: https://example.com/imported-item
---

Full description as written by the submitter.

## Replies

### Example Co - 2026-04-11

Official reply text. Rendered with the official badge.

### Ben - 2026-07-03

Follow-up from the submitter or other visitors.
```

Rules:
- `## Replies` heading separates the description from the thread; each `### <Author> - <YYYY-MM-DD>` starts a reply. An author matching `brand.officialAuthor` in config.js renders as the official reply.
- `email` is stored ENCRYPTED (`enc.v1.<base64url>`), never as a readable address, because git history is permanent. `EMAIL_ENCRYPTION_KEY` in the environment decrypts it when a reply needs sending. A value with no `enc.` prefix is read as-is, so an archive written before encryption keeps working. The build never renders it either; it exists only so the reply-notification robot can write to the submitter. This repo must stay PRIVATE. See LEGAL-CHECKLIST.md.
- `notifiedReplies` is how many official replies on this item have already been passed on to whoever raised it. Do not hand-edit it: raising it suppresses a message that should go out, lowering it re-sends one the customer already has.
- The public roadmap page is generated from `features/` files where `roadmap != none`, plus `changelog` for Shipped.

## Changelog file

```markdown
---
product: aurora
version: 1.0.38
date: 2026-06-20
title: Smoother Weather Switching
shipped: aurora-bug-0003, aurora-feature-0001   # optional: what this release closed
---

Release notes in your own voice. Markdown supported.
```

## FAQ file

`data/<product>/faq/<id>.md` - categorised questions with answers. The product FAQ page groups by `category`.

```markdown
---
id: aurora-faq-0001
product: aurora
category: Licensing        # Getting Started | Features | Licensing | Troubleshooting | Privacy
question: How many Macs can I use one licence on?
subtitle: One line shown under the question on the list.   # required - every FAQ has one
order: 1                   # ranges: Getting Started 1-19, Features 20-49, Licensing 50-59, Troubleshooting 60-89, Privacy 90-99
updated: 2026-07-02
---

The answer, in your own voice. Markdown supported.
```

MAINTENANCE RULE FOR CLAUDE: whenever a feature changes, a fix ships, or a changelog entry is written for a product, review that product's `faq/` folder in the same session - update any answer the change affects and add a new Q&A if users are likely to ask about it. This is part of the release checklist, not optional.

## Testimonial file

```markdown
---
id: aurora-testimonial-0001
product: aurora
stars: 5
author: Ben
email: ben@example.com   # PRIVATE
country: GB              # optional ISO code, submitter's choice; renders as a flag
created: 2026-07-02
approved: false          # only true renders on the site
---

The testimonial quote.
```

## Status meanings

| Status | Meaning |
|--------|---------|
| under-review | New, and waiting to be triaged |
| planned | Accepted; on the roadmap, not started yet |
| in-progress | Actively being worked on |
| completed | Fixed/shipped - closing reply explains what changed |
| declined | Not planned - reply explains why, kindly |

Roadmap stages (features): consideration -> planned -> in-progress -> shipped.
