/* ============================================================
   Who owns which file.

   THIS IS THE SINGLE MOST IMPORTANT RULE IN DOCKET.

   Updates are painless for exactly one reason: you and Docket never
   edit the same file. Get that right and an update is a REPLACEMENT,
   not a merge, and a replacement cannot conflict. It is the whole
   reason the update arrives as a pull request you can merge with one
   click rather than a git operation you have to think about.

   So this file is not a convenience list. It is the contract.

   DOCKET owns the engine: how the site is built, how the API works,
   how it looks. Every update overwrites these wholesale, without
   asking, because nothing of yours is in them.

   YOU own your content and your settings. Docket never writes to these
   after the first install, so an update can never touch your customer
   data, your configuration, your branding or your text.

   Anything not listed as yours is treated as Docket's, so a new engine
   file in a future version is handled correctly by an updater written
   today. That default is deliberate: the failure it causes is a
   surprising overwrite of a file you were told not to edit, which is
   recoverable, rather than an update that silently skips a file it
   needed to replace, which is not.

   IF YOU EDIT AN ENGINE FILE ANYWAY

   Your change is overwritten on the next update, silently. The updater
   checks for this and says so in the pull request rather than letting
   you find out afterwards. If you need the engine to behave
   differently, the honest answer is to say so on the Docket support
   board: the change then belongs to everyone and survives every
   update, which is a better outcome than a local patch you have to
   keep re-applying.
   ============================================================ */

/** Yours. Never written by an update. */
export const YOURS = [
  'config.js',          // your settings
  'products.json',      // your products
  'data/',              // your customers' submissions, and your replies
  'assets/',            // your icons and images
  '.env',               // your keys, which never leave your machine anyway
  'CNAME',              // your domain
];

/**
 * Docket's, but only created if missing rather than overwritten. These
 * are files you are expected to make your own after install: replacing
 * them would delete your work, and skipping them entirely would mean a
 * fresh install had none.
 */
export const SEEDED = [
  'README.md',
];

/**
 * Never part of an update in either direction. Build output and local
 * state: regenerated, not shipped.
 */
export const IGNORED = [
  '.git/',
  'node_modules/',
  'dist/',
  '.dryrun/',
  '.vercel/',
  '.netlify/',
  '.DS_Store',
];

/** True when a path is yours, and therefore never touched by an update. */
export function isYours(path) {
  return matchesAny(path, YOURS);
}

export function isSeeded(path) {
  return matchesAny(path, SEEDED);
}

export function isIgnored(path) {
  return matchesAny(path, IGNORED);
}

/** True when an update should replace this file outright. */
export function isEngine(path) {
  return !isYours(path) && !isSeeded(path) && !isIgnored(path);
}

/* A trailing slash means "this and everything under it". Without one the
   entry matches that exact path only, so `config.js` never accidentally
   claims `config.js.bak`. */
function matchesAny(path, list) {
  const p = String(path).replace(/^\.\//, '');
  return list.some((entry) =>
    entry.endsWith('/') ? p === entry.slice(0, -1) || p.startsWith(entry) : p === entry
  );
}
