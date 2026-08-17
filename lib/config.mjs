/* ============================================================
   Config loader.

   Reads `config.js` if you have created it, otherwise falls back to
   `config.example.js` so a fresh clone builds without any setup.

   Both the static build and the API functions import from here, so
   there is exactly one place any studio-specific value can live.
   ============================================================ */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const userConfig = join(ROOT, "config.js");
const exampleConfig = join(ROOT, "config.example.js");

/* Fixtures mode: read the shipped example config, whatever the install has.

   This exists for one caller, scripts/test-api-local.mjs. That suite checks
   the ENGINE, so it asserts against the example board and the example
   address. Read through the normal rule it passed 207 of 207 on an untouched
   template and failed 7 the moment products.json existed, which is step 2 of
   SETUP.md. Every buyer would have run a documented command and been shown
   failures naming products they had never heard of.

   Guarded by BOTH flags on purpose. SUPPORT_API_DRYRUN already means "this
   process writes to .dryrun and sends nothing", so the pair can only be true
   inside the harness. A live site cannot serve example content by having one
   stray variable set, which is the failure this would otherwise invite. */
const FIXTURES = process.env.DOCKET_FIXTURES === "1"
  && process.env.SUPPORT_API_DRYRUN === "1";

const chosen = (!FIXTURES && existsSync(userConfig)) ? userConfig : exampleConfig;

/** True when running on the shipped example values rather than the
 *  buyer's own config. Setup uses this to tell them what is left to do. */
export const usingExampleConfig = chosen === exampleConfig;

const loaded = (await import(pathToFileURL(chosen).href)).default;

/* The example file is the defaults, and your config.js is layered over
   it, key by key, all the way down.

   THIS IS WHAT MAKES UPDATES SAFE, and it is worth being clear about
   why. config.js is yours: an update never rewrites it. So the moment a
   future version of Docket reads a config key that did not exist when
   you wrote yours, that key is missing from your file. Without a merge
   the site stops building, and it stops building for EVERY existing
   install at once, the instant they take the update. It would be the
   worst possible failure: caused by us, triggered by them accepting an
   improvement, and arriving in their inbox as "the update broke my
   site".

   Merging against the example removes that entire class of failure. A
   new key ships with a working default, your file keeps overriding only
   what you actually set, and old and new configs both work.

   It also means a config.js with only the two or three lines you care
   about is a perfectly valid config, which is a kinder starting point
   than a file you have to fill in completely before anything runs. */
const defaults = chosen === exampleConfig
  ? loaded
  : (await import(pathToFileURL(exampleConfig).href)).default;

function mergeDeep(base, over) {
  const out = { ...base };
  for (const [key, value] of Object.entries(over || {})) {
    // Arrays are replaced rather than merged: a list you have set is the
    // list you meant, not your list appended to ours.
    out[key] = isPlainObject(value) && isPlainObject(base?.[key])
      ? mergeDeep(base[key], value)
      : value;
  }
  return out;
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const merged = mergeDeep(defaults, loaded);

/* Normalise the few values everything else depends on, so no caller has
   to think about trailing slashes. */
const config = {
  ...merged,
  brand: {
    ...merged.brand,
    siteUrl: String(merged.brand?.siteUrl || "").replace(/\/+$/, ""),
    homeUrl: String(merged.brand?.homeUrl || "").replace(/\/+$/, ""),
  },
};

export default config;
