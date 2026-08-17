/* ============================================================
   Product registry loader.

   Reads `products.json` if you have created it, otherwise falls back to
   `products.example.json` so a fresh clone builds without any setup.
   ============================================================ */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const userRegistry = join(ROOT, "products.json");
const exampleRegistry = join(ROOT, "products.example.json");

const chosen = existsSync(userRegistry) ? userRegistry : exampleRegistry;

/** True when running on the shipped example registry. */
export const usingExampleRegistry = chosen === exampleRegistry;

/* products.json is YOURS: you write it by hand, so a typo in it is a
   normal event rather than an exceptional one. A raw stack trace about
   reading a property of undefined tells you nothing about what to fix,
   so every way this file can be wrong gets a sentence naming the file
   and the shape it expects. */
function loadRegistry(path) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(
      `${path} is not valid JSON, so Docket cannot read your products.\n` +
      `  ${err.message}\n` +
      `  A missing comma or a trailing one is the usual cause.`
    );
  }

  const list = parsed?.products;
  if (!Array.isArray(list)) {
    throw new Error(
      `${path} needs a "products" list at the top level, like this:\n` +
      `    { "products": [ { "id": "widget", "name": "Widget" } ] }\n` +
      `  ${Array.isArray(parsed) ? "Yours is a bare list, so it needs wrapping in { \"products\": ... }." : "Yours has no \"products\" key."}`
    );
  }

  const nameless = list.findIndex((p) => !p?.id);
  if (nameless >= 0) {
    throw new Error(
      `${path}: the product at position ${nameless + 1} has no "id".\n` +
      `  Every product needs a short lowercase id, which becomes its web address.`
    );
  }

  const ids = list.map((p) => p.id);
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate) {
    throw new Error(
      `${path}: two products share the id "${duplicate}".\n` +
      `  Ids become web addresses, so they have to be unique.`
    );
  }

  return list;
}

export const products = loadRegistry(chosen);
export const productIds = products.map((p) => p.id);
export default products;
