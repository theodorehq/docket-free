---
id: aurora-bug-0002
product: aurora
type: bug
title: Search misses messages older than a year
status: in-progress
votes: 7
author: Marco
email: marco@example.com
created: 2026-07-30
updated: 2026-08-04
notifiedReplies: 1
---

Searching for anything from 2024 returns nothing, even when I know the message exists. Narrowing by sender doesn't help.

## Replies

### Example Co - 2026-07-30

Marco, thanks for reporting this. You're right that older messages aren't being returned, and that's a gap in how far back the index reaches rather than anything wrong with your search. We're working on it now and will update here.
