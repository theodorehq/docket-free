---
id: aurora-bug-0001
product: aurora
type: bug
title: Threads reorder while I'm reading one
status: completed
votes: 12
author: Priya
email: priya@example.com
created: 2026-06-14
updated: 2026-06-28
notifiedReplies: 2
---

If a new message lands while I have a thread open, the whole list jumps and I lose my place. Happens maybe once every ten minutes on a busy morning, which is exactly when I can least afford it.

Chrome on macOS, if that matters.

## Replies

### Example Co - 2026-06-14

Priya, thank you for flagging this. The list re-sorting under you while you're mid-read is not what should happen, and we can see why that would be maddening on a busy morning. We're looking into it and will post back here.

### Priya - 2026-06-20

Any news? Still happening today.

### Example Co - 2026-06-28

Fixed in 2.4.1, which is rolling out now. The list now holds its position while a thread is open and only reorders once you go back. Thanks for the nudge, Priya.
