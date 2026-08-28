# Docket releases

## 1.0.5 - 2026-08-28

Improved reliability of the digest job, which now runs cleanly on every schedule.

## 1.0.4 - 2026-08-28

Every AI and email provider now reaches the jobs that use them, so Grok, OpenRouter, DeepSeek, Postmark, SendGrid, Brevo and Mailgun all write and send as configured. A workflow you delete stays deleted, and docs/workflows.md explains the four scheduled jobs and how to change them.

## 1.0.3 - 2026-08-27

Five AI providers to choose from: Anthropic, OpenAI, Grok, OpenRouter and
DeepSeek, set in config.js. Brevo joins Resend, Postmark, SendGrid and
Mailgun for email. Deno Deploy joins Vercel, Netlify and Cloudflare as a
place to host, serving your site and its two endpoints from one entry
point.

On a phone, every section is now one tap away in a row above the board
rather than two through the drawer, and the status filter softens its
edge to show which way it scrolls.

Setup now offers the three ways your customers reach you from your own
site: the feedback widget, the quick menu and the callout card, with the
one setting the widget needs to accept a post.

## 1.0.2 - 2026-08-18

Choose your email provider: Resend, Postmark, SendGrid or Mailgun, set in config.js. And a new digest, off by default, that sends one email describing what happened on your board instead of one per event, daily or hourly in your own timezone.

## 1.0.1 - 2026-08-17

Ambient frame tint now adapts to your accent colour, so a vivid brand colour sits as calmly as a muted one. The engine test suite reads its own example board rather than your settings, so it gives the same answer on every install. Clearer setup and update instructions.

## 1.0.0 - 2026-08-17

The first release.

