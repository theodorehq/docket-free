/* ============================================================
   The platform label: "macOS", "iOS", "Web", "Figma plugin".

   Optional, and free text, because the field belongs to the buyer. A
   studio might ship a Mac app, an iPhone app, a VS Code extension and a
   Figma plugin at once, and no fixed list I could write would survive
   contact with whatever somebody builds next. So anything they type is
   accepted and shown as typed.

   What this file adds on top is recognition. A handful of common
   platforms get a known shape, so a sidebar of four products can be
   scanned rather than read. Anything unrecognised still renders, just
   without the shape, which is the graceful half of the deal: an
   unfamiliar platform looks plain, never broken.
   ============================================================ */

/* Matched against the label lowercased, first hit wins, so the more
   specific patterns come first: "vs code extension" must not be caught by
   the bare "code", and "web app" must not be caught by "app". */
const KNOWN = [
  { re: /\b(mac ?os|macos|mac|osx|os x)\b/,            key: 'mac' },
  { re: /\b(ipad ?os|ipados|ios|iphone|ipad)\b/,       key: 'ios' },
  { re: /\b(watch ?os|watchos|tv ?os|tvos|vision ?os|visionos)\b/, key: 'apple' },
  { re: /\b(android|play store)\b/,                    key: 'android' },
  { re: /\b(windows|win32|pc)\b/,                      key: 'windows' },
  { re: /\b(linux|ubuntu|debian)\b/,                   key: 'linux' },
  { re: /\b(extension|add[- ]?on|plugin|addon)\b/,     key: 'plugin' },
  { re: /\b(cli|terminal|command[- ]line)\b/,          key: 'cli' },
  { re: /\b(api|sdk|library|package)\b/,               key: 'api' },
  { re: /\b(docs?|documentation|handbook)\b/,          key: 'docs' },
  { re: /\b(web|website|browser|saas|app)\b/,          key: 'web' },
];

/**
 * Normalises a registry `platform` value.
 *
 * @returns {{label: string, key: string} | null}
 *   null when there is nothing to show, so a caller can render no pill
 *   at all rather than an empty one.
 */
export function platformOf(product) {
  const raw = String(product?.platform ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return null;
  // Long values are somebody using the field as a second tagline. Show a
  // sensible amount rather than letting it push the product name around.
  const label = raw.length > 24 ? raw.slice(0, 23).trimEnd() + '…' : raw;
  const lower = raw.toLowerCase();
  const hit = KNOWN.find((k) => k.re.test(lower));
  return { label, key: hit ? hit.key : 'other' };
}
