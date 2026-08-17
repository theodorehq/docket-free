/* ============================================================
   Which folder holds the content: yours, or the examples.

   WHY THIS IS ITS OWN FILE

   Docket ships with `data.example/`, a small demo board, so that a fresh
   clone builds into something real before anybody has configured
   anything. That is worth having: an empty first build looks broken even
   when it is correct.

   The rule for when to use it looked obvious enough that four different
   files each worked it out for themselves, and all four got it wrong in
   the same way. They read: "use data/ if it exists, otherwise use the
   examples." Which means the moment a buyer follows SETUP.md, writes
   their own products.json and has not yet received a single submission,
   the build loads a stranger's demo content, checks it against their
   product list, finds nothing matches, and refuses to build. Their very
   first build fails, with nineteen errors about a product they have
   never heard of.

   The missing half of the rule is that `data.example/` belongs to the
   UNTOUCHED template. Once somebody has written their own products.json,
   an absent `data/` no longer means "not set up yet". It means an empty
   board, which is exactly what a new customer should see on day one.

   So the rule lives here, once, and everything asks.
   ============================================================ */

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Where content is read from.
 *
 * @param {string} [root] the install directory, for tests
 * @returns {{ dir: string, name: string, isExample: boolean }}
 */
export function dataRoot(root = ROOT) {
  /* Fixtures mode, for scripts/test-api-local.mjs only. See the same pair of
     flags in lib/config.mjs for why both are required: the engine suite has
     to read the example board on an install that has its own, and a live site
     must not be able to do the same by accident. */
  if (process.env.DOCKET_FIXTURES === '1'
    && process.env.SUPPORT_API_DRYRUN === '1'
    && existsSync(join(root, 'data.example'))) {
    return { dir: join(root, 'data.example'), name: 'data.example', isExample: true };
  }
  if (existsSync(join(root, 'data'))) {
    return { dir: join(root, 'data'), name: 'data', isExample: false };
  }
  // No data yet. Only fall back to the demo while this is still the
  // untouched template; once products.json exists the board is theirs
  // and an empty one is the correct answer.
  if (!existsSync(join(root, 'products.json')) && existsSync(join(root, 'data.example'))) {
    return { dir: join(root, 'data.example'), name: 'data.example', isExample: true };
  }
  return { dir: join(root, 'data'), name: 'data', isExample: false };
}

/**
 * Turns a repository path like `data/acme/bugs/x.md` into the file to
 * actually read, which is the same path under `data.example/` while the
 * template is untouched. Writes never use this: they always go to
 * `data/`, so the examples are never edited in place.
 */
export function resolveForRead(repoPath, root = ROOT) {
  const src = dataRoot(root);
  if (src.isExample && repoPath.startsWith('data/')) {
    return join(src.dir, repoPath.slice('data/'.length));
  }
  return join(root, repoPath);
}
