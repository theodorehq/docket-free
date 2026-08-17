/* ============================================================
   Which edition of Docket this copy is.

   Set to "free", "pro" or "studio" by scripts/strip.mjs when that
   edition is generated. Nothing else ever writes it. In this repository,
   which is nobody's install, it reads "paid".

   WHAT THIS FLAG DOES, AND WHAT IT DELIBERATELY DOES NOT

   Two things, and this is the whole list:

     1. Cosmetics: the "Powered by Docket" badge, and the brand accent
        colour.
     2. Which release feed the updater reads, since Pro and Studio are
        published separately and each must take its own tier's source.

   It is NOT what gates the paid features. Those are physically absent
   from the free repo, deleted file by file before it is published, and
   a release gate fails the build if a trace of one survives. So editing
   this line in a free copy turns the badge off and gains nothing else,
   which is the point: a licence check that can be defeated by editing
   one line is worse than no check, because it invites the attempt and
   then loses. Docket does not ship one.

   Nor does (2) become one by accident. Pointing a Pro install at the
   Studio feed does not hand anyone Studio: that source lives in a
   private repository, and the download needs a credential only a Studio
   customer has. The flag chooses an address, not an entitlement.

   The badge is the honour-system part, and it stays that way on
   purpose. Anyone who removes it was never going to pay.
   ============================================================ */

export const EDITION = 'free';

/* The middle edition is `pro`, renamed from `solo` on 2026-08-14 because
   "Solo" described a headcount the licence does not restrict. The id moved
   with the label rather than lagging behind it, which was only possible
   because nothing had shipped: no buyer, no published feed, no tag.

   `paid` remains an alias for it in strip.mjs, because the marker token
   used throughout the source means "not free" rather than "pro". Those are
   different ideas and only one of them was renamed.

   Do not write that token literally in a comment. This one did, and
   strip.mjs read it as a real opening marker with no matching close, which
   broke the generation of all three editions until it was taken out. */

/** True in the paid editions (Pro and Studio). */
export const isPaid = EDITION !== 'free';

/** The free edition shows a small badge in the footer. */
export const showsBadge = !isPaid;
