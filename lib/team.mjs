/* ============================================================
   Who counts as "us" when a reply is posted.

   Every reply in a data file is a Markdown heading, `### <name> - <date>`,
   and the board decides whether to badge it as official by comparing that
   name. This file owns that comparison, so that every part of Docket which
   has to ask "is this reply ours?" gets the same answer.

   That matters more than it looks. Anything automatic which reads a reply
   thread has to know whether the thread has already been answered, and a
   reply it fails to recognise as ours reads as an unanswered item. One
   comparison, in one place, is what stops those two views disagreeing.
   ============================================================ */

import config from './config.mjs';

/* The company name is always official. It is what the robot signs, and on
   a one-person install it is the only name that ever appears. */
const base = () => String(config.brand.officialAuthor || '').trim();

let extra = [];

/** Every name whose replies are ours. The company first, then any people. */
export function officialAuthors() {
  const all = [base(), ...extra].filter(Boolean);
  return [...new Set(all)];
}

/** True when a reply by this name should be badged as official. */
export function isOfficialAuthor(name) {
  const n = String(name || '').trim();
  return officialAuthors().some((a) => a === n);
}

/**
 * The alternation for a `### <name> - ` heading, escaped for a RegExp.
 *
 * Longest first, so that a company name which is a prefix of a person's
 * name cannot match and stop early.
 */
export function officialAuthorPattern() {
  return officialAuthors()
    .sort((a, b) => b.length - a.length)
    .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
}

/** People only, without the company name. Empty unless any are set. */
export function teamMembers() {
  return [...extra];
}

/** True when this name is an individual rather than the company itself. */
export function isTeamMember(name) {
  const n = String(name || '').trim();
  return extra.some((m) => m === n);
}
